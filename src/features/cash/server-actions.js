'use server';

/**
 * Module 06 — Cash Bag & Cash Ledger Server Actions & Business Logic
 *
 * Implements:
 * 1. Line-isolated Cash Bags and Central Vault.
 * 2. Immutable, append-only cash ledger with strictly derived balances (sum(IN) - sum(OUT)).
 * 3. Daily opening balances before collection trips.
 * 4. Atomic cash collection and payment reversal integration.
 * 5. Inter-Line transfers posting paired TRANSFER_OUT and TRANSFER_IN entries in one transaction.
 * 6. Field expense recording, approval workflows, and self-approval flagging.
 * 7. Optional collector-to-cashier cash handovers with carry-forward support.
 * 8. Physical cash reconciliation with strict audit, mandatory explanation, and approval policy.
 */
import prisma from '../../lib/prisma.js';
import { paiseToRupees, rupeesToPaise } from '../../lib/money/index.js';
import { requirePermission, isScopeAllowed } from '../../lib/permissions/index.js';
import { writeAudit } from '../../lib/audit/index.js';

const TX_OPTIONS = { maxWait: 15000, timeout: 45000 };

function safeRevalidate(path) {
  try {
    // Dynamic import to avoid next/cache failure in pure CLI tests
    import('next/cache').then(({ revalidatePath }) => revalidatePath(path)).catch(() => {});
  } catch (err) {
    // Graceful no-op in test/CLI environments
  }
}

async function getAuthSession() {
  const { requireAuth } = await import('../../lib/auth/index.js');
  const { profile, user } = await requireAuth();
  return { profile, user };
}

// ============================================================================
// 1. BALANCE DERIVATION & LEDGER HELPERS
// ============================================================================

/**
 * Derives the authoritative physical cash balance for a CashBag by summing
 * all immutable ledger entries (IN - OUT). Cached balance is never authoritative.
 */
export async function deriveCashBagBalance(cashBagId, tx = prisma) {
  const [inAgg, outAgg] = await Promise.all([
    tx.cashLedgerEntry.aggregate({
      where: { cashBagId, direction: 'IN' },
      _sum: { amountPaise: true },
    }),
    tx.cashLedgerEntry.aggregate({
      where: { cashBagId, direction: 'OUT' },
      _sum: { amountPaise: true },
    }),
  ]);

  const totalIn = inAgg._sum.amountPaise || 0;
  const totalOut = outAgg._sum.amountPaise || 0;
  return totalIn - totalOut;
}

/**
 * Finds or automatically provisions the dedicated CashBag for a given Line.
 */
export async function getOrCreateLineCashBag(lineId, tx = prisma) {
  if (!lineId) {
    return getOrCreateVaultCashBag(tx);
  }

  let bag = await tx.cashBag.findUnique({
    where: { lineId },
    include: { line: true },
  });

  if (!bag) {
    const line = await tx.line.findUnique({ where: { id: lineId } });
    if (!line) {
      return getOrCreateVaultCashBag(tx);
    }

    bag = await tx.cashBag.create({
      data: {
        name: `${line.name} Cash Bag`,
        code: `CB-${line.code}`,
        lineId: line.id,
        description: `Dedicated field collection cash bag for Line ${line.name} (${line.code})`,
      },
      include: { line: true },
    });
  }

  return bag;
}

/**
 * Finds or provisions the Main Office Vault CashBag.
 */
export async function getOrCreateVaultCashBag(tx = prisma) {
  let vault = await tx.cashBag.findUnique({
    where: { code: 'VAULT-MAIN' },
    include: { line: true },
  });

  if (!vault) {
    vault = await tx.cashBag.create({
      data: {
        name: 'Main Office Vault',
        code: 'VAULT-MAIN',
        lineId: null,
        description: 'Central branch office cash vault for disbursements, handovers, and banking.',
      },
      include: { line: true },
    });
  }

  return vault;
}

/**
 * Core append-only ledger entry creator. Computes balanceAfterPaise snapshot
 * based on previous derived balance and appends the entry.
 */
export async function appendLedgerEntry(tx, data, actorId) {
  if (!data.amountPaise || data.amountPaise <= 0) {
    throw new Error('Ledger entry amount must be strictly greater than zero paise');
  }

  const currentBalance = await deriveCashBagBalance(data.cashBagId, tx);
  const balanceAfterPaise =
    data.direction === 'IN'
      ? currentBalance + data.amountPaise
      : currentBalance - data.amountPaise;

  const entry = await tx.cashLedgerEntry.create({
    data: {
      cashBagId: data.cashBagId,
      entryType: data.entryType,
      direction: data.direction,
      amountPaise: data.amountPaise,
      balanceAfterPaise,
      actorId,
      notes: data.notes || null,
      paymentId: data.paymentId || null,
      disbursementId: data.disbursementId || null,
      expenseId: data.expenseId || null,
      transferId: data.transferId || null,
      handoverId: data.handoverId || null,
      reconciliationId: data.reconciliationId || null,
    },
  });

  return entry;
}

/**
 * Synchronous atomic posting of CASH repayments to the Line Cash Bag ledger.
 * UPI / Bank Transfer payments bypass this completely.
 */
export async function postCashCollectionEntry(tx, payment, actorId) {
  if (payment.mode !== 'CASH') {
    return null; // UPI and Bank transfers do not alter physical Cash Bag
  }

  const bag = await getOrCreateLineCashBag(payment.lineId, tx);

  return appendLedgerEntry(
    tx,
    {
      cashBagId: bag.id,
      entryType: 'COLLECTION',
      direction: 'IN',
      amountPaise: payment.amountPaise,
      paymentId: payment.id,
      notes: `Cash collection: Payment ${payment.paymentNumber}`,
    },
    actorId
  );
}

/**
 * Compensating atomic posting when a CASH repayment is reversed.
 * Appends REVERSAL entry (OUT) without deleting original COLLECTION entry.
 */
export async function postCashReversalEntry(tx, payment, reversalReason, actorId) {
  if (payment.mode !== 'CASH') {
    return null;
  }

  // Find original collection entry to locate bag
  const originalEntry = await tx.cashLedgerEntry.findUnique({
    where: { paymentId: payment.id },
  });

  const bagId = originalEntry
    ? originalEntry.cashBagId
    : (await getOrCreateLineCashBag(payment.lineId, tx)).id;

  return appendLedgerEntry(
    tx,
    {
      cashBagId: bagId,
      entryType: 'REVERSAL',
      direction: 'OUT',
      amountPaise: payment.amountPaise,
      notes: `Reversal of Payment ${payment.paymentNumber}: ${reversalReason}`,
    },
    actorId
  );
}

// ============================================================================
// 2. QUERY ACTIONS
// ============================================================================

/**
 * List all Cash Bags with live derived balances, today's movements, and pending items.
 */
export async function getCashBagsList(actorContext = null) {
  let profile = actorContext?.profile;
  if (!profile) {
    const auth = await getAuthSession();
    profile = auth.profile;
  }

  const bags = await prisma.cashBag.findMany({
    where: { isActive: true },
    include: {
      line: true,
      openings: {
        orderBy: { openingDate: 'desc' },
        take: 1,
      },
      reconciliations: {
        where: { approvalStatus: 'PENDING' },
      },
      expenses: {
        where: { approvalStatus: 'PENDING' },
      },
    },
    orderBy: [{ line: { name: 'asc' } }, { name: 'asc' }],
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const enrichedBags = await Promise.all(
    bags.map(async (bag) => {
      const derivedBalancePaise = await deriveCashBagBalance(bag.id);

      // Today's collections and outflows
      const [todayInAgg, todayOutAgg] = await Promise.all([
        prisma.cashLedgerEntry.aggregate({
          where: {
            cashBagId: bag.id,
            direction: 'IN',
            createdAt: { gte: todayStart },
          },
          _sum: { amountPaise: true },
        }),
        prisma.cashLedgerEntry.aggregate({
          where: {
            cashBagId: bag.id,
            direction: 'OUT',
            createdAt: { gte: todayStart },
          },
          _sum: { amountPaise: true },
        }),
      ]);

      const lastEntry = await prisma.cashLedgerEntry.findFirst({
        where: { cashBagId: bag.id },
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { fullName: true } } },
      });

      return {
        id: bag.id,
        name: bag.name,
        code: bag.code,
        lineId: bag.lineId,
        lineName: bag.line?.name || 'Central Vault',
        lineCode: bag.line?.code || 'VAULT',
        weekday: bag.line?.weekday || 'ALL',
        session: bag.line?.session || null,
        description: bag.description,
        derivedBalancePaise,
        derivedBalanceRupees: paiseToRupees(derivedBalancePaise),
        todayInRupees: paiseToRupees(todayInAgg._sum.amountPaise || 0),
        todayOutRupees: paiseToRupees(todayOutAgg._sum.amountPaise || 0),
        latestOpening: bag.openings[0]
          ? {
              date: bag.openings[0].openingDate.toISOString().slice(0, 10),
              amountRupees: paiseToRupees(bag.openings[0].amountPaise),
            }
          : null,
        pendingReconciliationsCount: bag.reconciliations.length,
        pendingExpensesCount: bag.expenses.length,
        lastActivityAt: lastEntry ? lastEntry.createdAt.toISOString() : bag.createdAt.toISOString(),
        lastActor: lastEntry?.actor?.fullName || 'System',
      };
    })
  );

  const totalVaultPaise = enrichedBags.reduce((sum, b) => sum + b.derivedBalancePaise, 0);

  return {
    bags: enrichedBags,
    totalVaultPaise,
    totalVaultRupees: paiseToRupees(totalVaultPaise),
  };
}

/**
 * Get detailed CashBag view including ledger transaction history.
 */
export async function getCashBagDetails(cashBagId, { limit = 100, offset = 0 } = {}, actorContext = null) {
  let profile = actorContext?.profile;
  if (!profile) {
    const auth = await getAuthSession();
    profile = auth.profile;
  }

  const bag = await prisma.cashBag.findUnique({
    where: { id: cashBagId },
    include: {
      line: true,
      openings: {
        orderBy: { openingDate: 'desc' },
        take: 5,
        include: { openedBy: { select: { fullName: true } } },
      },
      reconciliations: {
        orderBy: { reconciledAt: 'desc' },
        take: 5,
        include: {
          reconciledBy: { select: { fullName: true } },
          approvedBy: { select: { fullName: true } },
        },
      },
      expenses: {
        orderBy: { expenseDate: 'desc' },
        take: 10,
        include: {
          category: true,
          recordedBy: { select: { fullName: true } },
          approvedBy: { select: { fullName: true } },
        },
      },
    },
  });

  if (!bag) {
    throw new Error('CashBag not found');
  }

  const derivedBalancePaise = await deriveCashBagBalance(bag.id);

  const [entries, totalEntries] = await Promise.all([
    prisma.cashLedgerEntry.findMany({
      where: { cashBagId: bag.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
        payment: { select: { paymentNumber: true, loanId: true } },
        disbursement: { select: { disbursementNumber: true, loanId: true } },
        expense: { select: { expenseNumber: true, description: true } },
        transfer: { select: { transferNumber: true } },
        handover: { select: { handoverNumber: true } },
        reconciliation: { select: { status: true, differencePaise: true } },
      },
    }),
    prisma.cashLedgerEntry.count({ where: { cashBagId: bag.id } }),
  ]);

  return {
    bag: {
      id: bag.id,
      name: bag.name,
      code: bag.code,
      lineId: bag.lineId,
      line: bag.line,
      description: bag.description,
      derivedBalancePaise,
      derivedBalanceRupees: paiseToRupees(derivedBalancePaise),
      openings: bag.openings.map((o) => ({
        ...o,
        amountRupees: paiseToRupees(o.amountPaise),
      })),
      reconciliations: bag.reconciliations.map((r) => ({
        ...r,
        expectedBalanceRupees: paiseToRupees(r.expectedBalancePaise),
        actualBalanceRupees: paiseToRupees(r.actualBalancePaise),
        differenceRupees: paiseToRupees(r.differencePaise),
      })),
      expenses: bag.expenses.map((e) => ({
        ...e,
        amountRupees: paiseToRupees(e.amountPaise),
      })),
    },
    entries: entries.map((e) => ({
      id: e.id,
      entryType: e.entryType,
      direction: e.direction,
      amountPaise: e.amountPaise,
      amountRupees: paiseToRupees(e.amountPaise),
      balanceAfterPaise: e.balanceAfterPaise,
      balanceAfterRupees: paiseToRupees(e.balanceAfterPaise),
      notes: e.notes,
      actorName: e.actor.fullName,
      createdAt: e.createdAt.toISOString(),
      referenceLabel:
        e.payment?.paymentNumber ||
        e.expense?.expenseNumber ||
        e.transfer?.transferNumber ||
        e.handover?.handoverNumber ||
        (e.reconciliation ? `Recon: ${e.reconciliation.status}` : null) ||
        null,
    })),
    totalEntries,
  };
}

/**
 * Fetch active Expense Categories.
 */
export async function getExpenseCategories() {
  return prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

// ============================================================================
// 3. MUTATION EXECUTORS
// ============================================================================

/**
 * Record daily opening balance before departure on a collection trip.
 */
export async function executeRecordCashBagOpening(input, actorContext) {
  const { profile, user } = actorContext;
  if (!profile.isAdmin) {
    requirePermission(profile, 'cash:bag_view');
  }

  const cashBagId = input.cashBagId;
  const amountPaise = rupeesToPaise(input.amountRupees);
  if (amountPaise < 0) {
    throw new Error('Opening cash amount cannot be negative');
  }

  const openingDate = input.openingDate ? new Date(input.openingDate) : new Date();
  openingDate.setHours(0, 0, 0, 0);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.cashBagOpening.findUnique({
      where: {
        cashBagId_openingDate: { cashBagId, openingDate },
      },
    });

    if (existing) {
      throw new Error(`Opening balance already recorded for this Cash Bag on ${openingDate.toISOString().slice(0, 10)}`);
    }

    const opening = await tx.cashBagOpening.create({
      data: {
        cashBagId,
        openingDate,
        amountPaise,
        openedById: user.id,
        notes: input.notes || null,
      },
    });

    // Post OPENING ledger entry if opening amount > 0
    let ledgerEntry = null;
    if (amountPaise > 0) {
      ledgerEntry = await appendLedgerEntry(
        tx,
        {
          cashBagId,
          entryType: 'OPENING',
          direction: 'IN',
          amountPaise,
          notes: `Daily Opening Balance: ${input.notes || 'Trip start'}`,
        },
        user.id
      );
    }

    return { opening, ledgerEntry };
  }, TX_OPTIONS);

  await writeAudit({
    actorId: user.id,
    action: 'CASH_BAG_OPENED',
    entityType: 'CashBagOpening',
    entityId: result.opening.id,
    metadata: {
      cashBagId,
      amountRupees: paiseToRupees(amountPaise),
      openingDate: openingDate.toISOString(),
    },
  });

  safeRevalidate(`/cash`);
  safeRevalidate(`/cash/${cashBagId}`);

  return { success: true, ...result };
}

/**
 * Inter-Line Cash Transfer: posts paired TRANSFER_OUT and TRANSFER_IN entries atomically.
 * Rule: Inter-Line transfer is not capital contribution.
 */
export async function executeInterLineCashTransfer(input, actorContext) {
  const { profile, user } = actorContext;
  if (!profile.isAdmin) {
    requirePermission(profile, 'cash:transfer');
  }

  const { sourceCashBagId, destinationCashBagId, amountRupees, notes } = input;
  if (!sourceCashBagId || !destinationCashBagId) {
    throw new Error('Source and destination Cash Bags are required');
  }
  if (sourceCashBagId === destinationCashBagId) {
    throw new Error('Source and destination Cash Bags must be distinct');
  }

  const amountPaise = rupeesToPaise(amountRupees);
  if (amountPaise <= 0) {
    throw new Error('Transfer amount must be greater than zero');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Verify source balance
    const sourceBalance = await deriveCashBagBalance(sourceCashBagId, tx);
    if (sourceBalance < amountPaise) {
      throw new Error(
        `Insufficient funds in source Cash Bag. Available: ${paiseToRupees(sourceBalance)}, Requested: ${paiseToRupees(amountPaise)}`
      );
    }

    const count = await tx.cashTransfer.count();
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const transferNumber = `TRF-${datePrefix}-${String(count + 1001).slice(-4)}`;

    const transfer = await tx.cashTransfer.create({
      data: {
        transferNumber,
        sourceCashBagId,
        destinationCashBagId,
        amountPaise,
        initiatedById: user.id,
        notes: notes || null,
      },
    });

    // 1. Paired entry: Source Bag Outflow
    const outEntry = await appendLedgerEntry(
      tx,
      {
        cashBagId: sourceCashBagId,
        entryType: 'TRANSFER_OUT',
        direction: 'OUT',
        amountPaise,
        transferId: transfer.id,
        notes: `Transfer out to destination bag. ${notes || ''}`,
      },
      user.id
    );

    // 2. Paired entry: Destination Bag Inflow
    const inEntry = await appendLedgerEntry(
      tx,
      {
        cashBagId: destinationCashBagId,
        entryType: 'TRANSFER_IN',
        direction: 'IN',
        amountPaise,
        transferId: transfer.id,
        notes: `Transfer in from source bag. ${notes || ''}`,
      },
      user.id
    );

    return { transfer, outEntry, inEntry };
  }, TX_OPTIONS);

  await writeAudit({
    actorId: user.id,
    action: 'CASH_TRANSFERRED',
    entityType: 'CashTransfer',
    entityId: result.transfer.id,
    metadata: {
      transferNumber: result.transfer.transferNumber,
      sourceCashBagId,
      destinationCashBagId,
      amountRupees: paiseToRupees(amountPaise),
    },
  });

  safeRevalidate(`/cash`);
  safeRevalidate(`/cash/${sourceCashBagId}`);
  safeRevalidate(`/cash/${destinationCashBagId}`);

  return { success: true, ...result };
}

/**
 * Record a field expense. Cash expenses decrease physical cash once approved.
 * Rule: Expense entry/approval permissions are separate; self-approved expenses flagged.
 */
export async function executeRecordExpense(input, actorContext) {
  const { profile, user } = actorContext;
  if (!profile.isAdmin) {
    requirePermission(profile, 'cash:expense_create');
  }

  const { cashBagId, categoryId, amountRupees, description, receiptUrl, autoApprove } = input;
  const amountPaise = rupeesToPaise(amountRupees);
  if (amountPaise <= 0) {
    throw new Error('Expense amount must be greater than zero');
  }
  if (!description || !description.trim()) {
    throw new Error('Expense description is required');
  }

  // Check if approver rights exist
  const canApprove = profile.isAdmin || profile.permissions.includes('cash:expense_approve');
  const shouldApproveNow = autoApprove && canApprove;

  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.expense.count();
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const expenseNumber = `EXP-${datePrefix}-${String(count + 1001).slice(-4)}`;

    const isSelfApproved = shouldApproveNow; // Recorder == Approver

    const expense = await tx.expense.create({
      data: {
        expenseNumber,
        cashBagId,
        categoryId,
        amountPaise,
        recordedById: user.id,
        description: description.trim(),
        receiptUrl: receiptUrl || null,
        approvalStatus: shouldApproveNow ? 'APPROVED' : 'PENDING',
        approvedById: shouldApproveNow ? user.id : null,
        approvedAt: shouldApproveNow ? new Date() : null,
        isSelfApproved,
      },
      include: { category: true },
    });

    let ledgerEntry = null;
    if (shouldApproveNow) {
      ledgerEntry = await appendLedgerEntry(
        tx,
        {
          cashBagId,
          entryType: 'EXPENSE',
          direction: 'OUT',
          amountPaise,
          expenseId: expense.id,
          notes: `Expense [${expense.category.name}]: ${description}`,
        },
        user.id
      );
    }

    return { expense, ledgerEntry };
  }, TX_OPTIONS);

  await writeAudit({
    actorId: user.id,
    action: 'EXPENSE_RECORDED',
    entityType: 'Expense',
    entityId: result.expense.id,
    metadata: {
      expenseNumber: result.expense.expenseNumber,
      cashBagId,
      amountRupees: paiseToRupees(amountPaise),
      approvalStatus: result.expense.approvalStatus,
      isSelfApproved: result.expense.isSelfApproved,
    },
  });

  safeRevalidate(`/cash`);
  safeRevalidate(`/cash/${cashBagId}`);

  return { success: true, ...result };
}

/**
 * Approve or reject a pending expense.
 */
export async function executeApproveExpense(input, actorContext) {
  const { profile, user } = actorContext;
  if (!profile.isAdmin) {
    requirePermission(profile, 'cash:expense_approve');
  }

  const { expenseId, approved, notes } = input;
  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({
      where: { id: expenseId },
      include: { category: true },
    });

    if (!expense) throw new Error('Expense record not found');
    if (expense.approvalStatus !== 'PENDING') {
      throw new Error(`Expense has already been ${expense.approvalStatus}`);
    }

    const isSelfApproved = expense.recordedById === user.id;

    if (!approved) {
      const updated = await tx.expense.update({
        where: { id: expense.id },
        data: {
          approvalStatus: 'REJECTED',
          approvedById: user.id,
          approvedAt: new Date(),
          notes: notes || null,
        },
      });
      return { expense: updated, ledgerEntry: null };
    }

    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        isSelfApproved,
        notes: notes || null,
      },
    });

    const ledgerEntry = await appendLedgerEntry(
      tx,
      {
        cashBagId: expense.cashBagId,
        entryType: 'EXPENSE',
        direction: 'OUT',
        amountPaise: expense.amountPaise,
        expenseId: expense.id,
        notes: `Approved expense [${expense.category.name}]: ${expense.description}`,
      },
      user.id
    );

    return { expense: updated, ledgerEntry };
  }, TX_OPTIONS);

  await writeAudit({
    actorId: user.id,
    action: input.approved ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
    entityType: 'Expense',
    entityId: result.expense.id,
    metadata: {
      expenseNumber: result.expense.expenseNumber,
      approved: input.approved,
      isSelfApproved: result.expense.isSelfApproved,
    },
  });

  safeRevalidate(`/cash`);
  safeRevalidate(`/cash/${result.expense.cashBagId}`);

  return { success: true, ...result };
}

/**
 * Record end-of-trip cash handover from collector to cashier/manager.
 * Rule: Handover is optional. If not handed over, balance carries forward.
 */
export async function executeRecordHandover(input, actorContext) {
  const { profile, user } = actorContext;
  if (!profile.isAdmin) {
    requirePermission(profile, 'cash:bag_view');
  }

  const { cashBagId, amountRupees, receivedById, notes } = input;
  const amountPaise = rupeesToPaise(amountRupees);
  if (amountPaise <= 0) {
    throw new Error('Handover amount must be greater than zero');
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentBalance = await deriveCashBagBalance(cashBagId, tx);
    if (currentBalance < amountPaise) {
      throw new Error(
        `Insufficient balance in Cash Bag for handover. Current: ${paiseToRupees(currentBalance)}, Requested: ${paiseToRupees(amountPaise)}`
      );
    }

    const count = await tx.cashHandover.count();
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const handoverNumber = `HND-${datePrefix}-${String(count + 1001).slice(-4)}`;

    const handover = await tx.cashHandover.create({
      data: {
        handoverNumber,
        cashBagId,
        amountPaise,
        handedOverById: user.id,
        receivedById: receivedById || null,
        status: 'PENDING',
        notes: notes || null,
      },
    });

    return { handover };
  }, TX_OPTIONS);

  await writeAudit({
    actorId: user.id,
    action: 'CASH_HANDOVER_RECORDED',
    entityType: 'CashHandover',
    entityId: result.handover.id,
    metadata: {
      handoverNumber: result.handover.handoverNumber,
      cashBagId,
      amountRupees: paiseToRupees(amountPaise),
    },
  });

  safeRevalidate(`/cash`);
  safeRevalidate(`/cash/${cashBagId}`);

  return { success: true, ...result };
}

/**
 * Acknowledge / Accept cash handover, transferring cash out of line bag into vault.
 */
export async function executeAcceptHandover(input, actorContext) {
  const { profile, user } = actorContext;
  if (!profile.isAdmin) {
    requirePermission(profile, 'cash:bag_view');
  }

  const { handoverId, notes } = input;

  const result = await prisma.$transaction(async (tx) => {
    const handover = await tx.cashHandover.findUnique({
      where: { id: handoverId },
    });

    if (!handover) throw new Error('Handover record not found');
    if (handover.status !== 'PENDING') {
      throw new Error(`Handover is already ${handover.status}`);
    }

    const updated = await tx.cashHandover.update({
      where: { id: handover.id },
      data: {
        status: 'ACCEPTED',
        receivedById: user.id,
        acknowledgedAt: new Date(),
        notes: notes || handover.notes,
      },
    });

    // Post HANDOVER_OUT on line bag
    const outEntry = await appendLedgerEntry(
      tx,
      {
        cashBagId: handover.cashBagId,
        entryType: 'HANDOVER_OUT',
        direction: 'OUT',
        amountPaise: handover.amountPaise,
        handoverId: handover.id,
        notes: `Cash handed over to cashier/branch (${updated.handoverNumber})`,
      },
      user.id
    );

    // Also post HANDOVER_IN to main vault
    const vault = await getOrCreateVaultCashBag(tx);
    const inEntry = await appendLedgerEntry(
      tx,
      {
        cashBagId: vault.id,
        entryType: 'HANDOVER_IN',
        direction: 'IN',
        amountPaise: handover.amountPaise,
        handoverId: handover.id,
        notes: `Cash received from Line Bag handover (${updated.handoverNumber})`,
      },
      user.id
    );

    return { handover: updated, outEntry, inEntry };
  }, TX_OPTIONS);

  await writeAudit({
    actorId: user.id,
    action: 'CASH_HANDOVER_ACCEPTED',
    entityType: 'CashHandover',
    entityId: result.handover.id,
    metadata: {
      handoverNumber: result.handover.handoverNumber,
      amountRupees: paiseToRupees(result.handover.amountPaise),
    },
  });

  safeRevalidate(`/cash`);
  safeRevalidate(`/cash/${result.handover.cashBagId}`);

  return { success: true, ...result };
}

/**
 * Reconcile physical cash count against expected ledger balance.
 * Rule: Shortage/excess requires reason, actor and audit; never silently auto-adjust.
 */
export async function executeRecordReconciliation(input, actorContext) {
  const { profile, user } = actorContext;
  if (!profile.isAdmin) {
    requirePermission(profile, 'cash:reconcile');
  }

  const { cashBagId, actualBalanceRupees, reason } = input;
  const actualBalancePaise = rupeesToPaise(actualBalanceRupees);
  if (actualBalancePaise < 0) {
    throw new Error('Physical cash count cannot be negative');
  }

  const result = await prisma.$transaction(async (tx) => {
    const expectedBalancePaise = await deriveCashBagBalance(cashBagId, tx);
    const differencePaise = actualBalancePaise - expectedBalancePaise;

    let status = 'BALANCED';
    if (differencePaise < 0) status = 'SHORTAGE';
    else if (differencePaise > 0) status = 'EXCESS';

    // Invariant: Non-zero difference strictly requires an explanatory reason
    if (differencePaise !== 0 && (!reason || !reason.trim())) {
      throw new Error(
        `Discrepancy detected (${paiseToRupees(differencePaise)}). A documented explanation is strictly required for shortage/excess reconciliation.`
      );
    }

    // If balanced, auto-approved; if discrepancy, requires manager/admin approval
    const approvalStatus = differencePaise === 0 ? 'APPROVED' : 'PENDING';

    const reconciliation = await tx.cashReconciliation.create({
      data: {
        cashBagId,
        reconciledById: user.id,
        expectedBalancePaise,
        actualBalancePaise,
        differencePaise,
        status,
        reason: reason?.trim() || null,
        approvalStatus,
        approvedById: differencePaise === 0 ? user.id : null,
        approvedAt: differencePaise === 0 ? new Date() : null,
      },
    });

    return { reconciliation };
  }, TX_OPTIONS);

  await writeAudit({
    actorId: user.id,
    action: 'CASH_RECONCILIATION_RECORDED',
    entityType: 'CashReconciliation',
    entityId: result.reconciliation.id,
    metadata: {
      cashBagId,
      expectedRupees: paiseToRupees(result.reconciliation.expectedBalancePaise),
      actualRupees: paiseToRupees(result.reconciliation.actualBalancePaise),
      differenceRupees: paiseToRupees(result.reconciliation.differencePaise),
      status: result.reconciliation.status,
    },
  });

  safeRevalidate(`/cash`);
  safeRevalidate(`/cash/${cashBagId}`);

  return { success: true, ...result };
}

/**
 * Approve a cash reconciliation discrepancy and post an ADJUSTMENT ledger entry.
 */
export async function executeApproveReconciliation(input, actorContext) {
  const { profile, user } = actorContext;
  if (!profile.isAdmin) {
    requirePermission(profile, 'cash:reconcile');
  }

  const { reconciliationId, approved, approvalNotes } = input;

  const result = await prisma.$transaction(async (tx) => {
    const recon = await tx.cashReconciliation.findUnique({
      where: { id: reconciliationId },
    });

    if (!recon) throw new Error('Reconciliation record not found');
    if (recon.approvalStatus !== 'PENDING') {
      throw new Error(`Reconciliation has already been ${recon.approvalStatus}`);
    }

    if (!approved) {
      const updated = await tx.cashReconciliation.update({
        where: { id: recon.id },
        data: {
          approvalStatus: 'REJECTED',
          approvedById: user.id,
          approvedAt: new Date(),
          approvalNotes: approvalNotes || null,
        },
      });
      return { reconciliation: updated, ledgerEntry: null };
    }

    const updated = await tx.cashReconciliation.update({
      where: { id: recon.id },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        approvalNotes: approvalNotes || null,
      },
    });

    let ledgerEntry = null;
    if (recon.differencePaise !== 0) {
      const isShortage = recon.differencePaise < 0;
      ledgerEntry = await appendLedgerEntry(
        tx,
        {
          cashBagId: recon.cashBagId,
          entryType: 'ADJUSTMENT',
          direction: isShortage ? 'OUT' : 'IN',
          amountPaise: Math.abs(recon.differencePaise),
          reconciliationId: recon.id,
          notes: `Reconciliation Adjustment (${recon.status}): ${recon.reason || 'Approved discrepancy'}`,
        },
        user.id
      );
    }

    return { reconciliation: updated, ledgerEntry };
  }, TX_OPTIONS);

  await writeAudit({
    actorId: user.id,
    action: input.approved ? 'CASH_RECONCILIATION_APPROVED' : 'CASH_RECONCILIATION_REJECTED',
    entityType: 'CashReconciliation',
    entityId: result.reconciliation.id,
    metadata: {
      differenceRupees: paiseToRupees(result.reconciliation.differencePaise),
      approved: input.approved,
    },
  });

  safeRevalidate(`/cash`);
  safeRevalidate(`/cash/${result.reconciliation.cashBagId}`);

  return { success: true, ...result };
}

// ============================================================================
// 4. NEXT.JS SERVER ACTION ENTRY POINTS
// ============================================================================

export async function recordCashBagOpening(input) {
  const { profile, user } = await getAuthSession();
  return executeRecordCashBagOpening(input, { profile, user });
}

export async function executeCashTransfer(input) {
  const { profile, user } = await getAuthSession();
  return executeInterLineCashTransfer(input, { profile, user });
}

export async function recordExpense(input) {
  const { profile, user } = await getAuthSession();
  return executeRecordExpense(input, { profile, user });
}

export async function approveExpense(input) {
  const { profile, user } = await getAuthSession();
  return executeApproveExpense(input, { profile, user });
}

export async function recordHandover(input) {
  const { profile, user } = await getAuthSession();
  return executeRecordHandover(input, { profile, user });
}

export async function acceptHandover(input) {
  const { profile, user } = await getAuthSession();
  return executeAcceptHandover(input, { profile, user });
}

export async function recordReconciliation(input) {
  const { profile, user } = await getAuthSession();
  return executeRecordReconciliation(input, { profile, user });
}

export async function approveReconciliation(input) {
  const { profile, user } = await getAuthSession();
  return executeApproveReconciliation(input, { profile, user });
}

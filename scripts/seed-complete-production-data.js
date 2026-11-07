import fs from 'fs';
import prisma from '../src/lib/prisma.js';

function parseCSVLine(line) {
  const values = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values[0] && values[0].includes('మొత్తం')) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseRupeesToPaise(val) {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) * 100;
}

async function main() {
  console.log('================================================================');
  console.log('🚀 IMPORTING COMPLETE PRODUCTION DATA CHRONOLOGICALLY');
  console.log('================================================================');

  // 1. Get Admin User
  const admin = await prisma.userProfile.findFirst({
    where: { email: 'prudhvi.inumarthi12@gmail.com' },
  });
  if (!admin) {
    throw new Error('Admin user prudhvi.inumarthi12@gmail.com not found!');
  }
  console.log(`✔ Admin User: ${admin.fullName} (${admin.id})`);

  // 2. Setup Partners
  console.log('\n--- Setting up Partners ---');
  const partnerPrudhvi = await prisma.partner.upsert({
    where: { partnerCode: 'PRT-001' },
    update: {
      name: 'Prudhvi Inumarthi (పృధ్వి)',
      phone: admin.phone || '9491807858',
      email: admin.email,
      userProfileId: admin.id,
      status: 'ACTIVE',
    },
    create: {
      partnerCode: 'PRT-001',
      name: 'Prudhvi Inumarthi (పృధ్వి)',
      phone: admin.phone || '9491807858',
      email: admin.email,
      userProfileId: admin.id,
      status: 'ACTIVE',
      joinDate: new Date('2026-10-01T00:00:00.000Z'),
    },
  });

  const partnerSattibabu = await prisma.partner.upsert({
    where: { partnerCode: 'PRT-002' },
    update: {
      name: 'సత్తిబాబు (Sattibabu)',
      status: 'ACTIVE',
    },
    create: {
      partnerCode: 'PRT-002',
      name: 'సత్తిబాబు (Sattibabu)',
      status: 'ACTIVE',
      joinDate: new Date('2026-10-01T00:00:00.000Z'),
    },
  });
  console.log(`✔ Partner 1: ${partnerPrudhvi.name} (${partnerPrudhvi.partnerCode})`);
  console.log(`✔ Partner 2: ${partnerSattibabu.name} (${partnerSattibabu.partnerCode})`);

  // 3. Setup Villages & Areas
  console.log('\n--- Setting up Villages & Areas ---');
  const vilEdurlanka = await prisma.village.upsert({
    where: { code: 'VIL-EDL' },
    update: { name: 'Edurlanka (ఎదుర్లంక)' },
    create: { code: 'VIL-EDL', name: 'Edurlanka (ఎదుర్లంక)' },
  });
  const vilKothapalli = await prisma.village.upsert({
    where: { code: 'VIL-KTP' },
    update: { name: 'Kothapalli (కొత్తపల్లి)' },
    create: { code: 'VIL-KTP', name: 'Kothapalli (కొత్తపల్లి)' },
  });

  const areaEdurlankaMain = await prisma.area.upsert({
    where: { villageId_name: { villageId: vilEdurlanka.id, name: 'Edurlanka Main (ఎదుర్లంక మెయిన్)' } },
    update: {},
    create: { name: 'Edurlanka Main (ఎదుర్లంక మెయిన్)', villageId: vilEdurlanka.id },
  });
  const areaJaganColony = await prisma.area.upsert({
    where: { villageId_name: { villageId: vilEdurlanka.id, name: 'Jagan Colony (జగన్ కాలనీ)' } },
    update: {},
    create: { name: 'Jagan Colony (జగన్ కాలనీ)', villageId: vilEdurlanka.id },
  });
  const areaKothapalliMain = await prisma.area.upsert({
    where: { villageId_name: { villageId: vilKothapalli.id, name: 'Kothapalli Main (కొత్తపల్లి మెయిన్)' } },
    update: {},
    create: { name: 'Kothapalli Main (కొత్తపల్లి మెయిన్)', villageId: vilKothapalli.id },
  });

  // 4. Setup Line
  console.log('\n--- Setting up Collection Line ---');
  const line = await prisma.line.upsert({
    where: { code: 'SAT-AFT' },
    update: {
      name: 'Saturday Afternoon Line (శనివారం మధ్యాహ్నం)',
      weekday: 'SATURDAY',
      session: 'AFTERNOON',
      description: 'Edurlanka and Kothapalli Saturday Afternoon Collection Line',
    },
    create: {
      code: 'SAT-AFT',
      name: 'Saturday Afternoon Line (శనివారం మధ్యాహ్నం)',
      weekday: 'SATURDAY',
      session: 'AFTERNOON',
      description: 'Edurlanka and Kothapalli Saturday Afternoon Collection Line',
    },
  });
  console.log(`✔ Line: ${line.name} (${line.code})`);

  // 5. Setup Master Vault & Line Cash Bag
  console.log('\n--- Setting up Cash Bags ---');
  let vault = await prisma.cashBag.findFirst({ where: { code: 'VAULT-MAIN' } });
  if (!vault) {
    vault = await prisma.cashBag.create({
      data: {
        code: 'VAULT-MAIN',
        name: 'Master Operations Vault',
        description: 'Primary Physical Vault',
        isActive: true,
      },
    });
  }

  let lineCashBag = await prisma.cashBag.findFirst({ where: { code: 'BAG-SAT-AFT' } });
  if (!lineCashBag) {
    lineCashBag = await prisma.cashBag.create({
      data: {
        code: 'BAG-SAT-AFT',
        name: 'Saturday Afternoon Line Cash Bag',
        lineId: line.id,
        description: 'Saturday Afternoon Line Cash Bag',
        isActive: true,
      },
    });
  }
  console.log(`✔ Vault: ${vault.code}, Line Bag: ${lineCashBag.code}`);

  // Setup Expense Category
  let expenseCat = await prisma.expenseCategory.findFirst({ where: { code: 'DISBURSEMENT_OPS' } });
  if (!expenseCat) {
    expenseCat = await prisma.expenseCategory.create({
      data: {
        code: 'DISBURSEMENT_OPS',
        name: 'Loan Disbursements & Operational Outflows',
        description: 'Field disbursements and direct operations',
      },
    });
  }

  // 6. Ensure Schemes Exist
  console.log('\n--- Ensuring Loan Schemes ---');
  async function getOrCreateScheme(code, name, freq, totalRepayPaise, installmentsCount, regularDuePaise, finalDuePaise) {
    let scheme = await prisma.loanScheme.findUnique({ where: { code } });
    if (!scheme) {
      scheme = await prisma.loanScheme.create({
        data: {
          code,
          name,
          frequency: freq,
          isActive: true,
          description: `${name} (${installmentsCount} installments)`,
        },
      });
    }
    let version = await prisma.loanSchemeVersion.findFirst({
      where: { schemeId: scheme.id, versionNumber: 1 },
    });
    if (!version) {
      const principalPaise = Math.round(totalRepayPaise * 0.8);
      const financeChargePaise = totalRepayPaise - principalPaise;
      version = await prisma.loanSchemeVersion.create({
        data: {
          schemeId: scheme.id,
          versionNumber: 1,
          principalPaise,
          totalFinanceChargePaise: financeChargePaise,
          totalRepaymentPaise: totalRepayPaise,
          installmentCount: installmentsCount,
          isActive: true,
        },
      });
      // create rules
      const daysMultiplier = freq === 'MONTHLY' ? 30 : 7;
      const rules = [];
      for (let i = 1; i <= installmentsCount; i++) {
        const isFinal = i === installmentsCount;
        const totalDue = isFinal ? finalDuePaise : regularDuePaise;
        const pDue = Math.round(totalDue * 0.8);
        const fDue = totalDue - pDue;
        rules.push({
          schemeVersionId: version.id,
          installmentNumber: i,
          dueOffsetDays: i * daysMultiplier,
          principalDuePaise: pDue,
          financeChargeDuePaise: fDue,
          totalDuePaise: totalDue,
        });
      }
      await prisma.loanSchemeInstallmentRule.createMany({ data: rules });
    }
    return { scheme, version };
  }

  const schemeW12_5K = await getOrCreateScheme('W12.5K', '₹10,000 Weekly Scheme (₹12,500 Total)', 'WEEKLY', 1250000, 25, 50000, 50000);
  const schemeM12_5K = await getOrCreateScheme('M12.5K', '₹10,000 Monthly Scheme (₹12,500 Total)', 'MONTHLY', 1250000, 6, 210000, 200000);
  const schemeW25K = await getOrCreateScheme('W25K', '₹20,000 Weekly Scheme (₹25,000 Total)', 'WEEKLY', 2500000, 25, 100000, 100000);
  const schemeW6_3K = await getOrCreateScheme('W6.3K', '₹5,000 Weekly Scheme (₹6,300 Total)', 'WEEKLY', 630000, 26, 25000, 5000);
  const schemeW5K = await getOrCreateScheme('W5K', '₹4,000 Weekly Scheme (₹5,000 Total)', 'WEEKLY', 500000, 25, 20000, 20000);
  const schemeW1_25K = await getOrCreateScheme('W1.25K', '₹1,000 Weekly Scheme (₹1,250 Total)', 'WEEKLY', 125000, 13, 10000, 5000);
  const schemeM2_5K = await getOrCreateScheme('M2.5K', '₹2,000 Monthly Scheme (₹2,500 Total)', 'MONTHLY', 250000, 6, 42000, 40000);

  function pickScheme(amountStr, freqType) {
    const amt = parseRupeesToPaise(amountStr);
    const isMonthly = (freqType || '').includes('నెల') || (freqType || '').toLowerCase().includes('monthly');
    if (isMonthly) {
      if (amt <= 300000) return schemeM2_5K;
      return schemeM12_5K;
    }
    if (amt === 125000) return schemeW1_25K;
    if (amt === 500000) return schemeW5K;
    if (amt === 630000) return schemeW6_3K;
    if (amt === 2500000) return schemeW25K;
    return schemeW12_5K;
  }

  // 7. Load all CSV data
  const edurlankaRows = parseCSV('scripts/Edurlanka.csv');
  const kothapalliRows = parseCSV('scripts/Kothapalli.csv');

  const allCustomerRows = [
    ...edurlankaRows.map((r, i) => ({
      ...r,
      villageId: vilEdurlanka.id,
      areaId: (r['కాలనీ (Colony)'] || '').includes('జగన్') ? areaJaganColony.id : areaEdurlankaMain.id,
      customerNumber: `VF-EDL-${String(i + 1).padStart(3, '0')}`,
      sortIndex: i + 1,
    })),
    ...kothapalliRows.map((r, i) => ({
      ...r,
      villageId: vilKothapalli.id,
      areaId: areaKothapalliMain.id,
      customerNumber: `VF-KTP-${String(i + 1).padStart(3, '0')}`,
      sortIndex: 100 + i + 1,
    })),
  ];

  console.log(`Loaded ${allCustomerRows.length} total customers from sheets.`);

  let currentBagBalancePaise = 0;
  const createdCustomersMap = new Map(); // customerNumber -> { customer, loan, installments }

  // Helper to post cash ledger entry
  async function postLedgerEntry(entryType, direction, amountPaise, notes, createdAt, extra = {}) {
    if (direction === 'IN') {
      currentBagBalancePaise += amountPaise;
    } else {
      currentBagBalancePaise -= amountPaise;
    }
    return await prisma.cashLedgerEntry.create({
      data: {
        cashBagId: lineCashBag.id,
        entryType,
        direction,
        amountPaise,
        balanceAfterPaise: currentBagBalancePaise,
        actorId: admin.id,
        notes,
        createdAt,
        ...extra,
      },
    });
  }

  // Helper to disburse a customer loan
  async function disburseCustomer(row, joinedDate) {
    const isMonthly = (row['పేమెంట్ విధానం (Payment Type)'] || '').includes('నెల') || (row['పేమెంట్ విధానం (Payment Type)'] || '').toLowerCase().includes('monthly');
    const { scheme, version } = pickScheme(row['సొమ్ము (Amount)'], row['పేమెంట్ విధానం (Payment Type)']);

    // Bilingual display name
    const englishName = row['English Transliteration'] || '';
    const teluguName = row['ఆసామీ పేరు (Telugu Name)'] || '';
    const displayName = englishName ? `${teluguName} (${englishName})` : teluguName;

    // Create Customer
    const customer = await prisma.customer.create({
      data: {
        customerNumber: row.customerNumber,
        fullName: displayName,
        villageId: row.villageId,
        areaId: row.areaId,
        status: 'ACTIVE',
        createdAt: joinedDate,
      },
    });

    // Add Phone if present
    if (row['ఫోన్ నంబర్ (Phone)']) {
      await prisma.customerPhone.create({
        data: {
          customerId: customer.id,
          phoneNumber: row['ఫోన్ నంబర్ (Phone)'],
          phoneType: 'PRIMARY',
          isPrimary: true,
        },
      });
    }

    // Line Assignment
    await prisma.customerLineAssignment.create({
      data: {
        customerId: customer.id,
        lineId: line.id,
        assignedBy: admin.id,
        effectiveFrom: joinedDate,
        isCurrent: true,
      },
    });

    // Create Loan
    const loanNumber = `LN-${row.customerNumber}`;
    const loan = await prisma.loan.create({
      data: {
        loanNumber,
        customerId: customer.id,
        schemeId: scheme.id,
        schemeVersionId: version.id,
        requestedPrincipalPaise: version.principalPaise,
        sanctionedPrincipalPaise: version.principalPaise,
        totalFinanceChargePaise: version.totalFinanceChargePaise,
        totalRepaymentPaise: version.totalRepaymentPaise,
        status: 'ACTIVE',
        applicantId: admin.id,
        notes: row['ఇతర వివరాలు / Remarks'] || null,
        createdAt: joinedDate,
      },
    });

    // Create Loan Schedule Version
    const schedVersion = await prisma.loanScheduleVersion.create({
      data: {
        loanId: loan.id,
        versionNumber: 1,
        generatedReason: 'INITIAL_DISBURSEMENT',
        totalPrincipalPaise: version.principalPaise,
        totalFinanceChargePaise: version.totalFinanceChargePaise,
        totalRepaymentPaise: version.totalRepaymentPaise,
        isCurrent: true,
      },
    });

    // Create Loan Disbursement
    await prisma.loanDisbursement.create({
      data: {
        loanId: loan.id,
        disbursementNumber: 1,
        amountPaise: version.principalPaise,
        disbursedAt: joinedDate,
        disbursedBy: admin.id,
        mode: 'CASH',
        lineId: line.id,
        cashBagId: lineCashBag.id,
        createdAt: joinedDate,
      },
    });

    // Create Installments
    const daysMultiplier = isMonthly ? 30 : 7;
    const installmentsData = [];
    const regularDuePaise = isMonthly ? 210000 : Math.round(version.totalRepaymentPaise / version.installmentCount);
    for (let i = 1; i <= version.installmentCount; i++) {
      const isFinal = i === version.installmentCount;
      const totalDue = isFinal ? (version.totalRepaymentPaise - regularDuePaise * (version.installmentCount - 1)) : regularDuePaise;
      const pDue = Math.round(totalDue * 0.8);
      const fDue = totalDue - pDue;
      const dueDate = new Date(joinedDate.getTime() + i * daysMultiplier * 24 * 60 * 60 * 1000);
      installmentsData.push({
        loanId: loan.id,
        scheduleVersionId: schedVersion.id,
        installmentNumber: i,
        dueDate,
        principalDuePaise: Math.round(pDue),
        financeChargeDuePaise: Math.round(fDue),
        totalDuePaise: Math.round(totalDue),
        principalPaidPaise: 0,
        financeChargePaidPaise: 0,
        totalPaidPaise: 0,
        status: 'PENDING',
      });
    }

    await prisma.loanInstallment.createMany({ data: installmentsData });
    const createdInstallments = await prisma.loanInstallment.findMany({
      where: { loanId: loan.id },
      orderBy: { installmentNumber: 'asc' },
    });

    createdCustomersMap.set(row.customerNumber, {
      row,
      customer,
      loan,
      installments: createdInstallments,
    });
  }

  // ============================================================================
  // WEEK 0: 03-10-2026 (Disbursements & Initial Capital)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('📅 PROCESSING WEEK 0: 03-10-2026 (Joining & Initial Capital)');
  console.log('----------------------------------------------------------------');
  const dateWeek0 = new Date('2026-10-03T08:00:00.000Z');

  // 1. Capital Inflow
  await prisma.partnerCapitalEntry.create({
    data: {
      entryNumber: 'CAP-20261003-001',
      partnerId: partnerPrudhvi.id,
      entryType: 'INITIAL_CONTRIBUTION',
      amountPaise: 5000000,
      paymentMode: 'BANK_TRANSFER',
      effectiveDate: dateWeek0,
      notes: 'Initial Capital Contribution by Prudhvi',
      recordedById: admin.id,
      createdAt: dateWeek0,
    },
  });

  await prisma.partnerCapitalEntry.create({
    data: {
      entryNumber: 'CAP-20261003-002',
      partnerId: partnerSattibabu.id,
      entryType: 'INITIAL_CONTRIBUTION',
      amountPaise: 15000000,
      paymentMode: 'BANK_TRANSFER',
      effectiveDate: dateWeek0,
      notes: 'Initial Capital Contribution by Sattibabu',
      recordedById: admin.id,
      createdAt: dateWeek0,
    },
  });

  await postLedgerEntry('OPENING', 'IN', 20000000, 'Initial Partner Capital (Prudhvi: ₹50k, Sattibabu: ₹150k)', dateWeek0);
  console.log(`✔ Capital In: ₹2,00,000. Bag Balance: ₹${currentBagBalancePaise / 100}`);

  // 2. Disburse Week 0 Customers (joined 03-10-26)
  const week0Customers = allCustomerRows.filter(r => r['తేదీ (Date)'] === '03-10-26');
  console.log(`Disbursing ${week0Customers.length} customers who joined on 03-10-26...`);
  for (const r of week0Customers) {
    await disburseCustomer(r, dateWeek0);
  }

  // 3. Post Week 0 Expense / Disbursement Outflow: ₹80,900
  const exp0 = await prisma.expense.create({
    data: {
      expenseNumber: 'EXP-20261003-001',
      cashBagId: lineCashBag.id,
      categoryId: expenseCat.id,
      amountPaise: 8090000,
      recordedById: admin.id,
      expenseDate: dateWeek0,
      description: 'Week 0 Customer Loan Disbursements & Setup Expenses',
      approvalStatus: 'APPROVED',
      approvedById: admin.id,
      approvedAt: dateWeek0,
      isSelfApproved: true,
      createdAt: dateWeek0,
    },
  });
  await postLedgerEntry('EXPENSE', 'OUT', 8090000, 'Loan Disbursements & Operational Outflows', dateWeek0, { expenseId: exp0.id });
  console.log(`✔ Outflow: ₹80,900. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹1,19,100)`);

  // ============================================================================
  // WEEK 1: 10-10-2026 (Capital, New Customers & Collection Session #1)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('📅 PROCESSING WEEK 1: 10-10-2026 (Collection #1 & Week 1 Customers)');
  console.log('----------------------------------------------------------------');
  const dateWeek1 = new Date('2026-10-10T08:00:00.000Z');

  // 1. Capital Inflow: Prudhvi ₹1,00,000
  await prisma.partnerCapitalEntry.create({
    data: {
      entryNumber: 'CAP-20261010-001',
      partnerId: partnerPrudhvi.id,
      entryType: 'ADDITIONAL_CONTRIBUTION',
      amountPaise: 10000000,
      paymentMode: 'BANK_TRANSFER',
      effectiveDate: dateWeek1,
      notes: 'Capital Contribution by Prudhvi',
      recordedById: admin.id,
      createdAt: dateWeek1,
    },
  });
  await postLedgerEntry('ADDITIONAL_CASH_IN', 'IN', 10000000, 'Partner Capital (Prudhvi: ₹100k)', dateWeek1);
  console.log(`✔ Capital In: ₹1,00,000. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹2,19,100)`);

  // 2. Disburse Week 1 Customers (joined 10-10-26)
  const week1Customers = allCustomerRows.filter(r => r['తేదీ (Date)'] === '10-10-26');
  console.log(`Disbursing ${week1Customers.length} customers who joined on 10-10-26...`);
  for (const r of week1Customers) {
    await disburseCustomer(r, dateWeek1);
  }

  // 3. Outflow: ₹1,24,550
  const exp1 = await prisma.expense.create({
    data: {
      expenseNumber: 'EXP-20261010-001',
      cashBagId: lineCashBag.id,
      categoryId: expenseCat.id,
      amountPaise: 12455000,
      recordedById: admin.id,
      expenseDate: dateWeek1,
      description: 'Week 1 Customer Loan Disbursements & Expenses',
      approvalStatus: 'APPROVED',
      approvedById: admin.id,
      approvedAt: dateWeek1,
      isSelfApproved: true,
      createdAt: dateWeek1,
    },
  });
  await postLedgerEntry('EXPENSE', 'OUT', 12455000, 'Loan Disbursements & Operational Outflows', dateWeek1, { expenseId: exp1.id });
  console.log(`✔ Outflow: ₹1,24,550. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹94,550)`);

  // 4. Collection Session #1 (10-10-2026)
  const session1 = await prisma.collectionSession.create({
    data: {
      sessionNumber: 'SES-20261010-SAT-AFT',
      sessionDate: dateWeek1,
      lineId: line.id,
      status: 'COMPLETED',
      openedAt: dateWeek1,
      closedAt: new Date('2026-10-10T12:00:00.000Z'),
      openedById: admin.id,
      closedById: admin.id,
      notes: 'Week 1 Saturday Afternoon Collection Session',
      createdAt: dateWeek1,
    },
  });
  await prisma.sessionTeamMember.create({
    data: {
      sessionId: session1.id,
      userId: admin.id,
      role: 'LEAD',
    },
  });

  let session1TotalPaise = 0;
  for (const [code, { row, customer, loan, installments }] of createdCustomersMap.entries()) {
    const rawVal = row['1 (10/10/26)'];
    const amountPaise = parseRupeesToPaise(rawVal);
    const isUPI = rawVal.toUpperCase().includes('UPI');
    const mode = isUPI ? 'UPI' : 'CASH';

    if (amountPaise > 0) {
      session1TotalPaise += amountPaise;
      const principalPortion = Math.round(amountPaise * 0.8);
      const financePortion = amountPaise - principalPortion;

      const payment = await prisma.payment.create({
        data: {
          paymentNumber: `PAY-W1-${customer.customerNumber}`,
          customerId: customer.id,
          loanId: loan.id,
          lineId: line.id,
          amountPaise,
          principalPaidPaise: principalPortion,
          financeChargePaidPaise: financePortion,
          mode,
          status: 'CONFIRMED',
          collectedById: admin.id,
          collectedAt: dateWeek1,
          createdAt: dateWeek1,
        },
      });

      const inst = installments[0];
      await prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          loanId: loan.id,
          installmentId: inst.id,
          amountPaise,
          principalPaise: principalPortion,
          financeChargePaise: financePortion,
        },
      });

      await prisma.loanInstallment.update({
        where: { id: inst.id },
        data: {
          totalPaidPaise: inst.totalPaidPaise + amountPaise,
          principalPaidPaise: inst.principalPaidPaise + principalPortion,
          financeChargePaidPaise: inst.financeChargePaidPaise + financePortion,
          status: (inst.totalPaidPaise + amountPaise >= inst.totalDuePaise) ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: dateWeek1,
        },
      });

      await prisma.collectionVisit.create({
        data: {
          sessionId: session1.id,
          customerId: customer.id,
          collectorId: admin.id,
          visitedAt: dateWeek1,
          status: 'COLLECTED',
          paymentId: payment.id,
        },
      });
    } else if (row['తేదీ (Date)'] === '03-10-26') {
      await prisma.collectionVisit.create({
        data: {
          sessionId: session1.id,
          customerId: customer.id,
          collectorId: admin.id,
          visitedAt: dateWeek1,
          status: 'NOT_AVAILABLE',
          notes: 'Customer missed installment',
        },
      });
    }
  }

  await postLedgerEntry('COLLECTION', 'IN', session1TotalPaise, 'Session Collection #1 (10/10/26)', dateWeek1);
  console.log(`✔ Session 1 Collected: ₹${session1TotalPaise / 100}. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹1,03,900)`);

  // ============================================================================
  // WEEK 2: 17-10-2026 (Capital, New Customers & Collection Session #2)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('📅 PROCESSING WEEK 2: 17-10-2026 (Collection #2 & Week 2 Customers)');
  console.log('----------------------------------------------------------------');
  const dateWeek2 = new Date('2026-10-17T08:00:00.000Z');

  // 1. Capital Inflow: Prudhvi ₹40k, Sattibabu ₹60k
  await prisma.partnerCapitalEntry.create({
    data: {
      entryNumber: 'CAP-20261017-001',
      partnerId: partnerPrudhvi.id,
      entryType: 'ADDITIONAL_CONTRIBUTION',
      amountPaise: 4000000,
      paymentMode: 'BANK_TRANSFER',
      effectiveDate: dateWeek2,
      notes: 'Capital Contribution by Prudhvi',
      recordedById: admin.id,
      createdAt: dateWeek2,
    },
  });
  await prisma.partnerCapitalEntry.create({
    data: {
      entryNumber: 'CAP-20261017-002',
      partnerId: partnerSattibabu.id,
      entryType: 'ADDITIONAL_CONTRIBUTION',
      amountPaise: 6000000,
      paymentMode: 'BANK_TRANSFER',
      effectiveDate: dateWeek2,
      notes: 'Capital Contribution by Sattibabu',
      recordedById: admin.id,
      createdAt: dateWeek2,
    },
  });
  await postLedgerEntry('ADDITIONAL_CASH_IN', 'IN', 10000000, 'Partner Capital (Prudhvi: ₹40k, Sattibabu: ₹60k)', dateWeek2);
  console.log(`✔ Capital In: ₹1,00,000. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹2,03,900)`);

  // 2. Disburse Week 2 Customers (joined 17-10-26)
  const week2Customers = allCustomerRows.filter(r => r['తేదీ (Date)'] === '17-10-26');
  console.log(`Disbursing ${week2Customers.length} customers who joined on 17-10-26...`);
  for (const r of week2Customers) {
    await disburseCustomer(r, dateWeek2);
  }

  // 3. Outflow: ₹1,23,500
  const exp2 = await prisma.expense.create({
    data: {
      expenseNumber: 'EXP-20261017-001',
      cashBagId: lineCashBag.id,
      categoryId: expenseCat.id,
      amountPaise: 12350000,
      recordedById: admin.id,
      expenseDate: dateWeek2,
      description: 'Week 2 Customer Loan Disbursements & Expenses',
      approvalStatus: 'APPROVED',
      approvedById: admin.id,
      approvedAt: dateWeek2,
      isSelfApproved: true,
      createdAt: dateWeek2,
    },
  });
  await postLedgerEntry('EXPENSE', 'OUT', 12350000, 'Loan Disbursements & Operational Outflows', dateWeek2, { expenseId: exp2.id });
  console.log(`✔ Outflow: ₹1,23,500. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹80,400)`);

  // 4. Collection Session #2 (17-10-2026)
  const session2 = await prisma.collectionSession.create({
    data: {
      sessionNumber: 'SES-20261017-SAT-AFT',
      sessionDate: dateWeek2,
      lineId: line.id,
      status: 'COMPLETED',
      openedAt: dateWeek2,
      closedAt: new Date('2026-10-17T12:00:00.000Z'),
      openedById: admin.id,
      closedById: admin.id,
      notes: 'Week 2 Saturday Afternoon Collection Session',
      createdAt: dateWeek2,
    },
  });
  await prisma.sessionTeamMember.create({
    data: {
      sessionId: session2.id,
      userId: admin.id,
      role: 'LEAD',
    },
  });

  let session2TotalPaise = 0;
  for (const [code, { row, customer, loan, installments }] of createdCustomersMap.entries()) {
    const rawVal = row['2 (17/10/26)'];
    const amountPaise = parseRupeesToPaise(rawVal);
    const isUPI = rawVal.toUpperCase().includes('UPI');
    const mode = isUPI ? 'UPI' : 'CASH';

    if (amountPaise > 0) {
      session2TotalPaise += amountPaise;
      const principalPortion = Math.round(amountPaise * 0.8);
      const financePortion = amountPaise - principalPortion;

      const payment = await prisma.payment.create({
        data: {
          paymentNumber: `PAY-W2-${customer.customerNumber}`,
          customerId: customer.id,
          loanId: loan.id,
          lineId: line.id,
          amountPaise,
          principalPaidPaise: principalPortion,
          financeChargePaidPaise: financePortion,
          mode,
          status: 'CONFIRMED',
          collectedById: admin.id,
          collectedAt: dateWeek2,
          createdAt: dateWeek2,
        },
      });

      const unpaidInsts = await prisma.loanInstallment.findMany({
        where: { loanId: loan.id, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        orderBy: { installmentNumber: 'asc' },
      });
      const targetInst = unpaidInsts[0] || installments[1];
      await prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          loanId: loan.id,
          installmentId: targetInst.id,
          amountPaise,
          principalPaise: principalPortion,
          financeChargePaise: financePortion,
        },
      });

      await prisma.loanInstallment.update({
        where: { id: targetInst.id },
        data: {
          totalPaidPaise: targetInst.totalPaidPaise + amountPaise,
          principalPaidPaise: targetInst.principalPaidPaise + principalPortion,
          financeChargePaidPaise: targetInst.financeChargePaidPaise + financePortion,
          status: (targetInst.totalPaidPaise + amountPaise >= targetInst.totalDuePaise) ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: dateWeek2,
        },
      });

      await prisma.collectionVisit.create({
        data: {
          sessionId: session2.id,
          customerId: customer.id,
          collectorId: admin.id,
          visitedAt: dateWeek2,
          status: 'COLLECTED',
          paymentId: payment.id,
        },
      });
    } else if (['03-10-26', '10-10-26'].includes(row['తేదీ (Date)'])) {
      await prisma.collectionVisit.create({
        data: {
          sessionId: session2.id,
          customerId: customer.id,
          collectorId: admin.id,
          visitedAt: dateWeek2,
          status: 'NOT_AVAILABLE',
          notes: 'Customer missed installment',
        },
      });
    }
  }

  await postLedgerEntry('COLLECTION', 'IN', session2TotalPaise, 'Session Collection #2 (17/10/26)', dateWeek2);
  console.log(`✔ Session 2 Collected: ₹${session2TotalPaise / 100}. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹89,750)`);

  // ============================================================================
  // WEEK 3: 24-10-2026 (Capital, New Customers & Collection Session #3)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('📅 PROCESSING WEEK 3: 24-10-2026 (Collection #3 & Week 3 Customers)');
  console.log('----------------------------------------------------------------');
  const dateWeek3 = new Date('2026-10-24T08:00:00.000Z');

  // 1. Capital Inflow: Prudhvi ₹50k, Sattibabu ₹50k
  await prisma.partnerCapitalEntry.create({
    data: {
      entryNumber: 'CAP-20261024-001',
      partnerId: partnerPrudhvi.id,
      entryType: 'ADDITIONAL_CONTRIBUTION',
      amountPaise: 5000000,
      paymentMode: 'BANK_TRANSFER',
      effectiveDate: dateWeek3,
      notes: 'Capital Contribution by Prudhvi',
      recordedById: admin.id,
      createdAt: dateWeek3,
    },
  });
  await prisma.partnerCapitalEntry.create({
    data: {
      entryNumber: 'CAP-20261024-002',
      partnerId: partnerSattibabu.id,
      entryType: 'ADDITIONAL_CONTRIBUTION',
      amountPaise: 5000000,
      paymentMode: 'BANK_TRANSFER',
      effectiveDate: dateWeek3,
      notes: 'Capital Contribution by Sattibabu',
      recordedById: admin.id,
      createdAt: dateWeek3,
    },
  });
  await postLedgerEntry('ADDITIONAL_CASH_IN', 'IN', 10000000, 'Partner Capital (Prudhvi: ₹50k, Sattibabu: ₹50k)', dateWeek3);
  console.log(`✔ Capital In: ₹1,00,000. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹1,89,750)`);

  // 2. Disburse Week 3 Customers (joined 24-10-26 & 25-10-26)
  const week3Customers = allCustomerRows.filter(r => r['తేదీ (Date)'] === '24-10-26' || r['తేదీ (Date)'] === '25-10-26');
  console.log(`Disbursing ${week3Customers.length} customers who joined on 24-10-26 / 25-10-26...`);
  for (const r of week3Customers) {
    const jDate = r['తేదీ (Date)'] === '25-10-26' ? new Date('2026-10-25T08:00:00.000Z') : dateWeek3;
    await disburseCustomer(r, jDate);
  }

  // 3. Outflow: ₹1,01,700
  const exp3 = await prisma.expense.create({
    data: {
      expenseNumber: 'EXP-20261024-001',
      cashBagId: lineCashBag.id,
      categoryId: expenseCat.id,
      amountPaise: 10170000,
      recordedById: admin.id,
      expenseDate: dateWeek3,
      description: 'Week 3 Customer Loan Disbursements & Expenses',
      approvalStatus: 'APPROVED',
      approvedById: admin.id,
      approvedAt: dateWeek3,
      isSelfApproved: true,
      createdAt: dateWeek3,
    },
  });
  await postLedgerEntry('EXPENSE', 'OUT', 10170000, 'Loan Disbursements & Operational Outflows', dateWeek3, { expenseId: exp3.id });
  console.log(`✔ Outflow: ₹1,01,700. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹88,050)`);

  // 4. Collection Session #3 (24-10-2026)
  const session3 = await prisma.collectionSession.create({
    data: {
      sessionNumber: 'SES-20261024-SAT-AFT',
      sessionDate: dateWeek3,
      lineId: line.id,
      status: 'COMPLETED',
      openedAt: dateWeek3,
      closedAt: new Date('2026-10-24T12:00:00.000Z'),
      openedById: admin.id,
      closedById: admin.id,
      notes: 'Week 3 Saturday Afternoon Collection Session',
      createdAt: dateWeek3,
    },
  });
  await prisma.sessionTeamMember.create({
    data: {
      sessionId: session3.id,
      userId: admin.id,
      role: 'LEAD',
    },
  });

  let session3TotalPaise = 0;
  for (const [code, { row, customer, loan, installments }] of createdCustomersMap.entries()) {
    const rawVal = row['3 (24/10/26)'];
    const amountPaise = parseRupeesToPaise(rawVal);
    const isUPI = rawVal.toUpperCase().includes('UPI');
    const mode = isUPI ? 'UPI' : 'CASH';

    if (amountPaise > 0) {
      session3TotalPaise += amountPaise;
      const principalPortion = Math.round(amountPaise * 0.8);
      const financePortion = amountPaise - principalPortion;

      const payment = await prisma.payment.create({
        data: {
          paymentNumber: `PAY-W3-${customer.customerNumber}`,
          customerId: customer.id,
          loanId: loan.id,
          lineId: line.id,
          amountPaise,
          principalPaidPaise: principalPortion,
          financeChargePaidPaise: financePortion,
          mode,
          status: 'CONFIRMED',
          collectedById: admin.id,
          collectedAt: dateWeek3,
          createdAt: dateWeek3,
        },
      });

      const unpaidInsts = await prisma.loanInstallment.findMany({
        where: { loanId: loan.id, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        orderBy: { installmentNumber: 'asc' },
      });
      const targetInst = unpaidInsts[0] || installments[0];
      await prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          loanId: loan.id,
          installmentId: targetInst.id,
          amountPaise,
          principalPaise: principalPortion,
          financeChargePaise: financePortion,
        },
      });

      await prisma.loanInstallment.update({
        where: { id: targetInst.id },
        data: {
          totalPaidPaise: targetInst.totalPaidPaise + amountPaise,
          principalPaidPaise: targetInst.principalPaidPaise + principalPortion,
          financeChargePaidPaise: targetInst.financeChargePaidPaise + financePortion,
          status: (targetInst.totalPaidPaise + amountPaise >= targetInst.totalDuePaise) ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: dateWeek3,
        },
      });

      await prisma.collectionVisit.create({
        data: {
          sessionId: session3.id,
          customerId: customer.id,
          collectorId: admin.id,
          visitedAt: dateWeek3,
          status: 'COLLECTED',
          paymentId: payment.id,
        },
      });
    } else if (['03-10-26', '10-10-26', '17-10-26'].includes(row['తేదీ (Date)'])) {
      await prisma.collectionVisit.create({
        data: {
          sessionId: session3.id,
          customerId: customer.id,
          collectorId: admin.id,
          visitedAt: dateWeek3,
          status: 'NOT_AVAILABLE',
          notes: 'Customer missed installment',
        },
      });
    }
  }

  await postLedgerEntry('COLLECTION', 'IN', session3TotalPaise, 'Session Collection #3 (24/10/26)', dateWeek3);
  console.log(`✔ Session 3 Collected: ₹${session3TotalPaise / 100}. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹98,350)`);

  // ============================================================================
  // WEEK 4: 31-10-2026 (Capital, New Customers & Collection Session #4)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('📅 PROCESSING WEEK 4: 31-10-2026 (Collection #4 & Week 4 Customers)');
  console.log('----------------------------------------------------------------');
  const dateWeek4 = new Date('2026-10-31T08:00:00.000Z');

  // 1. Partner Capital: Sattibabu ₹90k
  await prisma.partnerCapitalEntry.create({
    data: {
      entryNumber: 'CAP-20261031-001',
      partnerId: partnerSattibabu.id,
      entryType: 'ADDITIONAL_CONTRIBUTION',
      amountPaise: 9000000,
      paymentMode: 'BANK_TRANSFER',
      effectiveDate: dateWeek4,
      notes: 'Capital Contribution by Sattibabu (Investments Sheet Row 9)',
      recordedById: admin.id,
      createdAt: dateWeek4,
    },
  });

  // 2. Disburse Week 4 Customer (joined 31-10-26)
  const week4Customers = allCustomerRows.filter(r => r['తేదీ (Date)'] === '31-10-26');
  console.log(`Disbursing ${week4Customers.length} customers who joined on 31-10-26...`);
  for (const r of week4Customers) {
    await disburseCustomer(r, dateWeek4);
  }

  // 3. Outflow: ₹25,400
  const exp4 = await prisma.expense.create({
    data: {
      expenseNumber: 'EXP-20261031-001',
      cashBagId: lineCashBag.id,
      categoryId: expenseCat.id,
      amountPaise: 2540000,
      recordedById: admin.id,
      expenseDate: dateWeek4,
      description: 'Week 4 Customer Loan Disbursements & Expenses',
      approvalStatus: 'APPROVED',
      approvedById: admin.id,
      approvedAt: dateWeek4,
      isSelfApproved: true,
      createdAt: dateWeek4,
    },
  });
  await postLedgerEntry('EXPENSE', 'OUT', 2540000, 'Loan Disbursements & Operational Outflows', dateWeek4, { expenseId: exp4.id });
  console.log(`✔ Outflow: ₹25,400. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹72,950)`);

  // 4. Collection Session #4 (31-10-2026)
  const session4 = await prisma.collectionSession.create({
    data: {
      sessionNumber: 'SES-20261031-SAT-AFT',
      sessionDate: dateWeek4,
      lineId: line.id,
      status: 'COMPLETED',
      openedAt: dateWeek4,
      closedAt: new Date('2026-10-31T12:00:00.000Z'),
      openedById: admin.id,
      closedById: admin.id,
      notes: 'Week 4 Saturday Afternoon Collection Session',
      createdAt: dateWeek4,
    },
  });
  await prisma.sessionTeamMember.create({
    data: {
      sessionId: session4.id,
      userId: admin.id,
      role: 'LEAD',
    },
  });

  let session4TotalPaise = 0;
  for (const [code, { row, customer, loan, installments }] of createdCustomersMap.entries()) {
    const rawVal = row['4 (31/10/26)'];
    const amountPaise = parseRupeesToPaise(rawVal);
    const isUPI = rawVal.toUpperCase().includes('UPI');
    const mode = isUPI ? 'UPI' : 'CASH';

    if (amountPaise > 0) {
      session4TotalPaise += amountPaise;
      const principalPortion = Math.round(amountPaise * 0.8);
      const financePortion = amountPaise - principalPortion;

      const payment = await prisma.payment.create({
        data: {
          paymentNumber: `PAY-W4-${customer.customerNumber}`,
          customerId: customer.id,
          loanId: loan.id,
          lineId: line.id,
          amountPaise,
          principalPaidPaise: principalPortion,
          financeChargePaidPaise: financePortion,
          mode,
          status: 'CONFIRMED',
          collectedById: admin.id,
          collectedAt: dateWeek4,
          createdAt: dateWeek4,
        },
      });

      const unpaidInsts = await prisma.loanInstallment.findMany({
        where: { loanId: loan.id, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        orderBy: { installmentNumber: 'asc' },
      });
      const targetInst = unpaidInsts[0] || installments[0];
      await prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          loanId: loan.id,
          installmentId: targetInst.id,
          amountPaise,
          principalPaise: principalPortion,
          financeChargePaise: financePortion,
        },
      });

      await prisma.loanInstallment.update({
        where: { id: targetInst.id },
        data: {
          totalPaidPaise: targetInst.totalPaidPaise + amountPaise,
          principalPaidPaise: targetInst.principalPaidPaise + principalPortion,
          financeChargePaidPaise: targetInst.financeChargePaidPaise + financePortion,
          status: (targetInst.totalPaidPaise + amountPaise >= targetInst.totalDuePaise) ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: dateWeek4,
        },
      });

      await prisma.collectionVisit.create({
        data: {
          sessionId: session4.id,
          customerId: customer.id,
          collectorId: admin.id,
          visitedAt: dateWeek4,
          status: 'COLLECTED',
          paymentId: payment.id,
        },
      });
    } else if (['03-10-26', '10-10-26', '17-10-26', '24-10-26', '25-10-26'].includes(row['తేదీ (Date)'])) {
      await prisma.collectionVisit.create({
        data: {
          sessionId: session4.id,
          customerId: customer.id,
          collectorId: admin.id,
          visitedAt: dateWeek4,
          status: 'NOT_AVAILABLE',
          notes: 'Customer missed installment',
        },
      });
    }
  }

  await postLedgerEntry('COLLECTION', 'IN', session4TotalPaise, 'Session Collection #4 (31/10/26)', dateWeek4);
  console.log(`✔ Session 4 Collected: ₹${session4TotalPaise / 100}. Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹83,050)`);

  console.log('\n================================================================');
  console.log('🎉 VERIFICATION SUMMARY');
  console.log('================================================================');
  const totalCustomers = await prisma.customer.count();
  const totalLoans = await prisma.loan.count();
  const totalPayments = await prisma.payment.count();
  const totalSessions = await prisma.collectionSession.count();
  const totalLedgerEntries = await prisma.cashLedgerEntry.count();
  const totalPartnerCapital = await prisma.partnerCapitalEntry.aggregate({ _sum: { amountPaise: true } });
  const totalExpenses = await prisma.expense.aggregate({ _sum: { amountPaise: true } });
  const totalPaymentsCollected = await prisma.payment.aggregate({ _sum: { amountPaise: true } });

  console.log(`Total Customers Created: ${totalCustomers}`);
  console.log(`Total Loans Created: ${totalLoans}`);
  console.log(`Total Collection Sessions: ${totalSessions}`);
  console.log(`Total Payments Recorded: ${totalPayments}`);
  console.log(`Total Amount Collected: ₹${(totalPaymentsCollected._sum.amountPaise || 0) / 100} (Expected: ₹39,100)`);
  console.log(`Total Expenses / Outflow: ₹${(totalExpenses._sum.amountPaise || 0) / 100} (Expected: ₹456,050)`);
  console.log(`Total Partner Capital: ₹${(totalPartnerCapital._sum.amountPaise || 0) / 100} (Expected: ₹590,000)`);
  console.log(`Final Line Cash Bag Balance: ₹${currentBagBalancePaise / 100} (Expected: ₹83,050)`);
  console.log('================================================================');
}

main()
  .catch((e) => {
    console.error('❌ Error during import:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

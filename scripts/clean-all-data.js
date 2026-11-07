import prisma from '../src/lib/prisma.js';

async function cleanAllData() {
  console.log('=== WIPING ALL TRIAL / TEST DATA FROM DATABASE ===\n');

  // Verify Admin User to preserve
  const adminUser = await prisma.userProfile.findFirst({
    where: { email: 'prudhvi.inumarthi12@gmail.com' },
  });
  console.log(`Preserving Admin user: ${adminUser?.fullName} (${adminUser?.email})`);

  // 1. Visit & GPS Logs
  const gpsDeleted = await prisma.visitGPSLog.deleteMany({});
  console.log(`✓ Deleted ${gpsDeleted.count} Visit GPS logs`);

  const visitsDeleted = await prisma.collectionVisit.deleteMany({});
  console.log(`✓ Deleted ${visitsDeleted.count} Collection Visits`);

  // 2. Collection Sessions & Team
  const teamDeleted = await prisma.sessionTeamMember.deleteMany({});
  console.log(`✓ Deleted ${teamDeleted.count} Session Team members`);

  const sessionsDeleted = await prisma.collectionSession.deleteMany({});
  console.log(`✓ Deleted ${sessionsDeleted.count} Collection Sessions`);

  // 3. Cash Ledgers, Transfers, Expenses, Handovers & Reconciliations
  const ledgerDeleted = await prisma.cashLedgerEntry.deleteMany({});
  console.log(`✓ Deleted ${ledgerDeleted.count} Cash Ledger entries`);

  const transfersDeleted = await prisma.cashTransfer.deleteMany({});
  console.log(`✓ Deleted ${transfersDeleted.count} Cash Transfers`);

  const handoversDeleted = await prisma.cashHandover.deleteMany({});
  console.log(`✓ Deleted ${handoversDeleted.count} Cash Handovers`);

  const expensesDeleted = await prisma.expense.deleteMany({});
  console.log(`✓ Deleted ${expensesDeleted.count} Expenses`);

  const reconciliationsDeleted = await prisma.cashReconciliation.deleteMany({});
  console.log(`✓ Deleted ${reconciliationsDeleted.count} Cash Reconciliations`);

  const partnerCapsDeleted = await prisma.partnerCapitalEntry.deleteMany({});
  console.log(`✓ Deleted ${partnerCapsDeleted.count} Partner Capital Entries`);

  const partnerRatiosDeleted = await prisma.partnerRatio.deleteMany({});
  console.log(`✓ Deleted ${partnerRatiosDeleted.count} Partner Ratios`);

  const partnerWithdrawalsDeleted = await prisma.partnerWithdrawal.deleteMany({});
  console.log(`✓ Deleted ${partnerWithdrawalsDeleted.count} Partner Withdrawals`);

  const partnersDeleted = await prisma.partner.deleteMany({});
  console.log(`✓ Deleted ${partnersDeleted.count} Partners`);

  const openingsDeleted = await prisma.cashBagOpening.deleteMany({});
  console.log(`✓ Deleted ${openingsDeleted.count} Cash Bag Openings`);

  // 4. Payments, Allocations & Advance Credits
  const reversalsDeleted = await prisma.paymentReversal.deleteMany({});
  console.log(`✓ Deleted ${reversalsDeleted.count} Payment Reversals`);

  const advanceCreditsDeleted = await prisma.customerAdvanceCreditEntry.deleteMany({});
  console.log(`✓ Deleted ${advanceCreditsDeleted.count} Advance Credit entries`);

  const allocationsDeleted = await prisma.paymentAllocation.deleteMany({});
  console.log(`✓ Deleted ${allocationsDeleted.count} Payment Allocations`);

  const paymentsDeleted = await prisma.payment.deleteMany({});
  console.log(`✓ Deleted ${paymentsDeleted.count} Payments`);

  // 5. Loan Installments, Schedules, Approvals, Cancellations & Loans
  const recoveriesDeleted = await prisma.recoveryAllocation.deleteMany({});
  console.log(`✓ Deleted ${recoveriesDeleted.count} Recovery Allocations`);

  const cancellationsDeleted = await prisma.loanCancellation.deleteMany({});
  console.log(`✓ Deleted ${cancellationsDeleted.count} Loan Cancellations`);

  const installmentsDeleted = await prisma.loanInstallment.deleteMany({});
  console.log(`✓ Deleted ${installmentsDeleted.count} Loan Installments`);

  const scheduleVersionsDeleted = await prisma.loanScheduleVersion.deleteMany({});
  console.log(`✓ Deleted ${scheduleVersionsDeleted.count} Loan Schedule Versions`);

  const disbursementsDeleted = await prisma.loanDisbursement.deleteMany({});
  console.log(`✓ Deleted ${disbursementsDeleted.count} Loan Disbursements`);

  const approvalsDeleted = await prisma.loanApproval.deleteMany({});
  console.log(`✓ Deleted ${approvalsDeleted.count} Loan Approvals`);

  const loansDeleted = await prisma.loan.deleteMany({});
  console.log(`✓ Deleted ${loansDeleted.count} Loans`);

  // 6. Customers & Related Profiles
  const lineAssignmentsDeleted = await prisma.customerLineAssignment.deleteMany({});
  console.log(`✓ Deleted ${lineAssignmentsDeleted.count} Customer Line Assignments`);

  const phonesDeleted = await prisma.customerPhone.deleteMany({});
  console.log(`✓ Deleted ${phonesDeleted.count} Customer Phones`);

  const locationsDeleted = await prisma.customerLocation.deleteMany({});
  console.log(`✓ Deleted ${locationsDeleted.count} Customer Locations`);

  const addressesDeleted = await prisma.customerAddress.deleteMany({});
  console.log(`✓ Deleted ${addressesDeleted.count} Customer Addresses`);

  const docsDeleted = await prisma.customerDocument.deleteMany({});
  console.log(`✓ Deleted ${docsDeleted.count} Customer Documents`);

  const customersDeleted = await prisma.customer.deleteMany({});
  console.log(`✓ Deleted ${customersDeleted.count} Customers`);

  // 7. Non-Vault Cash Bags & Lines
  const bagsDeleted = await prisma.cashBag.deleteMany({
    where: { code: { not: 'VAULT-MAIN' } },
  });
  console.log(`✓ Deleted ${bagsDeleted.count} Line Cash Bags`);

  const linesDeleted = await prisma.line.deleteMany({});
  console.log(`✓ Deleted ${linesDeleted.count} Lines`);

  const areasDeleted = await prisma.area.deleteMany({});
  console.log(`✓ Deleted ${areasDeleted.count} Areas`);

  const villagesDeleted = await prisma.village.deleteMany({});
  console.log(`✓ Deleted ${villagesDeleted.count} Villages`);

  // 8. Audit Logs generated during trial testing
  const auditDeleted = await prisma.auditLog.deleteMany({});
  console.log(`✓ Deleted ${auditDeleted.count} Audit Logs`);

  console.log('\n======================================================');
  console.log('✅ DATABASE HAS BEEN COMPLETELY WIPED CLEAN!');
  console.log('- 0 Customers');
  console.log('- 0 Loans');
  console.log('- 0 Payments');
  console.log('- 0 Collection Sessions');
  console.log('- 0 Cash Ledger Entries');
  console.log('- Preserved: Admin User & Loan Schemes definitions');
  console.log('======================================================\n');
}

cleanAllData()
  .catch((err) => {
    console.error('❌ Error during wipe:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

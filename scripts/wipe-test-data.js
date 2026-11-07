import prisma from '../src/lib/prisma.js';

const ADMIN_EMAIL = 'prudhvi.inumarthi12@gmail.com';

async function wipeTestData() {
  console.log('\n======================================================');
  console.log('🧹 STARTING DATABASE CLEANUP: REMOVING ALL TEST DATA');
  console.log('======================================================\n');

  // Verify the admin user exists before wiping
  const admin = await prisma.userProfile.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (!admin) {
    throw new Error(`Safety stop: Master Admin (${ADMIN_EMAIL}) was not found.`);
  }

  console.log(`✓ Master Admin verified: ${admin.fullName} (${admin.email})\n`);

  // Step 1: Delete transactional, operational, and financial test records
  console.log('1. Wiping collection sessions, visits, and GPS logs...');
  await prisma.visitGPSLog.deleteMany({});
  await prisma.collectionVisit.deleteMany({});
  await prisma.sessionTeamMember.deleteMany({});
  await prisma.collectionSession.deleteMany({});

  console.log('2. Wiping payments, allocations, reversals, and advance credits...');
  await prisma.recoveryAllocation.deleteMany({});
  await prisma.paymentAllocation.deleteMany({});
  await prisma.paymentReversal.deleteMany({});
  await prisma.customerAdvanceCreditEntry.deleteMany({});
  await prisma.payment.deleteMany({});

  console.log('3. Wiping loans, installments, disbursements, and schedules...');
  await prisma.loanCancellation.deleteMany({});
  await prisma.loanInstallment.deleteMany({});
  await prisma.loanScheduleVersion.deleteMany({});
  await prisma.loanDisbursement.deleteMany({});
  await prisma.loanApproval.deleteMany({});
  await prisma.loan.deleteMany({});

  console.log('4. Wiping customers, phones, addresses, locations, and documents...');
  await prisma.customerDocument.deleteMany({});
  await prisma.customerLocation.deleteMany({});
  await prisma.customerAddress.deleteMany({});
  await prisma.customerPhone.deleteMany({});
  await prisma.customerLineAssignment.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.mediaAsset.deleteMany({});

  console.log('5. Wiping cash bags, ledger entries, reconciliations, and transfers...');
  await prisma.cashTransfer.deleteMany({});
  await prisma.cashHandover.deleteMany({});
  await prisma.cashReconciliation.deleteMany({});
  await prisma.cashLedgerEntry.deleteMany({});
  await prisma.cashBagOpening.deleteMany({});
  await prisma.cashBag.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.expenseCategory.deleteMany({});

  console.log('6. Wiping partner capital, ratios, profit/loss periods, and distributions...');
  await prisma.profitDistributionDetail.deleteMany({});
  await prisma.profitDistribution.deleteMany({});
  await prisma.profitPeriod.deleteMany({});
  await prisma.lossAllocationDetail.deleteMany({});
  await prisma.lossAllocation.deleteMany({});
  await prisma.lossPeriod.deleteMany({});
  await prisma.partnerWithdrawal.deleteMany({});
  await prisma.partnerRatio.deleteMany({});
  await prisma.partnerCapitalEntry.deleteMany({});
  await prisma.partner.deleteMany({});

  console.log('7. Wiping test lines, areas, and villages...');
  await prisma.line.deleteMany({});
  await prisma.area.deleteMany({});
  await prisma.village.deleteMany({});

  console.log('8. Wiping notifications, sync conflicts, and audit logs...');
  await prisma.notification.deleteMany({});
  await prisma.syncConflict.deleteMany({});
  await prisma.auditLog.deleteMany({});

  console.log('9. Wiping test collector users (preserving Master Admin)...');
  await prisma.deviceRegistration.deleteMany({
    where: { userId: { not: admin.id } },
  });
  await prisma.userDataScope.deleteMany({
    where: { userId: { not: admin.id } },
  });
  await prisma.userRole.deleteMany({
    where: { userId: { not: admin.id } },
  });
  await prisma.userProfile.deleteMany({
    where: { id: { not: admin.id } },
  });

  console.log('\n======================================================');
  console.log('✅ ALL TEST DATA HAS BEEN COMPLETELY REMOVED!');
  console.log('======================================================\n');

  console.log('--- Current Database State ---');
  const remainingCounts = {
    customers: await prisma.customer.count(),
    loans: await prisma.loan.count(),
    installments: await prisma.loanInstallment.count(),
    payments: await prisma.payment.count(),
    cashBags: await prisma.cashBag.count(),
    cashLedger: await prisma.cashLedgerEntry.count(),
    partners: await prisma.partner.count(),
    profitPeriods: await prisma.profitPeriod.count(),
    villages: await prisma.village.count(),
    lines: await prisma.line.count(),
    auditLogs: await prisma.auditLog.count(),
    users: await prisma.userProfile.count(),
  };
  console.table(remainingCounts);

  const activeAdmin = await prisma.userProfile.findUnique({
    where: { email: ADMIN_EMAIL },
    include: { userRoles: { include: { role: true } } },
  });

  console.log('Preserved Master Admin:');
  console.log(`  Name:  ${activeAdmin.fullName}`);
  console.log(`  Email: ${activeAdmin.email}`);
  console.log(`  Roles: ${activeAdmin.userRoles.map((ur) => ur.role.name).join(', ')}`);
}

wipeTestData()
  .catch((err) => {
    console.error('\n❌ Cleanup error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

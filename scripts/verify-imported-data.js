import prisma from '../src/lib/prisma.js';
import { paiseToRupees } from '../src/lib/money/index.js';

async function main() {
  console.log('=== VERIFYING IMPORTED PRODUCTION DATA ===\n');

  const [villages, areas, lines, cashBags, customers, loans, installments, payments, sessions, ledgerEntries] = await Promise.all([
    prisma.village.findMany({ include: { areas: true } }),
    prisma.area.findMany(),
    prisma.line.findMany(),
    prisma.cashBag.findMany(),
    prisma.customer.findMany({ include: { village: true, area: true, phones: true, loans: true } }),
    prisma.loan.findMany({ include: { scheme: true, installments: true, payments: true } }),
    prisma.loanInstallment.findMany(),
    prisma.payment.findMany({ include: { customer: true, allocations: true } }),
    prisma.collectionSession.findMany({ include: { visits: true } }),
    prisma.cashLedgerEntry.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);

  console.log(`Villages (${villages.length}):`, villages.map(v => `${v.name} (${v.code})`).join(', '));
  console.log(`Areas (${areas.length}):`, areas.map(a => a.name).join(', '));
  console.log(`Lines (${lines.length}):`, lines.map(l => `${l.name} (${l.code})`).join(', '));
  console.log(`Cash Bags (${cashBags.length}):`, cashBags.map(b => `${b.name} (${b.code})`).join(', '));
  console.log(`Customers: ${customers.length}`);
  console.log(`Loans: ${loans.length}`);
  console.log(`Installments: ${installments.length}`);
  console.log(`Payments: ${payments.length}`);
  console.log(`Sessions: ${sessions.length}`);

  const totalSanctionedPaise = loans.reduce((acc, l) => acc + l.sanctionedPrincipalPaise, 0);
  const totalRepaymentPaise = loans.reduce((acc, l) => acc + l.totalRepaymentPaise, 0);
  const totalPaidPaise = payments.reduce((acc, p) => acc + p.amountPaise, 0);

  console.log(`\nPortfolio Financials:`);
  console.log(`- Total Sanctioned Principal: ₹${paiseToRupees(totalSanctionedPaise).toLocaleString('en-IN')}`);
  console.log(`- Total Scheduled Repayment: ₹${paiseToRupees(totalRepaymentPaise).toLocaleString('en-IN')}`);
  console.log(`- Total Repayments Collected: ₹${paiseToRupees(totalPaidPaise).toLocaleString('en-IN')}`);

  console.log(`\nCollection Sessions:`);
  for (const s of sessions) {
    const sPayments = payments.filter(p => p.collectedAt.toISOString().slice(0, 10) === s.sessionDate.toISOString().slice(0, 10));
    const sTotal = sPayments.reduce((acc, p) => acc + p.amountPaise, 0);
    console.log(`- ${s.sessionNumber} (${s.sessionDate.toISOString().slice(0, 10)}): ${sPayments.length} payments, ₹${paiseToRupees(sTotal).toLocaleString('en-IN')}, ${s.visits.length} visits logged`);
  }

  console.log('\nTop 5 Sample Customers:');
  customers.slice(0, 5).forEach((c, idx) => {
    const loan = c.loans[0];
    const phone = c.phones[0]?.phoneNumber || 'None';
    console.log(`${idx + 1}. [${c.customerNumber}] ${c.fullName} | Village: ${c.village.name} | Phone: ${phone} | Loan: ₹${loan ? paiseToRupees(loan.totalRepaymentPaise) : 0}`);
  });
}

main().catch(console.error).finally(() => process.exit(0));

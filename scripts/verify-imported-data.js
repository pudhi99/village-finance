import prisma from '../src/lib/prisma.js';

async function verify() {
  console.log('=== VERIFYING IMPORTED PRODUCTION DATA ===\n');

  // 1. Sessions
  const sessions = await prisma.collectionSession.findMany({
    include: {
      visits: { include: { payment: true } },
      line: true,
    },
    orderBy: { sessionDate: 'asc' },
  });

  console.log('--- Collection Sessions ---');
  sessions.forEach(s => {
    const totalCollected = s.visits.reduce((acc, v) => acc + (v.payment?.amountPaise || 0), 0) / 100;
    const collectedVisits = s.visits.filter(v => v.status === 'COLLECTED').length;
    const missedVisits = s.visits.filter(v => v.status === 'NOT_AVAILABLE').length;
    console.log(`[${s.sessionDate.toISOString().slice(0, 10)}] ${s.sessionNumber}: Collected ₹${totalCollected.toLocaleString('en-IN')} | Visits: ${s.visits.length} (${collectedVisits} Paid, ${missedVisits} Missed)`);
  });

  // 2. Partners
  console.log('\n--- Partners & Capital ---');
  const partners = await prisma.partner.findMany({
    include: { capitalEntries: true },
  });
  partners.forEach(p => {
    const totalCap = p.capitalEntries.reduce((sum, c) => sum + c.amountPaise, 0) / 100;
    console.log(`${p.name} (${p.partnerCode}): Total Capital ₹${totalCap.toLocaleString('en-IN')} across ${p.capitalEntries.length} entries`);
  });

  // 3. Cash Bag
  console.log('\n--- Cash Bag & Ledger ---');
  const bags = await prisma.cashBag.findMany({
    include: {
      ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  bags.forEach(b => {
    const lastEntry = b.ledgerEntries[0];
    console.log(`${b.name} (${b.code}): Balance ₹${((lastEntry?.balanceAfterPaise || 0) / 100).toLocaleString('en-IN')}`);
  });

  // 4. Customers
  const totalCust = await prisma.customer.count();
  const edlCust = await prisma.customer.count({ where: { village: { code: 'VIL-EDL' } } });
  const ktpCust = await prisma.customer.count({ where: { village: { code: 'VIL-KTP' } } });
  console.log(`\n--- Customers Total: ${totalCust} (Edurlanka: ${edlCust}, Kothapalli: ${ktpCust}) ---`);
}

verify().catch(console.error).finally(() => prisma.$disconnect());

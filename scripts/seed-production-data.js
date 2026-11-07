import fs from 'fs';
import prisma from '../src/lib/prisma.js';

function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  return lines.map((line) => {
    const matches = [];
    let cur = '',
      inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        matches.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    matches.push(cur.trim());
    return matches;
  });
}

function cleanNum(val) {
  if (!val) return 0;
  return parseInt(val.replace(/,/g, '').trim(), 10) || 0;
}

function parseDate(dStr) {
  const parts = dStr.split('-');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (year < 100) year += 2000;
  return new Date(Date.UTC(year, month - 1, day, 10, 0, 0));
}

async function main() {
  console.log('=== VILLAGE FINANCE PRODUCTION SEEDING SCRIPT ===\n');

  // 1. Verify Admin User
  const adminUser = await prisma.userProfile.findFirst({
    where: { email: 'prudhvi.inumarthi12@gmail.com' },
  });
  if (!adminUser) {
    throw new Error('Admin user prudhvi.inumarthi12@gmail.com not found in database!');
  }
  console.log(`✓ Admin user verified: ${adminUser.fullName} (${adminUser.id})`);

  // 1b. Clean existing transactional & customer records
  console.log('\n--- Cleaning any existing operational data ---');
  await prisma.cashLedgerEntry.deleteMany({});
  await prisma.collectionVisit.deleteMany({});
  await prisma.collectionSession.deleteMany({});
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.loanInstallment.deleteMany({});
  await prisma.loanScheduleVersion.deleteMany({});
  await prisma.loanDisbursement.deleteMany({});
  await prisma.loan.deleteMany({});
  await prisma.customerLineAssignment.deleteMany({});
  await prisma.customerPhone.deleteMany({});
  await prisma.customerLocation.deleteMany({});
  await prisma.customerAddress.deleteMany({});
  await prisma.customerDocument.deleteMany({});
  await prisma.customer.deleteMany({});
  console.log('✓ Cleaned transactional tables for clean production seed.');

  // 2. Loan Schemes Configuration
  console.log('\n--- Configuring Loan Schemes ---');
  const schemeDefs = [
    {
      code: 'W10K',
      name: '₹10,000 Weekly Scheme',
      frequency: 'WEEKLY',
      description: 'Standard 25-week micro-loan with ₹500 weekly repayments (₹400 principal + ₹100 finance charge).',
      principalPaise: 1000000,
      totalFinanceChargePaise: 250000,
      totalRepaymentPaise: 1250000,
      installmentCount: 25,
      rules: Array.from({ length: 25 }, (_, i) => ({
        installmentNumber: i + 1,
        dueOffsetDays: (i + 1) * 7,
        principalDuePaise: 40000,
        financeChargeDuePaise: 10000,
        totalDuePaise: 50000,
      })),
    },
    {
      code: 'W20K',
      name: '₹20,000 Weekly Scheme',
      frequency: 'WEEKLY',
      description: 'Standard 25-week micro-loan with ₹1,000 weekly repayments (₹800 principal + ₹200 finance charge).',
      principalPaise: 2000000,
      totalFinanceChargePaise: 500000,
      totalRepaymentPaise: 2500000,
      installmentCount: 25,
      rules: Array.from({ length: 25 }, (_, i) => ({
        installmentNumber: i + 1,
        dueOffsetDays: (i + 1) * 7,
        principalDuePaise: 80000,
        financeChargeDuePaise: 20000,
        totalDuePaise: 100000,
      })),
    },
    {
      code: 'W5K',
      name: '₹5,000 Weekly Scheme',
      frequency: 'WEEKLY',
      description: '26-week micro-loan with 25 installments of ₹250 and final installment of ₹50.',
      principalPaise: 500000,
      totalFinanceChargePaise: 130000,
      totalRepaymentPaise: 630000,
      installmentCount: 26,
      rules: [
        ...Array.from({ length: 25 }, (_, i) => ({
          installmentNumber: i + 1,
          dueOffsetDays: (i + 1) * 7,
          principalDuePaise: 19800,
          financeChargeDuePaise: 5200,
          totalDuePaise: 25000,
        })),
        {
          installmentNumber: 26,
          dueOffsetDays: 26 * 7,
          principalDuePaise: 5000,
          financeChargeDuePaise: 0,
          totalDuePaise: 5000,
        },
      ],
    },
    {
      code: 'W4K',
      name: '₹4,000 Weekly Scheme',
      frequency: 'WEEKLY',
      description: '25-week micro-loan with ₹200 weekly repayments (₹160 principal + ₹40 finance charge). Total ₹5,000.',
      principalPaise: 400000,
      totalFinanceChargePaise: 100000,
      totalRepaymentPaise: 500000,
      installmentCount: 25,
      rules: Array.from({ length: 25 }, (_, i) => ({
        installmentNumber: i + 1,
        dueOffsetDays: (i + 1) * 7,
        principalDuePaise: 16000,
        financeChargeDuePaise: 4000,
        totalDuePaise: 20000,
      })),
    },
    {
      code: 'W1K',
      name: '₹1,000 Weekly Scheme',
      frequency: 'WEEKLY',
      description: '13-week micro-loan with 12 installments of ₹100 and final installment of ₹50. Total ₹1,250.',
      principalPaise: 100000,
      totalFinanceChargePaise: 25000,
      totalRepaymentPaise: 125000,
      installmentCount: 13,
      rules: [
        ...Array.from({ length: 12 }, (_, i) => ({
          installmentNumber: i + 1,
          dueOffsetDays: (i + 1) * 7,
          principalDuePaise: 8000,
          financeChargeDuePaise: 2000,
          totalDuePaise: 10000,
        })),
        {
          installmentNumber: 13,
          dueOffsetDays: 13 * 7,
          principalDuePaise: 4000,
          financeChargeDuePaise: 1000,
          totalDuePaise: 5000,
        },
      ],
    },
    {
      code: 'M10K',
      name: '₹10,000 Monthly Scheme',
      frequency: 'MONTHLY',
      description: '6-month micro-loan with 5 installments of ₹2,100 and final installment of ₹2,000. Total ₹12,500.',
      principalPaise: 1000000,
      totalFinanceChargePaise: 250000,
      totalRepaymentPaise: 1250000,
      installmentCount: 6,
      rules: [
        ...Array.from({ length: 5 }, (_, i) => ({
          installmentNumber: i + 1,
          dueOffsetDays: (i + 1) * 30,
          principalDuePaise: 168000,
          financeChargeDuePaise: 42000,
          totalDuePaise: 210000,
        })),
        {
          installmentNumber: 6,
          dueOffsetDays: 180,
          principalDuePaise: 160000,
          financeChargeDuePaise: 40000,
          totalDuePaise: 200000,
        },
      ],
    },
    {
      code: 'M5K',
      name: '₹5,000 Monthly Scheme',
      frequency: 'MONTHLY',
      description: '6-month micro-loan with 6 installments of ₹1,050. Total ₹6,300.',
      principalPaise: 500000,
      totalFinanceChargePaise: 130000,
      totalRepaymentPaise: 630000,
      installmentCount: 6,
      rules: Array.from({ length: 6 }, (_, i) => ({
        installmentNumber: i + 1,
        dueOffsetDays: (i + 1) * 30,
        principalDuePaise: 83333,
        financeChargeDuePaise: 21667,
        totalDuePaise: 105000,
      })),
    },
    {
      code: 'M2K',
      name: '₹2,000 Monthly Scheme',
      frequency: 'MONTHLY',
      description: '5-month micro-loan with 5 installments of ₹500. Total ₹2,500.',
      principalPaise: 200000,
      totalFinanceChargePaise: 50000,
      totalRepaymentPaise: 250000,
      installmentCount: 5,
      rules: Array.from({ length: 5 }, (_, i) => ({
        installmentNumber: i + 1,
        dueOffsetDays: (i + 1) * 30,
        principalDuePaise: 40000,
        financeChargeDuePaise: 10000,
        totalDuePaise: 50000,
      })),
    },
  ];

  const schemeVersionMap = {};

  for (const s of schemeDefs) {
    const scheme = await prisma.loanScheme.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        frequency: s.frequency,
        description: s.description,
      },
      create: {
        name: s.name,
        code: s.code,
        frequency: s.frequency,
        description: s.description,
        isActive: true,
      },
    });

    const version = await prisma.loanSchemeVersion.upsert({
      where: {
        schemeId_versionNumber: {
          schemeId: scheme.id,
          versionNumber: 1,
        },
      },
      update: {
        principalPaise: s.principalPaise,
        totalFinanceChargePaise: s.totalFinanceChargePaise,
        totalRepaymentPaise: s.totalRepaymentPaise,
        installmentCount: s.installmentCount,
      },
      create: {
        schemeId: scheme.id,
        versionNumber: 1,
        principalPaise: s.principalPaise,
        totalFinanceChargePaise: s.totalFinanceChargePaise,
        totalRepaymentPaise: s.totalRepaymentPaise,
        installmentCount: s.installmentCount,
        isActive: true,
      },
    });

    await prisma.loanSchemeInstallmentRule.deleteMany({
      where: { schemeVersionId: version.id },
    });

    await prisma.loanSchemeInstallmentRule.createMany({
      data: s.rules.map((r) => ({
        schemeVersionId: version.id,
        installmentNumber: r.installmentNumber,
        dueOffsetDays: r.dueOffsetDays,
        principalDuePaise: r.principalDuePaise,
        financeChargeDuePaise: r.financeChargeDuePaise,
        totalDuePaise: r.totalDuePaise,
      })),
    });

    schemeVersionMap[s.code] = {
      schemeId: scheme.id,
      versionId: version.id,
      ...s,
    };
    console.log(`  ✓ Scheme ${s.code} (${s.name}) ready with ${s.rules.length} installment rules.`);
  }

  // 3. Create Villages
  console.log('\n--- Creating Villages & Areas ---');
  const edurlanka = await prisma.village.upsert({
    where: { code: 'EDL' },
    update: {
      name: 'Edurlanka (ఎదుర్లంక)',
      district: 'Dr. B.R. Ambedkar Konaseema',
      state: 'Andhra Pradesh',
    },
    create: {
      code: 'EDL',
      name: 'Edurlanka (ఎదుర్లంక)',
      district: 'Dr. B.R. Ambedkar Konaseema',
      state: 'Andhra Pradesh',
    },
  });
  console.log(`✓ Village created: ${edurlanka.name} (${edurlanka.code})`);

  const kothapalli = await prisma.village.upsert({
    where: { code: 'KTP' },
    update: {
      name: 'Kothapalli (కొత్తపల్లి)',
      district: 'Dr. B.R. Ambedkar Konaseema',
      state: 'Andhra Pradesh',
    },
    create: {
      code: 'KTP',
      name: 'Kothapalli (కొత్తపల్లి)',
      district: 'Dr. B.R. Ambedkar Konaseema',
      state: 'Andhra Pradesh',
    },
  });
  console.log(`✓ Village created: ${kothapalli.name} (${kothapalli.code})`);

  // Jagan Colony Area under Edurlanka
  const jaganColony = await prisma.area.upsert({
    where: {
      villageId_name: {
        villageId: edurlanka.id,
        name: 'Jagan Colony (జగన్ కాలనీ)',
      },
    },
    update: {},
    create: {
      villageId: edurlanka.id,
      name: 'Jagan Colony (జగన్ కాలనీ)',
      landmark: 'Jagan Colony, Edurlanka',
    },
  });
  console.log(`✓ Area created: ${jaganColony.name} under ${edurlanka.name}`);

  // 4. Create Collection Line: Saturday Afternoon Line
  console.log('\n--- Creating Saturday Afternoon Collection Line ---');
  const line = await prisma.line.upsert({
    where: { code: 'SAT-AFT' },
    update: {
      name: 'Saturday Afternoon Line (శనివారం మధ్యాహ్నం)',
      weekday: 'SATURDAY',
      session: 'AFTERNOON',
      description: 'Weekly Saturday afternoon collection route covering Edurlanka and Kothapalli villages.',
    },
    create: {
      code: 'SAT-AFT',
      name: 'Saturday Afternoon Line (శనివారం మధ్యాహ్నం)',
      weekday: 'SATURDAY',
      session: 'AFTERNOON',
      description: 'Weekly Saturday afternoon collection route covering Edurlanka and Kothapalli villages.',
    },
  });
  console.log(`✓ Collection Line created: ${line.name} (${line.code})`);

  // Line Cash Bag
  const lineCashBag = await prisma.cashBag.upsert({
    where: { lineId: line.id },
    update: {
      name: 'Saturday Afternoon Cash Bag',
      code: 'CB-SAT-AFT',
    },
    create: {
      name: 'Saturday Afternoon Cash Bag',
      code: 'CB-SAT-AFT',
      lineId: line.id,
      description: 'Field collection cash bag for Saturday Afternoon Line.',
    },
  });
  console.log(`✓ Cash Bag provisioned: ${lineCashBag.name} (${lineCashBag.code})`);

  // 5. Read and Parse CSV Data
  console.log('\n--- Reading Customer & Loan Data ---');
  const edurlankaRaw = parseCSV(fs.readFileSync('scripts/sheet_gid_0.csv', 'utf8')).slice(1, -1);
  const kothapalliRaw = parseCSV(fs.readFileSync('scripts/sheet_gid_2013296151.csv', 'utf8')).slice(1, -1);

  const customerItems = [];

  edurlankaRaw.forEach((r, idx) => {
    customerItems.push({
      villageCode: 'EDL',
      villageId: edurlanka.id,
      joinedDate: parseDate(r[0]),
      joinedDateStr: r[0],
      sno: r[1],
      teluguName: r[2],
      englishName: r[3],
      loanAmount: cleanNum(r[4]),
      phone: r[5] ? r[5].replace(/\D/g, '').trim() : null,
      colony: r[6] || null,
      paymentType: r[7] || 'Weekly',
      w1: cleanNum(r[8]),
      w2: cleanNum(r[9]),
      w3: cleanNum(r[10]),
      remarks: r[11] || null,
    });
  });

  kothapalliRaw.forEach((r, idx) => {
    customerItems.push({
      villageCode: 'KTP',
      villageId: kothapalli.id,
      joinedDate: parseDate(r[0]),
      joinedDateStr: r[0],
      sno: r[1],
      teluguName: r[2],
      englishName: r[3],
      loanAmount: cleanNum(r[4]),
      phone: r[5] ? r[5].replace(/\D/g, '').trim() : null,
      colony: r[6] || null,
      paymentType: r[7] || 'Weekly',
      w1: cleanNum(r[8]),
      w2: cleanNum(r[9]),
      w3: cleanNum(r[10]),
      remarks: r[11] || null,
    });
  });

  console.log(`Total customers to import: ${customerItems.length}`);

  // 6. Create Customers and Loans
  console.log('\n--- Creating Customers, Loan Contracts & Schedules ---');
  const createdCustomers = [];
  const createdLoans = [];

  for (let i = 0; i < customerItems.length; i++) {
    const item = customerItems[i];
    const custNum = `VF-CUST-${10001 + i}`;
    const loanNum = `VF-LN-${10001 + i}`;

    const isJaganColony = item.colony && item.colony.includes('జగన్');
    const areaId = isJaganColony ? jaganColony.id : null;

    // Pick scheme version
    let schemeCode = 'W10K';
    const isMonthly = item.paymentType.includes('నెల') || item.paymentType.includes('Monthly');

    if (isMonthly) {
      if (item.loanAmount === 12500) schemeCode = 'M10K';
      else if (item.loanAmount === 6300) schemeCode = 'M5K';
      else if (item.loanAmount === 2500) schemeCode = 'M2K';
      else schemeCode = 'M10K';
    } else {
      if (item.loanAmount === 12500) schemeCode = 'W10K';
      else if (item.loanAmount === 25000) schemeCode = 'W20K';
      else if (item.loanAmount === 6300) schemeCode = 'W5K';
      else if (item.loanAmount === 5000) schemeCode = 'W4K';
      else if (item.loanAmount === 1250) schemeCode = 'W1K';
      else schemeCode = 'W10K';
    }

    const schemeInfo = schemeVersionMap[schemeCode];

    // Create Customer
    const fullName = `${item.englishName} (${item.teluguName})`;
    const customer = await prisma.customer.create({
      data: {
        customerNumber: custNum,
        fullName,
        villageId: item.villageId,
        areaId,
        status: 'ACTIVE',
        createdAt: item.joinedDate,
        updatedAt: item.joinedDate,
        ...(item.phone
          ? {
              phones: {
                create: {
                  phoneNumber: item.phone,
                  phoneType: 'PRIMARY',
                  isPrimary: true,
                },
              },
            }
          : {}),
        lineAssignments: {
          create: {
            lineId: line.id,
            assignedBy: adminUser.id,
            effectiveFrom: item.joinedDate,
            isCurrent: true,
          },
        },
      },
    });

    // Create Loan
    const loan = await prisma.loan.create({
      data: {
        loanNumber: loanNum,
        customerId: customer.id,
        schemeId: schemeInfo.schemeId,
        schemeVersionId: schemeInfo.versionId,
        requestedPrincipalPaise: schemeInfo.principalPaise,
        sanctionedPrincipalPaise: schemeInfo.principalPaise,
        totalFinanceChargePaise: schemeInfo.totalFinanceChargePaise,
        totalRepaymentPaise: schemeInfo.totalRepaymentPaise,
        status: 'ACTIVE',
        applicantId: adminUser.id,
        notes: item.remarks ? `Remarks: ${item.remarks}` : null,
        createdAt: item.joinedDate,
        updatedAt: item.joinedDate,
        disbursements: {
          create: {
            disbursementNumber: 1,
            amountPaise: schemeInfo.principalPaise,
            disbursedAt: item.joinedDate,
            mode: 'CASH',
            disbursedBy: adminUser.id,
            lineId: line.id,
            cashBagId: lineCashBag.id,
            notes: `Loan disbursed on joined date ${item.joinedDateStr}`,
          },
        },
        scheduleVersions: {
          create: {
            versionNumber: 1,
            generatedAt: item.joinedDate,
            generatedReason: 'INITIAL_DISBURSEMENT',
            totalPrincipalPaise: schemeInfo.principalPaise,
            totalFinanceChargePaise: schemeInfo.totalFinanceChargePaise,
            totalRepaymentPaise: schemeInfo.totalRepaymentPaise,
            isCurrent: true,
          },
        },
      },
      include: {
        scheduleVersions: true,
      },
    });

    // Create Installments
    const scheduleVersion = loan.scheduleVersions[0];
    const installmentData = schemeInfo.rules.map((rule) => {
      const dueDate = new Date(item.joinedDate.getTime() + rule.dueOffsetDays * 24 * 60 * 60 * 1000);
      return {
        scheduleVersionId: scheduleVersion.id,
        loanId: loan.id,
        installmentNumber: rule.installmentNumber,
        dueDate,
        principalDuePaise: rule.principalDuePaise,
        financeChargeDuePaise: rule.financeChargeDuePaise,
        totalDuePaise: rule.totalDuePaise,
        principalPaidPaise: 0,
        financeChargePaidPaise: 0,
        totalPaidPaise: 0,
        status: 'PENDING',
      };
    });

    await prisma.loanInstallment.createMany({
      data: installmentData,
    });

    createdCustomers.push(customer);
    createdLoans.push({
      ...loan,
      customer,
      item,
    });

    if ((i + 1) % 10 === 0 || i === customerItems.length - 1) {
      console.log(`  Imported ${i + 1}/${customerItems.length} customers and loans...`);
    }
  }

  // 7. Create Collection Sessions for 3 Saturdays
  console.log('\n--- Creating Collection Sessions ---');
  const collectionDates = [
    { key: 'w1', dateStr: '10/10/26', date: new Date(Date.UTC(2026, 9, 10, 14, 0, 0)) }, // 10 Oct 2026
    { key: 'w2', dateStr: '17/10/26', date: new Date(Date.UTC(2026, 9, 17, 14, 0, 0)) }, // 17 Oct 2026
    { key: 'w3', dateStr: '24/10/26', date: new Date(Date.UTC(2026, 9, 24, 14, 0, 0)) }, // 24 Oct 2026
  ];

  let paymentCounter = 10001;
  let totalCollectedPaise = 0;

  for (const sessionInfo of collectionDates) {
    const formattedDateCode = sessionInfo.date.toISOString().slice(0, 10).replace(/-/g, '');
    const sessionNum = `SES-${formattedDateCode}-SAT-AFT`;

    const session = await prisma.collectionSession.create({
      data: {
        sessionNumber: sessionNum,
        lineId: line.id,
        sessionDate: sessionInfo.date,
        status: 'COMPLETED',
        openedAt: sessionInfo.date,
        closedAt: new Date(sessionInfo.date.getTime() + 4 * 60 * 60 * 1000), // 4 hours later
        openedById: adminUser.id,
        closedById: adminUser.id,
        notes: `Saturday Afternoon Field Collection for ${sessionInfo.dateStr}`,
        teamMembers: {
          create: {
            userId: adminUser.id,
            role: 'LEAD',
          },
        },
      },
    });

    console.log(`\n✓ Collection Session created: ${session.sessionNumber} (${sessionInfo.dateStr})`);

    let sessionTotalPaise = 0;
    let paymentCountForSession = 0;

    for (const loanRecord of createdLoans) {
      const { customer, item } = loanRecord;
      const amountRupees = item[sessionInfo.key];

      if (amountRupees > 0) {
        const paymentNum = `VF-PAY-${paymentCounter++}`;
        const amountPaise = amountRupees * 100;
        sessionTotalPaise += amountPaise;
        totalCollectedPaise += amountPaise;
        paymentCountForSession++;

        // Fetch installments FIFO
        const installments = await prisma.loanInstallment.findMany({
          where: {
            loanId: loanRecord.id,
            status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          },
          orderBy: { installmentNumber: 'asc' },
        });

        let remainingToAllocate = amountPaise;
        let totalPrincipalAllocated = 0;
        let totalFCAllocated = 0;
        const allocationsToCreate = [];

        for (const inst of installments) {
          if (remainingToAllocate <= 0) break;

          const remTotal = inst.totalDuePaise - inst.totalPaidPaise;
          const remPrincipal = inst.principalDuePaise - inst.principalPaidPaise;
          const remFC = inst.financeChargeDuePaise - inst.financeChargePaidPaise;

          if (remTotal <= 0) continue;

          const allocAmount = Math.min(remainingToAllocate, remTotal);
          let allocPrincipal = 0;
          let allocFC = 0;

          if (allocAmount === remTotal) {
            allocPrincipal = remPrincipal;
            allocFC = remFC;
          } else {
            allocPrincipal = Math.floor(allocAmount * (remPrincipal / remTotal));
            allocFC = allocAmount - allocPrincipal;
            if (allocPrincipal > remPrincipal) {
              allocPrincipal = remPrincipal;
              allocFC = allocAmount - allocPrincipal;
            } else if (allocFC > remFC) {
              allocFC = remFC;
              allocPrincipal = allocAmount - allocFC;
            }
          }

          const newTotalPaid = inst.totalPaidPaise + allocAmount;
          const isFullyPaid = newTotalPaid >= inst.totalDuePaise;

          await prisma.loanInstallment.update({
            where: { id: inst.id },
            data: {
              principalPaidPaise: inst.principalPaidPaise + allocPrincipal,
              financeChargePaidPaise: inst.financeChargePaidPaise + allocFC,
              totalPaidPaise: newTotalPaid,
              status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
              paidAt: sessionInfo.date,
            },
          });

          allocationsToCreate.push({
            installmentId: inst.id,
            amountPaise: allocAmount,
            principalPaise: allocPrincipal,
            financeChargePaise: allocFC,
          });

          totalPrincipalAllocated += allocPrincipal;
          totalFCAllocated += allocFC;
          remainingToAllocate -= allocAmount;
        }

        // Create Payment Record
        const payment = await prisma.payment.create({
          data: {
            paymentNumber: paymentNum,
            loanId: loanRecord.id,
            customerId: customer.id,
            collectedById: adminUser.id,
            lineId: line.id,
            amountPaise,
            principalPaidPaise: totalPrincipalAllocated,
            financeChargePaidPaise: totalFCAllocated,
            advanceCreditPaise: remainingToAllocate,
            mode: 'CASH',
            status: 'CONFIRMED',
            collectedAt: sessionInfo.date,
            createdAt: sessionInfo.date,
            allocations: {
              create: allocationsToCreate.map((a) => ({
                loanId: loanRecord.id,
                installmentId: a.installmentId,
                amountPaise: a.amountPaise,
                principalPaise: a.principalPaise,
                financeChargePaise: a.financeChargePaise,
                createdAt: sessionInfo.date,
              })),
            },
          },
        });

        // Record Cash Ledger Entry
        await prisma.cashLedgerEntry.create({
          data: {
            cashBagId: lineCashBag.id,
            entryType: 'COLLECTION',
            direction: 'IN',
            amountPaise,
            balanceAfterPaise: 0, // Will be computed sequentially
            actorId: adminUser.id,
            notes: `Field collection: ${customer.fullName} (${payment.paymentNumber})`,
            paymentId: payment.id,
            createdAt: sessionInfo.date,
          },
        });

        // Record Collection Visit
        await prisma.collectionVisit.create({
          data: {
            sessionId: session.id,
            customerId: customer.id,
            collectorId: adminUser.id,
            status: 'COLLECTED',
            paymentId: payment.id,
            visitedAt: sessionInfo.date,
            notes: `Collected ₹${amountRupees}`,
            createdAt: sessionInfo.date,
          },
        });
      } else {
        // Customer joined on or before this date but paid 0
        if (loanRecord.item.joinedDate <= sessionInfo.date) {
          await prisma.collectionVisit.create({
            data: {
              sessionId: session.id,
              customerId: customer.id,
              collectorId: adminUser.id,
              status: 'NOT_AVAILABLE',
              visitedAt: sessionInfo.date,
              notes: 'No collection received this week',
              createdAt: sessionInfo.date,
            },
          });
        }
      }
    }

    console.log(`  ✓ Recorded ${paymentCountForSession} payments totaling ₹${sessionTotalPaise / 100} for ${sessionInfo.dateStr}`);
  }

  // 8. Recompute Sequential Ledger Balances
  console.log('\n--- Recomputing Cash Ledger Running Balances ---');
  const ledgerEntries = await prisma.cashLedgerEntry.findMany({
    where: { cashBagId: lineCashBag.id },
    orderBy: { createdAt: 'asc' },
  });

  let runningBalancePaise = 0;
  for (const entry of ledgerEntries) {
    if (entry.direction === 'IN') {
      runningBalancePaise += entry.amountPaise;
    } else {
      runningBalancePaise -= entry.amountPaise;
    }

    await prisma.cashLedgerEntry.update({
      where: { id: entry.id },
      data: { balanceAfterPaise: runningBalancePaise },
    });
  }
  console.log(`✓ Updated ${ledgerEntries.length} ledger entries. Final Cash Bag Balance: ₹${runningBalancePaise / 100}`);

  console.log('\n======================================================');
  console.log('✅ PRODUCTION SEEDING COMPLETED SUCCESSFULLY!');
  console.log(`Total Customers Created: ${createdCustomers.length}`);
  console.log(`Total Loans Disbursed:   ${createdLoans.length}`);
  console.log(`Total Portfolio Value:   ₹${customerItems.reduce((acc, c) => acc + c.loanAmount, 0).toLocaleString('en-IN')}`);
  console.log(`Total Cash Collected:    ₹${(totalCollectedPaise / 100).toLocaleString('en-IN')}`);
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

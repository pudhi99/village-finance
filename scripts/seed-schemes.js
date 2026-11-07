import prisma from '../src/lib/prisma.js';

async function seedLoanSchemes() {
  console.log('Seeding confirmed loan schemes...');

  const schemes = [
    {
      name: '₹10,000 Weekly Scheme',
      code: 'W10K',
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
      name: '₹10,000 Monthly Scheme',
      code: 'M10K',
      frequency: 'MONTHLY',
      description: '6-month micro-loan with 5 installments of ₹2,100 and final installment of ₹2,000.',
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
      name: '₹20,000 Weekly Scheme',
      code: 'W20K',
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
      name: '₹5,000 Weekly Scheme',
      code: 'W5K',
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
  ];

  for (const s of schemes) {
    console.log(`Processing scheme ${s.code} (${s.name})...`);
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

    console.log(`Creating/updating ${s.rules.length} installment rules for ${s.code}...`);
    // Delete existing rules for this version and createMany for high performance
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
    console.log(`✔ Scheme ${s.code} seeded successfully.`);
  }

  console.log('✅ All 4 Confirmed Schemes Seeded with Zero Rounding Discrepancies!');
}

seedLoanSchemes()
  .catch((e) => {
    console.error('Failed to seed schemes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

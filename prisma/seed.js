/**
 * Prisma Seed Script — Village Finance
 * Populates standard Roles, Permissions, and RolePermission mappings.
 *
 * Usage:
 *   node --env-file=.env.local prisma/seed.js
 */
import prisma from '../src/lib/prisma.js';

const PERMISSIONS = [
  // User & security management
  { code: 'users:read', description: 'View user profiles, roles and device registrations' },
  { code: 'users:manage', description: 'Invite users, assign/revoke roles and data scopes' },
  { code: 'devices:revoke', description: 'Revoke collector registered devices' },
  { code: 'audit:read', description: 'View audit logs' },

  // Customers & Villages
  { code: 'customers:read', description: 'View customers, addresses, phones and documents' },
  { code: 'customers:write', description: 'Create and update customers, documents and GPS' },

  // Loan Schemes & Loans
  { code: 'schemes:read', description: 'View loan schemes' },
  { code: 'schemes:manage', description: 'Configure loan scheme parameters' },
  { code: 'loans:apply', description: 'Submit loan applications' },
  { code: 'loans:approve', description: 'Approve or reject loan applications' },
  { code: 'loans:disburse', description: 'Disburse sanctioned loan funds' },
  { code: 'loans:read', description: 'View loan accounts and repayment schedules' },

  // Payments & Collections
  { code: 'payments:collect', description: 'Record repayments, partial payments and advances' },
  { code: 'payments:read', description: 'View payment receipts and allocation history' },
  { code: 'payments:reverse', description: 'Submit or approve payment reversals' },
  { code: 'collections:session', description: 'Open, conduct and complete dated collection sessions' },

  // Cash Bag & Accounting
  { code: 'cash:bag_view', description: 'View assigned Line Cash Bag balance and entries' },
  { code: 'cash:manage', description: 'Open, transfer, deposit, close and reconcile Cash Bags' },
  { code: 'cash:expense', description: 'Record or approve cash expenses' },
  { code: 'cash:reconcile', description: 'Perform daily Cash Bag reconciliation' },

  // Partners & Distribution
  { code: 'partners:read', description: 'View partner capital ratios and profit/loss periods' },
  { code: 'partners:manage', description: 'Record capital investments, withdrawals and distributions' },

  // Reports & Analytics
  { code: 'reports:view', description: 'View executive dashboards, overdue lists and reports' },
];

const ROLE_PERMISSIONS = {
  ADMIN: PERMISSIONS.map((p) => p.code), // Admin gets all permissions
  PARTNER: [
    'users:read',
    'customers:read',
    'loans:read',
    'payments:read',
    'cash:bag_view',
    'partners:read',
    'reports:view',
    'audit:read',
  ],
  COLLECTION_TEAM: [
    'customers:read',
    'customers:write',
    'loans:read',
    'loans:apply',
    'payments:collect',
    'payments:read',
    'collections:session',
    'cash:bag_view',
    'cash:expense',
  ],
  ACCOUNTANT: [
    'users:read',
    'customers:read',
    'schemes:read',
    'loans:read',
    'payments:read',
    'cash:bag_view',
    'cash:reconcile',
    'partners:read',
    'reports:view',
    'audit:read',
  ],
};

async function main() {
  console.log('Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }

  console.log('Seeding roles and mapping permissions...');
  for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `Standard ${roleName.replace('_', ' ')} role`,
      },
    });

    const permissions = await prisma.permission.findMany({
      where: { code: { in: permCodes } },
    });

    for (const perm of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: perm.id,
        },
      });
    }
  }

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

    for (const r of s.rules) {
      await prisma.loanSchemeInstallmentRule.upsert({
        where: {
          schemeVersionId_installmentNumber: {
            schemeVersionId: version.id,
            installmentNumber: r.installmentNumber,
          },
        },
        update: {
          dueOffsetDays: r.dueOffsetDays,
          principalDuePaise: r.principalDuePaise,
          financeChargeDuePaise: r.financeChargeDuePaise,
          totalDuePaise: r.totalDuePaise,
        },
        create: {
          schemeVersionId: version.id,
          installmentNumber: r.installmentNumber,
          dueOffsetDays: r.dueOffsetDays,
          principalDuePaise: r.principalDuePaise,
          financeChargeDuePaise: r.financeChargeDuePaise,
          totalDuePaise: r.totalDuePaise,
        },
      });
    }
  }

  console.log('✅ Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

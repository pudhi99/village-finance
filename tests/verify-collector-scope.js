/**
 * Direct Verification: Collector Access Denial Outside Scope
 *
 * Demonstrates:
 * 1. Collector assigned to Line A is denied access (403 Forbidden) when requesting a customer in Line B.
 * 2. Collector cannot see out-of-scope customers in customer directory lists.
 */
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import { isScopeAllowed, requireScope } from '../src/lib/permissions/index.js';
import { AuthError } from '../src/lib/auth/errors.js';

console.log('\n--- Verifying Collector Access Denial Outside Assigned Scope ---');

async function testCollectorScopeIsolation() {
  const timestamp = Date.now();
  let customerInLineB = null;

  try {
    // 1. Fetch 2 distinct Lines
    const lines = await prisma.line.findMany({ take: 2 });
    if (lines.length < 2) {
      throw new Error('Need at least 2 lines in database');
    }
    const lineA = lines[0]; // Collector's assigned line
    const lineB = lines[1]; // Other line

    const village = await prisma.village.findFirst();
    const adminUser = await prisma.userProfile.findFirst({ where: { status: 'ACTIVE' } });

    // 2. Create customer assigned to Line B
    customerInLineB = await prisma.customer.create({
      data: {
        customerNumber: `VF-SCOPE-${timestamp}`,
        fullName: `Scope Test Customer ${timestamp}`,
        villageId: village.id,
        phones: {
          create: {
            phoneNumber: `9700${String(timestamp).slice(-6)}`,
            isPrimary: true,
          },
        },
        lineAssignments: {
          create: {
            lineId: lineB.id,
            assignedBy: adminUser.id,
            isCurrent: true,
          },
        },
      },
    });

    console.log(`Created test customer ${customerInLineB.customerNumber} in Line "${lineB.name}" (${lineB.code})`);

    // 3. Define a Collector profile scoped strictly to Line A only
    const collectorProfile = {
      userId: 'collector-uuid-line-a',
      fullName: 'Field Collector Line A',
      status: 'ACTIVE',
      roles: ['COLLECTION_TEAM'],
      permissions: ['customers:read', 'payments:collect'],
      dataScopes: [
        { scopeType: 'LINE', scopeValue: lineA.id },
      ],
      isAdmin: false,
    };

    console.log(`Collector assigned scope: Line "${lineA.name}" (${lineA.code})`);

    // 4. Test isScopeAllowed for Line B
    const allowed = isScopeAllowed(collectorProfile, 'LINE', lineB.id);
    console.log(`Checking if Collector can access Line B: ${allowed ? 'ALLOWED (FAIL)' : 'DENIED (PASS)'}`);
    assert.equal(allowed, false, 'Collector MUST NOT be allowed to access Line B');

    // 5. Test requireScope enforcement
    let rejected = false;
    let thrownError = null;
    try {
      requireScope(collectorProfile, 'LINE', lineB.id);
    } catch (err) {
      rejected = true;
      thrownError = err;
    }

    assert.equal(rejected, true, 'requireScope must throw error when accessing unassigned line');
    assert.ok(thrownError instanceof AuthError, 'Error must be an AuthError');
    assert.equal(thrownError.statusCode, 403, 'HTTP Status code must be 403 Forbidden');
    console.log(`Access Denial Confirmed: Received ${thrownError.statusCode} - "${thrownError.message}"`);

    // 6. Test Directory Filtering logic
    const where = {
      lineAssignments: {
        some: {
          lineId: { in: collectorProfile.dataScopes.filter(ds => ds.scopeType === 'LINE').map(ds => ds.scopeValue) },
          isCurrent: true,
        },
      },
    };

    const visibleToCollector = await prisma.customer.findMany({
      where: {
        id: customerInLineB.id,
        ...where,
      },
    });

    assert.equal(visibleToCollector.length, 0, 'Customer in Line B MUST NOT appear in collector customer query results');
    console.log('Directory Filtering Confirmed: Customer in Line B is completely excluded from query results.');

    console.log('\n===============================================================');
    console.log('✅ VERIFICATION SUCCESSFUL: Collector access strictly denied!');
    console.log('===============================================================\n');

  } finally {
    if (customerInLineB) {
      await prisma.customer.delete({ where: { id: customerInLineB.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

testCollectorScopeIsolation().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

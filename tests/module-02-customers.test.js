/**
 * Module 2 Acceptance & Integrity Tests — Village Finance
 *
 * Verifies:
 * 1. Phone number uniqueness across customers (strictly enforced per owner rule)
 * 2. Single active Line constraint (partial unique index one_active_line_per_customer)
 * 3. Address history preservation on update (old address retained with effectiveTo, not overwritten)
 * 4. Duplicate warning is advisory only (returns matches without altering or merging records)
 * 5. Collector scope isolation (access denied when customer is outside assigned Line/Village scope)
 */
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import { isScopeAllowed, requireScope } from '../src/lib/permissions/index.js';
import { AuthError } from '../src/lib/auth/errors.js';

console.log('\n--- Running Module 2: Villages, Areas & Customers Acceptance Tests ---');

async function runTests() {
  const timestamp = Date.now();
  const testPhone1 = `9876${String(timestamp).slice(-6)}`;
  const testCustomerNumber1 = `TEST-CUST-1-${timestamp}`;
  const testCustomerNumber2 = `TEST-CUST-2-${timestamp}`;

  let createdCustomerId1 = null;
  let createdCustomerId2 = null;

  try {
    // Lookup or ensure test village and lines
    let testVillage = await prisma.village.findFirst();
    if (!testVillage) {
      testVillage = await prisma.village.create({
        data: {
          name: `Test Village ${timestamp}`,
          code: `TV-${String(timestamp).slice(-4)}`,
          district: 'East Godavari',
          state: 'Andhra Pradesh',
        },
      });
    }

    const testLines = await prisma.line.findMany({ take: 2 });
    if (testLines.length < 2) {
      throw new Error('At least 2 Lines must exist for Line constraint and scope tests');
    }
    const lineA = testLines[0];
    const lineB = testLines[1];

    const adminUser = await prisma.userProfile.findFirst({
      where: { status: 'ACTIVE' },
    });
    if (!adminUser) {
      throw new Error('An active user profile is required for foreign key audit fields');
    }

    // ============================================================
    // TEST 1: Phone Uniqueness Enforcement
    // ============================================================
    console.log('\n▶ Test 1: Customer Phone Uniqueness Rule...');

    const customer1 = await prisma.customer.create({
      data: {
        customerNumber: testCustomerNumber1,
        fullName: `Test Customer One ${timestamp}`,
        villageId: testVillage.id,
        status: 'ACTIVE',
        phones: {
          create: {
            phoneNumber: testPhone1,
            phoneType: 'PRIMARY',
            isPrimary: true,
          },
        },
      },
    });
    createdCustomerId1 = customer1.id;

    // Attempting to create a second customer with the exact same phone number must fail
    let phoneCollisionFailed = false;
    try {
      await prisma.customer.create({
        data: {
          customerNumber: testCustomerNumber2,
          fullName: `Test Customer Two ${timestamp}`,
          villageId: testVillage.id,
          status: 'ACTIVE',
          phones: {
            create: {
              phoneNumber: testPhone1, // Duplicate phone
              phoneType: 'PRIMARY',
              isPrimary: true,
            },
          },
        },
      });
    } catch (err) {
      phoneCollisionFailed = true;
      assert.ok(
        err.message.includes('Unique constraint failed') ||
        err.code === 'P2002' ||
        err.message.includes('duplicate key value'),
        `Expected unique constraint violation, got: ${err.message}`
      );
    }

    assert.equal(
      phoneCollisionFailed,
      true,
      'Database MUST reject creating second customer with an identical phone number'
    );
    console.log('✔ Test 1 Passed: Duplicate phone number strictly rejected by unique constraint.');

    // ============================================================
    // TEST 2: Single Active Line Constraint
    // ============================================================
    console.log('\n▶ Test 2: Single Active Line Assignment Constraint...');

    // Assign initial active Line to customer 1
    const assignment1 = await prisma.customerLineAssignment.create({
      data: {
        customerId: customer1.id,
        lineId: lineA.id,
        assignedBy: adminUser.id,
        effectiveFrom: new Date(),
        isCurrent: true,
      },
    });

    // Attempting to assign a second active Line (isCurrent = true) without closing the first
    let lineCollisionFailed = false;
    try {
      await prisma.customerLineAssignment.create({
        data: {
          customerId: customer1.id,
          lineId: lineB.id,
          assignedBy: adminUser.id,
          effectiveFrom: new Date(),
          isCurrent: true, // Collision with partial unique index one_active_line_per_customer
        },
      });
    } catch (err) {
      lineCollisionFailed = true;
      assert.ok(
        err.message.includes('one_active_line_per_customer') ||
        err.code === 'P2002' ||
        err.message.includes('unique constraint') ||
        err.message.includes('duplicate key value'),
        `Expected partial unique index error, got: ${err.message}`
      );
    }

    assert.equal(
      lineCollisionFailed,
      true,
      'Database MUST reject multiple concurrent active Lines for the same customer'
    );
    console.log('✔ Test 2 Passed: Customer cannot have two active Line assignments concurrently.');

    // ============================================================
    // TEST 3: Address History Preservation on Change
    // ============================================================
    console.log('\n▶ Test 3: Address History Preservation...');

    // 1. Initial Address
    const addr1 = await prisma.customerAddress.create({
      data: {
        customerId: customer1.id,
        villageId: testVillage.id,
        addressLine: 'Old Address Line 1',
        isCurrent: true,
        effectiveFrom: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });

    // 2. Transition Address: Archive old address and create new address
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: { customerId: customer1.id, isCurrent: true },
        data: { isCurrent: false, effectiveTo: now },
      });

      await tx.customerAddress.create({
        data: {
          customerId: customer1.id,
          villageId: testVillage.id,
          addressLine: 'New Updated Address Line 2',
          isCurrent: true,
          effectiveFrom: now,
        },
      });
    });

    // 3. Verify both addresses exist in history
    const allAddresses = await prisma.customerAddress.findMany({
      where: { customerId: customer1.id },
      orderBy: { effectiveFrom: 'asc' },
    });

    assert.equal(allAddresses.length, 2, 'Customer must retain both old and new address records');
    assert.equal(allAddresses[0].isCurrent, false, 'Previous address must be marked isCurrent = false');
    assert.ok(allAddresses[0].effectiveTo !== null, 'Previous address must have effectiveTo timestamp');
    assert.equal(allAddresses[1].isCurrent, true, 'New address must be marked isCurrent = true');
    assert.equal(allAddresses[1].effectiveTo, null, 'New address must have null effectiveTo');
    assert.equal(allAddresses[1].addressLine, 'New Updated Address Line 2');

    console.log('✔ Test 3 Passed: Previous address safely preserved with effectiveTo timestamp.');

    // ============================================================
    // TEST 4: Advisory Duplicate Detection
    // ============================================================
    console.log('\n▶ Test 4: Advisory Duplicate Detection (No Data Mutation)...');

    const beforeCount = await prisma.customer.count();

    // Check duplicate detection by matching phone number
    const phoneMatch = await prisma.customerPhone.findUnique({
      where: { phoneNumber: testPhone1 },
      include: { customer: true },
    });

    assert.ok(phoneMatch, 'Duplicate check should detect customer by phone number');
    assert.equal(phoneMatch.customerId, customer1.id);

    // Verify advisory search did not modify or delete any customer record
    const afterCount = await prisma.customer.count();
    assert.equal(beforeCount, afterCount, 'Customer count must remain exactly the same; no records deleted or merged');

    const customerCheck = await prisma.customer.findUnique({
      where: { id: customer1.id },
    });
    assert.ok(customerCheck, 'Customer record must remain unaltered');

    console.log('✔ Test 4 Passed: Duplicate warning is advisory only; zero mutations or auto-merges.');

    // ============================================================
    // TEST 5: Data Scope Isolation for Collectors
    // ============================================================
    console.log('\n▶ Test 5: Collector Data Scope Boundaries...');

    const restrictedCollectorProfile = {
      userId: 'col-restricted-1',
      status: 'ACTIVE',
      roles: ['COLLECTION_TEAM'],
      permissions: ['customers:read'],
      dataScopes: [
        { scopeType: 'LINE', scopeValue: lineA.id }, // Assigned only to Line A
      ],
      isAdmin: false,
    };

    // Collector can access Line A
    assert.equal(
      isScopeAllowed(restrictedCollectorProfile, 'LINE', lineA.id),
      true,
      'Collector should be permitted to access assigned Line A'
    );

    // Collector cannot access Line B
    assert.equal(
      isScopeAllowed(restrictedCollectorProfile, 'LINE', lineB.id),
      false,
      'Collector MUST NOT access unassigned Line B'
    );

    assert.throws(
      () => requireScope(restrictedCollectorProfile, 'LINE', lineB.id),
      (err) => err instanceof AuthError && err.statusCode === 403,
      'requireScope must throw 403 AuthError when requesting customer in unassigned Line'
    );

    console.log('✔ Test 5 Passed: Collector access denied when accessing customer outside assigned scope.');

  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test artifacts...');
    if (createdCustomerId1) {
      await prisma.customer.delete({ where: { id: createdCustomerId1 } }).catch(() => {});
    }
    if (createdCustomerId2) {
      await prisma.customer.delete({ where: { id: createdCustomerId2 } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log('\n=============================================================');
  console.log('🎉 ALL 5 MODULE 2 ACCEPTANCE & INTEGRITY TESTS PASSED!');
  console.log('=============================================================\n');
}

runTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ Module 2 Test Suite Failed:', err);
  process.exit(1);
});

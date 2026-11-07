/**
 * Module 5 Acceptance & Integrity Tests — Village Finance
 *
 * Verifies:
 * 1. Line Isolation Rule: Customers outside the selected Line NEVER appear in the nearby list,
 *    regardless of their physical proximity.
 * 2. Radius Filter Sequence: Proximity radius applies strictly AFTER Line assignment filter.
 * 3. Graceful GPS Fallback: When GPS is unavailable/denied, authorized manual customer list
 *    is accessible with full details.
 * 4. Visit Uniqueness: One session cannot have duplicate customer visit records
 *    (enforced by sessionId_customerId unique constraint).
 * 5. Unique Session per Line/Date: Prevents opening duplicate sessions for the same Line on the same date.
 * 6. Session Lifecycle & GPS Audit: Full transition (PLANNED -> IN_PROGRESS -> COMPLETED) with
 *    collector GPS coordinates logging.
 */
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import {
  executeCreateCollectionSession,
  executeStartCollectionSession,
  executeCompleteCollectionSession,
  executeRecordCustomerVisit,
  getAssignedCustomersForSession,
  getCollectionSessionDetails,
} from '../src/features/collections/server-actions.js';
import { getUserSecurityProfile } from '../src/lib/permissions/index.js';

console.log('\n--- Running Module 5: Lines, Collection Sessions, Visits & GPS Acceptance Tests ---');

async function runTests() {
  const timestamp = Date.now();
  let line1 = null;
  let line2 = null;
  let customerA = null; // Assigned to Line 1, close to collector (400m)
  let customerB = null; // Assigned to Line 1, far from collector (4.5km)
  let customerC = null; // Assigned to Line 2, right next to collector (50m)
  let testSession = null;

  try {
    // 1. Fetch Admin context
    const users = await prisma.userProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { userRoles: { include: { role: true } } },
    });
    const adminUser = users.find((u) =>
      u.userRoles.some((ur) => ur.role.name === 'ADMIN')
    ) || users[0];
    const adminProfile = await getUserSecurityProfile(adminUser.id);
    const adminContext = { profile: adminProfile, user: adminUser };

    // 2. Fetch Village
    const village = await prisma.village.findFirst();
    if (!village) throw new Error('Database missing village for tests');

    // 3. Create two distinct Lines
    line1 = await prisma.line.create({
      data: {
        name: `Line North ${timestamp}`,
        code: `LN-${String(timestamp).slice(-6)}`,
        weekday: 'SUNDAY',
        session: 'MORNING',
      },
    });

    line2 = await prisma.line.create({
      data: {
        name: `Line South ${timestamp}`,
        code: `LS-${String(timestamp).slice(-6)}`,
        weekday: 'SUNDAY',
        session: 'AFTERNOON',
      },
    });

    // Collector Base Reference GPS: 16.5062° N, 80.6480° E (Vijayawada Center)
    const collectorLat = 16.5062;
    const collectorLng = 80.6480;

    // Customer A: Assigned to Line 1 (~400m from collector)
    // 16.5090° N, 80.6500° E
    customerA = await prisma.customer.create({
      data: {
        customerNumber: `VF-MOD5-A-${timestamp}`,
        fullName: `Assigned Near Customer A ${timestamp}`,
        villageId: village.id,
        phones: { create: { phoneNumber: `9111${String(timestamp).slice(-6)}`, isPrimary: true } },
        lineAssignments: {
          create: {
            lineId: line1.id,
            assignedBy: adminUser.id,
            isCurrent: true,
          },
        },
        locations: {
          create: {
            latitude: 16.5090,
            longitude: 80.6500,
            accuracy: 10,
            capturedBy: adminUser.id,
            isPrimary: true,
          },
        },
      },
    });

    // Customer B: Assigned to Line 1 (~4.5km from collector)
    // 16.5400° N, 80.6700° E
    customerB = await prisma.customer.create({
      data: {
        customerNumber: `VF-MOD5-B-${timestamp}`,
        fullName: `Assigned Far Customer B ${timestamp}`,
        villageId: village.id,
        phones: { create: { phoneNumber: `9222${String(timestamp).slice(-6)}`, isPrimary: true } },
        lineAssignments: {
          create: {
            lineId: line1.id,
            assignedBy: adminUser.id,
            isCurrent: true,
          },
        },
        locations: {
          create: {
            latitude: 16.5400,
            longitude: 80.6700,
            accuracy: 15,
            capturedBy: adminUser.id,
            isPrimary: true,
          },
        },
      },
    });

    // Customer C: Assigned to Line 2 (SUPER CLOSE: ~50m from collector at 16.5064° N, 80.6482° E)
    customerC = await prisma.customer.create({
      data: {
        customerNumber: `VF-MOD5-C-${timestamp}`,
        fullName: `Unassigned Closest Customer C ${timestamp}`,
        villageId: village.id,
        phones: { create: { phoneNumber: `9333${String(timestamp).slice(-6)}`, isPrimary: true } },
        lineAssignments: {
          create: {
            lineId: line2.id,
            assignedBy: adminUser.id,
            isCurrent: true,
          },
        },
        locations: {
          create: {
            latitude: 16.5064,
            longitude: 80.6482,
            accuracy: 5,
            capturedBy: adminUser.id,
            isPrimary: true,
          },
        },
      },
    });

    console.log(`✓ Setup: Created Line 1 (${line1.code}), Line 2 (${line2.code}) and test customers A, B, C with GPS coordinates.`);

    // -------------------------------------------------------------------------
    // TEST 1: Strict Line Isolation
    // Customers outside the selected Line NEVER appear in the nearby list,
    // even if they are right next to the collector (Customer C is 50m away).
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Strict Line Scope Isolation ---');
    const line1QueryResult = await getAssignedCustomersForSession(
      {
        lineId: line1.id,
        sessionDate: new Date().toISOString(),
        collectorLat,
        collectorLng,
        radiusMeters: 5000, // 5 km radius
      },
      adminContext
    );

    const customerIdsInResult = line1QueryResult.customers.map((c) => c.customerId);
    assert.ok(
      customerIdsInResult.includes(customerA.id),
      'Customer A (assigned to Line 1) must be included'
    );
    assert.ok(
      customerIdsInResult.includes(customerB.id),
      'Customer B (assigned to Line 1) must be included within 5km'
    );
    assert.equal(
      customerIdsInResult.includes(customerC.id),
      false,
      'Customer C (assigned to Line 2) MUST NEVER appear in Line 1 query, even if 50m away'
    );
    console.log('✓ Strict Line Isolation passed: Customer C (50m away) correctly excluded because they belong to Line 2.');

    // -------------------------------------------------------------------------
    // TEST 2: Radius filter applies strictly AFTER Line assignment filter
    // When radius is set to 1,000m (1 km): Customer A (400m) is included,
    // but Customer B (4.5 km) is filtered out.
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Radius Filter Sequence (Applied After Line Filter) ---');
    const radius1kmResult = await getAssignedCustomersForSession(
      {
        lineId: line1.id,
        sessionDate: new Date().toISOString(),
        collectorLat,
        collectorLng,
        radiusMeters: 1000, // 1 km radius
      },
      adminContext
    );

    const ids1km = radius1kmResult.customers.map((c) => c.customerId);
    assert.ok(ids1km.includes(customerA.id), 'Customer A (400m) must be included in 1km radius');
    assert.equal(ids1km.includes(customerB.id), false, 'Customer B (4.5km) must be excluded from 1km radius');
    assert.ok(radius1kmResult.customers[0].distanceMeters < 1000, 'Customer A distance must be < 1000m');
    console.log(`✓ Radius Filter passed: Customer A (${radius1kmResult.customers[0].distanceLabel}) included; Customer B (4.5km) excluded.`);

    // -------------------------------------------------------------------------
    // TEST 3: Graceful GPS Fallback (Manual List when GPS is unavailable)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Graceful GPS Fallback to Manual List ---');
    const manualListResult = await getAssignedCustomersForSession(
      {
        lineId: line1.id,
        sessionDate: new Date().toISOString(),
        collectorLat: null,
        collectorLng: null,
        radiusMeters: null,
      },
      adminContext
    );

    const manualIds = manualListResult.customers.map((c) => c.customerId);
    assert.ok(manualIds.includes(customerA.id), 'Customer A must appear in manual list');
    assert.ok(manualIds.includes(customerB.id), 'Customer B must appear in manual list');
    assert.equal(manualIds.includes(customerC.id), false, 'Customer C must not appear in Line 1 manual list');
    assert.equal(manualListResult.isGPSFiltered, false, 'Manual list must indicate isGPSFiltered = false');
    console.log(`✓ Graceful GPS fallback passed: All ${manualListResult.totalAssignedCount} assigned customers returned in manual list when GPS is null.`);

    // -------------------------------------------------------------------------
    // TEST 4: Create Collection Session & Enforce Unique Line + Date
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Unique Collection Session per Line & Date ---');
    const todayStr = new Date().toISOString().slice(0, 10);
    const sessionRes = await executeCreateCollectionSession(
      {
        lineId: line1.id,
        sessionDate: todayStr,
        notes: 'Sunday morning regular collection',
      },
      adminContext
    );

    assert.equal(sessionRes.success, true);
    testSession = sessionRes.session;
    assert.equal(testSession.status, 'PLANNED');
    assert.match(testSession.sessionNumber, new RegExp(`^SES-\\d{8}-${line1.code}$`));

    // Attempting to create duplicate session for same line & date must fail
    let duplicateSessionBlocked = false;
    try {
      await executeCreateCollectionSession(
        {
          lineId: line1.id,
          sessionDate: todayStr,
          notes: 'Duplicate attempt',
        },
        adminContext
      );
    } catch (err) {
      duplicateSessionBlocked = true;
      assert.match(err.message, /already exists for Line/);
    }
    assert.equal(duplicateSessionBlocked, true, 'Duplicate session for same line & date must throw error');
    console.log(`✓ Unique Session enforcement passed: Created ${testSession.sessionNumber}; duplicate submission rejected.`);

    // -------------------------------------------------------------------------
    // TEST 5: Session Lifecycle & Visit Logging with GPS Audit
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Session Lifecycle & Visit Logging ---');
    // Start session
    const startRes = await executeStartCollectionSession(
      { sessionId: testSession.id },
      adminContext
    );
    assert.equal(startRes.session.status, 'IN_PROGRESS');
    assert.ok(startRes.session.openedAt);

    // Record visit for Customer A with GPS coordinates
    const visitRes = await executeRecordCustomerVisit(
      {
        sessionId: testSession.id,
        customerId: customerA.id,
        status: 'COLLECTED',
        notes: 'Collected repayment at residence',
        latitude: 16.5090,
        longitude: 80.6500,
        accuracy: 8.5,
      },
      adminContext
    );

    assert.equal(visitRes.success, true);
    assert.equal(visitRes.visit.status, 'COLLECTED');
    assert.ok(visitRes.gpsLog, 'VisitGPSLog record must be generated when coordinates provided');
    assert.equal(visitRes.gpsLog.accuracy, 8.5);

    // Verify session details reflect visit
    const sessionDetails = await getCollectionSessionDetails(testSession.id, adminContext);
    assert.equal(sessionDetails.visits.length, 1);
    assert.equal(sessionDetails.visits[0].customerId, customerA.id);
    assert.equal(sessionDetails.visits[0].status, 'COLLECTED');

    console.log('✓ Visit logging passed: Visit recorded as COLLECTED with GPS audit log.');

    // -------------------------------------------------------------------------
    // TEST 6: Visit Uniqueness (One visit record per customer per session)
    // Updating visit for Customer A must update the existing record, not duplicate
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: One Visit per Customer / Session Uniqueness ---');
    const updateVisitRes = await executeRecordCustomerVisit(
      {
        sessionId: testSession.id,
        customerId: customerA.id,
        status: 'PARTIAL',
        notes: 'Updated notes: customer paid partial due',
      },
      adminContext
    );

    assert.equal(updateVisitRes.visit.id, visitRes.visit.id, 'Visit ID must remain identical on update');
    assert.equal(updateVisitRes.visit.status, 'PARTIAL');

    const totalVisitsCount = await prisma.collectionVisit.count({
      where: { sessionId: testSession.id },
    });
    assert.equal(totalVisitsCount, 1, 'Session must not have duplicate customer visit records');
    console.log('✓ Visit uniqueness passed: Updating existing visit preserved exactly 1 record per customer.');

    // Complete session
    const completeRes = await executeCompleteCollectionSession(
      { sessionId: testSession.id, notes: 'Trip successfully finished' },
      adminContext
    );
    assert.equal(completeRes.session.status, 'COMPLETED');
    assert.ok(completeRes.session.closedAt);
    console.log('✓ Session completion passed: Status transitioned to COMPLETED with closedAt timestamp.');

    console.log('\n======================================================');
    console.log('✅ ALL MODULE 05 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    // Cleanup test records
    if (testSession) {
      await prisma.visitGPSLog.deleteMany({ where: { sessionId: testSession.id } }).catch(() => {});
      await prisma.collectionVisit.deleteMany({ where: { sessionId: testSession.id } }).catch(() => {});
      await prisma.sessionTeamMember.deleteMany({ where: { sessionId: testSession.id } }).catch(() => {});
      await prisma.collectionSession.delete({ where: { id: testSession.id } }).catch(() => {});
    }
    if (customerA) {
      await prisma.customerLocation.deleteMany({ where: { customerId: customerA.id } }).catch(() => {});
      await prisma.customerPhone.deleteMany({ where: { customerId: customerA.id } }).catch(() => {});
      await prisma.customerLineAssignment.deleteMany({ where: { customerId: customerA.id } }).catch(() => {});
      await prisma.customer.delete({ where: { id: customerA.id } }).catch(() => {});
    }
    if (customerB) {
      await prisma.customerLocation.deleteMany({ where: { customerId: customerB.id } }).catch(() => {});
      await prisma.customerPhone.deleteMany({ where: { customerId: customerB.id } }).catch(() => {});
      await prisma.customerLineAssignment.deleteMany({ where: { customerId: customerB.id } }).catch(() => {});
      await prisma.customer.delete({ where: { id: customerB.id } }).catch(() => {});
    }
    if (customerC) {
      await prisma.customerLocation.deleteMany({ where: { customerId: customerC.id } }).catch(() => {});
      await prisma.customerPhone.deleteMany({ where: { customerId: customerC.id } }).catch(() => {});
      await prisma.customerLineAssignment.deleteMany({ where: { customerId: customerC.id } }).catch(() => {});
      await prisma.customer.delete({ where: { id: customerC.id } }).catch(() => {});
    }
    if (line1) await prisma.line.delete({ where: { id: line1.id } }).catch(() => {});
    if (line2) await prisma.line.delete({ where: { id: line2.id } }).catch(() => {});

    await prisma.$disconnect().catch(() => {});
  }
}

runTests().then(() => {
  process.exit(0);
}).catch(async (e) => {
  console.error('\n❌ MODULE 05 TEST FAILED:', e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

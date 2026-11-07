'use server';

/**
 * Lines, Collection Sessions, Visits & GPS Field Operations
 * Module 05 — Village Finance
 *
 * Implements:
 * - Line-based recurring schedule (weekday + session).
 * - Dated CollectionSession instance management (PLANNED -> IN_PROGRESS -> COMPLETED / CANCELLED).
 * - Enforces one session per Line per date.
 * - Customer active assignment predicate:
 *   effectiveFrom <= selectedDate AND (effectiveTo IS NULL OR effectiveTo > selectedDate)
 * - Strict isolation: Customers outside the selected Line NEVER appear in the nearby list.
 * - GPS proximity search with PostGIS / Haversine distance and configurable radius (500m, 1km, 3km, 5km, 10km).
 * - Graceful fallback: If GPS is unavailable/denied, full authorized manual customer list is accessible.
 * - Per-customer visit tracking (NOT_VISITED, VISITED, COLLECTED, PARTIAL, NOT_AVAILABLE).
 * - Links to payments and logs collector GPS audit coordinates.
 */
import prisma from '../../lib/prisma.js';
import { requirePermission, isScopeAllowed, requireScope } from '../../lib/permissions/index.js';
import { writeAudit } from '../../lib/audit/index.js';
import { validate, z } from '../../lib/validation/index.js';
import { paiseToRupees } from '../../lib/money/index.js';
import { calculateHaversineDistanceMeters, formatDistance } from '../../lib/geo/index.js';
import { executeRecordPayment } from '../payments/server-actions.js';

// ---- Validation Schemas ----

const createSessionSchema = z.object({
  lineId: z.string().uuid('Invalid line ID'),
  sessionDate: z.string().min(1, 'Session date is required'),
  notes: z.string().optional().nullable(),
  teamUserIds: z.array(z.string().uuid()).optional().default([]),
});

const startSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  teamUserIds: z.array(z.string().uuid()).optional(),
});

const completeSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  notes: z.string().optional().nullable(),
});

const cancelSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  reason: z.string().min(3, 'A cancellation reason is required'),
});

const recordVisitSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  customerId: z.string().uuid('Invalid customer ID'),
  status: z.enum(['NOT_VISITED', 'VISITED', 'COLLECTED', 'PARTIAL', 'NOT_AVAILABLE']),
  notes: z.string().optional().nullable(),
  paymentId: z.string().uuid().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  accuracy: z.number().optional().nullable(),
  deviceId: z.string().optional().nullable(),
});

async function safeRevalidate(path) {
  try {
    const { revalidatePath } = await import('next/cache');
    revalidatePath(path);
  } catch {
    // Outside Next.js request context (CLI/test)
  }
}

async function getAuthSession() {
  const { requireAuth } = await import('../../lib/auth/index.js');
  return requireAuth();
}

// ---- Query Functions ----

/**
 * Get paginated list of collection sessions with filters.
 */
export async function getCollectionSessionsList({
  lineId,
  status = 'ALL',
  date,
  limit = 50,
  offset = 0,
} = {}, actorContext = null) {
  let profile = actorContext?.profile;
  if (!profile) {
    const auth = await getAuthSession();
    profile = auth.profile;
  }
  requirePermission(profile, 'customers:read');

  const where = {};
  if (lineId) where.lineId = lineId;
  if (status !== 'ALL') where.status = status;

  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);
    where.sessionDate = { gte: startOfDay, lte: endOfDay };
  }

  // Collector Line scope filter
  if (!profile.isAdmin) {
    const allowedLineIds = profile.dataScopes
      .filter((ds) => ds.scopeType === 'LINE')
      .map((ds) => ds.scopeValue);
    if (allowedLineIds.length > 0) {
      where.lineId = { in: allowedLineIds };
    }
  }

  const [total, sessions] = await Promise.all([
    prisma.collectionSession.count({ where }),
    prisma.collectionSession.findMany({
      where,
      orderBy: { sessionDate: 'desc' },
      skip: offset,
      take: limit,
      include: {
        line: {
          select: { id: true, name: true, code: true, weekday: true, session: true },
        },
        openedBy: { select: { id: true, fullName: true } },
        closedBy: { select: { id: true, fullName: true } },
        teamMembers: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        visits: {
          include: {
            payment: {
              select: { id: true, amountPaise: true, status: true },
            },
          },
        },
        _count: {
          select: { visits: true, teamMembers: true },
        },
      },
    }),
  ]);

  const formattedSessions = await Promise.all(
    sessions.map(async (s) => {
      const assignedCount = await prisma.customerLineAssignment.count({
        where: {
          lineId: s.lineId,
          effectiveFrom: { lte: s.sessionDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: s.sessionDate } },
          ],
        },
      });

      const totalCollectedPaise = s.visits.reduce(
        (sum, v) => sum + (v.payment?.status === 'CONFIRMED' ? v.payment.amountPaise : 0),
        0
      );

      const visitedCount = s.visits.filter(
        (v) => v.status === 'COLLECTED' || v.status === 'VISITED' || v.status === 'PARTIAL'
      ).length;

      const dateObj = new Date(s.sessionDate);
      const sessionDateFormatted = dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const sessionTimeOfDay =
        s.line?.session === 'AFTERNOON' ? 'Afternoon' : s.line?.session === 'MORNING' ? 'Morning' : '';

      return {
        ...s,
        sessionDateFormatted,
        sessionTimeOfDay,
        totalCollectedRupees: paiseToRupees(totalCollectedPaise),
        totalCollectedPaise,
        visitedCount,
        assignedCustomersCount: assignedCount || s.visits.length,
      };
    })
  );

  return { total, sessions: formattedSessions };
}

/**
 * Get detailed session record with team and visit statuses.
 */
export async function getCollectionSessionDetails(sessionId, actorContext = null) {
  let profile = actorContext?.profile;
  if (!profile) {
    const auth = await getAuthSession();
    profile = auth.profile;
  }
  requirePermission(profile, 'customers:read');

  const session = await prisma.collectionSession.findUnique({
    where: { id: sessionId },
    include: {
      line: true,
      openedBy: { select: { id: true, fullName: true, email: true } },
      closedBy: { select: { id: true, fullName: true, email: true } },
      teamMembers: {
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      },
      visits: {
        include: {
          customer: {
            include: {
              village: true,
              phones: { where: { isPrimary: true }, take: 1 },
              locations: { where: { isPrimary: true }, take: 1 },
            },
          },
          collector: { select: { id: true, fullName: true } },
          payment: { select: { id: true, paymentNumber: true, amountPaise: true, mode: true } },
        },
      },
    },
  });

  if (!session) {
    throw new Error('Collection session not found');
  }

  if (!profile.isAdmin) {
    requireScope(profile, 'LINE', session.lineId);
  }

  const totalCollectedPaise = session.visits.reduce(
    (sum, v) => sum + (v.payment ? v.payment.amountPaise : 0),
    0
  );

  return {
    ...session,
    totalCollectedPaise,
    totalCollectedRupees: paiseToRupees(totalCollectedPaise),
    visits: session.visits.map((v) => ({
      ...v,
      payment: v.payment
        ? { ...v.payment, amountRupees: paiseToRupees(v.payment.amountPaise) }
        : null,
    })),
  };
}

/**
 * Core GPS Customer List Query
 *
 * Implements:
 * 1. Line assignment filter: effectiveFrom <= sessionDate AND (effectiveTo IS NULL OR effectiveTo > sessionDate).
 * 2. Strict isolation: Customers outside the Line are NEVER returned.
 * 3. Radius filter applies ONLY AFTER Line assignment filter.
 * 4. GPS unavailable falls back to manual list.
 */
export async function getAssignedCustomersForSession({
  sessionId,
  lineId,
  sessionDate,
  collectorLat,
  collectorLng,
  radiusMeters,
  search = '',
} = {}, actorContext = null) {
  let profile = actorContext?.profile;
  if (!profile) {
    const auth = await getAuthSession();
    profile = auth.profile;
  }
  requirePermission(profile, 'customers:read');

  let resolvedLineId = lineId;
  let targetDate = sessionDate ? new Date(sessionDate) : new Date();

  // If sessionId is provided, fetch its Line and Date
  let session = null;
  if (sessionId) {
    session = await prisma.collectionSession.findUnique({
      where: { id: sessionId },
      include: {
        line: true,
        visits: {
          include: {
            collector: { select: { fullName: true } },
            payment: { select: { id: true, paymentNumber: true, amountPaise: true } },
          },
        },
      },
    });
    if (!session) throw new Error('Collection session not found');
    resolvedLineId = session.lineId;
    targetDate = session.sessionDate;
  }

  if (!resolvedLineId) {
    throw new Error('Line ID is required to retrieve assigned customers');
  }

  // Line scope verification
  if (!profile.isAdmin) {
    requireScope(profile, 'LINE', resolvedLineId);
  }

  // Normalization for date predicate: effectiveFrom <= targetDate AND (effectiveTo IS NULL OR effectiveTo > targetDate)
  const targetDateEnd = new Date(targetDate);
  targetDateEnd.setUTCHours(23, 59, 59, 999);

  // 1. Fetch ALL customers actively assigned to this Line on targetDate
  const lineAssignments = await prisma.customerLineAssignment.findMany({
    where: {
      lineId: resolvedLineId,
      isCurrent: true,
      effectiveFrom: { lte: targetDateEnd },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: targetDate } },
      ],
    },
    include: {
      customer: {
        include: {
          village: true,
          area: true,
          phones: { where: { isPrimary: true }, take: 1 },
          locations: { where: { isPrimary: true }, take: 1 },
          loans: {
            where: {
              status: { in: ['ACTIVE', 'DISBURSED', 'PARTIALLY_DISBURSED'] },
            },
            include: {
              scheme: { select: { name: true, code: true, frequency: true } },
              installments: {
                where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
                orderBy: { installmentNumber: 'asc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const totalAssignedCount = lineAssignments.length;

  // Map visits for quick lookup if session is active
  const visitMap = new Map();
  if (session && session.visits) {
    for (const v of session.visits) {
      visitMap.set(v.customerId, v);
    }
  }

  // 2. Process distance & pending loan dues for each assigned customer
  let processedCustomers = lineAssignments.map((la) => {
    const c = la.customer;
    const loc = c.locations?.[0] || null;
    const activeLoan = c.loans?.[0] || null;
    const nextInst = activeLoan?.installments?.[0] || null;
    const visit = visitMap.get(c.id) || null;

    let distanceMeters = null;
    let distanceLabel = 'N/A';

    if (
      collectorLat != null &&
      collectorLng != null &&
      loc &&
      loc.latitude != null &&
      loc.longitude != null
    ) {
      distanceMeters = calculateHaversineDistanceMeters(
        collectorLat,
        collectorLng,
        loc.latitude,
        loc.longitude
      );
      distanceLabel = formatDistance(distanceMeters);
    }

    const nextDueAmountPaise = nextInst
      ? nextInst.totalDuePaise - nextInst.totalPaidPaise
      : 0;

    return {
      customerId: c.id,
      customerNumber: c.customerNumber,
      fullName: c.fullName,
      fatherOrSpouseName: c.fatherOrSpouseName,
      villageName: c.village?.name || 'N/A',
      areaName: c.area?.name || 'N/A',
      primaryPhone: c.phones?.[0]?.phoneNumber || 'N/A',
      location: loc
        ? {
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy,
            capturedAt: loc.capturedAt,
          }
        : null,
      distanceMeters,
      distanceLabel,
      activeLoan: activeLoan
        ? {
            id: activeLoan.id,
            loanNumber: activeLoan.loanNumber,
            schemeName: activeLoan.scheme.name,
            schemeCode: activeLoan.scheme.code,
            nextInstallmentNumber: nextInst ? nextInst.installmentNumber : null,
            nextDueDate: nextInst ? nextInst.dueDate.toISOString() : null,
            nextDueAmountRupees: paiseToRupees(nextDueAmountPaise),
          }
        : null,
      visitStatus: visit ? visit.status : 'NOT_VISITED',
      visitNotes: visit ? visit.notes : null,
      visitPayment: visit?.payment
        ? {
            id: visit.payment.id,
            paymentNumber: visit.payment.paymentNumber,
            amountRupees: paiseToRupees(visit.payment.amountPaise),
          }
        : null,
      visitedAt: visit ? visit.visitedAt : null,
      collectorName: visit?.collector ? visit.collector.fullName : null,
    };
  });

  // 3. Optional Search query filter (customer name, number, phone, village)
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    processedCustomers = processedCustomers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.customerNumber.toLowerCase().includes(q) ||
        c.primaryPhone.includes(q) ||
        c.villageName.toLowerCase().includes(q)
    );
  }

  // 4. GPS Radius Filtering (Applies strictly after Line assignment filter!)
  if (radiusMeters != null && radiusMeters > 0 && collectorLat != null && collectorLng != null) {
    processedCustomers = processedCustomers.filter(
      (c) => c.distanceMeters != null && c.distanceMeters <= radiusMeters
    );
  }

  // 5. Sorting
  if (collectorLat != null && collectorLng != null) {
    // Sort by straight-line distance ASCENDING; customers without GPS coordinates go to bottom
    processedCustomers.sort((a, b) => {
      if (a.distanceMeters != null && b.distanceMeters != null) {
        return a.distanceMeters - b.distanceMeters;
      }
      if (a.distanceMeters != null) return -1;
      if (b.distanceMeters != null) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  } else {
    // Manual list fallback: sort by Village name then Customer name
    processedCustomers.sort((a, b) => {
      const vComp = a.villageName.localeCompare(b.villageName);
      if (vComp !== 0) return vComp;
      return a.fullName.localeCompare(b.fullName);
    });
  }

  return {
    lineId: resolvedLineId,
    sessionDate: targetDate.toISOString(),
    totalAssignedCount,
    matchingCount: processedCustomers.length,
    isGPSFiltered: radiusMeters != null && radiusMeters > 0 && collectorLat != null,
    customers: processedCustomers,
  };
}

// ---- Mutation Functions ----

/**
 * Create a new planned collection session for a recurring Line on a specific date.
 */
export async function executeCreateCollectionSession(input, { profile, user }) {
  if (!profile.isAdmin) {
    requirePermission(profile, 'payments:collect');
  }

  const data = validate(createSessionSchema, input);

  // Line scope verification
  if (!profile.isAdmin) {
    requireScope(profile, 'LINE', data.lineId);
  }

  const line = await prisma.line.findUnique({
    where: { id: data.lineId },
  });
  if (!line) throw new Error('Line not found');

  // Normalize session date to UTC midnight for unique constraint consistency
  const sessionDate = new Date(data.sessionDate);
  sessionDate.setUTCHours(0, 0, 0, 0);

  // Check unique session for this Line on this date
  const existing = await prisma.collectionSession.findFirst({
    where: {
      lineId: data.lineId,
      sessionDate,
    },
  });
  if (existing) {
    throw new Error(
      `A collection session already exists for Line '${line.name}' on date ${sessionDate.toISOString().slice(0, 10)} (${existing.sessionNumber})`
    );
  }

  // Generate readable sessionNumber: e.g. "SES-20261104-SUN-AM"
  const dateStr = sessionDate.toISOString().slice(0, 10).replace(/-/g, '');
  const sessionNumber = `SES-${dateStr}-${line.code}`;

  const session = await prisma.collectionSession.create({
    data: {
      sessionNumber,
      lineId: data.lineId,
      sessionDate,
      status: 'PLANNED',
      notes: data.notes || null,
      teamMembers: {
        create: data.teamUserIds.map((uid) => ({
          userId: uid,
          role: 'COLLECTOR',
        })),
      },
    },
    include: {
      line: true,
      teamMembers: { include: { user: { select: { fullName: true } } } },
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'SESSION_CREATED',
    entityType: 'CollectionSession',
    entityId: session.id,
    metadata: {
      sessionNumber: session.sessionNumber,
      lineId: line.id,
      sessionDate: session.sessionDate,
    },
  });

  safeRevalidate('/collections');

  return { success: true, session };
}

/**
 * Start a collection session (transition PLANNED -> IN_PROGRESS).
 */
export async function executeStartCollectionSession(input, { profile, user }) {
  if (!profile.isAdmin) {
    requirePermission(profile, 'payments:collect');
  }

  const data = validate(startSessionSchema, input);

  const session = await prisma.collectionSession.findUnique({
    where: { id: data.sessionId },
  });
  if (!session) throw new Error('Collection session not found');

  if (session.status !== 'PLANNED') {
    throw new Error(`Cannot start session in '${session.status}' status (must be PLANNED).`);
  }

  if (!profile.isAdmin) {
    requireScope(profile, 'LINE', session.lineId);
  }

  const updatedSession = await prisma.collectionSession.update({
    where: { id: session.id },
    data: {
      status: 'IN_PROGRESS',
      openedAt: new Date(),
      openedById: user.id,
    },
  });

  // Assign team member if not already on the team
  await prisma.sessionTeamMember.upsert({
    where: {
      sessionId_userId: {
        sessionId: session.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      sessionId: session.id,
      userId: user.id,
      role: 'LEAD',
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'SESSION_STARTED',
    entityType: 'CollectionSession',
    entityId: session.id,
    metadata: {
      sessionNumber: session.sessionNumber,
      openedById: user.id,
    },
  });

  safeRevalidate('/collections');
  safeRevalidate(`/collections/${session.id}`);

  return { success: true, session: updatedSession };
}

/**
 * Complete a collection session (transition IN_PROGRESS -> COMPLETED).
 */
export async function executeCompleteCollectionSession(input, { profile, user }) {
  if (!profile.isAdmin) {
    requirePermission(profile, 'payments:collect');
  }

  const data = validate(completeSessionSchema, input);

  const session = await prisma.collectionSession.findUnique({
    where: { id: data.sessionId },
    include: { _count: { select: { visits: true } } },
  });
  if (!session) throw new Error('Collection session not found');

  if (session.status !== 'IN_PROGRESS') {
    throw new Error(`Cannot complete session in '${session.status}' status (must be IN_PROGRESS).`);
  }

  if (!profile.isAdmin) {
    requireScope(profile, 'LINE', session.lineId);
  }

  const updatedSession = await prisma.collectionSession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      closedAt: new Date(),
      closedById: user.id,
      notes: data.notes || session.notes,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'SESSION_COMPLETED',
    entityType: 'CollectionSession',
    entityId: session.id,
    metadata: {
      sessionNumber: session.sessionNumber,
      totalVisits: session._count.visits,
      closedById: user.id,
    },
  });

  safeRevalidate('/collections');
  safeRevalidate(`/collections/${session.id}`);

  return { success: true, session: updatedSession };
}

/**
 * Cancel a collection session (Admin or Session Opener).
 */
export async function executeCancelCollectionSession(input, { profile, user }) {
  const data = validate(cancelSessionSchema, input);

  const session = await prisma.collectionSession.findUnique({
    where: { id: data.sessionId },
  });
  if (!session) throw new Error('Collection session not found');

  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    throw new Error(`Cannot cancel a session that is already ${session.status}.`);
  }

  const isOpener = session.openedById === user.id;
  if (!profile.isAdmin && !isOpener) {
    throw new Error('Forbidden: Only an Administrator or the Session Opener can cancel a session.');
  }

  const updatedSession = await prisma.collectionSession.update({
    where: { id: session.id },
    data: {
      status: 'CANCELLED',
      notes: `${session.notes ? session.notes + ' | ' : ''}Cancelled: ${data.reason}`,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'SESSION_CANCELLED',
    entityType: 'CollectionSession',
    entityId: session.id,
    metadata: {
      sessionNumber: session.sessionNumber,
      reason: data.reason,
      cancelledBy: user.id,
    },
  });

  safeRevalidate('/collections');
  safeRevalidate(`/collections/${session.id}`);

  return { success: true, session: updatedSession };
}

/**
 * Record a customer visit in a session with optional GPS coordinates and payment link.
 * Crucial rule: One session cannot have duplicate customer visit records (upsert on [sessionId, customerId]).
 */
export async function executeRecordCustomerVisit(input, { profile, user }) {
  if (!profile.isAdmin) {
    requirePermission(profile, 'payments:collect');
  }

  const data = validate(recordVisitSchema, input);

  // 1. Verify session exists and is not cancelled or completed
  const session = await prisma.collectionSession.findUnique({
    where: { id: data.sessionId },
  });
  if (!session) throw new Error('Collection session not found');

  if (session.status === 'CANCELLED' || session.status === 'COMPLETED') {
    throw new Error(`Cannot record visits on a ${session.status} session.`);
  }

  if (!profile.isAdmin) {
    requireScope(profile, 'LINE', session.lineId);
  }

  // 2. Verify customer is actively assigned to the session's Line
  const assignment = await prisma.customerLineAssignment.findFirst({
    where: {
      lineId: session.lineId,
      customerId: data.customerId,
      isCurrent: true,
    },
  });
  if (!assignment) {
    throw new Error('Customer is not currently assigned to the collection line for this session.');
  }

  // 3. Upsert Visit record (prevents duplicates)
  const visit = await prisma.collectionVisit.upsert({
    where: {
      sessionId_customerId: {
        sessionId: data.sessionId,
        customerId: data.customerId,
      },
    },
    update: {
      status: data.status,
      visitedAt: new Date(),
      notes: data.notes || null,
      paymentId: data.paymentId || null,
      collectorId: user.id,
    },
    create: {
      sessionId: data.sessionId,
      customerId: data.customerId,
      collectorId: user.id,
      status: data.status,
      visitedAt: new Date(),
      notes: data.notes || null,
      paymentId: data.paymentId || null,
    },
  });

  // 4. Log GPS audit if coordinates were provided
  let gpsLog = null;
  if (data.latitude != null && data.longitude != null) {
    gpsLog = await prisma.visitGPSLog.create({
      data: {
        sessionId: session.id,
        visitId: visit.id,
        customerId: data.customerId,
        collectorId: user.id,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy || null,
        deviceId: data.deviceId || null,
        capturedAt: new Date(),
      },
    });
  }

  await writeAudit({
    actorId: user.id,
    action: 'VISIT_RECORDED',
    entityType: 'CollectionVisit',
    entityId: visit.id,
    metadata: {
      sessionId: session.id,
      customerId: data.customerId,
      status: data.status,
      hasGPS: !!gpsLog,
      paymentId: data.paymentId || null,
    },
  });

  safeRevalidate(`/collections/${session.id}`);

  return { success: true, visit, gpsLog };
}

// ---- Next.js Server Action Entry Points ----

export async function createCollectionSession(input) {
  const { profile, user } = await getAuthSession();
  return executeCreateCollectionSession(input, { profile, user });
}

export async function startCollectionSession(input) {
  const { profile, user } = await getAuthSession();
  return executeStartCollectionSession(input, { profile, user });
}

export async function completeCollectionSession(input) {
  const { profile, user } = await getAuthSession();
  return executeCompleteCollectionSession(input, { profile, user });
}

export async function cancelCollectionSession(input) {
  const { profile, user } = await getAuthSession();
  return executeCancelCollectionSession(input, { profile, user });
}

export async function recordCustomerVisit(input) {
  const { profile, user } = await getAuthSession();
  return executeRecordCustomerVisit(input, { profile, user });
}

export async function collectRepaymentInSession(input) {
  const { profile, user } = await getAuthSession();
  if (!profile.isAdmin) {
    requirePermission(profile, 'payments:collect');
  }

  const {
    sessionId,
    customerId,
    loanId,
    amountRupees,
    mode = 'CASH',
    notes = null,
    latitude = null,
    longitude = null,
    accuracy = null,
  } = input;

  if (!sessionId) throw new Error('Session ID is required');
  if (!customerId) throw new Error('Customer ID is required');
  if (!loanId) throw new Error('Loan ID is required');
  if (!amountRupees || Number(amountRupees) <= 0) {
    throw new Error('Repayment amount must be greater than zero');
  }

  const session = await prisma.collectionSession.findUnique({
    where: { id: sessionId },
    include: { line: true },
  });
  if (!session) throw new Error('Collection session not found');

  if (session.status === 'CANCELLED') {
    throw new Error('Cannot collect repayment in a cancelled session.');
  }

  if (!profile.isAdmin) {
    requireScope(profile, 'LINE', session.lineId);
  }

  // 1. Record Payment atomically (allocates installments FIFO, posts to line cash bag ledger)
  const paymentRes = await executeRecordPayment(
    {
      loanId,
      amountRupees: Number(amountRupees),
      mode: mode || 'CASH',
      lineId: session.lineId,
      notes: notes || `Field repayment collected in session ${session.sessionNumber}`,
      collectedAt: new Date().toISOString(),
    },
    { profile, user }
  );

  const payment = paymentRes.payment;

  // 2. Upsert Customer CollectionVisit
  const visit = await prisma.collectionVisit.upsert({
    where: {
      sessionId_customerId: {
        sessionId,
        customerId,
      },
    },
    update: {
      status: 'COLLECTED',
      visitedAt: new Date(),
      paymentId: payment.id,
      collectorId: user.id,
      notes: notes || `Collected ₹${amountRupees} in session`,
    },
    create: {
      sessionId,
      customerId,
      collectorId: user.id,
      status: 'COLLECTED',
      visitedAt: new Date(),
      paymentId: payment.id,
      notes: notes || `Collected ₹${amountRupees} in session`,
    },
  });

  // 3. Log GPS if coordinates were provided
  let gpsLog = null;
  if (latitude != null && longitude != null) {
    gpsLog = await prisma.visitGPSLog.create({
      data: {
        sessionId,
        visitId: visit.id,
        customerId,
        collectorId: user.id,
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: accuracy ? Number(accuracy) : null,
        capturedAt: new Date(),
      },
    });
  }

  safeRevalidate('/collections');
  safeRevalidate(`/collections/${sessionId}`);
  safeRevalidate(`/customers/${customerId}`);
  safeRevalidate(`/loans/${loanId}`);
  safeRevalidate('/cash');
  safeRevalidate('/dashboard');

  return {
    success: true,
    payment: {
      ...payment,
      amountRupees: Number(amountRupees),
    },
    visit,
    message: `Collected ₹${amountRupees} successfully!`,
  };
}

export async function getActiveLines() {
  return prisma.line.findMany({
    orderBy: [{ weekday: 'asc' }, { session: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      weekday: true,
      session: true,
    },
  });
}

export async function getActiveCollectors() {
  return prisma.userProfile.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      email: true,
      userRoles: {
        select: {
          role: { select: { name: true } },
        },
      },
    },
  });
}

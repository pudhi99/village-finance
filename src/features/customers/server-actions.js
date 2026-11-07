'use server';

/**
 * Customers, Villages & Lines Server Actions — Village Finance (Module 2)
 *
 * Implements:
 * - Data scope enforcement (Line/Village isolation)
 * - Anti-tampering & audit logging for all mutations
 * - Advisory duplicate detection (never auto-merge)
 * - Historical address & Line assignment preservation
 * - Phone uniqueness enforcement (as required by business owner)
 */
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission, isScopeAllowed, requireScope } from '@/lib/permissions';
import { writeAudit } from '@/lib/audit';
import { validate, z, mobileSchema } from '@/lib/validation';
import { paiseToRupees } from '@/lib/money';
import { revalidatePath } from 'next/cache';

// ---- Zod Validation Schemas ----

const createCustomerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  fatherOrSpouseName: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  monthlyIncomeRupees: z.number().nonnegative().optional().nullable(),
  villageId: z.string().uuid('Invalid village selection'),
  areaId: z.string().uuid().optional().nullable(),
  phoneNumber: mobileSchema,
  phoneType: z.enum(['PRIMARY', 'SECONDARY', 'FAMILY', 'GUARANTOR']).default('PRIMARY'),
  ownerName: z.string().optional().nullable(),
  addressLine: z.string().min(3, 'Address line is required'),
  landmark: z.string().optional().nullable(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional().nullable(),
  lineId: z.string().uuid().optional().nullable(),
});

/**
 * Fetch list of customers with search, status filters, and scope isolation.
 * Requires: customers:read
 */
export async function getCustomersList({
  search = '',
  status = 'ALL',
  villageId = 'ALL',
  lineId = 'ALL',
  limit = 50,
  offset = 0,
} = {}) {
  const { profile } = await requireAuth();
  requirePermission(profile, 'customers:read');

  // Build where conditions
  const where = {};

  if (status !== 'ALL') {
    where.status = status;
  }

  if (villageId !== 'ALL') {
    where.villageId = villageId;
  }

  if (lineId !== 'ALL') {
    where.lineAssignments = {
      some: {
        lineId,
        isCurrent: true,
      },
    };
  }

  // Search filter
  if (search.trim()) {
    const s = search.trim();
    where.OR = [
      { fullName: { contains: s, mode: 'insensitive' } },
      { customerNumber: { contains: s, mode: 'insensitive' } },
      {
        phones: {
          some: {
            phoneNumber: { contains: s },
          },
        },
      },
    ];
  }

  // Data scope isolation: If not admin, restrict to allowed Lines/Villages
  if (!profile.isAdmin) {
    const hasAll = profile.dataScopes.some((ds) => ds.scopeType === 'ALL' || ds.scopeValue === '*');
    if (!hasAll) {
      const allowedVillages = profile.dataScopes
        .filter((ds) => ds.scopeType === 'VILLAGE')
        .map((ds) => ds.scopeValue);
      const allowedLines = profile.dataScopes
        .filter((ds) => ds.scopeType === 'LINE')
        .map((ds) => ds.scopeValue);

      where.AND = [
        {
          OR: [
            ...(allowedVillages.length > 0 ? [{ villageId: { in: allowedVillages } }] : []),
            ...(allowedLines.length > 0
              ? [{ lineAssignments: { some: { lineId: { in: allowedLines }, isCurrent: true } } }]
              : []),
          ],
        },
      ];
    }
  }

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        village: { select: { id: true, name: true, code: true } },
        area: { select: { id: true, name: true } },
        phones: {
          where: { isPrimary: true },
          take: 1,
        },
        lineAssignments: {
          where: { isCurrent: true },
          include: { line: true },
          take: 1,
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    totalCount,
    customers: customers.map((c) => ({
      id: c.id,
      customerNumber: c.customerNumber,
      fullName: c.fullName,
      status: c.status,
      villageName: c.village.name,
      areaName: c.area?.name || '—',
      primaryPhone: c.phones[0]?.phoneNumber || '—',
      currentLine: c.lineAssignments[0]?.line?.name || 'Unassigned',
      currentLineCode: c.lineAssignments[0]?.line?.code || null,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

/**
 * Fetch complete customer profile with history, GPS, and documents.
 * Requires: customers:read
 */
export async function getCustomerDetails(customerId) {
  const { profile } = await requireAuth();
  requirePermission(profile, 'customers:read');

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      village: true,
      area: true,
      phones: { orderBy: { isPrimary: 'desc' } },
      addresses: {
        orderBy: { effectiveFrom: 'desc' },
        include: { village: true, area: true },
      },
      locations: {
        orderBy: { capturedAt: 'desc' },
        include: { actor: { select: { fullName: true } } },
      },
      documents: {
        include: {
          mediaAsset: true,
          verifier: { select: { fullName: true } },
        },
      },
      lineAssignments: {
        orderBy: { effectiveFrom: 'desc' },
        include: {
          line: true,
          assigner: { select: { fullName: true } },
        },
      },
      loans: {
        orderBy: { createdAt: 'desc' },
        include: {
          scheme: true,
          installments: {
            orderBy: { installmentNumber: 'asc' },
            include: {
              allocations: {
                include: {
                  payment: {
                    select: {
                      id: true,
                      paymentNumber: true,
                      amountPaise: true,
                      collectedAt: true,
                      mode: true,
                      collectedBy: { select: { fullName: true } },
                    },
                  },
                },
              },
            },
          },
          payments: {
            orderBy: { collectedAt: 'desc' },
            include: {
              collectedBy: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });

  if (!customer) throw new Error('Customer not found');

  // Verify data scope
  const currentLineId = customer.lineAssignments.find((la) => la.isCurrent)?.lineId;
  if (!profile.isAdmin) {
    const villageAllowed = isScopeAllowed(profile, 'VILLAGE', customer.villageId);
    const lineAllowed = currentLineId ? isScopeAllowed(profile, 'LINE', currentLineId) : false;
    if (!villageAllowed && !lineAllowed) {
      requireScope(profile, 'VILLAGE', customer.villageId);
    }
  }

  return {
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    dateOfBirth: customer.dateOfBirth?.toISOString() || null,
    addresses: customer.addresses.map((a) => ({
      ...a,
      effectiveFrom: a.effectiveFrom.toISOString(),
      effectiveTo: a.effectiveTo ? a.effectiveTo.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    })),
    locations: customer.locations.map((l) => ({
      ...l,
      capturedAt: l.capturedAt.toISOString(),
    })),
    lineAssignments: customer.lineAssignments.map((la) => ({
      ...la,
      effectiveFrom: la.effectiveFrom.toISOString(),
      effectiveTo: la.effectiveTo ? la.effectiveTo.toISOString() : null,
      createdAt: la.createdAt.toISOString(),
    })),
    documents: customer.documents.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
    })),
    loans: (customer.loans || []).map((l) => {
      const totalRepaymentRupees = paiseToRupees(l.totalRepaymentPaise);
      const sanctionedPrincipalRupees = paiseToRupees(l.sanctionedPrincipalPaise);
      const totalFinanceChargeRupees = paiseToRupees(l.totalFinanceChargePaise);
      const totalPaidPaise = (l.installments || []).reduce((sum, inst) => sum + inst.totalPaidPaise, 0);
      const totalPaidRupees = paiseToRupees(totalPaidPaise);
      const remainingRupees = Math.max(0, totalRepaymentRupees - totalPaidRupees);
      const progressPercent =
        totalRepaymentRupees > 0
          ? Math.min(100, Math.round((totalPaidRupees / totalRepaymentRupees) * 100))
          : 0;

      const installments = (l.installments || []).map((inst) => {
        const totalDueRupees = paiseToRupees(inst.totalDuePaise);
        const totalPaidInstRupees = paiseToRupees(inst.totalPaidPaise);
        const balanceRupees = Math.max(0, totalDueRupees - totalPaidInstRupees);

        const isPastDue = new Date(inst.dueDate) < new Date();
        let displayStatus = inst.status;
        if (inst.status === 'PAID') {
          displayStatus = 'PAID';
        } else if (inst.status === 'PARTIALLY_PAID') {
          displayStatus = 'PARTIALLY_PAID';
        } else if (inst.status === 'PENDING' && isPastDue) {
          displayStatus = 'MISSED';
        } else {
          displayStatus = 'UPCOMING';
        }

        const firstAlloc = inst.allocations?.[0];
        const paidAtDate = inst.paidAt || firstAlloc?.payment?.collectedAt || null;

        return {
          id: inst.id,
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate.toISOString(),
          dueDateFormatted: new Date(inst.dueDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          totalDueRupees,
          totalPaidRupees: totalPaidInstRupees,
          balanceRupees,
          status: displayStatus,
          paidAt: paidAtDate ? new Date(paidAtDate).toISOString() : null,
          paidAtFormatted: paidAtDate
            ? new Date(paidAtDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : null,
          paymentNumber: firstAlloc?.payment?.paymentNumber || null,
          paymentMode: firstAlloc?.payment?.mode || null,
        };
      });

      const payments = (l.payments || []).map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amountRupees: paiseToRupees(p.amountPaise),
        mode: p.mode,
        status: p.status,
        collectedAt: p.collectedAt.toISOString(),
        collectedAtFormatted: new Date(p.collectedAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        collectedByName: p.collectedBy?.fullName || 'Collector',
      }));

      const paidCount = installments.filter((i) => i.status === 'PAID').length;
      const missedCount = installments.filter((i) => i.status === 'MISSED').length;
      const upcomingCount = installments.filter((i) => i.status === 'UPCOMING').length;

      return {
        id: l.id,
        loanNumber: l.loanNumber,
        schemeName: l.scheme.name,
        schemeCode: l.scheme.code,
        frequency: l.scheme.frequency,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
        createdAtFormatted: new Date(l.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        totalRepaymentRupees,
        sanctionedPrincipalRupees,
        totalFinanceChargeRupees,
        totalPaidRupees,
        remainingRupees,
        progressPercent,
        paidCount,
        missedCount,
        upcomingCount,
        installments,
        payments,
      };
    }),
  };
}

/**
 * Advisory Duplicate Detection.
 * Searches for existing profiles matching phone number or full name + village.
 * Does not alter or merge records.
 */
export async function checkCustomerDuplicates({ fullName, phoneNumber, villageId }) {
  const matches = [];

  if (phoneNumber) {
    const phoneMatch = await prisma.customerPhone.findUnique({
      where: { phoneNumber },
      include: {
        customer: {
          include: { village: true },
        },
      },
    });

    if (phoneMatch) {
      matches.push({
        type: 'PHONE_EXACT_MATCH',
        severity: 'BLOCKING', // Per user rule: phone numbers cannot be shared
        customerId: phoneMatch.customer.id,
        customerNumber: phoneMatch.customer.customerNumber,
        customerName: phoneMatch.customer.fullName,
        villageName: phoneMatch.customer.village.name,
        detail: `Phone number ${phoneNumber} is already registered to ${phoneMatch.customer.fullName} (${phoneMatch.customer.customerNumber}).`,
      });
    }
  }

  if (fullName && villageId) {
    const nameMatches = await prisma.customer.findMany({
      where: {
        fullName: { equals: fullName.trim(), mode: 'insensitive' },
        villageId,
      },
      include: { village: true },
    });

    for (const nm of nameMatches) {
      matches.push({
        type: 'NAME_AND_VILLAGE_MATCH',
        severity: 'ADVISORY',
        customerId: nm.id,
        customerNumber: nm.customerNumber,
        customerName: nm.fullName,
        villageName: nm.village.name,
        detail: `Another customer with identical name '${nm.fullName}' exists in ${nm.village.name}.`,
      });
    }
  }

  return matches;
}

/**
 * Create a new customer record with primary phone, address, and Line assignment.
 * Requires: customers:write
 */
export async function createCustomer(formData) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');

  const validated = validate(createCustomerSchema, formData);

  // Scope check on target village
  if (!profile.isAdmin) {
    requireScope(profile, 'VILLAGE', validated.villageId);
  }

  // Phone uniqueness enforcement
  const existingPhone = await prisma.customerPhone.findUnique({
    where: { phoneNumber: validated.phoneNumber },
  });
  if (existingPhone) {
    throw new Error(
      `Business Policy: Phone number ${validated.phoneNumber} is already registered. Phone sharing between customers is not permitted.`
    );
  }

  // Generate unique human-readable customerNumber
  const count = await prisma.customer.count();
  const customerNumber = `VF-CUST-${String(count + 10001)}`;

  const monthlyIncomePaise = validated.monthlyIncomeRupees
    ? Math.round(validated.monthlyIncomeRupees * 100)
    : null;

  const newCustomer = await prisma.$transaction(async (tx) => {
    // 1. Create Customer
    const customer = await tx.customer.create({
      data: {
        customerNumber,
        fullName: validated.fullName.trim(),
        fatherOrSpouseName: validated.fatherOrSpouseName?.trim() || null,
        gender: validated.gender || null,
        dateOfBirth: validated.dateOfBirth ? new Date(validated.dateOfBirth) : null,
        occupation: validated.occupation?.trim() || null,
        monthlyIncomePaise,
        status: 'ACTIVE',
        villageId: validated.villageId,
        areaId: validated.areaId || null,
      },
    });

    // 2. Create Primary Phone
    await tx.customerPhone.create({
      data: {
        customerId: customer.id,
        phoneNumber: validated.phoneNumber,
        phoneType: validated.phoneType,
        ownerName: validated.ownerName || null,
        isPrimary: true,
      },
    });

    // 3. Create Current Address
    await tx.customerAddress.create({
      data: {
        customerId: customer.id,
        villageId: validated.villageId,
        areaId: validated.areaId || null,
        addressLine: validated.addressLine.trim(),
        landmark: validated.landmark?.trim() || null,
        pincode: validated.pincode || null,
        isCurrent: true,
        effectiveFrom: new Date(),
      },
    });

    // 4. Create Line Assignment if provided
    if (validated.lineId) {
      await tx.customerLineAssignment.create({
        data: {
          customerId: customer.id,
          lineId: validated.lineId,
          assignedBy: user.id,
          effectiveFrom: new Date(),
          isCurrent: true,
        },
      });
    }

    // 5. Audit Log
    await writeAudit({
      actorId: user.id,
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customer.id,
      metadata: {
        customerNumber,
        fullName: customer.fullName,
        phoneNumber: validated.phoneNumber,
        villageId: validated.villageId,
        lineId: validated.lineId,
      },
      tx,
    });

    return customer;
  });

  revalidatePath('/customers');
  return { success: true, customerId: newCustomer.id, customerNumber: newCustomer.customerNumber };
}

/**
 * Update basic customer demographics.
 * Requires: customers:write
 */
export async function updateCustomer(customerId, data) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error('Customer not found');

  const monthlyIncomePaise = data.monthlyIncomeRupees !== undefined
    ? Math.round(data.monthlyIncomeRupees * 100)
    : undefined;

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      fullName: data.fullName?.trim() || undefined,
      fatherOrSpouseName: data.fatherOrSpouseName?.trim() || undefined,
      gender: data.gender || undefined,
      occupation: data.occupation?.trim() || undefined,
      monthlyIncomePaise,
      status: data.status || undefined,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'CUSTOMER_UPDATED',
    entityType: 'Customer',
    entityId: customerId,
    metadata: { previous: customer, updated },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
  return { success: true };
}

/**
 * Reassign Customer Address with historical record retention.
 * Marks old address as not current and creates new effective record.
 * Requires: customers:write
 */
export async function changeCustomerAddress(customerId, addressData) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Close current address
    await tx.customerAddress.updateMany({
      where: { customerId, isCurrent: true },
      data: { isCurrent: false, effectiveTo: now },
    });

    // 2. Create new active address
    const newAddress = await tx.customerAddress.create({
      data: {
        customerId,
        villageId: addressData.villageId,
        areaId: addressData.areaId || null,
        addressLine: addressData.addressLine.trim(),
        landmark: addressData.landmark?.trim() || null,
        pincode: addressData.pincode || null,
        isCurrent: true,
        effectiveFrom: now,
      },
    });

    // 3. Update customer's primary village/area foreign keys
    await tx.customer.update({
      where: { id: customerId },
      data: {
        villageId: addressData.villageId,
        areaId: addressData.areaId || null,
      },
    });

    // 4. Audit Log
    await writeAudit({
      actorId: user.id,
      action: 'CUSTOMER_ADDRESS_CHANGED',
      entityType: 'CustomerAddress',
      entityId: newAddress.id,
      metadata: { customerId, newAddress },
      tx,
    });
  });

  revalidatePath(`/customers/${customerId}`);
  return { success: true };
}

/**
 * Reassign Customer Line with historical retention and partial unique constraint.
 * Marks existing line assignment as not current and creates new active assignment.
 * Requires: customers:write
 */
export async function assignCustomerLine(customerId, newLineId) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Mark existing current Line as closed
    await tx.customerLineAssignment.updateMany({
      where: { customerId, isCurrent: true },
      data: { isCurrent: false, effectiveTo: now },
    });

    // 2. Insert new current Line assignment
    const assignment = await tx.customerLineAssignment.create({
      data: {
        customerId,
        lineId: newLineId,
        assignedBy: user.id,
        effectiveFrom: now,
        isCurrent: true,
      },
    });

    // 3. Audit Log
    await writeAudit({
      actorId: user.id,
      action: 'CUSTOMER_LINE_REASSIGNED',
      entityType: 'CustomerLineAssignment',
      entityId: assignment.id,
      metadata: { customerId, newLineId },
      tx,
    });
  });

  revalidatePath(`/customers/${customerId}`);
  return { success: true };
}

/**
 * Record GPS Location for a customer.
 * Requires: customers:write
 */
export async function recordCustomerGPS(customerId, { latitude, longitude, accuracy, source = 'DEVICE_GPS' }) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');

  // Map any source variant to valid Prisma LocationSource enum (DEVICE_GPS, MANUAL, GEOCODE)
  let normalizedSource = 'DEVICE_GPS';
  if (source === 'MANUAL' || source === 'MANUAL_ENTRY') {
    normalizedSource = 'MANUAL';
  } else if (source === 'GEOCODE' || source === 'GEOCODED') {
    normalizedSource = 'GEOCODE';
  }

  const location = await prisma.customerLocation.create({
    data: {
      customerId,
      latitude,
      longitude,
      accuracy: accuracy || null,
      source: normalizedSource,
      capturedBy: user.id,
      isPrimary: true,
      capturedAt: new Date(),
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'CUSTOMER_GPS_RECORDED',
    entityType: 'CustomerLocation',
    entityId: location.id,
    metadata: { customerId, latitude, longitude, accuracy },
  });

  revalidatePath(`/customers/${customerId}`);
  return { success: true, locationId: location.id };
}

/**
 * Link an uploaded Cloudinary asset to a customer as a verified or pending document.
 * Requires: customers:write
 */
export async function attachCustomerDocument(customerId, {
  publicId,
  secureUrl,
  bytes,
  format,
  documentType,
  documentNumber,
}) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');

  const result = await prisma.$transaction(async (tx) => {
    // 1. Record MediaAsset
    const media = await tx.mediaAsset.create({
      data: {
        publicId,
        secureUrl,
        format,
        bytes,
        folder: 'village-finance/customer-documents',
        resourceType: 'image',
        uploadedByUserId: user.id,
        purpose: 'CUSTOMER_DOCUMENT',
        status: 'ACTIVE',
      },
    });

    // 2. Record CustomerDocument
    const doc = await tx.customerDocument.create({
      data: {
        customerId,
        mediaAssetId: media.id,
        documentType,
        documentNumber: documentNumber ? documentNumber.trim() : null,
        verifiedAt: new Date(),
        verifiedBy: user.id,
      },
    });

    // 3. Audit
    await writeAudit({
      actorId: user.id,
      action: 'CUSTOMER_DOCUMENT_ATTACHED',
      entityType: 'CustomerDocument',
      entityId: doc.id,
      metadata: { customerId, documentType, publicId },
      tx,
    });

    return doc;
  });

  revalidatePath(`/customers/${customerId}`);
  return { success: true, documentId: result.id };
}

/**
 * Helper: Fetch all villages and their areas for forms & dropdowns.
 */
export async function getVillagesAndAreas() {
  const villages = await prisma.village.findMany({
    orderBy: { name: 'asc' },
    include: {
      areas: { orderBy: { name: 'asc' } },
    },
  });

  return villages.map((v) => ({
    id: v.id,
    name: v.name,
    code: v.code,
    areas: v.areas.map((a) => ({ id: a.id, name: a.name })),
  }));
}

/**
 * Helper: Fetch all active Lines for assignment.
 */
export async function getLinesList() {
  return prisma.line.findMany({
    orderBy: [{ weekday: 'asc' }, { session: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      weekday: true,
      session: true,
      description: true,
    },
  });
}

/**
 * Fetch detailed village and line lists with aggregate customer counts for management UI.
 */
export async function getVillagesManagementData() {
  const { profile } = await requireAuth();
  requirePermission(profile, 'customers:read');

  const [villages, lines] = await Promise.all([
    prisma.village.findMany({
      orderBy: { name: 'asc' },
      include: {
        areas: {
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { customers: true } },
          },
        },
        _count: { select: { customers: true } },
      },
    }),
    prisma.line.findMany({
      orderBy: [{ weekday: 'asc' }, { session: 'asc' }],
      include: {
        _count: {
          select: {
            customerLineAssignments: {
              where: { isCurrent: true },
            },
          },
        },
      },
    }),
  ]);

  return {
    villages: villages.map((v) => ({
      id: v.id,
      name: v.name,
      code: v.code,
      district: v.district,
      state: v.state,
      customerCount: v._count.customers,
      areas: v.areas.map((a) => ({
        id: a.id,
        name: a.name,
        pincode: a.pincode,
        landmark: a.landmark,
        customerCount: a._count.customers,
      })),
    })),
    lines: lines.map((l) => ({
      id: l.id,
      name: l.name,
      code: l.code,
      weekday: l.weekday,
      session: l.session,
      description: l.description,
      activeCustomerCount: l._count.customerLineAssignments,
    })),
  };
}

const createVillageSchema = z.object({
  name: z.string().min(2, 'Village name must be at least 2 characters'),
  code: z.string().min(2).max(15).toUpperCase(),
  district: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
});

/**
 * Create a new Village
 * Requires: customers:write
 */
export async function createVillage(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');

  const data = validate(createVillageSchema, input);

  const existing = await prisma.village.findUnique({
    where: { code: data.code },
  });
  if (existing) {
    throw new Error(`Village with code "${data.code}" already exists`);
  }

  const village = await prisma.village.create({
    data: {
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      district: data.district ? data.district.trim() : null,
      state: data.state ? data.state.trim() : null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'VILLAGE_CREATED',
    entityType: 'Village',
    entityId: village.id,
    metadata: { name: village.name, code: village.code },
  });

  revalidatePath('/villages');
  revalidatePath('/customers');
  return village;
}

const createAreaSchema = z.object({
  villageId: z.string().uuid('Invalid village ID'),
  name: z.string().min(2, 'Area name must be at least 2 characters'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional().nullable(),
  landmark: z.string().optional().nullable(),
});

/**
 * Create an Area within a Village
 * Requires: customers:write
 */
export async function createArea(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');

  const data = validate(createAreaSchema, input);

  const existing = await prisma.area.findFirst({
    where: {
      villageId: data.villageId,
      name: { equals: data.name.trim(), mode: 'insensitive' },
    },
  });
  if (existing) {
    throw new Error(`Area "${data.name}" already exists in this village`);
  }

  const area = await prisma.area.create({
    data: {
      villageId: data.villageId,
      name: data.name.trim(),
      pincode: data.pincode || null,
      landmark: data.landmark ? data.landmark.trim() : null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'AREA_CREATED',
    entityType: 'Area',
    entityId: area.id,
    metadata: { name: area.name, villageId: data.villageId },
  });

  revalidatePath('/villages');
  revalidatePath('/customers');
  return area;
}

const createLineSchema = z.object({
  name: z.string().min(2, 'Line name is required'),
  code: z.string().min(2).max(15).toUpperCase(),
  weekday: z.enum(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']),
  session: z.enum(['MORNING', 'AFTERNOON']),
  description: z.string().optional().nullable(),
});

/**
 * Create a new Collection Line
 * Requires: customers:write
 */
export async function createLine(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');

  const data = validate(createLineSchema, input);

  const existing = await prisma.line.findUnique({
    where: { code: data.code },
  });
  if (existing) {
    throw new Error(`Line with code "${data.code}" already exists`);
  }

  const line = await prisma.line.create({
    data: {
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      weekday: data.weekday,
      session: data.session,
      description: data.description ? data.description.trim() : null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'LINE_CREATED',
    entityType: 'Line',
    entityId: line.id,
    metadata: { name: line.name, code: line.code },
  });

  revalidatePath('/villages');
  revalidatePath('/customers');
  return line;
}

const updateVillageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, 'Village name must be at least 2 characters'),
  code: z.string().min(2).max(15).toUpperCase(),
  district: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
});

/**
 * Update an existing Village
 * Requires: customers:write
 */
export async function updateVillage(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');
  const data = validate(updateVillageSchema, input);

  const existing = await prisma.village.findFirst({
    where: { code: data.code, NOT: { id: data.id } },
  });
  if (existing) throw new Error(`Another village already uses code "${data.code}"`);

  const village = await prisma.village.update({
    where: { id: data.id },
    data: {
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      district: data.district ? data.district.trim() : null,
      state: data.state ? data.state.trim() : null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'VILLAGE_UPDATED',
    entityType: 'Village',
    entityId: village.id,
    metadata: { name: village.name, code: village.code },
  });

  revalidatePath('/villages');
  revalidatePath('/customers');
  return village;
}

const updateAreaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, 'Area name must be at least 2 characters'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional().nullable(),
  landmark: z.string().optional().nullable(),
});

/**
 * Update an existing Area
 * Requires: customers:write
 */
export async function updateArea(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');
  const data = validate(updateAreaSchema, input);

  const currentArea = await prisma.area.findUnique({ where: { id: data.id } });
  if (!currentArea) throw new Error('Area not found');

  const existing = await prisma.area.findFirst({
    where: {
      villageId: currentArea.villageId,
      name: { equals: data.name.trim(), mode: 'insensitive' },
      NOT: { id: data.id },
    },
  });
  if (existing) throw new Error(`Area "${data.name}" already exists in this village`);

  const area = await prisma.area.update({
    where: { id: data.id },
    data: {
      name: data.name.trim(),
      pincode: data.pincode || null,
      landmark: data.landmark ? data.landmark.trim() : null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'AREA_UPDATED',
    entityType: 'Area',
    entityId: area.id,
    metadata: { name: area.name, villageId: area.villageId },
  });

  revalidatePath('/villages');
  return area;
}

const updateLineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, 'Line name is required'),
  code: z.string().min(2).max(15).toUpperCase(),
  weekday: z.enum(['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']),
  session: z.enum(['MORNING', 'AFTERNOON']),
  description: z.string().optional().nullable(),
});

/**
 * Update an existing Collection Line
 * Requires: customers:write
 */
export async function updateLine(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');
  const data = validate(updateLineSchema, input);

  const existing = await prisma.line.findFirst({
    where: { code: data.code, NOT: { id: data.id } },
  });
  if (existing) throw new Error(`Another line already uses code "${data.code}"`);

  const line = await prisma.line.update({
    where: { id: data.id },
    data: {
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      weekday: data.weekday,
      session: data.session,
      description: data.description ? data.description.trim() : null,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'LINE_UPDATED',
    entityType: 'Line',
    entityId: line.id,
    metadata: { name: line.name, code: line.code },
  });

  revalidatePath('/villages');
  return line;
}

const updateCustomerProfileSchema = z.object({
  customerId: z.string().uuid(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  fatherOrSpouseName: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  monthlyIncomeRupees: z.number().nonnegative().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
});

/**
 * Update basic customer personal and demographic profile
 * Requires: customers:write
 */
export async function updateCustomerProfile(input) {
  const { profile, user } = await requireAuth();
  requirePermission(profile, 'customers:write');
  const data = validate(updateCustomerProfileSchema, input);

  const customer = await prisma.customer.update({
    where: { id: data.customerId },
    data: {
      fullName: data.fullName.trim(),
      fatherOrSpouseName: data.fatherOrSpouseName ? data.fatherOrSpouseName.trim() : null,
      gender: data.gender || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      occupation: data.occupation ? data.occupation.trim() : null,
      monthlyIncomePaise:
        data.monthlyIncomeRupees != null ? rupeesToPaise(data.monthlyIncomeRupees) : null,
      status: data.status,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: 'CUSTOMER_PROFILE_UPDATED',
    entityType: 'Customer',
    entityId: customer.id,
    metadata: { fullName: customer.fullName, status: customer.status },
  });

  revalidatePath(`/customers/${customer.id}`);
  revalidatePath('/customers');
  return customer;
}



/**
 * Master Data Management - Parties API
 * 
 * Endpoints for managing party master data including:
 * - List parties
 * - Create party
 * - Find duplicates
 * - Merge parties
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import MDMService from '@/lib/mdm/mdm-service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreatePartySchema = z.object({
  partyType: z.enum(['VENDOR', 'CUSTOMER', 'EMPLOYEE', 'PARTNER', 'INTERNAL']),
  name: z.string().min(1).max(255),
  legalName: z.string().max(255).optional(),
  registrationNumber: z.string().max(100).optional(),
  taxId: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(2).optional(),
  externalId: z.string().max(255).optional(),
  source: z.string().max(100).optional(),
});

const ListPartiesSchema = z.object({
  partyType: z.enum(['VENDOR', 'CUSTOMER', 'EMPLOYEE', 'PARTNER', 'INTERNAL']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MERGED', 'DELETED']).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const FindDuplicatesSchema = z.object({
  partyId: z.string().cuid(),
  threshold: z.number().min(0).max(100).default(75),
});

const MergePartiesSchema = z.object({
  masterPartyId: z.string().cuid(),
  duplicatePartyId: z.string().cuid(),
  survivorshipRuleId: z.string().cuid().optional(),
  mergeReason: z.string().optional(),
});

// ============================================================================
// GET /api/mdm/parties - List parties
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant from user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { tenantId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = ListPartiesSchema.parse({
      partyType: searchParams.get('partyType') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    });

    // Build query
    const where: any = { tenantId: user.tenantId };
    if (params.partyType) where.partyType = params.partyType;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { registrationNumber: { contains: params.search, mode: 'insensitive' } },
        { taxId: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Fetch parties
    const [parties, total] = await Promise.all([
      prisma.party.findMany({
        where,
        skip: params.offset,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.party.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: parties,
      metadata: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < total,
      },
    });
  } catch (error) {
    logger.error('Error listing parties', { error });
    return NextResponse.json(
      { error: 'Failed to list parties' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/mdm/parties - Create party
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant from user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { tenantId: true, id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const data = CreatePartySchema.parse(body);

    // Check for duplicates
    const existing = await prisma.party.findFirst({
      where: {
        tenantId: user.tenantId,
        OR: [
          data.registrationNumber && { registrationNumber: data.registrationNumber },
          data.taxId && { taxId: data.taxId },
        ].filter(Boolean),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Party with this registration number or tax ID already exists' },
        { status: 409 }
      );
    }

    // Create party
    const party = await prisma.party.create({
      data: {
        tenantId: user.tenantId,
        ...data,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });

    // Calculate initial quality score
    const mdm = new MDMService(prisma);
    await mdm.calculatePartyQualityScore(user.tenantId, party.id);

    logger.info('Party created', {
      tenantId: user.tenantId,
      partyId: party.id,
      partyType: party.partyType,
    });

    return NextResponse.json(
      {
        success: true,
        data: party,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating party', { error });
    return NextResponse.json(
      { error: 'Failed to create party' },
      { status: 500 }
    );
  }
}

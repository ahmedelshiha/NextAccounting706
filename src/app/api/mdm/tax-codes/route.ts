/**
 * Master Data Management - Tax Codes API
 * 
 * Endpoints for managing tax code master data including:
 * - List tax codes
 * - Create tax code
 * - Update tax code
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateTaxCodeSchema = z.object({
  taxCodeValue: z.string().min(1).max(50),
  description: z.string().max(255).optional(),
  taxType: z.enum([
    'VAT',
    'INCOME_TAX',
    'WITHHOLDING_TAX',
    'ZAKAT',
    'CORPORATE_TAX',
    'STAMP_DUTY',
    'OTHER',
  ]),
  country: z.string().min(2).max(2),
  taxRate: z.number().min(0).max(100),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  externalId: z.string().max(255).optional(),
});

const ListTaxCodesSchema = z.object({
  taxType: z.enum([
    'VAT',
    'INCOME_TAX',
    'WITHHOLDING_TAX',
    'ZAKAT',
    'CORPORATE_TAX',
    'STAMP_DUTY',
    'OTHER',
  ]).optional(),
  country: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUPERSEDED', 'MERGED']).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// ============================================================================
// GET /api/mdm/tax-codes - List tax codes
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
    const params = ListTaxCodesSchema.parse({
      taxType: searchParams.get('taxType') || undefined,
      country: searchParams.get('country') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    });

    // Build query
    const where: any = { tenantId: user.tenantId };
    if (params.taxType) where.taxType = params.taxType;
    if (params.country) where.country = params.country;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { taxCodeValue: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Fetch tax codes
    const [taxCodes, total] = await Promise.all([
      prisma.taxCode.findMany({
        where,
        skip: params.offset,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.taxCode.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: taxCodes,
      metadata: {
        total,
        limit: params.limit,
        offset: params.offset,
        hasMore: params.offset + params.limit < total,
      },
    });
  } catch (error) {
    logger.error('Error listing tax codes', { error });
    return NextResponse.json(
      { error: 'Failed to list tax codes' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/mdm/tax-codes - Create tax code
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
    const data = CreateTaxCodeSchema.parse(body);

    // Check for duplicate tax code
    const existing = await prisma.taxCode.findFirst({
      where: {
        tenantId: user.tenantId,
        taxCodeValue: data.taxCodeValue,
        country: data.country,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Tax code for this country already exists' },
        { status: 409 }
      );
    }

    // Create tax code
    const taxCode = await prisma.taxCode.create({
      data: {
        tenantId: user.tenantId,
        ...data,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });

    logger.info('Tax code created', {
      tenantId: user.tenantId,
      taxCodeId: taxCode.id,
      taxCodeValue: taxCode.taxCodeValue,
    });

    return NextResponse.json(
      {
        success: true,
        data: taxCode,
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

    logger.error('Error creating tax code', { error });
    return NextResponse.json(
      { error: 'Failed to create tax code' },
      { status: 500 }
    );
  }
}

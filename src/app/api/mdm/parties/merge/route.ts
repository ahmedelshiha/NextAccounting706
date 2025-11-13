/**
 * Master Data Management - Merge Operations API
 * 
 * Endpoints for merging and unmerging party records
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

const MergePartiesSchema = z.object({
  masterPartyId: z.string().cuid(),
  duplicatePartyId: z.string().cuid(),
  survivorshipRuleId: z.string().cuid().optional(),
  mergeReason: z.string().optional(),
});

const UnmergeSchema = z.object({
  mergeLogId: z.string(),
  unmergeReason: z.string().optional(),
});

// ============================================================================
// POST /api/mdm/parties/merge - Merge two parties
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
      select: { tenantId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { masterPartyId, duplicatePartyId, survivorshipRuleId, mergeReason } =
      MergePartiesSchema.parse(body);

    // Initialize MDM service
    const mdm = new MDMService(prisma);

    // Perform merge
    const result = await mdm.mergeParties(
      user.tenantId,
      masterPartyId,
      duplicatePartyId,
      survivorshipRuleId,
      mergeReason
    );

    logger.info('Party merge completed', {
      tenantId: user.tenantId,
      masterPartyId,
      duplicatePartyId,
      mergeLogId: result.mergeLogId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    logger.error('Error merging parties', { error });
    return NextResponse.json(
      { error: 'Failed to merge parties' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/mdm/parties/unmerge - Unmerge two parties
// ============================================================================

export async function PUT(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    const { mergeLogId, unmergeReason } = UnmergeSchema.parse(body);

    // Initialize MDM service
    const mdm = new MDMService(prisma);

    // Perform unmerge
    const result = await mdm.unmergeParty(
      user.tenantId,
      mergeLogId,
      unmergeReason
    );

    logger.info('Party unmerge completed', {
      tenantId: user.tenantId,
      mergeLogId,
      masterRecordId: result.masterRecordId,
      duplicateRecordId: result.duplicateRecordId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    logger.error('Error unmerging parties', { error });
    return NextResponse.json(
      { error: 'Failed to unmerge parties' },
      { status: 500 }
    );
  }
}

/**
 * Master Data Management - Duplicate Detection API
 * 
 * Endpoints for finding and managing duplicate records
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

const UnmergeSchema = z.object({
  mergeLogId: z.string(),
  unmergeReason: z.string().optional(),
});

// ============================================================================
// POST /api/mdm/parties/duplicates/find - Find duplicate parties
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
    const { partyId, threshold } = FindDuplicatesSchema.parse(body);

    // Initialize MDM service
    const mdm = new MDMService(prisma);

    // Find duplicates
    const duplicates = await mdm.findPartyDuplicates(
      user.tenantId,
      partyId,
      threshold
    );

    logger.info('Duplicate detection completed', {
      tenantId: user.tenantId,
      partyId,
      matchCount: duplicates.length,
    });

    return NextResponse.json({
      success: true,
      data: duplicates,
      metadata: {
        partyId,
        threshold,
        matchCount: duplicates.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error finding duplicates', { error });
    return NextResponse.json(
      { error: 'Failed to find duplicates' },
      { status: 500 }
    );
  }
}

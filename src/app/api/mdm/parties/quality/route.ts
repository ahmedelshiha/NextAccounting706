/**
 * Master Data Management - Data Quality API
 * 
 * Endpoints for data quality scoring and merge history
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

const QualityScoreSchema = z.object({
  partyId: z.string().cuid(),
});

const MergeHistorySchema = z.object({
  recordId: z.string().cuid(),
  limit: z.number().int().min(1).max(100).default(50),
});

// ============================================================================
// POST /api/mdm/parties/quality - Calculate quality score
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
    const { partyId } = QualityScoreSchema.parse(body);

    // Initialize MDM service
    const mdm = new MDMService(prisma);

    // Calculate quality score
    const qualityScore = await mdm.calculatePartyQualityScore(
      user.tenantId,
      partyId
    );

    logger.info('Quality score calculated', {
      tenantId: user.tenantId,
      partyId,
      score: qualityScore.score,
    });

    return NextResponse.json({
      success: true,
      data: qualityScore,
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

    logger.error('Error calculating quality score', { error });
    return NextResponse.json(
      { error: 'Failed to calculate quality score' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/mdm/parties/quality/history - Get merge history
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
    const recordId = searchParams.get('recordId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId query parameter is required' },
        { status: 400 }
      );
    }

    // Initialize MDM service
    const mdm = new MDMService(prisma);

    // Get merge history
    const history = await mdm.getMergeHistory(user.tenantId, recordId, limit);

    logger.info('Merge history retrieved', {
      tenantId: user.tenantId,
      recordId,
      count: history.length,
    });

    return NextResponse.json({
      success: true,
      data: history,
      metadata: {
        recordId,
        count: history.length,
      },
    });
  } catch (error) {
    logger.error('Error retrieving merge history', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve merge history' },
      { status: 500 }
    );
  }
}

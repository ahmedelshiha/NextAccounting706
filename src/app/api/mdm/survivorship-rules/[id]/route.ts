/**
 * Master Data Management - Individual Survivorship Rule API
 * 
 * Endpoints for managing individual survivorship rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const UpdateRuleSchema = z.object({
  ruleName: z.string().max(255).optional(),
  description: z.string().optional(),
  fieldMappings: z.record(z.enum(['MASTER', 'DUPLICATE', 'NEWER', 'OLDER', 'CUSTOM'])).optional(),
  customLogic: z.string().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// GET /api/mdm/survivorship-rules/[id] - Get rule by ID
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Fetch rule
    const rule = await prisma.survivorshipRule.findUnique({
      where: { id: params.id },
    });

    if (!rule || rule.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Survivorship rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    logger.error('Error fetching survivorship rule', { error });
    return NextResponse.json(
      { error: 'Failed to fetch survivorship rule' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/mdm/survivorship-rules/[id] - Update rule
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify rule exists and belongs to tenant
    const rule = await prisma.survivorshipRule.findUnique({
      where: { id: params.id },
    });

    if (!rule || rule.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Survivorship rule not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const data = UpdateRuleSchema.parse(body);

    // Update rule
    const updated = await prisma.survivorshipRule.update({
      where: { id: params.id },
      data: {
        ...data,
        updatedBy: user.id,
        updatedAt: new Date(),
      },
    });

    logger.info('Survivorship rule updated', {
      tenantId: user.tenantId,
      ruleId: params.id,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error updating survivorship rule', { error });
    return NextResponse.json(
      { error: 'Failed to update survivorship rule' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/mdm/survivorship-rules/[id] - Delete rule
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify rule exists and belongs to tenant
    const rule = await prisma.survivorshipRule.findUnique({
      where: { id: params.id },
    });

    if (!rule || rule.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Survivorship rule not found' },
        { status: 404 }
      );
    }

    // Delete rule
    await prisma.survivorshipRule.delete({
      where: { id: params.id },
    });

    logger.info('Survivorship rule deleted', {
      tenantId: user.tenantId,
      ruleId: params.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Survivorship rule deleted',
    });
  } catch (error) {
    logger.error('Error deleting survivorship rule', { error });
    return NextResponse.json(
      { error: 'Failed to delete survivorship rule' },
      { status: 500 }
    );
  }
}

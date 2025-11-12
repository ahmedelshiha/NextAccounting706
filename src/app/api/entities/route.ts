import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { entityService } from "@/services/entities";
import { tenantContext } from "@/lib/tenant-context";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Validation schema for entity creation
const createEntitySchema = z.object({
  country: z.string().length(2),
  name: z.string().min(1).max(255),
  legalForm: z.string().optional(),
  entityType: z.enum(["company", "individual", "freelancer", "partnership"]).optional(),
  activityCode: z.string().optional(),
  fiscalYearStart: z.string().datetime().optional(),
  licenses: z.array(z.object({
    country: z.string(),
    authority: z.string(),
    licenseNumber: z.string(),
    legalForm: z.string().optional(),
    economicZoneId: z.string().optional(),
  })).optional(),
  registrations: z.array(z.object({
    type: z.string(),
    value: z.string(),
    source: z.string().optional(),
  })).optional(),
});

/**
 * GET /api/entities
 * List entities for current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const ctx = await tenantContext.getContext();
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      country: searchParams.get("country") || undefined,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      skip: searchParams.get("skip") ? parseInt(searchParams.get("skip")!) : 0,
      take: searchParams.get("take") ? parseInt(searchParams.get("take")!) : 50,
    };

    const entities = await entityService.listEntities(ctx.tenantId, filters);

    return NextResponse.json({
      success: true,
      data: entities,
    });
  } catch (error) {
    logger.error("Error listing entities", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/entities
 * Create new entity
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const ctx = await tenantContext.getContext();
    const body = await request.json();

    // Validate input
    const input = createEntitySchema.parse(body);

    // Create entity
    const entity = await entityService.createEntity(
      ctx.tenantId,
      session.user.id,
      {
        ...input,
        fiscalYearStart: input.fiscalYearStart ? new Date(input.fiscalYearStart) : undefined,
      }
    );

    logger.info("Entity created successfully", {
      entityId: entity.id,
      country: entity.country,
    });

    return NextResponse.json(
      {
        success: true,
        data: entity,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    logger.error("Error creating entity", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

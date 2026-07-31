import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@saas/database";
import { DEFAULT_PAGINATION, MAX_PER_PAGE } from "@saas/config";
import type { ApiResponse, PaginatedResponse, PaginationParams } from "@saas/types";
import { z } from "zod";

export function successResponse<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, string[]>,
): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status });
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): NextResponse<PaginatedResponse<T>> {
  const page = params.page ?? DEFAULT_PAGINATION.page;
  const perPage = Math.min(params.perPage ?? DEFAULT_PAGINATION.perPage, MAX_PER_PAGE);
  const totalPages = Math.ceil(total / perPage);

  return NextResponse.json({
    data,
    meta: {
      total,
      page,
      perPage,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
}

export function getPaginationParams(searchParams: URLSearchParams) {
  return {
    page: Math.max(1, parseInt(searchParams.get("page") ?? String(DEFAULT_PAGINATION.page), 10)),
    perPage: Math.min(
      Math.max(1, parseInt(searchParams.get("perPage") ?? String(DEFAULT_PAGINATION.perPage), 10)),
      MAX_PER_PAGE,
    ),
  };
}

export async function validateApiKey(request: NextRequest): Promise<string | null> {
  const apiKey =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!apiKey) return null;

  const key = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    select: { userId: true, expiresAt: true },
  });

  if (!key) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  await prisma.apiKey.update({
    where: { key: apiKey },
    data: { lastUsedAt: new Date() },
  });

  return key.userId;
}

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { data?: T; error?: ApiResponse["error"] } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        details: result.error.flatten().fieldErrors as Record<string, string[]>,
      },
    };
  }
  return { data: result.data };
}

export async function requireOrganizationAccess(organizationId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  return !!membership;
}

export function rateLimitResponse(): NextResponse<ApiResponse> {
  return errorResponse("RATE_LIMIT", "Too many requests", 429);
}

export function notFoundResponse(resource: string = "Resource"): NextResponse<ApiResponse> {
  return errorResponse("NOT_FOUND", `${resource} not found`, 404);
}

export function unauthorizedResponse(message: string = "Unauthorized"): NextResponse<ApiResponse> {
  return errorResponse("UNAUTHORIZED", message, 401);
}

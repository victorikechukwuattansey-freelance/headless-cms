import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "node:crypto";
import { prisma } from "@awd/database";
import { IS_PUBLIC_KEY } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const token = header.slice(7);

    let user: { userId: string; email: string; organizationId: string };

    try {
      const payload = await this.jwt.verifyAsync(token);
      user = { userId: payload.sub, email: payload.email, organizationId: payload.organizationId };
    } catch {
      const apiKey = await prisma.apiKey.findUnique({
        where: { hashedKey: createHash("sha256").update(token).digest("hex") },
        include: { user: true },
      });
      if (!apiKey || apiKey.revokedAt !== null || (apiKey.expiresAt !== null && apiKey.expiresAt <= new Date())) {
        throw new UnauthorizedException("Invalid or expired API key");
      }
      void prisma.apiKey
        .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
      user = { userId: apiKey.createdById, email: apiKey.user.email, organizationId: apiKey.organizationId };
      request.apiKeyId = apiKey.id;
    }

    const override = request.headers["x-organization"];
    if (typeof override === "string" && override.length > 0 && override !== user.organizationId) {
      const membership = await prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId: override, userId: user.userId } },
        select: { organizationId: true },
      });
      if (!membership) {
        throw new ForbiddenException("Not a member of the requested organization");
      }
      user = { ...user, organizationId: override };
    }

    request.user = user;
    return true;
  }
}

import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { prisma, type MembershipRole } from "@awd/database";

export const MANAGEABLE_ROLES: MembershipRole[] = ["ADMIN", "MANAGER", "DEVELOPER", "OPERATOR", "VIEWER", "BILLING_ADMIN", "AUDITOR"];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "org";
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  for (let i = 2; i < 100; i++) {
    const existing = await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${base}-${i}`;
  }
  throw new BadRequestException("Could not generate a unique slug");
}

async function requireManageRole(organizationId: string, userId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  if (!membership) throw new NotFoundException("Organization not found");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new ForbiddenException("Requires OWNER or ADMIN role");
  }
}

export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  role: string;
}

export interface OrgMemberItem {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: Date;
}

@Injectable()
export class OrgsService {
  async list(userId: string): Promise<OrgListItem[]> {
    const memberships = await prisma.membership.findMany({
      where: { userId, organization: { deletedAt: null, status: "ACTIVE" } },
      include: { organization: { select: { id: true, name: true, slug: true, plan: true, status: true } } },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      plan: m.organization.plan,
      status: m.organization.status,
      role: m.role,
    }));
  }

  async get(organizationId: string, userId: string): Promise<{ id: string; name: string; slug: string; plan: string; status: string; role: string }> {
    const membership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: { organization: true },
    });
    if (!membership || membership.organization.deletedAt !== null) throw new NotFoundException("Organization not found");
    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      plan: membership.organization.plan,
      status: membership.organization.status,
      role: membership.role,
    };
  }

  async create(userId: string, input: { name: string }): Promise<{ id: string; name: string; slug: string; plan: string; status: string; role: string }> {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Name is required");
    const slug = await uniqueSlug(slugify(name));
    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name, slug, status: "ACTIVE", plan: "free" },
      });
      await tx.membership.create({
        data: { organizationId: created.id, userId, role: "OWNER" },
      });
      return created;
    });
    return { id: org.id, name: org.name, slug: org.slug, plan: org.plan, status: org.status, role: "OWNER" };
  }

  async update(organizationId: string, userId: string, input: { name?: string }): Promise<{ id: string; name: string }> {
    await requireManageRole(organizationId, userId);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Name is required");
    const org = await prisma.organization.update({ where: { id: organizationId }, data: { name }, select: { id: true, name: true } });
    return org;
  }

  async members(organizationId: string, userId: string): Promise<OrgMemberItem[]> {
    const membership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException("Organization not found");
    const members = await prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role,
      createdAt: m.createdAt,
    }));
  }

  async invite(organizationId: string, actorUserId: string, input: { email: string; role?: string }): Promise<OrgMemberItem> {
    await requireManageRole(organizationId, actorUserId);
    const email = input.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException("Email is required");
    const role = (input.role ?? "VIEWER") as MembershipRole;
    if (!MANAGEABLE_ROLES.includes(role)) throw new BadRequestException(`Invalid role; allowed: ${MANAGEABLE_ROLES.join(", ")}`);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, displayName: true } });
    if (!user) throw new NotFoundException(`No user with email ${email}`);
    try {
      const membership = await prisma.membership.create({
        data: { organizationId, userId: user.id, role },
        include: { user: { select: { id: true, email: true, displayName: true } } },
      });
      return {
        userId: membership.user.id,
        email: membership.user.email,
        displayName: membership.user.displayName,
        role: membership.role,
        createdAt: membership.createdAt,
      };
    } catch {
      throw new ConflictException("User is already a member");
    }
  }

  async updateRole(organizationId: string, actorUserId: string, memberUserId: string, input: { role: string }): Promise<{ userId: string; role: string }> {
    await requireManageRole(organizationId, actorUserId);
    const role = input.role as MembershipRole;
    if (!MANAGEABLE_ROLES.includes(role) && role !== "OWNER") {
      throw new BadRequestException(`Invalid role; allowed: ${[...MANAGEABLE_ROLES, "OWNER"].join(", ")}`);
    }
    const target = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: memberUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException("Member not found");
    if (target.role === "OWNER" && role !== "OWNER") {
      const actor = await prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId: actorUserId } },
        select: { role: true },
      });
      if (actor?.role !== "OWNER") throw new ForbiddenException("Only the OWNER can change an OWNER's role");
    }
    const updated = await prisma.membership.update({
      where: { organizationId_userId: { organizationId, userId: memberUserId } },
      data: { role },
      select: { userId: true, role: true },
    });
    return updated;
  }

  async removeMember(organizationId: string, actorUserId: string, memberUserId: string): Promise<{ removed: boolean }> {
    await requireManageRole(organizationId, actorUserId);
    const target = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: memberUserId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundException("Member not found");
    if (target.role === "OWNER" && actorUserId !== memberUserId) {
      throw new ForbiddenException("Only the OWNER themselves can leave as OWNER");
    }
    if (actorUserId === memberUserId) {
      const ownerCount = await prisma.membership.count({
        where: { organizationId, role: "OWNER" },
      });
      if (target.role === "OWNER" && ownerCount <= 1) {
        throw new BadRequestException("Cannot remove the last OWNER");
      }
    }
    await prisma.membership.delete({
      where: { organizationId_userId: { organizationId, userId: memberUserId } },
    });
    return { removed: true };
  }
}

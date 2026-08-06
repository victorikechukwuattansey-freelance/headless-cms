"use server";

import { prisma } from "@saas/database";
import { hash } from "bcryptjs";
import { auth } from "./index";
import { redirect } from "next/navigation";

export async function registerUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;

  if (!email || !password || !name) {
    return { success: false, error: "All fields are required" };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "A user with this email already exists" };
  }

  const passwordHash = await hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      profile: {
        create: {},
      },
    },
  });

  return { success: true };
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  return user;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login");
  }
  return session!;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }
  return session;
}

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { prisma } from "@awd/database";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { LoginResponseDto } from "./dto/login.dto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`${salt}${password}`).digest("hex");
  return `sha256$100000$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  const [algo, , salt, expected] = parts;
  if (algo !== "sha256" || !salt || !expected) return false;
  const actual = createHash("sha256").update(`${salt}${password}`).digest("hex");
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { memberships: true },
    });
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const membership = user.memberships.find((m) => m.role === "OWNER" || m.role === "ADMIN") ?? user.memberships[0];
    const organizationId = membership?.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException("User has no organization");
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      organizationId,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        organizationId,
      },
    };
  }
}

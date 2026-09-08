import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import type { User } from '@prisma/client';
import { mailer } from '../../lib/mailer';
import { AppError } from '../../middleware/errorHandler';
import { queue } from './queue';
import { prisma } from '../../lib/prisma';

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_EXPIRES_IN: NonNullable<SignOptions['expiresIn']> =
  (process.env.JWT_ACCESS_EXPIRES || '15m') as NonNullable<SignOptions['expiresIn']>;
const REFRESH_TOKEN_EXPIRES_IN: NonNullable<SignOptions['expiresIn']> =
  (process.env.JWT_REFRESH_EXPIRES || '7d') as NonNullable<SignOptions['expiresIn']>;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const toAuthUser = (
  user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'isEmailVerified' | 'isActive'>
) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive,
});

export const authService = {
  async register(email: string, name: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new AppError(409, 'CONFLICT', 'Email already in use');

    const hashed = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        password: hashed,
        emailVerifyToken: verifyToken,
      },
    });

    await queue.add('send_verification_email', {
      email: normalizedEmail,
      verifyToken,
    });

    return toAuthUser(user);
  },

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.password) throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');

    if (!user.isActive || user.deletedAt) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is inactive');
    }

    if (!user.isEmailVerified) {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email');
    }

    const tokens = await this.generateTokens(user);
    return { user: toAuthUser(user), tokens };
  },

  async refresh(refreshToken: string) {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string };
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

    if (!stored || stored.expiresAt < new Date()) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive || user.deletedAt) {
      await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
      throw new AppError(401, 'UNAUTHORIZED', 'User not found or inactive');
    }

    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    const tokens = await this.generateTokens(user);
    return { user: toAuthUser(user), tokens };
  },

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  },

  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({ where: { emailVerifyToken: token, deletedAt: null } });
    if (!user) throw new AppError(400, 'INVALID_TOKEN', 'Invalid verification token');

    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerifyToken: null },
    });
  },

  async forgotPassword(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.isActive || user.deletedAt) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });

    await mailer.sendPasswordResetEmail(normalizedEmail, token);
  },

  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user) throw new AppError(400, 'INVALID_TOKEN', 'Token is invalid or expired');

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, passwordResetToken: null, passwordResetExpiry: null },
    });

    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  },

  async generateTokens(user: { id: string; role: string }) {
    const accessToken = jwt.sign({ userId: user.id, role: user.role }, ACCESS_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });

    return { accessToken, refreshToken };
  },
};

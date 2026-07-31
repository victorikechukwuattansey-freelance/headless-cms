import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.organizationName || `${dto.firstName}'s Boutique`,
        slug: dto.organizationName
          ? dto.organizationName.toLowerCase().replace(/\s+/g, '-')
          : `boutique-${Date.now()}`,
        plan: 'starter',
        status: 'TRIAL',
      },
    });

    const role = await this.prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'OWNER',
        isSystem: true,
        permissions: ['*'],
      },
    });

    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passwordHash,
        roleId: role.id,
      },
    });

    const token = this.generateToken(user, tenant);

    return {
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const token = this.generateToken(user, user.tenant);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.roleId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        plan: user.tenant.plan,
        status: user.tenant.status,
      },
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        role: true,
      },
    });
  }

  private generateToken(user: any, tenant: any): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      role: user.roleId,
    });
  }
}

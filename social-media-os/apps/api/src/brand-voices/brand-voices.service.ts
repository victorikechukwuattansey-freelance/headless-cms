import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandVoicesService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    workspaceId: string;
    name: string;
    personality?: string[];
    audience?: string;
    writingStyle?: string;
    forbiddenWords?: string[];
    approvedTerms?: string[];
    brandColors?: Record<string, string>;
    fonts?: Record<string, string>;
    logoUrl?: string;
  }) {
    const existing = await this.prisma.brandVoice.findFirst({
      where: { workspaceId: data.workspaceId, name: data.name },
    });

    if (existing) {
      throw new ConflictException('Brand voice with this name already exists in workspace');
    }

    return this.prisma.brandVoice.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        personality: data.personality || [],
        audience: data.audience || '',
        writingStyle: data.writingStyle || '',
        forbiddenWords: data.forbiddenWords || [],
        approvedTerms: data.approvedTerms || [],
        brandColors: data.brandColors || undefined,
        fonts: data.fonts || undefined,
        logoUrl: data.logoUrl || null,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.brandVoice.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const brandVoice = await this.prisma.brandVoice.findUnique({
      where: { id },
    });

    if (!brandVoice) {
      throw new NotFoundException('Brand voice not found');
    }

    return brandVoice;
  }

  async update(
    id: string,
    data: {
      name?: string;
      personality?: string[];
      audience?: string;
      writingStyle?: string;
      forbiddenWords?: string[];
      approvedTerms?: string[];
      brandColors?: Record<string, string>;
      fonts?: Record<string, string>;
      logoUrl?: string;
    },
  ) {
    await this.findById(id);

    if (data.name) {
      const existing = await this.prisma.brandVoice.findFirst({
        where: { name: data.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Brand voice name already exists');
      }
    }

    return this.prisma.brandVoice.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.brandVoice.delete({ where: { id } });
  }

  async validateContent(id: string, content: string): Promise<{
    valid: boolean;
    forbiddenWords: string[];
    warnings: string[];
  }> {
    const brandVoice = await this.findById(id);

    const forbiddenFound = brandVoice.forbiddenWords.filter((word) =>
      content.toLowerCase().includes(word.toLowerCase()),
    );

    const approvedFound = brandVoice.approvedTerms.filter((term) =>
      content.toLowerCase().includes(term.toLowerCase()),
    );

    return {
      valid: forbiddenFound.length === 0,
      forbiddenWords: forbiddenFound,
      warnings: approvedFound.length === 0 ? ['No approved terms found in content'] : [],
    };
  }
}

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { EventBusService } from '../../common/event-bus.service';
import { OpenAiService } from '../ai/openai.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private openai: OpenAiService,
  ) {}

  async create(tenantId: string, dto: CreateProductDto, userId: string) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const product = await this.prisma.product.create({
      data: {
        ...(dto as any),
        slug,
        tenantId,
        totalCost: (dto.purchasePrice || 0) + (dto.shippingCost || 0) + (dto.customsCost || 0) + (dto.restorationCost || 0),
        profit: (dto.sellingPrice || 0) - ((dto.purchasePrice || 0) + (dto.shippingCost || 0) + (dto.customsCost || 0) + (dto.restorationCost || 0)),
      },
      include: {
        brand: true,
        category: true,
        images: true,
      },
    });

    await this.eventBus.emit('product.created', { product, userId, tenantId });

    return product;
  }

  async findAll(tenantId: string, query: QueryProductDto) {
    const where: any = { tenantId, deletedAt: null };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) where.status = query.status;
    if (query.brandId) where.brandId = query.brandId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.condition) where.condition = query.condition;
    if (query.inventoryStatus) where.inventoryStatus = query.inventoryStatus;
    if (query.authenticationStatus) where.authenticationStatus = query.authenticationStatus;
    if (query.minPrice || query.maxPrice) {
      where.sellingPrice = {};
      if (query.minPrice) where.sellingPrice.gte = query.minPrice;
      if (query.maxPrice) where.sellingPrice.lte = query.maxPrice;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          brand: true,
          category: true,
          collection: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        brand: true,
        category: true,
        collection: true,
        supplier: true,
        images: { orderBy: { sortOrder: 'asc' } },
        videos: true,
        certificates: true,
        authenticationLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        notes: { orderBy: { createdAt: 'desc' }, take: 5 },
        tasks: { where: { status: { not: 'COMPLETED' } }, take: 5 },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto, userId: string) {
    const existing = await this.findOne(tenantId, id);
    const d = dto as any;

    const updateData: any = { ...d };
    if (d.purchasePrice || d.shippingCost || d.customsCost || d.restorationCost) {
      const purchasePrice = d.purchasePrice ?? existing.purchasePrice ?? 0;
      const shippingCost = d.shippingCost ?? existing.shippingCost ?? 0;
      const customsCost = d.customsCost ?? existing.customsCost ?? 0;
      const restorationCost = d.restorationCost ?? existing.restorationCost ?? 0;
      const sellingPrice = d.sellingPrice ?? existing.sellingPrice ?? 0;

      updateData.totalCost = Number(purchasePrice) + Number(shippingCost) + Number(customsCost) + Number(restorationCost);
      updateData.profit = Number(sellingPrice) - updateData.totalCost;
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: { brand: true, category: true, images: true },
    });

    await this.eventBus.emit('product.updated', { product, userId, tenantId });

    return product;
  }

  async updateStatus(tenantId: string, id: string, status: string, userId: string) {
    const product = await this.findOne(tenantId, id);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        status: status as any,
        ...(status === 'SOLD' ? { soldAt: new Date() } : {}),
        ...(status === 'ACTIVE' ? { publishedAt: new Date() } : {}),
      },
    });

    await this.eventBus.emit('product.status_changed', {
      product: updated,
      previousStatus: product.status,
      newStatus: status,
      userId,
      tenantId,
    });

    return updated;
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async duplicate(tenantId: string, id: string, userId: string) {
    const original = await this.findOne(tenantId, id);

    const { id: _, createdAt, updatedAt, deletedAt, publishedAt, soldAt, ...data } = original;

    return this.create(tenantId, {
      ...data,
      name: `${data.name} (Copy)`,
      sku: `${data.sku}-COPY-${Date.now()}`,
      status: 'DRAFT',
    } as any, userId);
  }

  async generateAiDescription(tenantId: string, id: string) {
    const product = await this.findOne(tenantId, id);
    const description = await this.openai.generateProductDescription(product);
    return this.prisma.product.update({
      where: { id },
      data: { aiDescription: description },
    });
  }

  async generateAiTags(tenantId: string, id: string) {
    const product = await this.findOne(tenantId, id);
    const tags = await this.openai.generateProductTags(product);
    return this.prisma.product.update({
      where: { id },
      data: { aiTags: tags },
    });
  }

  async semanticSearch(tenantId: string, query: string) {
    const embedding = await this.openai.generateEmbedding(query);
    const results = await this.prisma.$queryRaw`
      SELECT p.*, b.name as brand_name,
        1 - (p.embedding <=> ${embedding}::vector) as similarity
      FROM products p
      JOIN brands b ON b.id = p."brandId"
      WHERE p."tenantId" = ${tenantId}::uuid
        AND p."deletedAt" IS NULL
        AND p.embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT 20
    `;
    return results;
  }
}

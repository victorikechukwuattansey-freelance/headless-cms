import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'INVENTORY')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Product created' })
  async create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    return this.productsService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List products with filtering and pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Products retrieved' })
  async findAll(@Query() query: QueryProductDto, @CurrentUser() user: any) {
    return this.productsService.findAll(user.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.findOne(user.tenantId, id);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'INVENTORY')
  @ApiOperation({ summary: 'Update product' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.update(user.tenantId, id, dto, user.id);
  }

  @Patch(':id/status')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update product status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.productsService.updateStatus(user.tenantId, id, status, user.id);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Soft delete product' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.softDelete(user.tenantId, id);
  }

  @Post(':id/generate-ai-description')
  @ApiOperation({ summary: 'Generate AI-powered product description' })
  async generateAiDescription(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.generateAiDescription(user.tenantId, id);
  }

  @Post(':id/generate-ai-tags')
  @ApiOperation({ summary: 'Generate AI-powered product tags' })
  async generateAiTags(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.generateAiTags(user.tenantId, id);
  }

  @Post(':id/duplicate')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Duplicate product' })
  async duplicate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.duplicate(user.tenantId, id, user.id);
  }

  @Get('search/semantic')
  @ApiOperation({ summary: 'Semantic product search via vector embeddings' })
  async semanticSearch(
    @Query('q') query: string,
    @CurrentUser() user: any,
  ) {
    return this.productsService.semanticSearch(user.tenantId, query);
  }
}

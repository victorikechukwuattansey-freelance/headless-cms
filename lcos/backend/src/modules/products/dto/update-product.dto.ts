export class UpdateProductDto {
  brandId?: string;
  name?: string;
  sku?: string;
  model?: string;
  description?: string;
  condition?: string;
  color?: string;
  material?: string;
  size?: string;
  gender?: string;
  serialNumber?: string;
  purchasePrice?: number;
  shippingCost?: number;
  customsCost?: number;
  restorationCost?: number;
  sellingPrice?: number;
  location?: string;
  currency?: string;
  tags?: string[];
  isAuthenticated?: boolean;
}

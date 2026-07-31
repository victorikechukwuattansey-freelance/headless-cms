export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  path?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brandId: string;
  categoryId?: string;
  collectionId?: string;
  model?: string;
  description?: string;
  condition: string;
  color?: string;
  material?: string;
  size?: string;
  gender?: string;
  serialNumber?: string;
  purchasePrice: number;
  shippingCost: number;
  customsCost: number;
  restorationCost: number;
  totalCost: number;
  sellingPrice: number;
  profit: number;
  currency: string;
  status: string;
  inventoryStatus: string;
  authenticationStatus: string;
  quantity: number;
  location?: string;
  isAuthenticated: boolean;
  images: ProductImage[];
  videos: ProductVideo[];
  brand?: Brand;
  category?: Category;
  collection?: Collection;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductVideo {
  id: string;
  url: string;
  title?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  isLuxury: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  children?: Category[];
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface Customer {
  id: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  isVip: boolean;
  totalSpent: number;
  totalOrders: number;
  tags: string[];
  createdAt: string;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  score: number;
  tags: string[];
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  total: number;
  profit: number;
  currency: string;
  customer?: Customer;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  profit: number;
  product?: Product;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  country?: string;
  reliabilityScore?: number;
  avgShippingDays?: number;
  isActive: boolean;
}

export interface AiAgent {
  id: string;
  name: string;
  type: string;
  description?: string;
  isActive: boolean;
}

export interface AiConversation {
  id: string;
  title?: string;
  status: string;
  messages: AiMessage[];
  createdAt: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description?: string;
  definition: any;
  isActive: boolean;
  version: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignee?: User;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalProfit: number;
  totalProducts: number;
  activeProducts: number;
  totalCustomers: number;
  totalOrders: number;
  pendingOrders: number;
  inventoryValue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  topBrands: { name: string; revenue: number }[];
  recentOrders: Order[];
  lowStockProducts: Product[];
}

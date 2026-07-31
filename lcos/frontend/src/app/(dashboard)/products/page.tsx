'use client';

import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Filter } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  condition: string;
  sellingPrice: number;
  status: string;
  authenticationStatus: string;
  createdAt: string;
  image?: string;
}

const mockProducts: Product[] = [
  { id: '1', name: 'Classic Flap Bag', sku: 'CH-001', brand: 'Chanel', category: 'Bags', condition: 'Excellent', sellingPrice: 8500, status: 'ACTIVE', authenticationStatus: 'AUTHENTIC', createdAt: '2026-07-15', image: '' },
  { id: '2', name: 'Submariner Date', sku: 'RL-001', brand: 'Rolex', category: 'Watches', condition: 'Like New', sellingPrice: 14500, status: 'ACTIVE', authenticationStatus: 'AUTHENTIC', createdAt: '2026-07-14', image: '' },
  { id: '3', name: 'Neverfull MM', sku: 'LV-001', brand: 'Louis Vuitton', category: 'Bags', condition: 'Good', sellingPrice: 1800, status: 'ACTIVE', authenticationStatus: 'PENDING', createdAt: '2026-07-13', image: '' },
  { id: '4', name: 'Kelly 28', sku: 'HE-001', brand: 'Hermès', category: 'Bags', condition: 'Excellent', sellingPrice: 22000, status: 'RESERVED', authenticationStatus: 'AUTHENTIC', createdAt: '2026-07-12', image: '' },
  { id: '5', name: 'GG Marmont Matelassé', sku: 'GU-001', brand: 'Gucci', category: 'Bags', condition: 'Very Good', sellingPrice: 1200, status: 'DRAFT', authenticationStatus: 'INCONCLUSIVE', createdAt: '2026-07-11', image: '' },
  { id: '6', name: 'Wayfarer Sunglasses', sku: 'RB-001', brand: 'Ray-Ban', category: 'Sunglasses', condition: 'New', sellingPrice: 250, status: 'ACTIVE', authenticationStatus: 'AUTHENTIC', createdAt: '2026-07-10', image: '' },
];

const statusColors: Record<string, string> = {
  ACTIVE: 'text-green-500 bg-green-500/10',
  DRAFT: 'text-yellow-500 bg-yellow-500/10',
  RESERVED: 'text-blue-500 bg-blue-500/10',
  SOLD: 'text-gray-500 bg-gray-500/10',
  ARCHIVED: 'text-red-500 bg-red-500/10',
};

const authColors: Record<string, string> = {
  AUTHENTIC: 'text-green-500 bg-green-500/10',
  PENDING: 'text-yellow-500 bg-yellow-500/10',
  COUNTERFEIT: 'text-red-500 bg-red-500/10',
  INCONCLUSIVE: 'text-orange-500 bg-orange-500/10',
};

const brands = ['Chanel', 'Hermès', 'Louis Vuitton', 'Gucci', 'Rolex', 'Prada', 'Dior', 'Saint Laurent'];
const categories = ['Bags', 'Watches', 'Jewelry', 'Shoes', 'Sunglasses', 'Clothing', 'Accessories'];
const conditions = ['New', 'Like New', 'Excellent', 'Very Good', 'Good', 'Fair'];

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [products, setProducts] = useState(mockProducts);
  const [newProduct, setNewProduct] = useState({
    name: '', brand: '', category: '', condition: 'Excellent',
    sku: '', sellingPrice: 0, purchasePrice: 0,
  });

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.brand.toLowerCase().includes(search.toLowerCase())
  );

  const addProduct = () => {
    const product: Product = {
      id: String(Date.now()),
      name: newProduct.name,
      sku: newProduct.sku || `SKU-${Date.now()}`,
      brand: newProduct.brand,
      category: newProduct.category,
      condition: newProduct.condition,
      sellingPrice: newProduct.sellingPrice,
      status: 'DRAFT',
      authenticationStatus: 'PENDING',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setProducts([product, ...products]);
    setShowAddModal(false);
    setNewProduct({ name: '', brand: '', category: '', condition: 'Excellent', sku: '', sellingPrice: 0, purchasePrice: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">{products.length} products in catalog</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-luxury-gold"
          />
        </div>
        <button className="rounded-md border p-2 hover:bg-muted transition-colors">
          <Filter className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Brand</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Condition</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Auth</th>
                <th className="px-4 py-3 text-right font-medium">Date</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        {product.brand[0]}
                      </div>
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{product.sku}</td>
                  <td className="px-4 py-3">{product.brand}</td>
                  <td className="px-4 py-3 text-muted-foreground">{product.category}</td>
                  <td className="px-4 py-3">{product.condition}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(product.sellingPrice)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[product.status] || ''}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${authColors[product.authenticationStatus] || ''}`}>
                      {product.authenticationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">{formatDate(product.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button className="rounded p-1 hover:bg-muted transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add Product</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Product Name</label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                    placeholder="e.g. Classic Flap Bag"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SKU</label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                    placeholder="Auto-generated"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Brand</label>
                  <select
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                  >
                    <option value="">Select brand</option>
                    {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Condition</label>
                  <select
                    value={newProduct.condition}
                    onChange={(e) => setNewProduct({ ...newProduct, condition: e.target.value })}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                  >
                    {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Selling Price ($)</label>
                  <input
                    type="number"
                    value={newProduct.sellingPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: Number(e.target.value) })}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                    min={0}
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addProduct}
                disabled={!newProduct.name || !newProduct.brand}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

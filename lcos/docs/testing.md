# Testing Strategy

> **Version:** 1.0.0  
> **Status:** Approved  
> **Last Updated:** 2026-07-21  

---

## 1. Testing Philosophy

LCOS follows a multi-layered testing strategy covering Unit, Integration, E2E, and AI-specific testing. The approach follows the **Testing Trophy** model:

```
         /\
        /  \
       / E2E \
      /--------\
     /          \
    / Integration \
   /----------------\
  /                  \
 /    Unit Tests      \
/______________________\
```

| Layer | Focus | Tool | Coverage Target | Speed |
|-------|-------|------|-----------------|-------|
| Unit | Individual functions, utils, models | Jest + Vitest | 80%+ | ms |
| Integration | API endpoints, database, services | Supertest + Jest | 70%+ | s |
| E2E | Critical user flows, UI | Playwright | 40%+ | min |
| AI | Model outputs, edge cases | Custom + Jest | 90% of known cases | s-min |

---

## 2. Unit Testing (Jest + Vitest)

### Configuration

```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
  },
  setupFilesAfterSetup: ['<rootDir>/test/setup.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'src/domain/**/*.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
};
```

### Test Structure

```
src/
  domain/
    product/
      product.entity.ts
      product.service.ts
      product.service.test.ts    <-- unit test
      product.controller.ts
      product.controller.test.ts <-- unit test
  infrastructure/
    database/
      repositories/
        product.repository.ts
        product.repository.test.ts <-- integration test
```

### Naming Conventions

- Unit tests: `{filename}.test.ts`
- Integration tests: `{filename}.integration.test.ts`
- E2E tests: `{feature}.e2e.ts`
- Test fixtures: `__fixtures__/{name}.ts`

### Example: Service Unit Test

```typescript
// product.service.test.ts
import { ProductService } from './product.service';
import { Product } from './product.entity';

// Mock the repository
const mockRepo = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const service = new ProductService(mockRepo as any);

describe('ProductService', () => {
  describe('calculatePriceWithTax', () => {
    it('should add correct tax rate to base price', () => {
      const result = service.calculatePriceWithTax(1000, 0.20);
      expect(result).toBe(1200);
    });

    it('should handle zero tax rate', () => {
      const result = service.calculatePriceWithTax(1000, 0);
      expect(result).toBe(1000);
    });

    it('should throw on negative price', () => {
      expect(() => service.calculatePriceWithTax(-100, 0.20))
        .toThrow('Price cannot be negative');
    });
  });

  describe('getProductById', () => {
    it('should return product when found', async () => {
      const mockProduct = new Product({ id: 'prd_001', name: 'Test' });
      mockRepo.findById.mockResolvedValue(mockProduct);

      const result = await service.getProductById('prd_001');
      expect(result).toEqual(mockProduct);
      expect(mockRepo.findById).toHaveBeenCalledWith('prd_001');
    });

    it('should throw NotFoundError when product not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getProductById('nonexistent'))
        .rejects.toThrow('Product not found');
    });
  });
});
```

### Mocking Strategy

```typescript
// External services are always mocked
jest.mock('@/infrastructure/integrations/stripe/client');
jest.mock('@/infrastructure/event-bus');

// Database repository pattern allows easy mocking
// Repository classes implement interfaces that are injected
```

### What to Unit Test

- **Domain logic:** price calculations, tax, discounts, inventory logic
- **Validation rules:** SKU format validation, email validation, business rules
- **Entity methods:** computed properties, status transitions
- **Utils/helpers:** string formatting, date manipulation, currency conversion
- **Controllers:** request parsing, response formatting, error handling

### What NOT to Unit Test

- External API calls (mock them)
- Database queries (integration test)
- Framework internals (Express, Next.js)
- Configuration loading

---

## 3. Integration Testing (Supertest)

### Configuration

```typescript
// test/integration/setup.ts
import { app } from '@/app';
import { pool } from '@/infrastructure/database/pool';
import { redis } from '@/infrastructure/cache/redis';
import { createTestTenant, createTestUser, generateAuthToken } from './helpers';

let server: Server;

beforeAll(async () => {
  // Start app on random port
  server = app.listen(0);

  // Run migrations on test database
  await runMigrations('test');
});

afterAll(async () => {
  await pool.end();
  await redis.quit();
  server.close();
});

beforeEach(async () => {
  // Clean all tables before each test
  await cleanDatabase();
});
```

### API Integration Test Example

```typescript
// products.integration.test.ts
import request from 'supertest';
import { app } from '@/app';
import { createTestTenant, createTestUser, generateAuthToken } from './helpers';

describe('Products API (Integration)', () => {
  let tenant: Tenant;
  let token: string;

  beforeEach(async () => {
    tenant = await createTestTenant({ name: 'Test Maison' });
    const user = await createTestUser({ tenantId: tenant.id, role: 'inventory_manager' });
    token = generateAuthToken(user);
  });

  describe('POST /v1/products', () => {
    it('should create a new product and return 201', async () => {
      const response = await request(app)
        .post('/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', tenant.id)
        .send({
          name: 'Diamond Ring',
          sku: 'RNG-001',
          price: { amount: 12500, currency: 'USD' },
          status: 'draft',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Diamond Ring');
      expect(response.body.sku).toBe('RNG-001');
    });

    it('should reject duplicate SKU within same tenant', async () => {
      await createProduct(tenant.id, { sku: 'RNG-001' });

      const response = await request(app)
        .post('/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', tenant.id)
        .send({
          name: 'Another Ring',
          sku: 'RNG-001',
          price: { amount: 5000, currency: 'USD' },
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('SKU_CONFLICT');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/v1/products')
        .send({ name: 'Test', sku: 'TST' });

      expect(response.status).toBe(401);
    });

    it('should enforce tenant isolation', async () => {
      const tenant2 = await createTestTenant({ name: 'Other Maison' });

      // Create product in tenant 1
      await createProduct(tenant.id, { sku: 'RNG-001' });

      // Should still be able to create same SKU in tenant 2
      const response = await request(app)
        .post('/v1/products')
        .set('Authorization', `Bearer ${generateAuthToken(await createTestUser({ tenantId: tenant2.id }))}')
        .set('X-Tenant-ID', tenant2.id)
        .send({ name: 'Ring', sku: 'RNG-001', price: { amount: 1000, currency: 'USD' } });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /v1/products', () => {
    it('should return paginated products', async () => {
      // Create 30 products
      for (let i = 0; i < 30; i++) {
        await createProduct(tenant.id, { sku: `RNG-${i}`, name: `Ring ${i}` });
      }

      const response = await request(app)
        .get('/v1/products?page=1&perPage=10')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', tenant.id);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination.total).toBe(30);
      expect(response.body.pagination.totalPages).toBe(3);
    });
  });
});
```

### Test Database

- **Test database:** `lcos_test` (separate from development)
- **Recreated** before each test run
- **Cleaned** between test suites
- **Connection string:** `DATABASE_URL=postgresql://.../lcos_test`
- Migrations run once per test run (not per test)

---

## 4. E2E Testing (Playwright)

### Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
```

### E2E Test Example

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should allow user to sign up and create tenant', async ({ page }) => {
    await page.goto('/auth/register');

    await page.fill('[name="tenantName"]', 'Maison Dupont');
    await page.fill('[name="tenantSlug"]', 'maison-dupont');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.fill('[name="fullName"]', 'Jean Dupont');
    await page.click('button[type="submit"]');

    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('[data-testid="tenant-name"]')).toContainText('Maison Dupont');
  });

  test('should show validation errors on empty form', async ({ page }) => {
    await page.goto('/auth/register');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="field-error"]')).toHaveCount(4);
  });
});

test.describe('Product Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a product through the UI', async ({ page }) => {
    await page.click('[data-testid="nav-products"]');
    await page.click('[data-testid="create-product"]');

    await page.fill('[name="name"]', 'Diamond Eternity Ring');
    await page.fill('[name="sku"]', 'RNG-E2E-001');
    await page.fill('[name="price"]', '12500');
    await page.selectOption('[name="currency"]', 'USD');
    await page.selectOption('[name="category"]', 'Rings');
    await page.fill('[name="description"]', 'Test product from E2E');

    await page.click('button[type="submit"]');

    await page.waitForURL('/products/**');
    await expect(page.locator('[data-testid="product-name"]')).toContainText('Diamond Eternity Ring');
  });
});
```

### Critical User Flows (E2E Priority)

1. **Authentication:** Register, login, logout, password reset, MFA
2. **Tenant onboarding:** First-time setup wizard
3. **Product management:** CRUD operations, media upload
4. **Order processing:** Create order, process payment, fulfill
5. **CRM:** Customer search, create ticket, log interaction
6. **Automation:** Create workflow, test execution
7. **Settings:** Integration connection, user management, billing

---

## 5. Test Data Fixtures

### Factory Pattern

```typescript
// test/__fixtures__/product.factory.ts
import { faker } from '@faker-js/faker';

interface ProductFixture {
  name?: string;
  sku?: string;
  price?: number;
  currency?: string;
  status?: string;
  categoryId?: string;
  [key: string]: unknown;
}

export function buildProductFixture(overrides: ProductFixture = {}) {
  return {
    name: faker.commerce.productName(),
    sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
    price: { amount: faker.number.int({ min: 100, max: 50000 }), currency: 'USD' },
    status: 'draft',
    description: faker.commerce.productDescription(),
    ...overrides,
  };
}
```

### Seeding Integration Tests

```typescript
// test/helpers/database.ts
import { pool } from '@/infrastructure/database/pool';

export async function seedTestData() {
  const tenant = await createTenantInDb({
    name: 'Test Maison',
    slug: 'test-maison',
  });

  const category = await createCategoryInDb({
    tenantId: tenant.id,
    name: 'Rings',
    slug: 'rings',
  });

  const products = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      createProductInDb({
        tenantId: tenant.id,
        categoryId: category.id,
        name: `Test Product ${i + 1}`,
        sku: `TST-${i + 1}`,
      })
    )
  );

  return { tenant, category, products };
}

export async function cleanDatabase() {
  const tables = [
    'products', 'categories', 'brands', 'customers',
    'orders', 'order_items', 'users', 'tenants',
    'workflows', 'executions', 'integrations',
  ];

  for (const table of tables) {
    await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
  }
}
```

---

## 6. CI Test Execution

### GitHub Actions Workflow

```yaml
name: Tests
on: [pull_request, push]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-unit
          path: coverage/

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: lcos_test
          POSTGRES_USER: lcos
          POSTGRES_PASSWORD: lcos_test_pass
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration -- --coverage
        env:
          DATABASE_URL: postgresql://lcos:lcos_test_pass@localhost:5432/lcos_test
          REDIS_URL: redis://localhost:6379
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-integration
          path: coverage/

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: lcos_test
          POSTGRES_USER: lcos
          POSTGRES_PASSWORD: lcos_test_pass
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: npm run start:test &
      - run: npx playwright install --with-deps
      - run: npx playwright test
        env:
          DATABASE_URL: postgresql://lcos:lcos_test_pass@localhost:5432/lcos_test
          REDIS_URL: redis://localhost:6379
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  coverage:
    needs: [unit, integration]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
      - run: npx nyc merge coverage-unit coverage-integration .nyc_output
      - run: npx nyc report --reporter=text --reporter=lcov
```

### CI Pipeline Stages

1. **Lint** - ESLint + Prettier check (3 min)
2. **Typecheck** - TypeScript compilation check (2 min)
3. **Unit tests** - Fast feedback loop (5 min)
4. **Integration tests** - Database-dependent tests (10 min)
5. **E2E tests** - Full user flow tests (15 min)
6. **Coverage report** - Merged coverage from all layers (1 min)

Pipeline fails if any stage fails or coverage drops below thresholds.

---

## 7. Testing AI Components

### Challenges

- Non-deterministic outputs (LLMs return different results for same prompt)
- High cost per test call (API credits)
- Latency (AI calls take 1-10s)
- Prompt drift (model behavior changes over time)

### Strategy

```
Layer 1: Deterministic Unit Tests (fast, cheap)
  - Input validation
  - Prompt construction
  - Response parsing
  - Token counting
  - Cost calculation

Layer 2: Mocked Integration Tests (medium, cheap)
  - Mock AI provider responses
  - Test full service flow
  - Test error handling (timeouts, rate limits)
  - Test fallback behavior

Layer 3: Snapshot Tests (medium, medium cost)
  - Run against real models (once per PR)
  - Capture output snapshots
  - Manual review of differences
  - Track regression visually

Layer 4: Evaluation Tests (slow, expensive)
  - Run weekly against curated test set
  - Automated metrics: relevance, tone, accuracy
  - Human review for quality
  - Track scores over time
```

### AI Snapshot Testing

```typescript
// ai-studio/snapshots/product-description.test.ts
import { generateProductDescription } from './generator';
import { matchSnapshot } from './snapshot-utils';

describe('AI Product Description Generator (Snapshot)', () => {
  it('should generate description for a diamond ring', async () => {
    const product = {
      name: 'Diamond Eternity Ring',
      material: '18k White Gold',
      gemstone: '3ct VS1 Diamond',
      category: 'Rings',
    };

    const result = await generateProductDescription(product, { tone: 'elegant' });

    await matchSnapshot('diamond-ring-elegant', result);
  }, 30000); // 30s timeout for AI call
});
```

### AI Evaluation Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Relevance | Output addresses the prompt requirements | > 0.9 |
| Brand consistency | Uses correct tone and terminology | > 0.85 |
| Factual accuracy | Product specs are correct | 100% |
| Length compliance | Within expected token range | > 0.95 |
| Hallucination rate | Facts not in the input | < 5% |

---

## 8. Test Commands

```bash
# Run all tests
npm test

# Unit tests only (watch mode)
npm run test:unit -- --watch

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Specific file
npm test -- product.service.test.ts

# Coverage report
npm test -- --coverage

# AI snapshot tests
npm run test:ai-snapshots

# Lint + typecheck + test (full check before commit)
npm run verify
```

---

## 9. Quality Gates

| Gate | Threshold | Action |
|------|-----------|--------|
| Unit test coverage | >= 80% | Pipeline fails |
| Integration test coverage | >= 70% | Pipeline fails |
| E2E pass rate | 100% | Pipeline fails |
| Lint errors | 0 | Pipeline fails |
| TypeScript errors | 0 | Pipeline fails |
| Test duration (unit) | < 5 min | Alert |
| Test duration (integration) | < 10 min | Alert |
| Flaky test rate | < 2% | Quarterly review |

---

## 10. Test Infrastructure

### Local Development

```bash
# Start test databases
docker compose -f docker-compose.test.yml up -d

# Run tests pointing at test databases
npm run test:integration

# Run E2E with visible browser
npm run test:e2e -- --headed
```

### Environment Variables (Test)

```
DATABASE_URL=postgresql://lcos:lcos_test_pass@localhost:5432/lcos_test
REDIS_URL=redis://localhost:6379
NODE_ENV=test
LOG_LEVEL=silent
JWT_PRIVATE_KEY=test-private-key-for-tests-only
JWT_PUBLIC_KEY=test-public-key-for-tests-only
STRIPE_API_KEY=sk_test_...
SENDGRID_API_KEY=SG.test....
```

---

## 11. Flaky Test Management

- **Detection:** Tests that fail intermittently are flagged in CI
- **Quarantine:** Flaky tests are moved to a separate `flaky` directory
- **Review:** Weekly triage of quarantined tests
- **Fix or delete:** Tests must be fixed within 2 weeks or removed

```typescript
// Mark a test as flaky (will be quarantined if fails > 20% of runs)
test.flaky('should handle race condition', async () => {
  // ...
});
```

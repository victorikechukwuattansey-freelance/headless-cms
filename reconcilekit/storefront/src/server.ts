import { createServer as createHttpServer } from "node:http";
import type { Server } from "node:http";
import type { StorefrontConfig } from "./config.ts";
import { buildPaymentReference, newId } from "./ids.ts";
import type {
  Business,
  Order,
  PaymentRecord,
  Product,
} from "./domain/types.ts";
import type { JsonlStore } from "./store/jsonl-store.ts";
import type { Repositories } from "./db/repositories/index.ts";
import type { PaystackGateway } from "./paystack/gateway.ts";
import type {
  InitializeTransactionInput,
  InitializeTransactionResult,
} from "./paystack/client.ts";
import { verifyOrder } from "./application/verify-order.ts";
import type { CanonicalPaymentStatus } from "../../src/domain/model.ts";
import { reconcileRecords } from "../../src/application/reconcile-records.ts";
import {
  buildReconcileBridgeInput,
  effectivePaymentRecords,
} from "./reconcile/adapter.ts";
import { buildReconcileView, RECONCILE_CONFIG } from "./reconcile/view.ts";
import { toMerchantCsv } from "./reconcile/merchant-csv.ts";
import type { MockProviderScenario } from "./marketplace/types.ts";
import {
  OrchestrationError,
  ServiceInputValidationError,
  type MarketplaceTransactionDeps,
} from "./marketplace/transactions.ts";
import { ReconcileError } from "./marketplace/reconcile.ts";
import { ResolutionError } from "./marketplace/resolution.ts";
import { InvalidPaymentTransitionError } from "./marketplace/wallet.ts";
import { TicketFlowError } from "./marketplace/ticketing.ts";
import {
  completeTransactionRefund,
  initiateTransactionRefund,
  markManualReview,
  openDispute,
  resolveDispute,
  resolveManualReview,
  reverseTransactionDebit,
} from "./marketplace/resolution.ts";
import { cancelTicketTransaction } from "./marketplace/ticketing.ts";
import {
  adminDashboardViewModel,
  adminQueueViewModel,
  checkoutOptionsViewModel,
  catalogViewModel,
  customerProfile,
  dashboardViewModel,
  DEMO_CUSTOMER_ID,
  disputesViewModel,
  ensureReceipt,
  evidenceViewModel,
  findingDeterminationViewModel,
  findingEvidenceViewModel,
  findingsSummaryViewModel,
  findTransactionByIdentifier,
  notificationsViewModel,
  runCheckout,
  serviceDetailViewModel,
  transactionDetailViewModel,
  transactionsViewModel,
  walletViewModel,
} from "./ui/client.ts";
import {
  renderCatalogPage,
  renderCheckoutPage,
  renderDashboardPage,
  renderDisputesPage,
  renderEvidencePage,
  renderFindingDeterminationPage,
  renderFindingEvidencePage,
  renderFindingsSummaryPage,
  renderHomePage,
  renderLoginPage,
  renderNotificationsPage,
  renderProfilePage,
  renderReceiptPage,
  renderServiceDetailPage,
  renderTransactionDetailPage,
  renderTransactionsPage,
  renderWalletPage,
  providerFactsGrid,
  resultBanner,
} from "./ui/customer-pages.ts";
import {
  renderAdminDashboardPage,
  renderAdminEvidencePage,
  renderAdminQueuePage,
  renderAdminTransactionDetailPage,
} from "./ui/admin-pages.ts";
import { APP_CSS, APP_JS } from "./ui/styles.ts";
import { createSession, revokeSession } from "./auth/sessions.ts";
import { loginUser } from "./auth/identity.ts";
import { clearSessionCookie, serializeSessionCookie } from "./auth/cookies.ts";
import { readSessionToken, requireSession } from "./auth/middleware.ts";
import {
  listMembershipsForUser,
  getMembership,
} from "./marketplace/tenancy.ts";

export interface ServerDependencies {
  readonly store: JsonlStore;
  /**
   * Top-level repository handle. Mirrors `marketplace.repos` when
   * marketplace is configured; kept separately so non-marketplace paths
   * can reach Postgres without going through MarketplaceTransactionDeps.
   */
  readonly repos: Repositories;
  readonly paystack: PaystackGateway;
  readonly marketplace?: MarketplaceTransactionDeps;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly causeCode: string | null;

  constructor(
    status: number,
    code: string,
    message: string,
    options?: { readonly causeCode?: string | null },
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.causeCode = options?.causeCode ?? null;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MAX_BODY_BYTES = 1024 * 1024;

export function createStorefrontServer(
  config: StorefrontConfig,
  deps: ServerDependencies,
): Server {
  return createHttpServer((req, res) => {
    void handleRequest(req, res, config, deps).catch((error) => {
      writeJson(res, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "unexpected internal failure",
        },
      });
    });
  });
}

async function handleRequest(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  config: StorefrontConfig,
  deps: ServerDependencies,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://storefront.local");

    // Try marketplace routes first if marketplace deps are available
    if (deps.marketplace !== undefined) {
      const handled = await tryHandleMarketplace(
        req,
        res,
        url,
        deps.store,
        deps.marketplace,
        deps.repos,
        config,
      );
      if (handled) {
        return;
      }
    }

    const route = `${req.method ?? "GET"} ${url.pathname}`;

    if (route === "GET /health") {
      writeJson(res, 200, { status: "ok", service: "reconcilekit-storefront" });
      return;
    }

    if (route === "POST /businesses") {
      await handleCreateBusiness(req, res, deps);
      return;
    }

    if (route === "POST /products") {
      await handleCreateProduct(req, res, deps);
      return;
    }

    if (route === "POST /orders") {
      await handleCreateOrder(req, res, config, deps);
      return;
    }

    const verifyMatch = url.pathname.match(/^\/orders\/([^/]+)\/verify$/);
    if (req.method === "POST" && verifyMatch !== null) {
      await handleVerifyOrder(
        req,
        res,
        deps,
        decodeURIComponent(verifyMatch[1] as string),
      );
      return;
    }

    if (req.method === "GET" && url.pathname === "/callback") {
      await handleCallback(req, res, deps);
      return;
    }

    if (req.method === "GET" && url.pathname === "/reconcile/merchant.csv") {
      await handleReconcileCsv(res, deps);
      return;
    }

    if (req.method === "GET" && url.pathname === "/reconcile") {
      await handleReconcile(req, res, deps, url.searchParams.get("orderId"));
      return;
    }

    throw new HttpError(404, "NOT_FOUND", `no route for ${route}`);
  } catch (error) {
    if (error instanceof HttpError) {
      writeJson(res, error.status, {
        error: {
          code: error.code,
          message: error.message,
          ...(error.causeCode !== null ? { cause: error.causeCode } : {}),
        },
      });
      return;
    }
    throw error;
  }
}

async function handleCreateBusiness(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  deps: ServerDependencies,
): Promise<void> {
  const body = await readJsonBody(req);
  const name = stringField(body, "name");
  validateName(name);

  const business: Business = {
    id: newId(),
    name,
    createdAt: new Date().toISOString(),
  };
  await deps.repos.businesses.insert(business);
  writeJson(res, 201, { business });
}

async function handleCreateProduct(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  deps: ServerDependencies,
): Promise<void> {
  const body = await readJsonBody(req);
  const businessId = stringField(body, "businessId");
  const name = stringField(body, "name");
  const priceMinor = numberField(body, "priceMinor");
  const currency = stringField(body, "currency");

  validateName(name);
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0) {
    throw new HttpError(
      400,
      "INVALID_PRICE",
      "priceMinor must be a non-negative integer in the currency's minor units",
    );
  }
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new HttpError(
      400,
      "INVALID_CURRENCY",
      "currency must be a 3-letter uppercase currency code, e.g. NGN",
    );
  }

  const business = await deps.repos.businesses.readLatestById(businessId);
  if (business === null) {
    throw new HttpError(404, "BUSINESS_NOT_FOUND", "no such business");
  }

  const product: Product = {
    id: newId(),
    businessId: business.id,
    name,
    priceMinor,
    currency,
    createdAt: new Date().toISOString(),
  };
  await deps.repos.products.insert(product);
  writeJson(res, 201, { product });
}

async function handleCreateOrder(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  config: StorefrontConfig,
  deps: ServerDependencies,
): Promise<void> {
  const body = await readJsonBody(req);
  const businessId = stringField(body, "businessId");
  const productId = stringField(body, "productId");
  const customerEmail = stringField(body, "customerEmail");

  if (!EMAIL_PATTERN.test(customerEmail)) {
    throw new HttpError(
      400,
      "INVALID_EMAIL",
      "customerEmail must be a valid email address",
    );
  }

  const business = await deps.repos.businesses.readLatestById(businessId);
  if (business === null) {
    throw new HttpError(404, "BUSINESS_NOT_FOUND", "no such business");
  }
  const product = await deps.repos.products.readLatestById(productId);
  if (product === null) {
    throw new HttpError(404, "PRODUCT_NOT_FOUND", "no such product");
  }
  if (product.businessId !== business.id) {
    throw new HttpError(
      400,
      "PRODUCT_BUSINESS_MISMATCH",
      "product does not belong to the given business",
    );
  }

  const orderId = newId();
  const requestedReference = buildPaymentReference(orderId);
  const createdAt = new Date().toISOString();

  let initialized: InitializeTransactionResult;
  try {
    initialized = await deps.paystack.initializeTransaction({
      email: customerEmail,
      amount: product.priceMinor,
      currency: product.currency,
      reference: requestedReference,
      callbackUrl: `${config.callbackBaseUrl}/callback?orderId=${orderId}`,
      metadata: {
        business_id: business.id,
        product_id: product.id,
        order_id: orderId,
      },
    });
  } catch {
    const failedOrder: Order = {
      id: orderId,
      businessId: business.id,
      productId: product.id,
      customerEmail,
      expectedAmountMinor: product.priceMinor,
      currency: product.currency,
      status: "INITIALIZATION_FAILED",
      paystackReference: null,
      authorizationUrl: null,
      createdAt,
    };
    await deps.repos.orders.insert(failedOrder);
    throw new HttpError(
      502,
      "PAYSTACK_INITIALIZE_FAILED",
      `Paystack rejected the order initiation; retry with order id ${orderId}`,
    );
  }

  const order: Order = {
    id: orderId,
    businessId: business.id,
    productId: product.id,
    customerEmail,
    expectedAmountMinor: product.priceMinor,
    currency: product.currency,
    status: "PAYMENT_INITIATED",
    paystackReference: initialized.reference,
    authorizationUrl: initialized.authorizationUrl,
    createdAt,
  };
  await deps.repos.orders.insert(order);

  const payment: PaymentRecord = {
    id: order.id,
    businessId: business.id,
    orderId: order.id,
    expectedAmount: product.priceMinor,
    currency: product.currency,
    paystackReference: initialized.reference,
    status: "PENDING",
    paidAt: null,
    refundStatus: "NONE",
    metadata: {
      requested_reference: requestedReference,
      authorization_url: initialized.authorizationUrl,
      callback_url: `${config.callbackBaseUrl}/callback?orderId=${orderId}`,
      customer_email: customerEmail,
      product_id: product.id,
    },
    recordedAt: createdAt,
  };
  await deps.repos.payments.insert(payment);

  writeJson(res, 201, { order, payment });
}

async function handleVerifyOrder(
  _req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  deps: ServerDependencies,
  orderId: string,
): Promise<void> {
  const outcome = await verifyOrder(deps.repos, deps.paystack, orderId);
  switch (outcome.kind) {
    case "verified":
      writeJson(res, 200, {
        verification: {
          orderId: outcome.payment.orderId,
          changed: outcome.changed,
          payment: outcome.payment,
        },
      });
      return;
    case "order_not_found":
      throw new HttpError(404, "ORDER_NOT_FOUND", "no such order");
    case "not_initialized":
      throw new HttpError(
        409,
        "ORDER_NOT_INITIATED",
        "order has no Paystack reference to verify",
      );
    case "reference_mismatch":
      throw new HttpError(
        502,
        "REFERENCE_MISMATCH",
        "Paystack returned a different transaction reference than the one persisted for this order; nothing was recorded",
      );
    case "verify_failed":
      throw new HttpError(
        502,
        "VERIFY_FAILED",
        "Paystack verification could not be completed; no records were changed",
        { causeCode: outcome.causeCode },
      );
  }
}

async function handleCallback(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  deps: ServerDependencies,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://storefront.local");
  const orderId = url.searchParams.get("orderId");
  if (orderId === null || orderId === "") {
    writeHtml(
      res,
      400,
      "Missing order",
      "<p>This callback is missing the order identifier. Contact the merchant.</p>",
    );
    return;
  }

  const outcome = await verifyOrder(deps.repos, deps.paystack, orderId);
  switch (outcome.kind) {
    case "verified": {
      const heading = paymentStatusHeading(outcome.payment.status);
      writeHtml(
        res,
        200,
        heading,
        `<p>Order ${escapeHtml(outcome.payment.orderId)}</p>` +
          `<p>${heading}. Reference: ${escapeHtml(outcome.payment.paystackReference)}.</p>`,
      );
      return;
    }
    case "order_not_found":
      writeHtml(res, 404, "Order not found", "<p>No such order exists.</p>");
      return;
    case "not_initialized":
      writeHtml(
        res,
        409,
        "No payment reference",
        "<p>This order has no payment reference to verify. Contact the merchant.</p>",
      );
      return;
    case "reference_mismatch":
      writeHtml(
        res,
        502,
        "Verification error",
        "<p>The payment provider returned an unexpected transaction for this order. Contact the merchant.</p>",
      );
      return;
    case "verify_failed":
      writeHtml(
        res,
        502,
        "Verification unavailable",
        "<p>The payment provider could not be verified right now. Contact the merchant.</p>",
      );
      return;
  }
}

async function handleReconcile(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  deps: ServerDependencies,
  orderId: string | null,
): Promise<void> {
  const payments = effectivePaymentRecords(await deps.repos.payments.list());
  if (orderId !== null) {
    const matched = payments.filter((payment) => payment.orderId === orderId);
    if (matched.length === 0) {
      throw new HttpError(
        404,
        "ORDER_NOT_FOUND",
        "no payment record for the given order",
      );
    }
    const input = buildReconcileBridgeInput(matched);
    writeJson(
      res,
      200,
      buildReconcileView(
        matched,
        reconcileRecords({ ...input, config: RECONCILE_CONFIG }),
      ),
    );
    return;
  }
  const input = buildReconcileBridgeInput(payments);
  writeJson(
    res,
    200,
    buildReconcileView(
      payments,
      reconcileRecords({ ...input, config: RECONCILE_CONFIG }),
    ),
  );
}

async function handleReconcileCsv(
  res: import("node:http").ServerResponse,
  deps: ServerDependencies,
): Promise<void> {
  const payments = effectivePaymentRecords(await deps.repos.payments.list());
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="merchant-reconcilekit.csv"',
  });
  res.end(toMerchantCsv(payments));
}

// ============================================================
// Marketplace page routes (HTML) and form POST routes
// ============================================================

const MARKETPLACE_PATHS = new Set([
  "/",
  "/login",
  "/dashboard",
  "/wallet",
  "/catalog",
  "/catalog/",
  "/services/",
  "/checkout",
  "/checkout/",
  "/transactions",
  "/findings",
  "/notifications",
  "/disputes",
  "/profile",
  "/admin",
  "/admin/queues",
  "/admin/transactions",
  "/assets/app.css",
  "/assets/app.js",
]);

function isMarketplacePath(pathname: string): boolean {
  if (MARKETPLACE_PATHS.has(pathname)) {
    return true;
  }
  // Dynamic segments
  if (pathname.startsWith("/catalog/")) return true;
  if (pathname.startsWith("/services/")) return true;
  if (pathname.startsWith("/checkout/")) return true;
  if (pathname.startsWith("/transactions/")) return true;
  if (pathname.startsWith("/findings/")) return true;
  if (pathname.startsWith("/admin/queues/")) return true;
  if (pathname.startsWith("/admin/transactions/")) return true;
  return false;
}

async function tryHandleMarketplace(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  url: URL,
  store: JsonlStore,
  deps: MarketplaceTransactionDeps,
  repos: Repositories,
  config: StorefrontConfig,
): Promise<boolean> {
  const path = url.pathname;
  const method = req.method ?? "GET";
  try {
    await routeMarketplace(req, res, url, store, deps, repos, method, config);
    return true;
  } catch (error) {
    writeMarketplaceHtmlError(res, error, path);
    return true;
  }
}

function marketplaceErrorStatus(error: unknown): number {
  if (
    error instanceof ServiceInputValidationError ||
    error instanceof OrchestrationError ||
    error instanceof ReconcileError
  ) {
    return 400;
  }
  if (
    error instanceof ResolutionError ||
    error instanceof TicketFlowError ||
    error instanceof InvalidPaymentTransitionError
  ) {
    return 409;
  }
  if (error instanceof HttpError) {
    return error.status;
  }
  return 500;
}

function marketplaceErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "unexpected internal failure";
}

async function routeMarketplace(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  url: URL,
  store: JsonlStore,
  deps: MarketplaceTransactionDeps,
  repos: Repositories,
  method: string,
  config: StorefrontConfig,
): Promise<void> {
  const path = url.pathname;

  // Assets
  if (method === "GET") {
    if (path === "/assets/app.css") {
      sendAsset(res, APP_CSS, "text/css; charset=utf-8");
      return;
    }
    if (path === "/assets/app.js") {
      sendAsset(res, APP_JS, "text/javascript; charset=utf-8");
      return;
    }
  }

  // ---- Phase 5A.3b: session gate --------------------------------
  //
  // Public paths are:
  //   GET /login    — the sign-in form
  //   GET /assets/* — handled above, early-returned
  //   POST /logout  — self-protecting (no session ⇒ no-op + redirect)
  // Everything else requires a valid session. Admin routes additionally
  // require a membership with role OWNER or OPERATOR in the active org.

  const isPublicForAuth =
    path === "/login" || (method === "POST" && path === "/logout");

  if (!isPublicForAuth) {
    // session gate
    const auth = await requireSession(req, {
      repos,
      cookieName: config.sessionCookieName,
    });
    if (auth === null) {
      redirect(res, 303, "/login");
      return;
    }
    if (path.startsWith("/admin")) {
      const membership = await getMembership(
        repos,
        auth.user.id,
        auth.session.active_org_id,
      );
      if (membership === null) {
        throw new HttpError(
          403,
          "NOT_A_MEMBER",
          "you are not a member of the active organization",
        );
      }
      if (membership.role !== "OWNER" && membership.role !== "OPERATOR") {
        throw new HttpError(
          403,
          "INSUFFICIENT_ROLE",
          `role ${membership.role} cannot access admin routes`,
        );
      }
    }
  }
  // ---- end Phase 5A.3b gate -------------------------------------

  // Customer GET pages
  if (method === "GET") {
    if (path === "/" || path === "/dashboard") {
      const vm = await dashboardViewModel(store, deps, DEMO_CUSTOMER_ID);
      sendHtml(res, renderDashboardPage(vm));
      return;
    }
    if (path === "/login") {
      const customer = await customerProfile(repos, DEMO_CUSTOMER_ID);
      sendHtml(res, renderLoginPage(customer));
      return;
    }
    if (path === "/wallet") {
      const vm = await walletViewModel(deps, DEMO_CUSTOMER_ID);
      sendHtml(res, renderWalletPage(vm));
      return;
    }
    if (path === "/catalog") {
      const vm = await catalogViewModel(deps, DEMO_CUSTOMER_ID);
      sendHtml(res, renderCatalogPage(vm));
      return;
    }
    // /catalog/:categoryId
    const catalogMatch = path.match(/^\/catalog\/([^/]+)$/);
    if (catalogMatch) {
      const categoryId = decodeURIComponent(catalogMatch[1]);
      const vm = await catalogViewModel(deps, DEMO_CUSTOMER_ID);
      const filteredGroups = vm.groups.filter((g) => g.id === categoryId);
      if (filteredGroups.length === 0) {
        throw new HttpError(404, "CATEGORY_NOT_FOUND", "category not found");
      }
      const filteredVm = { ...vm, groups: filteredGroups };
      sendHtml(res, renderCatalogPage(filteredVm));
      return;
    }
    // /services/:serviceId
    const serviceMatch = path.match(/^\/services\/([^/]+)$/);
    if (serviceMatch) {
      const serviceId = decodeURIComponent(serviceMatch[1]);
      const vm = await serviceDetailViewModel(deps, serviceId);
      if (vm === null) {
        throw new HttpError(404, "SERVICE_NOT_FOUND", "service not found");
      }
      sendHtml(res, renderServiceDetailPage(vm));
      return;
    }
    // /checkout/:serviceId
    const checkoutMatch = path.match(/^\/checkout\/([^/]+)$/);
    if (checkoutMatch) {
      const serviceId = decodeURIComponent(checkoutMatch[1]);
      const vm = await checkoutOptionsViewModel(deps, DEMO_CUSTOMER_ID);
      if (!vm.services.some((s) => s.id === serviceId)) {
        throw new HttpError(404, "SERVICE_NOT_FOUND", "service not found");
      }
      sendHtml(res, renderCheckoutPage(vm, serviceId));
      return;
    }
    // /transactions (list)
    if (path === "/transactions") {
      const vm = await transactionsViewModel(deps, DEMO_CUSTOMER_ID);
      sendHtml(res, renderTransactionsPage(vm));
      return;
    }
    // /transactions/:id
    const txnMatch = path.match(/^\/transactions\/([^/]+)$/);
    if (txnMatch) {
      const identifier = decodeURIComponent(txnMatch[1]);
      const vm = await transactionDetailViewModel(store, deps, identifier);
      if (vm === null) {
        throw new HttpError(
          404,
          "TRANSACTION_NOT_FOUND",
          "transaction not found",
        );
      }
      sendHtml(res, renderTransactionDetailPage(vm));
      return;
    }
    // /transactions/:id/receipt
    const receiptMatch = path.match(/^\/transactions\/([^/]+)\/receipt$/);
    if (receiptMatch) {
      const identifier = decodeURIComponent(receiptMatch[1]);
      const vm = await ensureReceipt(deps, identifier);
      if (vm === null) {
        throw new HttpError(
          404,
          "TRANSACTION_NOT_FOUND",
          "transaction not found",
        );
      }
      sendHtml(res, renderReceiptPage(vm));
      return;
    }
    // /transactions/:id/evidence
    const evidenceMatch = path.match(/^\/transactions\/([^/]+)\/evidence$/);
    if (evidenceMatch) {
      const identifier = decodeURIComponent(evidenceMatch[1]);
      const vm = await evidenceViewModel(deps, identifier);
      if (vm === null) {
        throw new HttpError(
          404,
          "TRANSACTION_NOT_FOUND",
          "transaction not found",
        );
      }
      sendHtml(res, renderEvidencePage(vm));
      return;
    }
    // /findings (summary)
    if (path === "/findings") {
      const vm = await findingsSummaryViewModel(deps, DEMO_CUSTOMER_ID);
      sendHtml(res, renderFindingsSummaryPage(vm));
      return;
    }
    // /findings/:reference/evidence
    const findingEvidenceMatch = path.match(/^\/findings\/([^/]+)\/evidence$/);
    if (findingEvidenceMatch) {
      const identifier = decodeURIComponent(findingEvidenceMatch[1]);
      const vm = await findingEvidenceViewModel(deps, identifier);
      if (vm === null) {
        throw new HttpError(404, "FINDING_NOT_FOUND", "finding not found");
      }
      sendHtml(res, renderFindingEvidencePage(vm));
      return;
    }
    // /findings/:reference
    const findingMatch = path.match(/^\/findings\/([^/]+)$/);
    if (findingMatch) {
      const identifier = decodeURIComponent(findingMatch[1]);
      const vm = await findingDeterminationViewModel(deps, identifier);
      if (vm === null) {
        throw new HttpError(404, "FINDING_NOT_FOUND", "finding not found");
      }
      sendHtml(res, renderFindingDeterminationPage(vm));
      return;
    }
    if (path === "/notifications") {
      const vm = await notificationsViewModel(store, deps, DEMO_CUSTOMER_ID);
      sendHtml(res, renderNotificationsPage(vm));
      return;
    }
    if (path === "/disputes") {
      const vm = await disputesViewModel(deps, DEMO_CUSTOMER_ID);
      sendHtml(res, renderDisputesPage(vm));
      return;
    }
    if (path === "/profile") {
      const customer = await customerProfile(repos, DEMO_CUSTOMER_ID);
      sendHtml(res, renderProfilePage(customer));
      return;
    }
    // Admin GET pages
    if (path === "/admin") {
      const vm = await adminDashboardViewModel(deps);
      sendHtml(res, renderAdminDashboardPage(vm));
      return;
    }
    // /admin/queues/:queue
    const adminQueueMatch = path.match(/^\/admin\/queues\/([^/]+)$/);
    if (adminQueueMatch) {
      const queue = decodeURIComponent(adminQueueMatch[1]);
      const vm = await adminQueueViewModel(deps, queue);
      if (vm === null) {
        throw new HttpError(404, "QUEUE_NOT_FOUND", "queue not found");
      }
      sendHtml(res, renderAdminQueuePage(vm));
      return;
    }
    // /admin/transactions/:id
    const adminTxnMatch = path.match(/^\/admin\/transactions\/([^/]+)$/);
    if (adminTxnMatch) {
      const identifier = decodeURIComponent(adminTxnMatch[1]);
      const vm = await transactionDetailViewModel(store, deps, identifier);
      if (vm === null) {
        throw new HttpError(
          404,
          "TRANSACTION_NOT_FOUND",
          "transaction not found",
        );
      }
      sendHtml(res, renderAdminTransactionDetailPage(vm));
      return;
    }
    // /admin/transactions/:id/evidence
    const adminEvidenceMatch = path.match(
      /^\/admin\/transactions\/([^/]+)\/evidence$/,
    );
    if (adminEvidenceMatch) {
      const identifier = decodeURIComponent(adminEvidenceMatch[1]);
      const vm = await evidenceViewModel(deps, identifier);
      if (vm === null) {
        throw new HttpError(
          404,
          "TRANSACTION_NOT_FOUND",
          "transaction not found",
        );
      }
      const evidenceLines = vm.evidence
        ? `${resultBanner(vm.evidence)}
${providerFactsGrid(vm.evidence.providerFacts as Record<string, string | number | null | undefined>)}`
        : '<p class="muted">No evidence pack recorded.</p>';
      sendHtml(
        res,
        renderAdminEvidencePage({
          reference: vm.transaction.reference,
          outcome: vm.transaction.reconcileOutcome ?? "UNKNOWN",
          evidenceLines,
        }),
      );
      return;
    }
  }

  // POST routes
  if (method === "POST") {
    // /login
    if (path === "/login") {
      const form = await readFormBody(req);
      const email = form.get("email") ?? "";
      const password = form.get("password") ?? "";
      if (email === "" || password === "") {
        const customer = await customerProfile(repos, DEMO_CUSTOMER_ID);
        res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderLoginPage(customer, "Email and password are required."));
        return;
      }
      // POST /login — user lookup
      const user = await loginUser(repos, email, password);
      if (user === null) {
        const customer = await customerProfile(repos, DEMO_CUSTOMER_ID);
        res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderLoginPage(customer, "Invalid email or password."));
        return;
      }
      const memberships = await listMembershipsForUser(repos, user.id);
      if (memberships.length === 0) {
        const customer = await customerProfile(repos, DEMO_CUSTOMER_ID);
        res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          renderLoginPage(
            customer,
            "This account is not a member of any organization. Contact an administrator.",
          ),
        );
        return;
      }
      const activeOrgId = memberships[0]!.org_id;
      // POST /login — session creation
      const { token } = await createSession(repos, {
        userId: user.id,
        activeOrgId,
        ttlHours: config.sessionTtlHours,
      });
      res.setHeader(
        "Set-Cookie",
        serializeSessionCookie(token, {
          name: config.sessionCookieName,
          maxAgeSeconds: config.sessionTtlHours * 3600,
          secure: config.cookieSecure,
        }),
      );
      redirect(res, 303, "/");
      return;
    }
    if (path === "/logout") {
      const token = readSessionToken(req, config.sessionCookieName);
      // POST /logout — session revocation
      if (token !== null) {
        await revokeSession(repos, token);
      }
      res.setHeader(
        "Set-Cookie",
        clearSessionCookie(config.sessionCookieName, config.cookieSecure),
      );
      redirect(res, 303, "/login");
      return;
    }
    // /checkout
    if (path === "/checkout") {
      const form = await readFormBody(req);
      const service = stringForm(form, "service");
      const scenario = stringForm(form, "scenario");
      const inputs: Record<string, string> = {};
      for (const [key, value] of form.entries()) {
        if (key.startsWith("inputs[")) {
          const fieldName = key.slice(7, -1);
          inputs[fieldName] = value;
        }
      }
      const customerId = form.get("customer") ?? DEMO_CUSTOMER_ID;
      const result = await runCheckout(deps, {
        customerId,
        serviceId: service,
        scenario: scenario as MockProviderScenario,
        inputs,
      });
      redirect(res, 303, `/transactions/${result.reference}`);
      return;
    }
    // /transactions/:id/disputes (customer opens dispute)
    const disputePostMatch = path.match(/^\/transactions\/([^/]+)\/disputes$/);
    if (disputePostMatch) {
      const identifier = decodeURIComponent(disputePostMatch[1]);
      const txn = await findTransactionByIdentifier(deps.repos, identifier);
      if (txn === null) {
        throw new HttpError(
          404,
          "TRANSACTION_NOT_FOUND",
          "transaction not found",
        );
      }
      const form = await readFormBody(req);
      const reason = stringForm(form, "reason");
      const message = form.get("message") ?? "";
      await openDispute(repos, {
        transactionId: txn.id,
        reason,
        message,
      });
      redirect(res, 303, `/transactions/${txn.reference}`);
      return;
    }
    // Admin POST actions
    const adminTxnPostMatch = path.match(
      /^\/admin\/transactions\/([^/]+)\/(.+)$/,
    );
    if (adminTxnPostMatch) {
      const identifier = decodeURIComponent(adminTxnPostMatch[1]);
      const action = adminTxnPostMatch[2];
      const txn = await findTransactionByIdentifier(deps.repos, identifier);
      if (txn === null) {
        throw new HttpError(
          404,
          "TRANSACTION_NOT_FOUND",
          "transaction not found",
        );
      }
      const form = await readFormBody(req);
      switch (action) {
        case "refund": {
          const reason = form.get("reason") ?? "OPERATOR_INITIATED_REFUND";
          await initiateTransactionRefund(repos, {
            transactionId: txn.id,
            reason,
          });
          redirect(res, 303, `/admin/transactions/${txn.reference}`);
          return;
        }
        case "refund/complete": {
          await completeTransactionRefund(repos, {
            transactionId: txn.id,
          });
          redirect(res, 303, `/admin/transactions/${txn.reference}`);
          return;
        }
        case "reversal": {
          const reason = form.get("reason") ?? "OPERATOR_INITIATED_REVERSAL";
          await reverseTransactionDebit(repos, {
            transactionId: txn.id,
            reason,
          });
          redirect(res, 303, `/admin/transactions/${txn.reference}`);
          return;
        }
        case "cancel-ticket": {
          await cancelTicketTransaction(deps, {
            transactionId: txn.id,
          });
          redirect(res, 303, `/admin/transactions/${txn.reference}`);
          return;
        }
        case "review": {
          const reason = stringForm(form, "reason");
          await markManualReview(repos, {
            transactionId: txn.id,
            reason,
          });
          redirect(res, 303, `/admin/transactions/${txn.reference}`);
          return;
        }
        case "dispute/resolve": {
          const resolutionNote = stringForm(form, "resolutionNote");
          await resolveDispute(repos, {
            transactionId: txn.id,
            resolutionNote,
          });
          redirect(res, 303, `/admin/transactions/${txn.reference}`);
          return;
        }
        case "review/resolve": {
          const operatorNote = stringForm(form, "operatorNote");
          await resolveManualReview(repos, {
            transactionId: txn.id,
            operatorNote,
          });
          redirect(res, 303, `/admin/transactions/${txn.reference}`);
          return;
        }
      }
    }
  }

  throw new HttpError(
    404,
    "NOT_FOUND",
    `no marketplace route for ${method} ${path}`,
  );
}

async function readFormBody(
  req: import("node:http").IncomingMessage,
): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, "BODY_TOO_LARGE", "request body exceeds 1 MiB");
    }
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return new URLSearchParams(body);
}

function stringForm(form: URLSearchParams, key: string): string {
  const value = form.get(key);
  if (value === null || value.trim() === "") {
    throw new HttpError(
      400,
      "MISSING_FIELD",
      `${key} must be a non-empty string`,
    );
  }
  return value.trim();
}

function sendHtml(res: import("node:http").ServerResponse, html: string): void {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
  });
  res.end(html);
}

function sendAsset(
  res: import("node:http").ServerResponse,
  content: string,
  contentType: string,
): void {
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(content),
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  res.end(content);
}

function redirect(
  res: import("node:http").ServerResponse,
  status: number,
  location: string,
): void {
  res.writeHead(status, {
    Location: location,
    "Content-Length": 0,
  });
  res.end();
}

function writeMarketplaceHtmlError(
  res: import("node:http").ServerResponse,
  error: unknown,
  path: string,
): void {
  const status = marketplaceErrorStatus(error);
  const message = marketplaceErrorMessage(error);
  const isAdmin = path.startsWith("/admin");
  const backLink = isAdmin ? "/admin" : "/dashboard";
  const backLabel = isAdmin ? "Admin dashboard" : "Dashboard";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error ${status}</title>
  <link rel="stylesheet" href="/assets/app.css">
  </head><body>
  <main style="max-width:720px;margin:40px auto;padding:0 16px">
    <h1>Error ${status}</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="${escapeHtml(backLink)}">← Back to ${backLabel}</a></p>
  </main></body></html>`;
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
  });
  res.end(html);
}

function paymentStatusHeading(status: CanonicalPaymentStatus): string {
  switch (status) {
    case "SUCCESS":
      return "Payment received";
    case "FAILED":
      return "Payment failed";
    case "PENDING":
      return "Payment pending";
    case "CANCELLED":
      return "Payment cancelled";
    default:
      return "Payment not confirmed";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeHtml(
  res: import("node:http").ServerResponse,
  status: number,
  heading: string,
  body: string,
): void {
  const text =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(heading)}</title></head><body>` +
    `<h1>${escapeHtml(heading)}</h1>${body}</body></html>`;
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function validateName(name: string): void {
  if (name.length === 0) {
    throw new HttpError(400, "INVALID_NAME", "name must not be empty");
  }
  if (name.length > 200) {
    throw new HttpError(
      400,
      "INVALID_NAME",
      "name must be at most 200 characters",
    );
  }
}

async function readJsonBody(
  req: import("node:http").IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, "BODY_TOO_LARGE", "request body exceeds 1 MiB");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    throw new HttpError(400, "INVALID_BODY", "request body is required");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "INVALID_BODY", "request body must be valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(
      400,
      "INVALID_BODY",
      "request body must be a JSON object",
    );
  }
  return parsed as Record<string, unknown>;
}

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(
      400,
      "MISSING_FIELD",
      `${key} must be a non-empty string`,
    );
  }
  return value.trim();
}

function numberField(body: Record<string, unknown>, key: string): number {
  const value = body[key];
  if (typeof value !== "number") {
    throw new HttpError(400, "MISSING_FIELD", `${key} must be a number`);
  }
  return value;
}

function writeJson(
  res: import("node:http").ServerResponse,
  status: number,
  payload: unknown,
): void {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

import {
  attr,
  escapeHtml,
  formatDate,
  formatMinor,
  icon,
  moneyAtRiskBadge,
  renderPage,
  statusPill,
  txnTable,
  urlPath,
} from "./layout.ts";
import {
  customerStatusLabel,
  demoInputsForService,
  type CatalogViewModel,
  type CheckoutOptionsViewModel,
  type CustomerProfile,
  type DashboardViewModel,
  type DisputesViewModel,
  type EvidenceViewModel,
  type NotificationsViewModel,
  type ProfileLike,
  type ReceiptViewModel,
  type ServiceDetailViewModel,
  type TransactionDetailViewModel,
  type TransactionsViewModel,
  type WalletViewModel,
  type FindingDeterminationViewModel,
  type FindingEvidenceViewModel,
  type FindingRecordSide,
  type FindingsSummaryViewModel,
} from "./client.ts";

export function renderHomePage(vm: DashboardViewModel): string {
  const walletBlocks =
    vm.wallet === null
      ? ""
      : `<div class="stat accent">
    <div class="value">${escapeHtml(formatMinor(vm.wallet.availableMinor, vm.wallet.currency))}</div>
    <div class="label">Available balance</div>
  </div>
  <div class="stat">
    <div class="value">${escapeHtml(formatMinor(vm.wallet.pendingMinor, vm.wallet.currency))}</div>
    <div class="label">Pending</div>
  </div>`;
  const content = `
  <section class="hero">
    <h2>Welcome back, ${escapeHtml(vm.customer.name.split(" ")[0])}</h2>
    <p>This is your simulated marketplace account, driven end-to-end by the ReconcileKit engine — orders, wallet movement, provider calls, evidence, reconciliation, and resolution are all real records from the JSONL store.</p>
  </section>

  <div class="grid grid-3" style="margin-top:22px">
    <div class="stat">
      <div class="value">${escapeHtml(String(vm.atRiskCount))}</div>
      <div class="label">Transactions with money at risk</div>
    </div>
    <div class="stat">
      <div class="value">${escapeHtml(String(vm.rows.length))}</div>
      <div class="label">Recent transactions</div>
    </div>
    ${walletBlocks}
  </div>

  <div class="grid grid-2">
    <div class="card">
      <h3>${icon("list")} Recent activity</h3>
      ${txnTable(vm.rows, "No transactions yet — try the Catalog.")}
      <div class="actions" style="margin-top:14px">
        <a class="btn" href="/transactions">${icon("list")} All transactions</a>
        <a class="btn" href="/catalog">${icon("catalog")} Browse catalog</a>
      </div>
    </div>
    <div>
      <div class="card">
        <h3>${icon("bell")} Notifications</h3>
        ${notificationsBrief(vm.notifications)}
        <a class="btn" href="/notifications" style="margin-top:12px">${icon("bell")} View alerts</a>
      </div>
      <div class="card">
        <h3>${icon("shield")} Resolution centre</h3>
        <p class="muted">Open a dispute or review a transaction's evidence pack and receipt.</p>
        <div class="actions">
          <a class="btn" href="/disputes">${icon("ticket")} Disputes</a>
          <a class="btn" href="/wallet">${icon("wallet")} Wallet &amp; ledger</a>
        </div>
      </div>
    </div>
  </div>`;
  return renderPage(
    {
      title: "Account",
      active: "/",
      banner: "Demo identity: cus_demo — no real payments, all simulation",
    },
    content,
  );
}

interface BriefNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: string;
  readonly createdAt: string;
}

function notificationsBrief(items: readonly BriefNotification[]): string {
  if (items.length === 0) {
    return `<div class="empty-state">${icon("bell")}<p>No alerts yet.</p></div>`;
  }
  return `
  <ul class="inline">
    ${items
      .map(
        (item) => `
    <li>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <div class="muted" style="margin-top:3px">${escapeHtml(item.body)}</div>
      </div>
      <div>${statusPill(item.status === "READ" ? "Read" : "New", item.status)}</div>
    </li>`,
      )
      .join("")}
  </ul>`;
}

export function renderLoginPage(
  customer: CustomerProfile,
  errorMessage?: string,
): string {
  const errorBlock =
    errorMessage === undefined
      ? ""
      : `<div class="notice notice-warn" role="alert">${icon("alert")}<span>${escapeHtml(errorMessage)}</span></div>`;
  const content = `
  <section class="hero">
    <h2>Sign in to MarketPlace</h2>
    <p>Sign in with your account to continue.</p>
  </section>
  <div class="card" style="max-width:460px;margin-top:22px">
    ${errorBlock}
    <form method="post" action="/login" class="form-grid">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required value="${attr(customer.email === "demo@example.com" ? "demo@example.com" : "")}">
      </div>
      <div class="field">
        <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required value="${attr(customer.isDemo ? "demo-password" : "")}">
      </div>
      <button class="btn primary" type="submit">${icon("arrowLeft")} Sign in</button>
    </form>
  </div>`;
  return renderPage({ title: "Sign in", active: "/" }, content);
}
export function renderDashboardPage(vm: DashboardViewModel): string {
  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-sub">${escapeHtml(vm.customer.name)} — ${escapeHtml(vm.customer.email)}</p>
    </div>
    <div class="actions">
      <a class="btn" href="/catalog">${icon("catalog")} New transaction</a>
    </div>
  </div>

  <div class="grid grid-4">
    <div class="stat accent">
      <div class="value">${escapeHtml(String(vm.atRiskCount))}</div>
      <div class="label">Money at risk</div>
    </div>
    <div class="stat">
      <div class="value">${escapeHtml(String(vm.rows.length))}</div>
      <div class="label">Transactions</div>
    </div>
    <div class="stat">
      <div class="value">${vm.wallet === null ? "—" : escapeHtml(formatMinor(vm.wallet.availableMinor, vm.wallet.currency))}</div>
      <div class="label">Available</div>
    </div>
    <div class="stat">
      <div class="value">${vm.wallet === null ? "—" : escapeHtml(formatMinor(vm.wallet.pendingMinor, vm.wallet.currency))}</div>
      <div class="label">Pending</div>
    </div>
  </div>

  <div class="section-label">Recent transactions</div>
  ${txnTable(vm.rows, "No transactions yet.")}

  <div class="section-label">Alerts</div>
  ${notificationsBrief(vm.notifications)}`;
  return renderPage({ title: "Dashboard", active: "/dashboard" }, content);
}

export function renderWalletPage(vm: WalletViewModel): string {
  const walletBlock =
    vm.wallet === null
      ? `<div class="empty-state">${icon("wallet")}<p>No wallet has been created for this customer yet.</p></div>`
      : `
  <div class="grid grid-3">
    <div class="stat accent">
      <div class="value">${escapeHtml(formatMinor(vm.wallet.availableMinor, vm.wallet.currency))}</div>
      <div class="label">Available balance</div>
    </div>
    <div class="stat">
      <div class="value">${escapeHtml(formatMinor(vm.wallet.pendingMinor, vm.wallet.currency))}</div>
      <div class="label">Pending</div>
    </div>
    <div class="stat">
      <div class="value">${escapeHtml(formatMinor(vm.wallet.totalMinor, vm.wallet.currency))}</div>
      <div class="label">Total</div>
    </div>
  </div>

  <div class="section-label">Ledger — ${escapeHtml(vm.wallet.id)} · 100 base minor units per displayed unit</div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>Entry</th><th>Type</th><th>Amount</th><th>Status</th><th>Reference</th><th>When</th></tr></thead>
      <tbody>
        ${vm.ledger
          .map(
            (entry) => `<tr>
          <td class="mono">${escapeHtml(entry.id)}</td>
          <td>${escapeHtml(entry.type.replace(/_/g, " "))}</td>
          <td class="nowrap">${escapeHtml(formatMinor(entry.amountMinor, entry.currency))}</td>
          <td>${statusPill(entry.status.toLowerCase(), entry.status)}</td>
          <td class="mono">${escapeHtml(entry.reference)}</td>
          <td class="muted nowrap">${escapeHtml(formatDate(entry.occurredAt))}</td>
        </tr>`,
          )
          .join("")}
        ${vm.ledger.length === 0 ? `<tr><td colspan="6" class="muted">No ledger entries.</td></tr>` : ""}
      </tbody>
    </table>
  </div>`;
  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Wallet</h1>
      <p class="page-sub">${escapeHtml(vm.customer.name)}</p>
    </div>
  </div>
  ${walletBlock}`;
  return renderPage({ title: "Wallet", active: "/wallet" }, content);
}

export function renderCatalogPage(vm: CatalogViewModel): string {
  const groups = vm.groups
    .map(
      (group) => `
  <div class="section-label">${escapeHtml(group.group.replace(/_/g, " "))} — ${escapeHtml(group.name)}</div>
  <div class="grid grid-3">
    ${group.services
      .map(
        (service) => `
    <a class="card service-card" href="${attr(service.href)}">
      <div class="chip ${service.complianceStatus === "AVAILABLE" ? "chip-good" : "chip-warn"}" style="align-self:start">${escapeHtml(service.complianceStatus.replace(/_/g, " "))}</div>
      <h3 style="margin-top:10px">${escapeHtml(service.name)}</h3>
      <p class="muted" style="margin:0 0 12px">${escapeHtml(service.description)}</p>
      <div class="muted small">${escapeHtml(service.fulfillmentType.replace(/_/g, " "))} · ${escapeHtml(service.kind.replace(/_/g, " "))}</div>
      <div style="margin-top:10px"><span class="mono">${escapeHtml(formatMinor(service.baseAmountMinor, service.currency))}</span> from</div>
    </a>`,
      )
      .join("")}
  </div>`,
    )
    .join("");
  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Catalog</h1>
      <p class="page-sub">Simulated providers, real orchestration</p>
    </div>
  </div>
  ${groups}`;
  return renderPage({ title: "Catalog", active: "/catalog" }, content);
}

export function renderServiceDetailPage(vm: ServiceDetailViewModel): string {
  const productsBlock =
    vm.products.length === 0
      ? `<div class="empty-state">${icon("catalog")}<p>No fixed products for this service — orders are quoted from inputs.</p></div>`
      : `
  <div class="grid grid-3">
    ${vm.products
      .map(
        (product) => `
    <div class="card">
      <h3>${escapeHtml(product.name)}</h3>
      <p class="muted" style="margin:0 0 10px">${escapeHtml(product.description)}</p>
      <div class="mono">${escapeHtml(formatMinor(product.pricing.catalogPriceMinor, product.pricing.currency))}</div>
      <div class="chip chip-muted" style="margin-top:10px">${escapeHtml(product.availability)}</div>
    </div>`,
      )
      .join("")}
  </div>`;
  const content = `
  <div class="detail-head">
    <a class="back-link" href="/catalog">${icon("arrowLeft")} Catalog</a>
  </div>
  <div class="page-head">
    <div>
      <h1 class="page-title">${escapeHtml(vm.service.name)}</h1>
      <p class="page-sub">${escapeHtml(vm.service.description)}</p>
    </div>
    <div class="actions">
      <a class="btn primary" href="/checkout?service=${attr(vm.service.id)}">${icon("arrowLeft")} Buy now</a>
    </div>
  </div>
  <div class="card">
    <h3>${icon("eye")} Service details</h3>
    <dl class="kv">
      <dt>Service id</dt><dd>${escapeHtml(vm.service.id)}</dd>
      <dt>Kind</dt><dd>${escapeHtml(vm.service.kind)}</dd>
      <dt>Fulfillment</dt><dd>${escapeHtml(vm.service.fulfillmentType.replace(/_/g, " "))}</dd>
      <dt>Currency</dt><dd>${escapeHtml(vm.service.currency)}</dd>
      <dt>Availability</dt><dd>${escapeHtml(vm.service.availability)}</dd>
      <dt>Compliance</dt><dd>${escapeHtml(vm.service.complianceStatus)}</dd>
    </dl>
  </div>
  <div class="section-label">Products</div>
  ${productsBlock}`;
  return renderPage({ title: vm.service.name, active: "/catalog" }, content);
}

export function renderCheckoutPage(
  vm: CheckoutOptionsViewModel,
  serviceId: string | null,
): string {
  const selectedId =
    serviceId === null
      ? (vm.services[0]?.id ?? "")
      : vm.services.some((service) => service.id === serviceId)
        ? serviceId
        : (vm.services[0]?.id ?? "");
  const selected =
    vm.services.find((service) => service.id === selectedId) ?? null;
  const defaults = selected === null ? {} : demoInputsForService(selected.id);
  const serviceOptions = vm.services
    .map(
      (service) =>
        `<option value="${attr(service.id)}"${service.id === selectedId ? " selected" : ""}>${escapeHtml(service.name)}</option>`,
    )
    .join("");
  const scenarioOptions = vm.scenarios
    .filter((scenario) => scenario !== "UNKNOWN")
    .map(
      (scenario) =>
        `<option value="${attr(scenario)}">${escapeHtml(scenario.replace(/_/g, " "))}</option>`,
    )
    .join("");
  const inputFields =
    selected === null
      ? `<p class="muted">No eligible services available.</p>`
      : Object.entries(defaults)
          .map(
            ([name, value]) => `
      <div class="field">
        <label for="input-${attr(name)}">${escapeHtml(name)}</label>
        <input id="input-${attr(name)}" name="inputs[${attr(name)}]" value="${attr(value)}">
      </div>`,
          )
          .join("");
  const content = `
  <div class="detail-head">
    <a class="back-link" href="/catalog">${icon("arrowLeft")} Catalog</a>
  </div>
  <div class="page-head">
    <div>
      <h1 class="page-title">Checkout</h1>
      <p class="page-sub">Simulated transaction — the provider call is mocked, everything around it is real application flow.</p>
    </div>
  </div>
  <div class="card" style="max-width:640px">
    <form method="post" action="/checkout" class="form-grid">
      <div class="kv-form">
        <div class="field">
          <label for="service">Service</label>
          <select id="service" name="service">${serviceOptions}</select>
        </div>
        <div class="field">
          <label for="scenario">Provider scenario</label>
          <select id="scenario" name="scenario">${scenarioOptions}</select>
        </div>
      </div>
      <div class="kv-form">${inputFields}</div>
      <div class="notice notice-warn">${icon("alert")}<span>This charges the demo wallet and records a real transaction. Re-running the same inputs replays the same deterministic transaction.</span></div>
      <button class="btn primary" type="submit">${icon("bolt")} Execute &amp; reconcile</button>
    </form>
  </div>`;
  return renderPage({ title: "Checkout", active: "/catalog" }, content);
}

export function renderTransactionsPage(vm: TransactionsViewModel): string {
  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Transactions</h1>
      <p class="page-sub">Every row is a persisted marketplace transaction with deterministic ids.</p>
    </div>
    <div class="actions">
      <a class="btn" href="/catalog">${icon("catalog")} New transaction</a>
    </div>
  </div>
  ${txnTable(vm.rows, "No transactions yet.")}`;
  return renderPage(
    { title: "Transactions", active: "/transactions" },
    content,
  );
}

export function renderTransactionDetailPage(
  vm: TransactionDetailViewModel,
): string {
  const outcome = vm.transaction.reconcileOutcome ?? "UNKNOWN";
  const customerLabel = customerStatusLabel(vm.transaction.customerStatus);
  const atRisk = vm.truth.moneyAtRisk;

  const providerBlock =
    vm.providerAttempt === null
      ? `<div class="empty-state">${icon("alert")}<p>No provider response recorded.</p></div>`
      : `
  <dl class="kv">
    <dt>Provider</dt><dd>${escapeHtml(vm.providerAttempt.providerId)}</dd>
    <dt>Attempt status</dt><dd>${escapeHtml(vm.providerAttempt.status)} <span class="muted">(${escapeHtml(vm.providerAttempt.scenario)})</span></dd>
    <dt>Provider reference</dt><dd>${escapeHtml(vm.providerAttempt.providerReference ?? "—")}</dd>
    <dt>Canonical state</dt><dd>${escapeHtml(vm.providerAttempt.canonicalStatus ?? "—")}</dd>
    <dt>Amount</dt><dd>${escapeHtml(formatMinor(vm.providerAttempt.amountMinor ?? 0, vm.providerAttempt.currency ?? vm.payment?.currency ?? "NGN"))}</dd>
    <dt>Latency</dt><dd>${escapeHtml(String(vm.providerAttempt.latencyMs))} ms</dd>
  </dl>
  <details class="proof-box" style="margin-top:14px">
    <summary>Provider source attributes (masked)</summary>
    <div class="proof-open">
      ${providerFactsGrid(vm.providerAttempt.sourceAttributes)}
    </div>
  </details>`;

  const reconcileBlock =
    vm.evidence === null
      ? `<div class="empty-state">${icon("alert")}<p>No evidence pack has been built for this transaction.</p></div>`
      : `
  <div class="pill-row" style="margin-bottom:14px">
    <a class="is-active">${icon("eye")} Evidence pack</a>
    <a href="${attr(receiptHref(vm.transaction.id))}">${icon("receipt")} Receipt</a>
    <a href="${attr(evidenceHref(vm.transaction.id))}">${icon("cards")} Evidence detail</a>
  </div>
  ${stateBanner(vm)}
  <dl class="kv" style="margin-top:16px">
    <dt>Outcome</dt><dd><span class="mono">${escapeHtml(outcome)}</span></dd>
    <dt>Codes</dt><dd>${escapeHtml((vm.evidence.reconciliation?.codes ?? []).join(", ") || "none")}</dd>
    <dt>Provider reference</dt><dd class="mono">${escapeHtml(vm.evidence.providerReference ?? "—")}</dd>
    <dt>Customer reference</dt><dd class="mono">${escapeHtml(vm.evidence.customerReference ?? "—")}</dd>
    <dt>Amount</dt><dd>${escapeHtml(formatMinor(vm.evidence.amountMinor, vm.evidence.currency))}</dd>
    <dt>Resolution</dt><dd>${escapeHtml(vm.evidence.resolutionStatus)}</dd>
  </dl>`;

  const moneyBlock = paymentTruthBlock(vm);
  const ledgerBlock = ledgerTruthBlock(vm);
  const fulfillmentBlock = fulfillmentTruthBlock(vm);
  const nextBlock = whatNextBlock(vm);
  const actionsBlock = actionsHtml(vm);
  const timelineBlock = timelineHtml(vm);
  const ticketsBlock = ticketsHtml(vm);
  const giftCardsBlock = giftCardsHtml(vm);

  const content = `
  <div class="detail-head">
    <a class="back-link" href="/transactions">${icon("arrowLeft")} All transactions</a>
  </div>
  <div class="page-head">
    <div>
      <h1 class="page-title">Transaction</h1>
      <p class="page-sub">Ref <span class="mono">${escapeHtml(vm.transaction.reference)}</span></p>
    </div>
    <div class="actions">
      ${statusPill(customerLabel, vm.transaction.customerStatus)}
      ${statusPill(adminPillLabel(vm.transaction.adminStatus), vm.transaction.adminStatus)}
    </div>
  </div>

  <div class="section-label">Transaction truth — three separate records, shown distinctly</div>
  <div class="grid grid-2">
    <div class="card">
      <h3>${icon("wallet")} What happened to your money</h3>
      ${moneyBlock}
    </div>
    <div class="card">
      <h3>${icon("bolt")} Provider response</h3>
      ${providerBlock}
    </div>
    <div class="card">
      <h3>${icon("list")} Ledger truth</h3>
      ${ledgerBlock}
    </div>
    <div class="card">
      <h3>${icon("check")} Fulfillment truth</h3>
      ${fulfillmentBlock}
    </div>
    <div class="card" style="grid-column:1 / -1">
      <h3>${icon("shield")} ReconcileKit determination</h3>
      ${reconcileBlock}
    </div>
    <div class="card" style="grid-column:1 / -1">
      <h3>${icon("arrowLeft")} What happens next</h3>
      ${nextBlock}
    </div>
    <div class="card" style="grid-column:1 / -1">
      <h3>${icon("user")} Simulated data</h3>
      ${simulatedBlock(vm)}
    </div>
  </div>

  ${actionsBlock}
  ${ticketsBlock}
  ${giftCardsBlock}
  ${timelineBlock}`;

  return renderPage(
    {
      title: `Transaction ${vm.transaction.reference}`,
      active: "/transactions",
      banner: atRisk
        ? "Flagged by the reconcile engine — your money is at risk on this transaction."
        : undefined,
    },
    content,
  );
}

type DetailRenderState = "SUCCESS" | "DISCREPANCY" | "UNRESOLVED";

function renderStateFor(vm: TransactionDetailViewModel): DetailRenderState {
  const outcome = vm.transaction.reconcileOutcome ?? "UNKNOWN";
  if (outcome === "MATCH") {
    return "SUCCESS";
  }
  if (outcome === "DISCREPANCY") {
    return "DISCREPANCY";
  }
  return "UNRESOLVED";
}

function stateBanner(vm: TransactionDetailViewModel): string {
  const state = renderStateFor(vm);
  const outcome = vm.transaction.reconcileOutcome ?? "UNKNOWN";
  switch (state) {
    case "SUCCESS":
      return `<div class="notice notice-good" role="status">${icon("check")}<span><strong>MATCH</strong> — payment, ledger, provider, and fulfillment records line up.</span></div>`;
    case "DISCREPANCY": {
      const codes =
        (vm.evidence?.reconciliation?.codes ?? []).join(", ") || "none";
      return `<div class="notice notice-warn" role="status">${icon("alert")}<span><strong>${escapeHtml(outcome)}</strong> — the records do not line up. Codes: ${escapeHtml(codes)}.</span></div>`;
    }
    default:
      return `<div class="notice notice-warn" role="status">${icon("alert")}<span><strong>${escapeHtml(outcome)}</strong> — we found records for this transaction, but they do not give us enough evidence to confirm exactly what happened. This is not proof that anything failed — and the system refuses to guess.</span></div>`;
  }
}

function paymentTruthBlock(vm: TransactionDetailViewModel): string {
  const payment = vm.payment;
  const status = vm.transaction.paymentStatus;
  const currency = payment?.currency ?? vm.order?.currency ?? "NGN";
  const paidAt =
    payment?.paidAt === null || payment?.paidAt === undefined
      ? "—"
      : formatDate(payment.paidAt);
  const charged =
    payment?.actualAmountMinor === null ||
    payment?.actualAmountMinor === undefined
      ? "—"
      : formatMinor(payment.actualAmountMinor, currency);
  return `
  <p class="muted" style="margin:0 0 10px;font-size:0.85em">Statement from the payment layer, recorded before any provider response.</p>
  <dl class="kv">
    <dt>Your money</dt><dd class="big">${escapeHtml(amountOf(vm))}</dd>
    <dt>Payment record status</dt><dd>${statusPill(status.toLowerCase(), status)} ${escapeHtml(status)}</dd>
    <dt>Expected amount</dt><dd>${escapeHtml(formatMinor(payment?.expectedAmountMinor ?? vm.order?.quotedAmountMinor ?? 0, currency))}</dd>
    <dt>Amount charged</dt><dd>${escapeHtml(charged)}</dd>
    <dt>Paid at</dt><dd>${paidAt}</dd>
    <dt>Wallet reference</dt><dd class="mono">${escapeHtml(payment?.walletReference ?? "—")}</dd>
  </dl>
  <div style="margin-top:14px">${vm.truth.moneyAtRisk ? moneyAtRiskBadge(true) : `<span class="chip chip-good">${icon("check")} Money not at risk</span>`}</div>`;
}

function ledgerTruthBlock(vm: TransactionDetailViewModel): string {
  if (vm.ledger.length === 0) {
    return `<div class="empty-state">${icon("wallet")}<p>No wallet ledger entry recorded for this transaction.</p></div>`;
  }
  const rows = vm.ledger
    .map(
      (entry) => `
  <tr>
    <td class="mono">${escapeHtml(entry.id)}</td>
    <td>${escapeHtml(entry.type.replace(/_/g, " "))}</td>
    <td class="nowrap">${escapeHtml(formatMinor(entry.amountMinor, entry.currency))}</td>
    <td>${statusPill(entry.status.toLowerCase(), entry.status)}</td>
    <td class="mono">${escapeHtml(entry.reference)}</td>
    <td class="muted nowrap">${escapeHtml(formatDate(entry.occurredAt))}</td>
  </tr>`,
    )
    .join("");
  return `
  <p class="muted" style="margin:0 0 10px;font-size:0.85em">Wallet ledger movement for this transaction — money actually moved or reserved.</p>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>Entry</th><th>Type</th><th>Amount</th><th>Status</th><th>Reference</th><th>When</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function fulfillmentTruthBlock(vm: TransactionDetailViewModel): string {
  const artifacts: string[] = [];
  if (vm.tickets.length > 0) {
    artifacts.push(`${vm.tickets.length} ticket(s)`);
  }
  if (vm.giftCards.length > 0) {
    artifacts.push(`${vm.giftCards.length} gift card(s)`);
  }
  const delivered = artifacts.length === 0 ? "none" : artifacts.join(", ");
  return `
  <dl class="kv">
    <dt>Fulfillment status</dt><dd>${statusPill(vm.transaction.fulfillmentStatus.toLowerCase(), vm.transaction.fulfillmentStatus)} ${escapeHtml(vm.transaction.fulfillmentStatus)}</dd>
    <dt>Delivered artifacts</dt><dd>${escapeHtml(delivered)}</dd>
    <dt>Provider reported</dt><dd>${escapeHtml(vm.providerAttempt?.status ?? "—")}</dd>
  </dl>
  <p class="muted" style="margin-top:14px;font-size:0.85em">Confirmed payment and delivered fulfillment are separate statements — payment success does not mean the service was delivered.</p>`;
}

function whatNextBlock(vm: TransactionDetailViewModel): string {
  const resolution = vm.transaction.resolutionStatus;
  const resolutionLine =
    resolution === "NONE"
      ? ""
      : `<p style="margin:10px 0 0"><strong>Resolution:</strong> this transaction's resolution state is <span class="mono">${escapeHtml(resolution)}</span>. Open the receipt or evidence detail for the full record.</p>`;
  return `
  <p style="margin:0"><strong>${escapeHtml(vm.truth.nextAction)}</strong></p>
  <p class="muted" style="margin:8px 0 0">${escapeHtml(vm.truth.explanation)}</p>
  ${resolutionLine}`;
}

export function renderReceiptPage(vm: ReceiptViewModel): string {
  const content = `
  <div class="detail-head">
    <a class="back-link" href="${attr(txnHref(vm.transaction.reference))}">${icon("arrowLeft")} Back to transaction</a>
  </div>
  <div class="card" style="max-width:560px;margin-top:16px">
    <h3>${icon("receipt")} Receipt — ${escapeHtml(vm.receipt.id)}</h3>
    <dl class="kv">
      <dt>Description</dt><dd>${escapeHtml(vm.label)}</dd>
      <dt>Amount</dt><dd>${escapeHtml(formatMinor(vm.receipt.amountMinor, vm.receipt.currency))}</dd>
      <dt>ReconcileKit outcome</dt><dd class="mono">${escapeHtml(vm.reconciliationOutcome)}</dd>
      <dt>Customer reference</dt><dd class="mono">${escapeHtml(vm.references.customerReference)}</dd>
      <dt>Provider reference</dt><dd class="mono">${escapeHtml(vm.references.providerReference ?? "not available")}</dd>
      <dt>Issued</dt><dd>${escapeHtml(formatDate(vm.receipt.issuedAt))}</dd>
      <dt>Simulated</dt><dd>${escapeHtml(String(vm.receipt.simulated))}</dd>
    </dl>
    <p class="muted" style="font-size:0.82em;margin-top:12px">Backed by evidence pack <span class="mono">${escapeHtml(vm.receipt.evidencePackId)}</span>.</p>
  </div>`;
  return renderPage(
    { title: `Receipt · ${vm.transaction.reference}` },
    content,
  );
}

export function renderEvidencePage(vm: EvidenceViewModel): string {
  const packBlock =
    vm.evidence === null
      ? `<div class="empty-state">${icon("cards")}<p>No evidence pack recorded.</p></div>`
      : `
  <div class="card">
    <h3>${icon("cards")} Evidence pack — ${escapeHtml(vm.evidence.id)}</h3>
    ${resultBanner(vm.evidence)}
    <dl class="kv" style="margin-top:16px">
      <dt>Created</dt><dd>${escapeHtml(formatDate(vm.evidence.createdAt))}</dd>
      <dt>Amount</dt><dd>${escapeHtml(formatMinor(vm.evidence.amountMinor, vm.evidence.currency))}</dd>
      <dt>Mismatch flags</dt><dd>${escapeHtml(vm.evidence.mismatchFlags.join(", ") || "none")}</dd>
    </dl>
  </div>
  <div class="section-label">Provider facts — sensitive values masked</div>
  <details class="proof-box" open>
    <summary>${escapeHtml(String(Object.keys(vm.evidence.providerFacts).length))} keys</summary>
    <div class="proof-open">${providerFactsGrid(vm.evidence.providerFacts)}</div>
  </details>`;
  const content = `
  <div class="detail-head">
    <a class="back-link" href="${attr(detailHrefWithRef(vm.transaction))}">${icon("arrowLeft")} Transaction ${escapeHtml(vm.transaction.reference)}</a>
  </div>
  ${packBlock}`;
  return renderPage(
    { title: `Evidence · ${vm.transaction.reference}` },
    content,
  );
}

export function renderNotificationsPage(vm: NotificationsViewModel): string {
  const items = vm.notifications
    .map(
      (record) => `
  <div class="notif${record.status === "UNREAD" ? " unread" : ""}">
    <div style="flex:1">
      <div class="notif-title">${escapeHtml(record.title)} ${
        record.status === "UNREAD"
          ? `<span class="chip chip-info">New</span>`
          : ""
      }</div>
      <div class="notif-body">${escapeHtml(record.body)}</div>
      <div class="notif-meta">
        <span>${escapeHtml(formatDate(record.createdAt))}</span>
        ${record.transactionId === null ? "" : `<a href="${attr(detailHrefWithId(record.transactionId))}">${escapeHtml(record.transactionId)}</a>`}
      </div>
    </div>
    <form method="post" action="/notifications/${attr(urlPath(record.id))}/read">
      <button class="btn" type="submit"${record.status === "READ" ? " disabled" : ""}>${icon("check")} Mark read</button>
    </form>
  </div>`,
    )
    .join("");
  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Notifications</h1>
      <p class="page-sub">${escapeHtml(vm.customer.name)}</p>
    </div>
  </div>
  ${items.length === 0 ? `<div class="empty-state">${icon("bell")}<p>Nothing here yet.</p></div>` : items}`;
  return renderPage(
    { title: "Notifications", active: "/notifications" },
    content,
  );
}

export function renderDisputesPage(vm: DisputesViewModel): string {
  const disputesBlock =
    vm.disputes.length === 0
      ? `<div class="empty-state">${icon("ticket")}<p>No disputes opened yet.</p></div>`
      : vm.disputes
          .map(
            (dispute) => `
    <div class="card">
      <h3>${escapeHtml(dispute.id)} ${statusPill(dispute.status.toLowerCase(), dispute.status)}</h3>
      <dl class="kv">
        <dt>Reason</dt><dd>${escapeHtml(dispute.reason)}</dd>
        <dt>Message</dt><dd>${escapeHtml(dispute.message || "—")}</dd>
        <dt>Opened</dt><dd>${escapeHtml(formatDate(dispute.createdAt))}</dd>
        <dt>Resolution note</dt><dd>${escapeHtml(dispute.resolutionNote ?? "—")}</dd>
      </dl>
      <div class="actions" style="margin-top:12px">
        <a class="btn" href="${attr(detailHrefWithRef(transactionForDispute(vm, dispute.transactionId)))}">${icon("eye")} View transaction</a>
      </div>
    </div>`,
          )
          .join("");
  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Disputes</h1>
      <p class="page-sub">Open a dispute on any transaction whose money needs attention.</p>
    </div>
  </div>
  ${disputesBlock}
  <div class="section-label">Transactions you can dispute</div>
  ${txnTable(vm.rows, "No transactions available.")}`;
  return renderPage({ title: "Disputes", active: "/transactions" }, content);
}

export function renderProfilePage(customer: ProfileLike): string {
  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Profile</h1>
      <p class="page-sub">Simulated demo identity</p>
    </div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div style="display:flex;align-items:center;gap:14px">
        <div class="avatar">${escapeHtml(customer.name.slice(0, 1))}</div>
        <div>
          <div style="font-weight:650">${escapeHtml(customer.name)}</div>
          <div class="muted">${escapeHtml(customer.email)}</div>
        </div>
      </div>
      <dl class="kv" style="margin-top:16px">
        <dt>Customer id</dt><dd class="mono">${escapeHtml(customer.id)}</dd>
        <dt>Phone</dt><dd>${escapeHtml(customer.phone ?? "—")}</dd>
        <dt>Demo record</dt><dd>${escapeHtml(String(customer.isDemo))}</dd>
      </dl>
    </div>
    <div class="card">
      <h3>${icon("shield")} Security</h3>
      <p class="muted" style="font-size:0.9em;line-height:1.5">This demo identity is seeded into the JSONL store. There is no real authentication in Phase 2I, and no payment details or gift-card codes are ever stored for display.</p>
    </div>
  </div>`;
  return renderPage({ title: "Profile", active: "/profile" }, content);
}

function amountOf(vm: TransactionDetailViewModel): string {
  const amount = vm.facts?.expectedAmountMinor ?? vm.evidence?.amountMinor ?? 0;
  const currency =
    vm.evidence?.currency ??
    vm.facts?.currency ??
    vm.payment?.currency ??
    "NGN";
  return formatMinor(amount, currency);
}

export function resultBanner(evidence: EvidenceViewModel["evidence"]): string {
  if (evidence === null) {
    return "";
  }
  const outcome = evidence.reconciliation?.outcome ?? "UNKNOWN";
  const good = !evidence.mismatchFlags.length;
  const cls = good ? "notice-good" : "notice-warn";
  const body = evidence.mismatchFlags.length
    ? `Reconciliation recorded with flags: ${evidence.mismatchFlags.join(", ")}.`
    : "Reconciliation outcome matches expectations across payment, provider, and fulfillment facts.";
  return `<div class="notice ${cls}" role="status">${icon(good ? "check" : "alert")}<span><strong>${escapeHtml(outcome)}</strong> — ${escapeHtml(body)}</span></div>`;
}

export function providerFactsGrid(
  facts: Record<string, string | number | null | undefined>,
): string {
  const entries = Object.entries(facts);
  if (entries.length === 0) {
    return `<p class="muted">No provider source attributes captured.</p>`;
  }
  return `
  <dl class="proof">
    ${entries
      .map(
        ([key, value]) =>
          `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value === null || value === undefined ? "" : String(value))}</dd>`,
      )
      .join("")}
  </dl>`;
}

function simulatedBlock(vm: TransactionDetailViewModel): string {
  return `
  <dl class="kv">
    <dt>Transaction id</dt><dd class="mono">${escapeHtml(vm.transaction.id)}</dd>
    <dt>Order id</dt><dd class="mono">${escapeHtml(vm.transaction.orderId)}</dd>
    <dt>Service</dt><dd>${escapeHtml(vm.service?.name ?? vm.transaction.serviceId)}</dd>
    <dt>Scenario</dt><dd class="mono">${escapeHtml(vm.transaction.scenario)}</dd>
    <dt>Payment state</dt><dd>${escapeHtml(vm.transaction.paymentStatus)}</dd>
    <dt>Fulfillment</dt><dd>${escapeHtml(vm.transaction.fulfillmentStatus)}</dd>
    <dt>Resolution</dt><dd>${escapeHtml(vm.transaction.resolutionStatus)}</dd>
    <dt>Customer status</dt><dd>${escapeHtml(vm.transaction.customerStatus)}</dd>
    <dt>Admin status</dt><dd>${escapeHtml(vm.transaction.adminStatus)}</dd>
    <dt>Created</dt><dd>${escapeHtml(formatDate(vm.transaction.createdAt))}</dd>
    <dt>Updated</dt><dd>${escapeHtml(formatDate(vm.transaction.updatedAt))}</dd>
    <dt>Inputs</dt><dd class="mono">${escapeHtml(safeJson(vm.inputs))}</dd>
    <dt>Simulated</dt><dd>${escapeHtml(String(vm.isSimulated))}</dd>
  </dl>`;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function adminPillLabel(status: string): string {
  return status.split("_").join(" ").toLowerCase();
}

function actionsHtml(vm: TransactionDetailViewModel): string {
  const can = vm.can;
  const txnId = vm.transaction.id;
  const buttons: string[] = [];
  if (can.refund) {
    buttons.push(
      `<form method="post" action="/admin/transactions/${encodeURIComponent(txnId)}/refund"><input type="hidden" name="reason" value="Customer refund"><button class="btn" type="submit">${icon("receipt")} Refund</button></form>`,
    );
  }
  if (can.completeRefund) {
    buttons.push(
      `<form method="post" action="/admin/transactions/${encodeURIComponent(txnId)}/refund/complete"><button class="btn" type="submit">${icon("check")} Complete refund</button></form>`,
    );
  }
  if (can.reverse) {
    buttons.push(
      `<form method="post" action="/admin/transactions/${encodeURIComponent(txnId)}/reversal"><input type="hidden" name="reason" value="OPERATOR_INITIATED_REVERSAL"><button class="btn" type="submit">${icon("arrowLeft")} Reverse payment</button></form>`,
    );
  }
  if (can.cancelTicket) {
    buttons.push(
      `<form method="post" action="/admin/transactions/${encodeURIComponent(txnId)}/cancel-ticket"><button class="btn" type="submit">${icon("ticket")} Cancel ticket</button></form>`,
    );
  }
  if (can.openDispute) {
    buttons.push(
      `<form method="post" action="/transactions/${encodeURIComponent(txnId)}/dispute"><input type="hidden" name="reason" value="Customer initiated"><button class="btn" type="submit">${icon("ticket")} Open dispute</button></form>`,
    );
  }
  if (can.resolveDispute) {
    buttons.push(
      `<form method="post" action="/admin/transactions/${encodeURIComponent(txnId)}/dispute/resolve"><input type="hidden" name="resolutionNote" value="Reviewed and closed"><button class="btn" type="submit">${icon("check")} Resolve dispute</button></form>`,
    );
  }
  if (can.resolveReview) {
    buttons.push(
      `<form method="post" action="/admin/transactions/${encodeURIComponent(txnId)}/review/resolve"><input type="hidden" name="operatorNote" value="Reviewed manually"><button class="btn" type="submit">${icon("check")} Resolve review</button></form>`,
    );
  }
  if (buttons.length === 0) {
    return "";
  }
  return `
  <div class="card">
    <h3>${icon("shield")} Actions</h3>
    <div class="actions">${buttons.join("")}</div>
    <p class="muted" style="font-size:0.8em;margin:12px 0 0">Resolution actions persist refunds, reversals, disputes, and reviews as first-class records — inspect them on this page or in the admin queue.</p>
  </div>`;
}

function timelineHtml(vm: TransactionDetailViewModel): string {
  if (vm.events.length === 0) {
    return "";
  }
  const items = vm.events
    .map(
      (event) => `
  <li>
    <div class="t-title">${escapeHtml(event.label)}</div>
    <div class="t-desc">${escapeHtml(event.description)}</div>
    <div class="t-meta">${escapeHtml(event.source)} · ${escapeHtml(event.actor)} · ${escapeHtml(formatDate(event.occurredAt))} · <span class="mono">${escapeHtml(event.type)}</span></div>
  </li>`,
    )
    .join("");
  return `
  <div class="card">
    <h3>${icon("list")} Timeline</h3>
    <ol class="timeline">${items}</ol>
  </div>`;
}

function ticketsHtml(vm: TransactionDetailViewModel): string {
  if (vm.tickets.length === 0) {
    return "";
  }
  const items = vm.tickets
    .map(
      (ticket) => `
  <div class="card">
    <h3>${icon("ticket")} ${escapeHtml(ticket.ticketKind)} ticket ${statusPill(ticket.status.toLowerCase(), ticket.status)}</h3>
    <dl class="kv">
      <dt>Reservation</dt><dd class="mono">${escapeHtml(ticket.reservationReference ?? "—")}</dd>
      <dt>Issue reference</dt><dd class="mono">${escapeHtml(ticket.issueReference ?? "—")}</dd>
      <dt>Cancellation</dt><dd class="mono">${escapeHtml(ticket.cancellationReference ?? "—")}</dd>
      <dt>Passenger</dt><dd>${escapeHtml(ticket.passengerOrAttendee)}</dd>
      <dt>Route / venue</dt><dd>${escapeHtml(ticket.routeOrVenue)}</dd>
      <dt>Seat</dt><dd>${escapeHtml(ticket.seat ?? "—")}</dd>
      <dt>Code</dt><dd class="mono">${escapeHtml(ticket.maskedCode ?? "not issued")}</dd>
    </dl>
  </div>`,
    )
    .join("");
  return `<div class="grid grid-2">${items}</div>`;
}

function giftCardsHtml(vm: TransactionDetailViewModel): string {
  if (vm.giftCards.length === 0) {
    return "";
  }
  const items = vm.giftCards
    .map(
      (card) => `
  <div class="gift-card-tile">
    <div style="display:flex;gap:10px;align-items:center">
      ${icon("cards")}
      <div>
        <strong>${escapeHtml(card.brand)}</strong>
        <div class="muted small">${escapeHtml(card.region)} · ${escapeHtml(String(card.quantity))} × ${escapeHtml(formatMinor(card.denominationMinor, card.currency))}</div>
      </div>
    </div>
    ${card.maskedCodePreview === null ? "" : `<div style="margin-top:8px"><span class="chip chip-info">Masked code</span> <span class="mono">${escapeHtml(card.maskedCodePreview)}</span></div>`}
    <div style="margin-top:8px">${statusPill(card.deliveryStatus.toLowerCase().replace(/_/g, " "), card.deliveryStatus)} ${statusPill(card.redemptionStatus.toLowerCase(), card.redemptionStatus)}</div>
    ${card.riskFlags.length ? `<div style="margin-top:8px" class="muted">flags: ${escapeHtml(card.riskFlags.join(", "))}</div>` : ""}
  </div>`,
    )
    .join("");
  return `
  <div class="card">
    <h3>${icon("cards")} Gift cards</h3>
    <p class="muted" style="font-size:0.85em;margin:0 0 12px">Only masked code previews are shown — full codes never leave the provider.</p>
    <div class="grid grid-2">${items}</div>
  </div>`;
}

function detailHrefWithRef(
  transaction: { readonly reference: string } | null,
): string {
  if (transaction === null) {
    return "/transactions";
  }
  return `/transactions/${encodeURIComponent(transaction.reference)}`;
}

function detailHrefWithId(transactionId: string): string {
  return `/transactions/${encodeURIComponent(transactionId)}`;
}

function txnHref(transactionId: string): string {
  return `/transactions/${encodeURIComponent(transactionId)}`;
}

function receiptHref(transactionId: string): string {
  return `/transactions/${encodeURIComponent(transactionId)}/receipt`;
}

function evidenceHref(transactionId: string): string {
  return `/transactions/${encodeURIComponent(transactionId)}/evidence`;
}

function transactionForDispute(
  rows: DisputesViewModel,
  transactionId: string,
): { readonly reference: string } | null {
  const row = rows.rows.find((candidate) => candidate.id === transactionId);
  return row === undefined ? null : { reference: row.reference };
}

// ============================================================
// Phase 3D — Mismatch investigation render surface
// ============================================================

const FINDING_CODE_MEANINGS: Readonly<Record<string, string>> = {
  AMOUNT_MISMATCH:
    "The two records share a reference but disagree on amount. Do not fulfill until the difference is resolved.",
  CURRENCY_MISMATCH:
    "The two records agree on reference but disagree on currency. Do not fulfill until this is resolved.",
  STATUS_MISMATCH:
    "The two records share a reference but disagree on status. Investigate before acting on either status.",
  TEMPORAL_ANOMALY:
    "The two records agree on reference and amount but their timestamps are outside the tolerance. Verify which timestamp is authoritative.",
  DUPLICATE_MERCHANT_RECORD:
    "More than one merchant record shares this reference. Resolve the duplicate before continuing.",
  DUPLICATE_PROVIDER_RECORD:
    "More than one provider record shares this reference. Resolve the duplicate before continuing.",
  CONFLICTING_ATTRIBUTES:
    "The two records share a reference but disagree on one or more attributes. Investigate before acting.",
  STATUS_UNRESOLVED:
    "Merchant and provider statuses cannot be resolved by the engine. Do not fulfill; follow up with the customer; leave unresolved until evidence confirms.",
  MISSING_REFERENCE:
    "A record is missing its reference. Restore the reference before reconciling.",
};

const FINDING_OUTCOME_EXPLANATIONS: Readonly<Record<string, string>> = {
  DISCREPANCY:
    "The engine found a specific disagreement between the merchant and provider records. The codes above name the disagreement.",
  UNRESOLVED:
    "The engine could not resolve a status difference. Do not fulfill; follow up with the customer; leave unresolved until evidence confirms.",
  MISSING_PROVIDER_RECORD:
    "No provider record exists for this merchant record. The engine does not fabricate a match; investigate whether the provider call completed.",
  UNMATCHED_PROVIDER_RECORD:
    "Provider evidence exists with no matching merchant record. Match it to a transaction or document it as account history.",
  HELD_AMBIGUOUS:
    "Duplicate records prevent a clean determination. Resolve the duplicate before continuing.",
  MISSING_REFERENCE:
    "A record is missing its reference. The engine will not guess.",
  INPUT_ERROR:
    "The reconciliation input could not be processed. Correct the input records.",
};

export function renderFindingsSummaryPage(
  vm: FindingsSummaryViewModel,
): string {
  const body =
    vm.findings.length === 0
      ? `<div class="empty-state">${icon("check")}<p>No open findings. Every persisted reconciliation is MATCH.</p></div>`
      : `
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Reference</th>
          <th>Outcome</th>
          <th>Code(s)</th>
          <th>Amount</th>
          <th>Note</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${vm.findings
          .map(
            (row) => `<tr>
          <td class="mono">${escapeHtml(row.reference)}</td>
          <td>${statusPill(row.outcome, row.outcome)}</td>
          <td class="mono">${escapeHtml(row.codes.join(", ") || "—")}</td>
          <td class="nowrap">${escapeHtml(formatMinor(row.amountMinor, row.currency))}</td>
          <td class="muted">${escapeHtml(row.note || "—")}</td>
          <td><a class="btn" href="${attr(row.detailHref)}">${icon("eye")} Investigate</a></td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`;

  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Findings</h1>
      <p class="page-sub">Every non-MATCH reconciliation, from the persisted evidence packs. Read-only — nothing on this page changes a record.</p>
    </div>
  </div>
  ${body}`;

  return renderPage({ title: "Findings", active: "/findings" }, content);
}

function findingRecordSideHtml(side: FindingRecordSide | null): string {
  if (side === null) {
    return `<div class="empty-state">${icon("alert")}<p>No record on this side. The engine refused to fabricate one.</p></div>`;
  }
  return `
  <dl class="kv">
    <dt>Reference</dt><dd class="mono">${escapeHtml(side.reference ?? "—")}</dd>
    <dt>Amount</dt><dd>${side.amountMinor === null ? "—" : escapeHtml(formatMinor(side.amountMinor, side.currency ?? "NGN"))}</dd>
    <dt>Currency</dt><dd>${escapeHtml(side.currency ?? "—")}</dd>
    <dt>Status</dt><dd>${side.status === null ? "—" : statusPill(side.status.toLowerCase(), side.status)}</dd>
    <dt>Occurred at</dt><dd>${side.occurredAt === null ? "—" : escapeHtml(formatDate(side.occurredAt))}</dd>
    <dt>${escapeHtml(side.extraLabel)}</dt><dd class="mono">${escapeHtml(side.extraValue)}</dd>
  </dl>`;
}

function findingMeaningList(outcome: string, codes: readonly string[]): string {
  if (codes.length === 0) {
    const text =
      FINDING_OUTCOME_EXPLANATIONS[outcome] ??
      "No further explanation is available for this outcome.";
    return `<p>${escapeHtml(text)}</p>`;
  }
  return `
  <ul class="inline">
    ${codes
      .map(
        (code) => `<li>
      <div>
        <div class="mono" style="font-weight:600">${escapeHtml(code)}</div>
        <div class="muted" style="margin-top:4px">${escapeHtml(FINDING_CODE_MEANINGS[code] ?? "Unclassified code — see the frozen adapter documentation.")}</div>
      </div>
    </li>`,
      )
      .join("")}
  </ul>`;
}

export function renderFindingDeterminationPage(
  vm: FindingDeterminationViewModel,
): string {
  const content = `
  <div class="detail-head">
    <a class="back-link" href="/findings">${icon("arrowLeft")} All findings</a>
  </div>
  <div class="page-head">
    <div>
      <h1 class="page-title">Finding</h1>
      <p class="page-sub">Ref <span class="mono">${escapeHtml(vm.transaction.reference)}</span> · join anchor <span class="mono">${escapeHtml(vm.transaction.id)}</span></p>
    </div>
    <div class="actions">
      ${statusPill(vm.outcome, vm.outcome)}
    </div>
  </div>

  <div class="section-label">Per-record determination — from the frozen engine's evaluation</div>
  <div class="grid grid-2">
    <div class="card">
      <h3>${icon("user")} ${escapeHtml(vm.merchantSide.label)}</h3>
      ${findingRecordSideHtml(vm.merchantSide)}
    </div>
    <div class="card">
      <h3>${icon("bolt")} ${escapeHtml(vm.providerSide?.label ?? "What the provider recorded")}</h3>
      ${findingRecordSideHtml(vm.providerSide)}
    </div>
  </div>

  <div class="card" style="margin-top:22px">
    <h3>${icon("shield")} What ReconcileKit determined</h3>
    <dl class="kv">
      <dt>Outcome</dt><dd><span class="mono">${escapeHtml(vm.outcome)}</span></dd>
      <dt>Code(s)</dt><dd class="mono">${escapeHtml(vm.codes.join(", ") || "none")}</dd>
    </dl>
    ${
      vm.notes.length === 0
        ? ""
        : `<div class="section-label" style="margin-top:16px">Validation notes</div>
    <ul class="inline">${vm.notes
      .map((note) => `<li><div class="muted">${escapeHtml(note)}</div></li>`)
      .join("")}</ul>`
    }
  </div>

  <div class="card" style="margin-top:22px">
    <h3>${icon("eye")} What this means</h3>
    ${findingMeaningList(vm.outcome, vm.codes)}
  </div>

  <div class="card" style="margin-top:22px">
    <h3>${icon("arrowLeft")} What happens next</h3>
    <p style="margin:0"><strong>${escapeHtml(vm.whatHappensNext)}</strong></p>
    <p class="muted" style="margin:10px 0 0;font-size:0.85em">This is the same operator action shown on the transaction detail page. 3D does not add a second action vocabulary.</p>
  </div>

  <div class="card" style="margin-top:22px">
    <h3>${icon("cards")} Evidence</h3>
    <p class="muted" style="margin:0 0 12px">Open the masked evidence pack to see the raw provider attributes the engine evaluated — sensitive values are removed by the existing redaction layer.</p>
    <div class="actions">
      <a class="btn primary" href="${attr(vm.evidenceHref)}">${icon("cards")} Open evidence pack</a>
      <a class="btn" href="${attr(vm.transactionHref)}">${icon("list")} Transaction detail</a>
    </div>
  </div>`;

  return renderPage(
    {
      title: `Finding · ${vm.transaction.reference}`,
      active: "/findings",
    },
    content,
  );
}

export function renderFindingEvidencePage(
  vm: FindingEvidenceViewModel,
): string {
  const pack = vm.evidence;
  const content = `
  <div class="detail-head">
    <a class="back-link" href="${attr(vm.determinationHref)}">${icon("arrowLeft")} Back to the finding</a>
  </div>
  <div class="page-head">
    <div>
      <h1 class="page-title">Evidence pack</h1>
      <p class="page-sub">Finding <span class="mono">${escapeHtml(vm.transaction.reference)}</span> · <span class="mono">${escapeHtml(pack.id)}</span></p>
    </div>
    <div class="actions">${statusPill(vm.outcome, vm.outcome)}</div>
  </div>

  <div class="card">
    <h3>${icon("cards")} Reconciliation snapshot</h3>
    <dl class="kv">
      <dt>Outcome</dt><dd class="mono">${escapeHtml(vm.outcome)}</dd>
      <dt>Codes</dt><dd class="mono">${escapeHtml(vm.codes.join(", ") || "none")}</dd>
      <dt>Mismatch flags</dt><dd class="mono">${escapeHtml(pack.mismatchFlags.join(", ") || "none")}</dd>
      <dt>Provider reference</dt><dd class="mono">${escapeHtml(pack.providerReference ?? "—")}</dd>
      <dt>Customer reference</dt><dd class="mono">${escapeHtml(pack.customerReference ?? "—")}</dd>
      <dt>Amount</dt><dd>${escapeHtml(formatMinor(pack.amountMinor, pack.currency))}</dd>
      <dt>Resolution</dt><dd>${escapeHtml(pack.resolutionStatus)}</dd>
      <dt>Created</dt><dd>${escapeHtml(formatDate(pack.createdAt))}</dd>
    </dl>
  </div>

  <div class="section-label">Provider facts — sensitive values masked</div>
  <details class="proof-box" open>
    <summary>${escapeHtml(String(Object.keys(pack.providerFacts).length))} keys</summary>
    <div class="proof-open">${providerFactsGrid(pack.providerFacts as Record<string, string | number | null | undefined>)}</div>
  </details>

  <div class="card" style="margin-top:22px">
    <h3>${icon("list")} Referenced events</h3>
    <dl class="kv">
      <dt>Timeline events</dt><dd class="mono">${escapeHtml(pack.timelineEventIds.join(", ") || "—")}</dd>
      <dt>Audit events</dt><dd class="mono">${escapeHtml(pack.auditEventIds.join(", ") || "—")}</dd>
    </dl>
    <p class="muted" style="font-size:0.82em;margin-top:12px">Masking is applied by the existing redaction layer. Full gift-card / ticket codes never leave the provider; only masked previews are carried through.</p>
  </div>

  <div class="actions" style="margin-top:18px">
    <a class="btn" href="${attr(vm.determinationHref)}">${icon("arrowLeft")} Back to the finding</a>
    <a class="btn" href="${attr(vm.transactionHref)}">${icon("list")} Transaction detail</a>
  </div>`;

  return renderPage(
    {
      title: `Evidence · ${vm.transaction.reference}`,
      active: "/findings",
    },
    content,
  );
}

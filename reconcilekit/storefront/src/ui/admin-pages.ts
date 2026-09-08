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
} from "./layout.ts";
import {
  adminStatusLabel,
  type AdminDashboardViewModel,
  type AdminQueueViewModel,
  type TransactionDetailViewModel,
} from "./client.ts";

export function renderAdminDashboardPage(vm: AdminDashboardViewModel): string {
  const counts = vm.counts
    .map(
      (
        count,
      ) => `<a class="stat" href="${attr(count.href)}" style="display:block;text-decoration:none;color:inherit">
      <div class="value">${escapeHtml(String(count.count))}</div>
      <div class="label">${escapeHtml(count.label)}
        ${count.count === 0 ? "" : `<span style="display:block" class="muted small">open the queue →</span>`}
      </div>
    </a>`,
    )
    .join("");
  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Admin · Operational overview</h1>
      <p class="page-sub">${escapeHtml(String(vm.total))} marketplace transactions tracked. Status counts are derived from persisted admin statuses.</p>
    </div>
  </div>

  <div class="grid grid-3">${counts}</div>

  <div class="section-label">Money at risk</div>
  ${txnTable(vm.atRisk, "No transactions currently carry money at risk.")}`;
  return renderPage(
    {
      title: "Admin Overview",
      admin: true,
      active: "/admin",
      banner:
        "Phase 2I ships a simulated operator shell — no production authentication.",
    },
    content,
  );
}

export function renderAdminQueuePage(vm: AdminQueueViewModel): string {
  const content = `
  <div class="detail-head">
    <a class="back-link" href="/admin">${icon("arrowLeft")} Admin overview</a>
  </div>
  <div class="page-head">
    <div>
      <h1 class="page-title">${escapeHtml(vm.label)}</h1>
      <p class="page-sub">Status: <span class="mono">${escapeHtml(vm.status)}</span></p>
    </div>
  </div>
  ${txnTable(vm.rows, `No transactions currently in the ${escapeHtml(vm.status)} queue.`)}`;
  return renderPage(
    { title: `${vm.label} · Admin`, admin: true, active: "/admin" },
    content,
  );
}

export function renderAdminTransactionDetailPage(
  vm: TransactionDetailViewModel,
): string {
  const outcome = vm.transaction.reconcileOutcome ?? "UNKNOWN";
  const atRisk = vm.truth.moneyAtRisk;

  const evidenceBlock =
    vm.evidence === null
      ? `<div class="empty-state">${icon("cards")}<p>No evidence pack recorded.</p></div>`
      : `
  <dl class="kv">
    <dt>Outcome</dt><dd class="mono">${escapeHtml(outcome)}</dd>
    <dt>Codes</dt><dd>${escapeHtml(vm.evidence.reconciliation?.codes.join(", ") ?? "none")}</dd>
    <dt>Mismatch flags</dt><dd>${escapeHtml(vm.evidence.mismatchFlags.join(", ") || "none")}</dd>
    <dt>Provider reference</dt><dd class="mono">${escapeHtml(vm.evidence.providerReference ?? "—")}</dd>
    <dt>Amount</dt><dd>${escapeHtml(formatMinor(vm.evidence.amountMinor, vm.evidence.currency))}</dd>
  </dl>
  <a class="btn" href="${attr(`/admin/transactions/${encodeURIComponent(vm.transaction.reference)}/evidence`)}" style="margin-top:12px">${icon("eye")} Evidence detail</a>`;

  const resolutionRecords = resolutionRecordsBlock(vm);
  const actionsBlock = adminActionsHtml(vm);
  const timelineBlock = adminTimelineHtml(vm);

  const content = `
  <div class="detail-head">
    <a class="back-link" href="/admin">${icon("arrowLeft")} Admin overview</a>
  </div>
  <div class="page-head">
    <div>
      <h1 class="page-title">Transaction <span class="mono">${escapeHtml(vm.transaction.reference)}</span></h1>
      <p class="page-sub">${escapeHtml(vm.service?.name ?? vm.transaction.serviceId)} · ${escapeHtml(vm.transaction.scenario)}</p>
    </div>
    <div class="actions">
      ${statusPill(adminStatusLabel(vm.transaction.adminStatus), vm.transaction.adminStatus)}
      ${statusPill(vm.transaction.customerStatus.toLowerCase().replace(/_/g, " "), vm.transaction.customerStatus)}
    </div>
  </div>

  <div class="grid grid-2">
    <div class="card">
      <h3>${icon("wallet")} Money</h3>
      <dl class="kv">
        <dt>Quoted amount</dt><dd class="big">${escapeHtml(formatMinor(vm.order?.quotedAmountMinor ?? 0, vm.order?.currency ?? "NGN"))}</dd>
        <dt>Payment state</dt><dd>${escapeHtml(vm.payment?.status ?? "—")} <span class="muted">(${escapeHtml(vm.payment?.actualAmountMinor === null ? "not settled" : "settled")})</span></dd>
        <dt>Ledger reference</dt><dd class="mono">${escapeHtml(vm.payment?.walletReference ?? "—")}</dd>
        <dt>Expected</dt><dd>${escapeHtml(formatMinor(vm.payment?.expectedAmountMinor ?? 0, vm.payment?.currency ?? "NGN"))}</dd>
        <dt>Actual</dt><dd>${escapeHtml(formatMinor(vm.payment?.actualAmountMinor ?? 0, vm.payment?.currency ?? "NGN"))}</dd>
      </dl>
      <div style="margin-top:12px">${atRisk ? moneyAtRiskBadge(true) : `<span class="chip chip-good">${icon("check")} Money not at risk</span>`}</div>
    </div>
    <div class="card">
      <h3>${icon("shield")} ReconcileKit determination</h3>
      ${evidenceBlock}
    </div>
  </div>

  ${resolutionRecords}
  ${actionsBlock}

  ${timelineBlock}`;

  return renderPage(
    {
      title: `${vm.transaction.reference} · Admin`,
      admin: true,
      active: "/admin",
    },
    content,
  );
}

function resolutionRecordsBlock(vm: TransactionDetailViewModel): string {
  const rows: string[] = [];
  if (vm.refund !== null) {
    rows.push(`
    <div class="card">
      <h3>${icon("receipt")} Refund ${statusPill(vm.refund.status.toLowerCase().replace(/_/g, " "), vm.refund.status)}</h3>
      <dl class="kv">
        <dt>Id</dt><dd class="mono">${escapeHtml(vm.refund.id)}</dd>
        <dt>Amount</dt><dd>${escapeHtml(formatMinor(vm.refund.amountMinor, vm.refund.currency))}</dd>
        <dt>Reason</dt><dd>${escapeHtml(vm.refund.reason)}</dd>
        <dt>Initiated</dt><dd>${escapeHtml(formatDate(vm.refund.initiatedAt))}</dd>
        <dt>Completed</dt><dd>${escapeHtml(vm.refund.completedAt === null ? "—" : formatDate(vm.refund.completedAt))}</dd>
        <dt>Ledger reference</dt><dd class="mono">${escapeHtml(vm.refund.ledgerReference ?? "—")}</dd>
      </dl>
    </div>`);
  }
  if (vm.reversal !== null) {
    rows.push(`
    <div class="card">
      <h3>${icon("arrowLeft")} Reversal ${statusPill(vm.reversal.status.toLowerCase().replace(/_/g, " "), vm.reversal.status)}</h3>
      <dl class="kv">
        <dt>Id</dt><dd class="mono">${escapeHtml(vm.reversal.id)}</dd>
        <dt>Amount</dt><dd>${escapeHtml(formatMinor(vm.reversal.amountMinor, vm.reversal.currency))}</dd>
        <dt>Reason</dt><dd>${escapeHtml(vm.reversal.reason)}</dd>
        <dt>Initiated</dt><dd>${escapeHtml(formatDate(vm.reversal.initiatedAt))}</dd>
        <dt>Completed</dt><dd>${escapeHtml(vm.reversal.completedAt === null ? "—" : formatDate(vm.reversal.completedAt))}</dd>
        <dt>Ledger reference</dt><dd class="mono">${escapeHtml(vm.reversal.ledgerReference ?? "—")}</dd>
      </dl>
    </div>`);
  }
  if (vm.dispute !== null) {
    rows.push(`
    <div class="card">
      <h3>${icon("ticket")} Dispute ${statusPill(vm.dispute.status.toLowerCase().replace(/_/g, " "), vm.dispute.status)}</h3>
      <dl class="kv">
        <dt>Id</dt><dd class="mono">${escapeHtml(vm.dispute.id)}</dd>
        <dt>Customer</dt><dd class="mono">${escapeHtml(vm.dispute.customerId)}</dd>
        <dt>Reason</dt><dd>${escapeHtml(vm.dispute.reason)}</dd>
        <dt>Message</dt><dd>${escapeHtml(vm.dispute.message || "—")}</dd>
        <dt>Status updated</dt><dd>${escapeHtml(formatDate(vm.dispute.updatedAt))}</dd>
        <dt>Resolution note</dt><dd>${escapeHtml(vm.dispute.resolutionNote ?? "—")}</dd>
      </dl>
    </div>`);
  }
  if (vm.review !== null) {
    rows.push(`
    <div class="card">
      <h3>${icon("eye")} Manual review ${statusPill(vm.review.status.toLowerCase().replace(/_/g, " "), vm.review.status)}</h3>
      <dl class="kv">
        <dt>Id</dt><dd class="mono">${escapeHtml(vm.review.id)}</dd>
        <dt>Reason</dt><dd>${escapeHtml(vm.review.reason)}</dd>
        <dt>Assigned to</dt><dd>${escapeHtml(vm.review.assignedTo ?? "—")}</dd>
        <dt>Created</dt><dd>${escapeHtml(formatDate(vm.review.createdAt))}</dd>
        <dt>Operator note</dt><dd>${escapeHtml(vm.review.operatorNote ?? "—")}</dd>
      </dl>
    </div>`);
  }
  if (rows.length === 0) {
    return `
  <div class="section-label">Resolution records</div>
  <div class="empty-state">${icon("shield")}<p>No refunds, reversals, disputes, or manual reviews recorded.</p></div>`;
  }
  return `
  <div class="section-label">Resolution records</div>
  <div class="grid grid-2">${rows.join("")}</div>`;
}

function adminActionsHtml(vm: TransactionDetailViewModel): string {
  const can = vm.can;
  const txnId = vm.transaction.id;
  const buttons: string[] = [];
  if (can.refund) {
    buttons.push(
      `<form method="post" action="/admin/transactions/${encodeURIComponent(txnId)}/refund"><input type="hidden" name="reason" value="Customer refund"><button class="btn" type="submit">${icon("receipt")} Initiate refund</button></form>`,
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
  buttons.push(
    `<form method="post" action="/admin/transactions/${encodeURIComponent(txnId)}/review"><input type="hidden" name="reason" value="Operational review"><button class="btn" type="submit">${icon("eye")} Flag for review</button></form>`,
  );
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
  return `
  <div class="card">
    <h3>${icon("shield")} Operator actions</h3>
    <div class="actions">${buttons.join("")}</div>
    <p class="muted" style="font-size:0.8em;margin:12px 0 0">Every action is guarded by the resolution layer and recorded as a first-class record + timeline event.</p>
  </div>`;
}

function adminTimelineHtml(vm: TransactionDetailViewModel): string {
  if (vm.events.length === 0) {
    return `<div class="card"><h3>${icon("list")} Timeline</h3><p class="muted">No events recorded.</p></div>`;
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

export function renderAdminEvidencePage(vm: {
  readonly reference: string;
  readonly outcome: string;
  readonly evidenceLines: string;
}): string {
  const content = `
  <div class="page-head">
    <div>
      <h1 class="page-title">Evidence detail</h1>
      <p class="page-sub"><span class="mono">${escapeHtml(vm.reference)}</span> · outcome <span class="mono">${escapeHtml(vm.outcome)}</span></p>
    </div>
  </div>
  <details class="proof-box" open>
    <summary>Evidence pack contents</summary>
    <div class="proof-open">${vm.evidenceLines}</div>
  </details>`;
  return renderPage(
    { title: `Evidence · ${vm.reference}`, admin: true, active: "/admin" },
    content,
  );
}

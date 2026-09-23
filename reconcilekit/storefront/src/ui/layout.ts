import type { TransactionRow } from "./client.ts";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function attr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return escapeHtml(String(value));
}

export function urlPath(value: string): string {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

const ICONS: Readonly<Record<string, string>> = {
  bolt: '<polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline>',
  home: '<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1Z"></path>',
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
  wallet:
    '<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M16 12.5h.01M3 10h18"></path>',
  catalog:
    '<path d="M4 4h7v7H4Z M13 4h7v7h-7Z M4 13h7v7H4Z M13 13h7v7h-7Z"></path>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"></path><circle cx="3" cy="6" r="1"></circle><circle cx="3" cy="12" r="1"></circle><circle cx="3" cy="18" r="1"></circle>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
  shield: '<path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z"></path>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"></path>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"></path><circle cx="12" cy="12" r="3"></circle>',
  alert:
    '<path d="M12 9v4M12 17h.01"></path><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  cards:
    '<rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v3h20v-3a3 3 0 0 1 0-6V6H2Z"></path>',
  receipt:
    '<path d="M4 3h16v18l-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"></path><path d="M8 8h8M8 12h8"></path>',
};

export function icon(name: string): string {
  const body = ICONS[name] ?? "";
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function formatMinor(minor: number, currency: string): string {
  const amount = (minor / 100).toFixed(2);
  const symbol =
    currency === "NGN"
      ? "₦"
      : currency === "USD"
        ? "$"
        : currency === "GBP"
          ? "£"
          : currency === "EUR"
            ? "€"
            : "";
  return `${symbol}${amount}${currency === "" ? "" : ` ${currency}`}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHIP_CLASS: Readonly<Record<string, string>> = {
  CONFIRMED: "chip-good",
  HEALTHY: "chip-good",
  SUCCESS: "chip-good",
  PENDING: "chip-warn",
  PENDING_PROVIDER: "chip-warn",
  REFUND_PENDING: "chip-warn",
  NEEDS_ATTENTION: "chip-warn",
  FAILED: "chip-bad",
  PROVIDER_FAILED: "chip-bad",
  DUPLICATE: "chip-bad",
  MISMATCH: "chip-bad",
  UNRESOLVED: "chip-bad",
  REFUND_QUEUE: "chip-warn",
  REVERSAL_QUEUE: "chip-warn",
  REVERSED: "chip-muted",
  REFUNDED: "chip-muted",
  MANUAL_REVIEW: "chip-info",
  OPEN: "chip-info",
  UNDER_REVIEW: "chip-info",
  RESOLVED: "chip-good",
  READ: "chip-muted",
  UNREAD: "chip-info",
  DELIVERED: "chip-good",
  FULFILLED: "chip-good",
  ISSUED: "chip-good",
  RESERVED: "chip-warn",
  CANCELLED: "chip-muted",
};

export function chipClass(status: string): string {
  return CHIP_CLASS[status] ?? "chip-muted";
}

export function statusPill(label: string, status: string): string {
  return `<span class="chip ${chipClass(status)}">${escapeHtml(label)}</span>`;
}

export interface NavLink {
  readonly href: string;
  readonly label: string;
  readonly iconName: string;
}

const CUSTOMER_NAV: readonly NavLink[] = [
  { href: "/", label: "Home", iconName: "home" },
  { href: "/dashboard", label: "Dashboard", iconName: "dashboard" },
  { href: "/wallet", label: "Wallet", iconName: "wallet" },
  { href: "/catalog", label: "Catalog", iconName: "catalog" },
  { href: "/transactions", label: "Transactions", iconName: "list" },
  { href: "/notifications", label: "Alerts", iconName: "bell" },
  { href: "/admin", label: "Admin", iconName: "shield" },
];

const ADMIN_NAV: readonly NavLink[] = [
  { href: "/admin", label: "Overview", iconName: "shield" },
  { href: "/admin/queues/mismatch", label: "Mismatches", iconName: "alert" },
  {
    href: "/admin/queues/manual_review",
    label: "Manual review",
    iconName: "eye",
  },
  {
    href: "/admin/queues/refund_queue",
    label: "Refund queue",
    iconName: "receipt",
  },
  {
    href: "/admin/queues/reversal_queue",
    label: "Reversal queue",
    iconName: "arrowLeft",
  },
  { href: "/", label: "Customer site", iconName: "home" },
];

function navHtml(links: readonly NavLink[], active: string): string {
  return `
  <nav class="site-nav" aria-label="Primary">
    ${links
      .map(
        (link) => `
    <a class="nav-link${link.href === active ? " is-active" : ""}" href="${attr(link.href)}">
      ${icon(link.iconName)}<span>${escapeHtml(link.label)}</span>
    </a>`,
      )
      .join("")}
  </nav>`;
}

export interface PageOptions {
  readonly title: string;
  readonly admin?: boolean;
  readonly active?: string;
  readonly banner?: string;
}

export function renderPage(options: PageOptions, content: string): string {
  const links = options.admin === true ? ADMIN_NAV : CUSTOMER_NAV;
  const active = options.active ?? (options.admin === true ? "/admin" : "/");
  const nav = navHtml(links, active);
  const banner =
    options.banner === undefined
      ? ""
      : `<div class="page-banner">${icon("alert")}<span>${options.banner}</span></div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)} · MarketPlace Connect</title>
<link rel="stylesheet" href="/assets/app.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="${options.admin === true ? "/admin" : "/"}">
    <span class="brand-mark">${icon("bolt")}</span>
    <span class="brand-text">MarketPlace<em>${options.admin === true ? " Admin" : " Connect"}</em></span>
  </a>
  ${nav}
</header>
${banner}
<main class="container">${content}</main>
<footer class="site-footer">
  <span>ReconcileKit · MarketPlace Connect</span>
  <span class="muted">Phase 2I simulated surface</span>
</footer>
<script src="/assets/app.js"></script>
</body>
</html>`;
}

export function moneyAtRiskBadge(atRisk: boolean): string {
  if (!atRisk) {
    return "";
  }
  return `<span class="chip chip-bad">${icon("alert")}Money at risk</span>`;
}

export function txnTable(
  rows: readonly TransactionRow[],
  empty: string,
): string {
  if (rows.length === 0) {
    return `<div class="empty-state">${icon("list")}<p>${escapeHtml(empty)}</p></div>`;
  }
  return `
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Transaction</th>
          <th>Service</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Risk</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const riskCell = row.moneyAtRisk
              ? `<span class="risk-dot" title="Money at risk"></span>`
              : `<span class="muted">—</span>`;
            return `<tr>
            <td><a class="mono" href="${attr(row.detailHref)}">${escapeHtml(row.reference)}</a><span class="muted small">${escapeHtml(row.id)}</span></td>
            <td>${escapeHtml(row.serviceName)}<span class="muted small">${escapeHtml(row.kind)}</span></td>
            <td class="nowrap">${escapeHtml(formatMinor(row.amountMinor, row.currency))}</td>
            <td>${statusPill(customerStatusLabelSafe(row), row.customerStatus)}</td>
            <td>${riskCell}</td>
            <td class="muted nowrap">${escapeHtml(formatDate(row.createdAt))}</td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function customerStatusLabelSafe(row: TransactionRow): string {
  return row.customerStatus.split("_").join(" ");
}

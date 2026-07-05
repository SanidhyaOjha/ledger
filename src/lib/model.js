// model.js — pure data helpers, no UI, no Drive. Easy to test and reuse.

export const fmt = (n) => "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const niceDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const uid = () => Math.random().toString(36).slice(2, 10);

// v2: payment modes. A transaction's `payments` is null/absent (mode not set —
// all v1 data) or an array [{ id, mode, amount }] whose amounts sum to the
// transaction amount. Negative amounts are allowed (e.g. cashback).
export const MODES = ["cash", "upi", "debit card", "credit card", "neft"];
export const modeShort = { cash: "cash", upi: "upi", "debit card": "debit", "credit card": "credit", neft: "neft" };
export const paymentsSum = (payments) => (payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

// v2: ghost tags — hidden everywhere except the add/edit form. These helpers
// are the single source of truth for "which tags does the UI show".
export const isGhost = (tag, tagConfig) => !!tagConfig?.[tag]?.ghost;
export const visibleTags = (tags, tagConfig) => (tags || []).filter((tg) => !isGhost(tg, tagConfig));

export const received = (x) => (x.repayments || []).reduce((s, r) => s + r.amount, 0);
export const outstanding = (x) => Math.max(0, (x.owed || 0) - received(x));

// Old lends: money you lent before you started using the app, logged directly
// from the Owed tab (no tag setup needed). Uses a fake account id that never
// matches a real account, so it's excluded from balanceOf/net worth — the
// money already left your real account in the past, outside this app's ledger.
export const EXTERNAL_ACCOUNT = "__old_lend__";
export const isOldLend = (x) => x.account === EXTERNAL_ACCOUNT;

export const isRepayable = (x, tagConfig) =>
  x.type === "expense" && (isOldLend(x) || x.tags.some((tg) => tagConfig[tg]?.repay));

// balances: combined entries need no special handling — x.amount is always the
// entry total (the sum of its items), so the math below is untouched from v1.
export function balanceOf(tx, accId) {
  let bal = 0;
  for (const x of tx) {
    if (x.type === "income" && x.account === accId) bal += x.amount;
    if (x.type === "expense" && x.account === accId) { bal -= x.amount; bal += received(x); }
    if (x.type === "transfer") {
      if (x.account === accId) bal -= x.amount;
      if (x.toAccount === accId) bal += x.amount;
    }
  }
  return bal;
}

// ── empty / default state for a brand-new user ────────────────────────────────
export function emptyState() {
  return {
    version: 2,
    accounts: [{ id: "a_" + uid(), name: "Personal", color: "#6366f1" }],
    groups: [],
    tagConfig: {},
    tx: [],
  };
}

// ── v1 → v2 migration ─────────────────────────────────────────────────────────
// Deliberately non-destructive: every v2 field (payments, items, receiver,
// proof; tagConfig keys proof/receiver/ghost) is OPTIONAL, read with fallbacks
// throughout the UI. So migration only normalizes top-level containers and
// bumps the version — it never rewrites a single transaction.
// Returns { data, fromV1 } so the caller can write a one-time backup first.
export function migrateLedger(raw) {
  const data = { ...raw };
  data.accounts ||= [];
  data.groups ||= [];
  data.tagConfig ||= {};
  data.tx ||= [];
  const fromV1 = (data.version || 1) < 2;
  data.version = 2;
  return { data, fromV1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT ENTRY POINT — the single doorway for any future integration.
//
// UPI-screenshot OCR, Splitwise sync, bank CSV import — every one of them should
// produce an array of partial transactions and hand it here. This normalizes
// them into real transactions (filling ids, defaults) so the rest of the app
// never needs to know where the data came from.
//
// Each partial may include: { type, amount, account, group, note, tags, date,
// owed, payments, items, receiver, proof }. Missing fields get sensible defaults.
// ─────────────────────────────────────────────────────────────────────────────
export function importTransactions(partials, { defaultAccount }) {
  return partials.map((p) => ({
    id: uid(),
    type: p.type || "expense",
    amount: Number(p.amount) || 0,
    account: p.account || defaultAccount,
    toAccount: p.toAccount,
    group: p.group ?? null,
    note: p.note || "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    date: p.date || todayISO(),
    owed: p.owed || 0,
    invoice: p.invoice || null,
    repayments: p.repayments || [],
    payments: Array.isArray(p.payments) && p.payments.length ? p.payments : null, // v2
    items: Array.isArray(p.items) && p.items.length ? p.items : null,             // v2
    receiver: p.receiver || null,                                                  // v2
    proof: p.proof || null,                                                        // v2
    source: p.source || "import", // provenance, handy for dedup later
  }));
}

// model.js — pure data helpers, no UI, no Drive. Easy to test and reuse.

export const fmt = (n) => "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const niceDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const uid = () => Math.random().toString(36).slice(2, 10);

export const received = (x) => (x.repayments || []).reduce((s, r) => s + r.amount, 0);
export const outstanding = (x) => Math.max(0, (x.owed || 0) - received(x));
export const isRepayable = (x, tagConfig) => x.type === "expense" && x.tags.some((tg) => tagConfig[tg]?.repay);

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
    version: 1,
    accounts: [{ id: "a_" + uid(), name: "Personal", color: "#6366f1" }],
    groups: [],
    tagConfig: {},
    tx: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT ENTRY POINT — the single doorway for any future integration.
//
// UPI-screenshot OCR, Splitwise sync, bank CSV import — every one of them should
// produce an array of partial transactions and hand it here. This normalizes
// them into real transactions (filling ids, defaults) so the rest of the app
// never needs to know where the data came from.
//
// Each partial may include: { type, amount, account, group, note, tags, date, owed }
// Missing fields get sensible defaults.
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
    source: p.source || "import", // provenance, handy for dedup later
  }));
}

// pdf.js — generate a lean PDF statement from a filtered transaction list.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmt, niceDate, received, outstanding, visibleTags, modeShort } from "./model";

// `scope` is a human label like "Personal · Goa trip · food".
// `rows` is the already-filtered transaction array.
// `lookups` provides acct(id)->name and grp(id)->name and tagConfig.
export function exportStatement({ scope, rows, totals, lookups }) {
  const { acctName, grpName, tagConfig } = lookups;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFontSize(18); doc.setFont(undefined, "bold");
  doc.text("Ledger — Statement", 40, 48);
  doc.setFontSize(10); doc.setFont(undefined, "normal");
  doc.setTextColor(110);
  doc.text(scope || "All transactions", 40, 66);
  doc.text("Generated " + niceDate(new Date().toISOString().slice(0, 10)), 40, 80);
  doc.setTextColor(20);

  // summary line
  doc.setFontSize(11);
  const sum = `Income  ${fmt(totals.income)}      Net spend  ${fmt(totals.expense - totals.repaid)}      Net  ${totals.net < 0 ? "-" : ""}${fmt(totals.net)}`;
  doc.text(sum, 40, 108);

  // does any row carry repayment info? if so, show owed/received columns
  const anyRepay = rows.some((x) => x.type === "expense" && x.tags.some((tg) => tagConfig[tg]?.repay) && x.owed > 0);
  // v2: show a Mode column only if any row has payment info
  const anyMode = rows.some((x) => x.payments && x.payments.length);

  const head = [[
    "Date", "Note", "Account", "Group", "Tags",
    ...(anyMode ? ["Mode"] : []),
    "Amount",
    ...(anyRepay ? ["Owed", "Got back", "Outstanding"] : []),
  ]];

  const modeCell = (x) => !x.payments || !x.payments.length ? "—"
    : x.payments.length === 1 ? modeShort[x.payments[0].mode]
    : x.payments.map((p) => `${modeShort[p.mode]} ${p.amount < 0 ? "-" : ""}${fmt(p.amount)}`).join("\n");

  const body = rows.map((x) => {
    // combined entries: list items under the note
    let note = x.note || "—";
    if (x.receiver) note += `  → ${x.receiver}`;
    if (Array.isArray(x.items) && x.items.length) {
      note += "\n" + x.items.map((i) => `  • ${i.note || "(item)"} — ${fmt(i.amount)}`).join("\n");
    }
    const base = [
      niceDate(x.date),
      note,
      acctName(x.account) || "—",
      x.group ? grpName(x.group) || "—" : "—",
      visibleTags(x.tags, tagConfig).join(", "), // v2: ghost tags never exported
      ...(anyMode ? [modeCell(x)] : []),
      (x.type === "income" ? "+" : x.type === "expense" ? "-" : "↔") + fmt(x.type === "expense" ? x.amount - received(x) : x.amount),
    ];
    if (!anyRepay) return base;
    const isR = x.type === "expense" && x.owed > 0;
    return [...base, isR ? fmt(x.owed) : "—", isR ? fmt(received(x)) : "—", isR ? fmt(outstanding(x)) : "—"];
  });

  autoTable(doc, {
    head, body, startY: 128,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 248] },
    margin: { left: 40, right: 40 },
  });

  let y = doc.lastAutoTable.finalY + 20;
  doc.setFont(undefined, "bold"); doc.setFontSize(11);
  doc.text(`Total (${rows.length} item${rows.length !== 1 ? "s" : ""}):  net ${totals.net < 0 ? "-" : ""}${fmt(totals.net)}`, 40, y);
  if (anyRepay) {
    const owedSum = rows.reduce((s, x) => s + (x.type === "expense" ? outstanding(x) : 0), 0);
    y += 16; doc.setTextColor(180, 120, 10);
    doc.text(`Still owed to you:  ${fmt(owedSum)}`, 40, y);
  }

  const safe = (scope || "statement").replace(/[^\w]+/g, "-").slice(0, 40);
  doc.save(`ledger-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

import React, { useState } from "react";
import { Modal, Seg, Toggle, pill, inp, sel, lbl, primaryBtn, secondaryBtn, miniBtn } from "../lib/ui.jsx";
import { fmt, todayISO, uid, MODES, paymentsSum, isGhost } from "../lib/model";
import { uploadReceipt, deleteReceipt } from "../lib/drive";

export default function TxForm({ t, accounts, groups, allTags, tagConfig, initial, defaultAccount, defaultGroup, onSave, onClose }) {
  const [type, setType] = useState(initial?.type || "expense");
  const [amount, setAmount] = useState(initial && !initial.items?.length ? initial.amount : "");
  const [account, setAccount] = useState(initial?.account || defaultAccount);
  const [toAccount, setToAccount] = useState(initial?.toAccount || accounts.find((a) => a.id !== (initial?.account || defaultAccount))?.id);
  const [group, setGroup] = useState(initial?.group ?? defaultGroup ?? null);
  const [note, setNote] = useState(initial?.note || "");
  const [tags, setTags] = useState(initial?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [date, setDate] = useState(initial?.date || todayISO());
  const [owed, setOwed] = useState(initial?.owed || "");
  const [invoice, setInvoice] = useState(initial?.invoice || null); // { driveId, name }
  const [proof, setProof] = useState(initial?.proof || null);       // { driveId, name } — v2
  const [compress, setCompress] = useState(false);
  const [uploading, setUploading] = useState(null); // "invoice" | "proof" | null

  // v2: combined multi-item entries (expenses only)
  const [multi, setMulti] = useState(!!initial?.items?.length);
  const [items, setItems] = useState(initial?.items?.length ? initial.items.map((i) => ({ ...i })) : [{ id: uid(), note: "", amount: "" }]);

  // v2: payment modes. [] = not set (how all v1 transactions look).
  const [payments, setPayments] = useState(initial?.payments?.length ? initial.payments.map((p) => ({ ...p })) : []);
  const [receiver, setReceiver] = useState(initial?.receiver || "");

  const isMulti = multi && type === "expense";
  const effAmount = isMulti ? items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) : parseFloat(amount) || 0;

  const repayActive = type === "expense" && tags.some((tg) => tagConfig[tg]?.repay);
  const invoiceActive = type !== "transfer" && tags.some((tg) => tagConfig[tg]?.invoice);
  const proofActive = type !== "transfer" && tags.some((tg) => tagConfig[tg]?.proof);
  const receiverActive = type !== "transfer" && tags.some((tg) => tagConfig[tg]?.receiver);
  const paymentsApply = type !== "transfer"; // modes are for income & expenses only

  // keep a single-mode payment amount pinned to the (possibly changing) total
  const syncedPayments = payments.length === 1 ? [{ ...payments[0], amount: effAmount }] : payments;
  const paySum = paymentsSum(syncedPayments);
  const payOk = payments.length === 0 || Math.abs(paySum - effAmount) < 0.005;

  const addTag = (raw) => {
    const clean = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
    setTagInput("");
  };
  const suggestions = allTags.filter((tg) => !tags.includes(tg) && tg.includes(tagInput.toLowerCase())).slice(0, 8);

  // compress (optional) then upload to Drive, store only the file id.
  // Shared by invoices and payment proofs — same folder, same mechanics.
  const pickAttachment = (kind) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    try {
      let blob = file;
      if (compress && file.type.startsWith("image/")) blob = await compressImage(file);
      const driveId = await uploadReceipt(blob, file.name);
      if (kind === "invoice") setInvoice({ driveId, name: file.name });
      else setProof({ driveId, name: file.name });
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(null);
    }
  };
  const removeAttachment = (kind) => () => {
    const target = kind === "invoice" ? invoice : proof;
    if (target?.driveId) deleteReceipt(target.driveId); // fire and forget
    kind === "invoice" ? setInvoice(null) : setProof(null);
  };

  const submit = () => {
    if (!effAmount || effAmount <= 0 || (paymentsApply && !payOk)) return;
    const owedVal = repayActive ? (owed === "" ? effAmount : Math.min(parseFloat(owed) || 0, effAmount)) : 0;
    onSave({
      id: initial?.id || uid(),
      type, amount: effAmount, account,
      toAccount: type === "transfer" ? toAccount : undefined,
      group: type === "transfer" ? null : group,
      note, tags, date,
      owed: owedVal,
      invoice,
      proof: proofActive ? proof : (initial?.proof || null),
      receiver: receiverActive && receiver.trim() ? receiver.trim() : null,
      payments: paymentsApply && syncedPayments.length ? syncedPayments.map((p) => ({ ...p, amount: parseFloat(p.amount) || 0 })) : null,
      items: isMulti ? items.filter((i) => parseFloat(i.amount)).map((i) => ({ id: i.id || uid(), note: i.note || "", amount: parseFloat(i.amount) })) : null,
      repayments: initial?.repayments || [],
      source: initial?.source || "manual",
    });
  };

  // ghost tags get a dashed pill so you can tell they're invisible elsewhere
  const tagPillStyle = (tg) => {
    const ghost = isGhost(tg, tagConfig);
    const highlighted = tagConfig[tg]?.repay || tagConfig[tg]?.receiver || tagConfig[tg]?.proof || tagConfig[tg]?.invoice;
    return {
      ...pill(t), display: "flex", gap: 6, alignItems: "center",
      background: ghost ? "transparent" : highlighted ? t.accent + "22" : t.pill,
      color: ghost ? t.dim : highlighted ? t.accent : t.dim,
      border: ghost ? `1px dashed ${t.dim}` : "1px solid transparent",
    };
  };

  return (
    <Modal t={t} onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{initial ? "Edit" : "New"} transaction</div>
      <Seg t={t} options={["expense", "income", "transfer"]} value={type} onChange={setType} full />

      {type === "expense" && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 2px 0", fontSize: 13.5, color: t.dim, cursor: "pointer" }}>
          <Toggle t={t} on={multi} onClick={() => setMulti(!multi)} />
          Multiple items
        </label>
      )}

      {isMulti ? (
        <div style={{ margin: "12px 0 14px", padding: 12, borderRadius: 12, background: t.accent + "11", border: `1px solid ${t.accent}44` }}>
          <label style={lbl(t)}>Items in this entry</label>
          {items.map((i) => (
            <div key={i.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={i.note} onChange={(e) => setItems(items.map((x) => x.id === i.id ? { ...x, note: e.target.value } : x))} placeholder="e.g. Auto ride" style={{ ...inp(t), flex: 1 }} />
              <input type="number" inputMode="decimal" value={i.amount} onChange={(e) => setItems(items.map((x) => x.id === i.id ? { ...x, amount: e.target.value } : x))} placeholder="0" style={{ ...inp(t), width: 100, flex: "none" }} />
              {items.length > 1 && <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55", padding: "6px 10px" }} onClick={() => setItems(items.filter((x) => x.id !== i.id))}>×</button>}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <button style={miniBtn(t)} onClick={() => setItems([...items, { id: uid(), note: "", amount: "" }])}>+ add item</button>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Total −{fmt(effAmount)}</span>
          </div>
        </div>
      ) : (
        <input autoFocus type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
          style={{ ...inp(t), fontSize: 30, fontWeight: 700, textAlign: "center", margin: "14px 0", padding: 14 }} />
      )}

      <label style={lbl(t)}>{type === "transfer" ? "From account" : "Account"}</label>
      <select value={account} onChange={(e) => setAccount(e.target.value)} style={{ ...sel(t), width: "100%", marginBottom: 12 }}>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      {type === "transfer" ? (
        <>
          <label style={lbl(t)}>To account</label>
          <select value={toAccount} onChange={(e) => setToAccount(e.target.value)} style={{ ...sel(t), width: "100%", marginBottom: 12 }}>
            {accounts.filter((a) => a.id !== account).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </>
      ) : (
        <>
          <label style={lbl(t)}>Group <span style={{ color: t.dim }}>(optional)</span></label>
          <select value={group ?? ""} onChange={(e) => setGroup(e.target.value || null)} style={{ ...sel(t), width: "100%", marginBottom: 12 }}>
            <option value="">— None —</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </>
      )}

      {/* v2: payment mode + splits (income & expenses only, never transfers) */}
      {paymentsApply && (
        <div style={{ marginBottom: 14 }}>
          <label style={lbl(t)}>Paid via <span style={{ color: t.dim }}>(optional — tap again to unset)</span></label>
          {payments.length <= 1 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {MODES.map((m) => {
                const on = payments[0]?.mode === m;
                return (
                  <button key={m} onClick={() => setPayments(on ? [] : [{ id: payments[0]?.id || uid(), mode: m, amount: effAmount }])}
                    style={{ ...pill(t), cursor: "pointer", fontSize: 13, padding: "7px 13px", textTransform: "capitalize", background: on ? t.accent : t.card, color: on ? "#fff" : t.text, border: `1px solid ${on ? t.accent : t.line}` }}>
                    {m}
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              {payments.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select value={p.mode} onChange={(e) => setPayments(payments.map((x) => x.id === p.id ? { ...x, mode: e.target.value } : x))} style={{ ...sel(t), flex: 1, textTransform: "capitalize" }}>
                    {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input type="number" inputMode="decimal" value={p.amount} onChange={(e) => setPayments(payments.map((x) => x.id === p.id ? { ...x, amount: e.target.value } : x))}
                    placeholder="0 (− allowed)" style={{ ...inp(t), width: 118, flex: "none" }} />
                  <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55", padding: "6px 10px" }} onClick={() => setPayments(payments.filter((x) => x.id !== p.id))}>×</button>
                </div>
              ))}
              <div style={{ fontSize: 12.5, color: payOk ? t.green : t.red }}>
                {payOk ? `✓ splits add up to ${fmt(effAmount)}` : `splits total ${paySum < 0 ? "−" : ""}${fmt(paySum)} — need ${fmt(effAmount)} (off by ${fmt(Math.abs(effAmount - paySum))})`}
              </div>
            </div>
          )}
          <button style={{ ...miniBtn(t), marginTop: 8 }} onClick={() => {
            const remainder = +(effAmount - paySum).toFixed(2);
            const nextMode = MODES.find((m) => !payments.some((p) => p.mode === m)) || "cash";
            setPayments(payments.length === 0
              ? [{ id: uid(), mode: "cash", amount: effAmount }]
              : [...syncedPayments.map((p) => ({ ...p })), { id: uid(), mode: nextMode, amount: remainder || "" }]);
          }}>+ split payment</button>
          {payments.length > 1 && <span style={{ fontSize: 12, color: t.dim, marginLeft: 10 }}>negative amounts OK (e.g. cashback)</span>}
        </div>
      )}

      <label style={lbl(t)}>Note</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isMulti ? "e.g. Saket day out" : "e.g. Lunch at work"} style={{ ...inp(t), marginBottom: 12 }} />

      <label style={lbl(t)}>Tags {tags.some((tg) => isGhost(tg, tagConfig)) && <span style={{ color: t.dim }}>(dashed = ghost, visible only here)</span>}</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {tags.map((tg) => (
          <span key={tg} style={tagPillStyle(tg)}>
            {isGhost(tg, tagConfig) && <span style={{ fontSize: 10 }}>◌</span>}{tg}
            <span style={{ cursor: "pointer" }} onClick={() => setTags(tags.filter((x) => x !== tg))}>×</span>
          </span>
        ))}
      </div>
      <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
        placeholder="type a tag, press Enter" style={{ ...inp(t), marginBottom: suggestions.length ? 6 : 12 }} />
      {suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, maxHeight: 90, overflowY: "auto" }}>
          {suggestions.map((tg) => <span key={tg} style={{ ...pill(t), cursor: "pointer", opacity: 0.8, ...(isGhost(tg, tagConfig) ? { background: "transparent", border: `1px dashed ${t.dim}` } : {}) }} onClick={() => addTag(tg)}>+ {tg}</span>)}
        </div>
      )}

      {receiverActive && (
        <div style={{ padding: 12, borderRadius: 12, background: t.accent + "11", border: `1px solid ${t.accent}44`, marginBottom: 14 }}>
          <label style={lbl(t)}>Receiver — who was this for?</label>
          <input value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="e.g. Arjun" style={inp(t)} />
        </div>
      )}

      {repayActive && (
        <div style={{ padding: 12, borderRadius: 12, background: t.accent + "11", border: `1px solid ${t.accent}44`, marginBottom: 14 }}>
          <label style={lbl(t)}>Amount owed back to you</label>
          <input type="number" inputMode="decimal" value={owed} onChange={(e) => setOwed(e.target.value)}
            placeholder={`full (${effAmount ? fmt(effAmount) : "₹0"}) by default`} style={inp(t)} />
          <div style={{ fontSize: 12, color: t.dim, marginTop: 6 }}>
            Split bill? Enter what others owe you — e.g. you paid 1500, two friends owe 500 each → enter 1000.
          </div>
        </div>
      )}

      {invoiceActive && (
        <Attachment t={t} label="Invoice / receipt" icon="📎" value={invoice} uploading={uploading === "invoice"}
          onPick={pickAttachment("invoice")} onRemove={removeAttachment("invoice")}
          compress={compress} setCompress={setCompress} showCompress />
      )}

      {/* v2: payment proof — same mechanics as invoices, separate attachment */}
      {proofActive && (
        <Attachment t={t} label="Payment proof" icon="🧾" value={proof} uploading={uploading === "proof"}
          onPick={pickAttachment("proof")} onRemove={removeAttachment("proof")}
          compress={compress} setCompress={setCompress} showCompress={!invoiceActive} />
      )}

      <label style={lbl(t)}>Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inp(t), marginBottom: 18 }} />

      <button style={{ ...primaryBtn(t), width: "100%", opacity: effAmount > 0 && payOk ? 1 : 0.5 }} onClick={submit}>{initial ? "Save changes" : "Add"}</button>
      <button style={{ ...secondaryBtn(t), width: "100%", marginTop: 8 }} onClick={onClose}>Cancel</button>
    </Modal>
  );
}

// shared attach-image block for invoices and payment proofs
function Attachment({ t, label, icon, value, uploading, onPick, onRemove, compress, setCompress, showCompress }) {
  return (
    <>
      <label style={lbl(t)}>{label} <span style={{ color: t.dim }}>(optional)</span></label>
      {value ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 11, border: `1px solid ${t.line}`, background: t.card, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.name}</span>
          <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55" }} onClick={onRemove}>Remove</button>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...secondaryBtn(t), display: "inline-block", cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.6 : 1 }}>
            {uploading ? "Uploading…" : `${icon} Attach image`}
            <input type="file" accept="image/*" disabled={uploading} onChange={onPick} style={{ display: "none" }} />
          </label>
          {showCompress && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: t.dim, cursor: "pointer" }}>
              <Toggle t={t} on={compress} onClick={() => setCompress(!compress)} />
              Compress before upload (smaller file)
            </label>
          )}
        </div>
      )}
    </>
  );
}

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b || file), "image/jpeg", 0.8);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

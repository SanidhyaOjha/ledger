import React, { useState } from "react";
import { Modal, Seg, Toggle, pill, inp, sel, lbl, primaryBtn, secondaryBtn, miniBtn } from "../lib/ui.jsx";
import { fmt, todayISO, uid } from "../lib/model";
import { uploadReceipt, deleteReceipt } from "../lib/drive";

export default function TxForm({ t, accounts, groups, allTags, tagConfig, initial, defaultAccount, defaultGroup, onSave, onClose }) {
  const [type, setType] = useState(initial?.type || "expense");
  const [amount, setAmount] = useState(initial?.amount || "");
  const [account, setAccount] = useState(initial?.account || defaultAccount);
  const [toAccount, setToAccount] = useState(initial?.toAccount || accounts.find((a) => a.id !== (initial?.account || defaultAccount))?.id);
  const [group, setGroup] = useState(initial?.group ?? defaultGroup ?? null);
  const [note, setNote] = useState(initial?.note || "");
  const [tags, setTags] = useState(initial?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [date, setDate] = useState(initial?.date || todayISO());
  const [owed, setOwed] = useState(initial?.owed || "");
  const [invoice, setInvoice] = useState(initial?.invoice || null); // { driveId, name }
  const [compress, setCompress] = useState(false);
  const [uploading, setUploading] = useState(false);

  const repayActive = type === "expense" && tags.some((tg) => tagConfig[tg]?.repay);

  const addTag = (raw) => {
    const clean = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
    setTagInput("");
  };
  const suggestions = allTags.filter((tg) => !tags.includes(tg) && tg.includes(tagInput.toLowerCase())).slice(0, 8);

  // compress (optional) then upload to Drive, store only the file id
  const onPickInvoice = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      let blob = file;
      if (compress && file.type.startsWith("image/")) {
        blob = await compressImage(file);
      }
      const driveId = await uploadReceipt(blob, file.name);
      setInvoice({ driveId, name: file.name });
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeInvoice = async () => {
    if (invoice?.driveId) deleteReceipt(invoice.driveId); // fire and forget
    setInvoice(null);
  };

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const owedVal = repayActive ? (owed === "" ? amt : Math.min(parseFloat(owed) || 0, amt)) : 0;
    onSave({
      id: initial?.id || uid(),
      type, amount: amt, account,
      toAccount: type === "transfer" ? toAccount : undefined,
      group: type === "transfer" ? null : group,
      note, tags, date,
      owed: owedVal,
      invoice,
      repayments: initial?.repayments || [],
      source: initial?.source || "manual",
    });
  };

  return (
    <Modal t={t} onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{initial ? "Edit" : "New"} transaction</div>
      <Seg t={t} options={["expense", "income", "transfer"]} value={type} onChange={setType} full />
      <input autoFocus type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
        style={{ ...inp(t), fontSize: 30, fontWeight: 700, textAlign: "center", margin: "14px 0", padding: 14 }} />

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

      <label style={lbl(t)}>Note</label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Lunch at work" style={{ ...inp(t), marginBottom: 12 }} />

      <label style={lbl(t)}>Tags</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {tags.map((tg) => (
          <span key={tg} style={{ ...pill(t), display: "flex", gap: 6, alignItems: "center", background: tagConfig[tg]?.repay ? t.accent + "22" : t.pill, color: tagConfig[tg]?.repay ? t.accent : t.dim }}>
            {tg}<span style={{ cursor: "pointer" }} onClick={() => setTags(tags.filter((x) => x !== tg))}>×</span>
          </span>
        ))}
      </div>
      <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
        placeholder="type a tag, press Enter" style={{ ...inp(t), marginBottom: suggestions.length ? 6 : 12 }} />
      {suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, maxHeight: 90, overflowY: "auto" }}>
          {suggestions.map((tg) => <span key={tg} style={{ ...pill(t), cursor: "pointer", opacity: 0.8 }} onClick={() => addTag(tg)}>+ {tg}</span>)}
        </div>
      )}

      {repayActive && (
        <div style={{ padding: 12, borderRadius: 12, background: t.accent + "11", border: `1px solid ${t.accent}44`, marginBottom: 14 }}>
          <label style={lbl(t)}>Amount owed back to you</label>
          <input type="number" inputMode="decimal" value={owed} onChange={(e) => setOwed(e.target.value)}
            placeholder={`full (${amount ? fmt(parseFloat(amount)) : "₹0"}) by default`} style={inp(t)} />
          <div style={{ fontSize: 12, color: t.dim, marginTop: 6 }}>
            Split bill? Enter what others owe you — e.g. you paid 1500, two friends owe 500 each → enter 1000.
          </div>
        </div>
      )}

      {type !== "transfer" && (
        <>
          <label style={lbl(t)}>Invoice / receipt <span style={{ color: t.dim }}>(optional)</span></label>
          {invoice ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 11, border: `1px solid ${t.line}`, background: t.card, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>📎</span>
              <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{invoice.name}</span>
              <button style={{ ...miniBtn(t), color: t.red, borderColor: t.red + "55" }} onClick={removeInvoice}>Remove</button>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label style={{ ...secondaryBtn(t), display: "inline-block", cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.6 : 1 }}>
                {uploading ? "Uploading…" : "📎 Attach image"}
                <input type="file" accept="image/*" disabled={uploading} onChange={onPickInvoice} style={{ display: "none" }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: t.dim, cursor: "pointer" }}>
                <Toggle t={t} on={compress} onClick={() => setCompress(!compress)} />
                Compress before upload (smaller file)
              </label>
            </div>
          )}
        </>
      )}

      <label style={lbl(t)}>Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inp(t), marginBottom: 18 }} />

      <button style={{ ...primaryBtn(t), width: "100%" }} onClick={submit}>{initial ? "Save changes" : "Add"}</button>
      <button style={{ ...secondaryBtn(t), width: "100%", marginTop: 8 }} onClick={onClose}>Cancel</button>
    </Modal>
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

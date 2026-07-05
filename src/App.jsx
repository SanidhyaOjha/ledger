import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { theme, styles, primaryBtn, secondaryBtn } from "./lib/ui.jsx";
import { emptyState, uid, todayISO, migrateLedger, EXTERNAL_ACCOUNT } from "./lib/model";
import { GOOGLE_CLIENT_ID } from "./lib/config";
import * as drive from "./lib/drive";
import PinGate from "./components/PinGate.jsx";
import TxForm from "./components/TxForm.jsx";
import { Home, Analyze, Owed, Settings, InvoiceViewer } from "./components/Views.jsx";

const clientIdMissing = !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith("PASTE_");

export default function App() {
  const [dark, setDark] = useState(true);
  const t = theme(dark);

  const [unlocked, setUnlocked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncState, setSyncState] = useState("idle"); // idle | saving | saved | error

  // data
  const [data, setData] = useState(null); // { accounts, groups, tagConfig, tx }
  const [driveEmail, setDriveEmail] = useState(null);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [view, setView] = useState("home");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formGroup, setFormGroup] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  // shared post-auth load (used by both explicit and silent sign-in)
  const afterAuth = useCallback(async () => {
    setSignedIn(true);
    setDriveEmail(drive.getDriveEmail());
    let loaded = await drive.loadLedger();
    if (!loaded) { loaded = emptyState(); await drive.saveLedger(loaded); }
    // v2 migration: normalizes containers and bumps version — never rewrites
    // transactions (all new fields are optional). If this is v1 data, write a
    // one-time safety copy (ledger-data-backup-v1.json) to Drive BEFORE the
    // migrated version is ever saved. If the backup fails, we keep running on
    // the migrated data in memory but never persist the version bump.
    const { data: migrated, fromV1 } = migrateLedger(loaded);
    if (fromV1) {
      try { await drive.backupLedgerV1(loaded); await drive.saveLedger(migrated); }
      catch { /* backup failed → don't persist yet; next open retries */ }
    }
    setData(migrated);
    setCurrentAccount(migrated.accounts[0]?.id || null);
  }, []);

  // ── sign in + load ──────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await drive.signIn();
      await afterAuth();
    } catch (e) {
      setError(e.message === "AUTH_EXPIRED" ? "Session expired — sign in again." : ("Couldn't connect: " + e.message));
      setSignedIn(false);
    } finally { setLoading(false); }
  }, [afterAuth]);

  // ── silent re-auth on open ────────────────────────────────────────────────────
  // After the PIN unlocks, try a no-popup token grant. If the user linked Drive
  // in a past session, this connects invisibly — no button press. If Google needs
  // interaction, we silently fall back to showing the "Sign in" button.
  const triedSilent = useRef(false);
  useEffect(() => {
    if (!unlocked || signedIn || triedSilent.current || clientIdMissing) return;
    triedSilent.current = true;
    (async () => {
      setLoading(true);
      try {
        const tok = await drive.trySilentSignIn();
        if (tok) await afterAuth();
      } catch { /* fall back to button */ }
      finally { setLoading(false); }
    })();
  }, [unlocked, signedIn, afterAuth]);

  // ── debounced auto-save to Drive ──────────────────────────────────────────────
  const saveTimer = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (!data || !signedIn) return;
    if (firstRender.current) { firstRender.current = false; return; }
    setSyncState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await drive.saveLedger(data); setSyncState("saved"); setTimeout(() => setSyncState("idle"), 1500); }
      catch (e) { setSyncState("error"); if (e.message === "AUTH_EXPIRED") setSignedIn(false); }
    }, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [data, signedIn]);

  // ── helpers bound to data ─────────────────────────────────────────────────────
  const acct = useCallback((id) => data?.accounts.find((a) => a.id === id), [data]);
  const grp = useCallback((id) => data?.groups.find((g) => g.id === id), [data]);
  const allTags = useMemo(() => data ? [...new Set(data.tx.flatMap((x) => x.tags))].sort() : [], [data]);

  // setters that update slices of data
  const setTx = (updater) => setData((d) => ({ ...d, tx: typeof updater === "function" ? updater(d.tx) : updater }));
  const setAccounts = (updater) => setData((d) => ({ ...d, accounts: typeof updater === "function" ? updater(d.accounts) : updater }));
  const setGroups = (updater) => setData((d) => ({ ...d, groups: typeof updater === "function" ? updater(d.groups) : updater }));
  const setTagConfig = (updater) => setData((d) => ({ ...d, tagConfig: typeof updater === "function" ? updater(d.tagConfig) : updater }));

  const saveTx = (item) => { setTx((prev) => { const ex = prev.find((p) => p.id === item.id); return ex ? prev.map((p) => p.id === item.id ? item : p) : [item, ...prev]; }); setShowForm(false); setEditing(null); setFormGroup(null); };
  const deleteTx = (id) => setTx((prev) => prev.filter((p) => p.id !== id));
  const addRepayment = (id, amount) => setTx((prev) => prev.map((p) => p.id === id ? { ...p, repayments: [...(p.repayments || []), { id: uid(), amount, date: todayISO() }] } : p));
  const removeRepayment = (txId, rId) => setTx((prev) => prev.map((p) => p.id === txId ? { ...p, repayments: p.repayments.filter((r) => r.id !== rId) } : p));

  // old lends: logged straight from the Owed tab, no account/tag setup needed
  // — see EXTERNAL_ACCOUNT in lib/model.js for why this never touches balances.
  const addOldLend = ({ note, amount, date, receivedSoFar }) => setTx((prev) => [{
    id: uid(), type: "expense", amount, account: EXTERNAL_ACCOUNT, toAccount: undefined,
    group: null, note, tags: [], date: date || todayISO(), owed: amount, invoice: null,
    repayments: receivedSoFar > 0 ? [{ id: uid(), amount: receivedSoFar, date: todayISO() }] : [],
    payments: null, items: null, receiver: null, proof: null, source: "manual",
  }, ...prev]);

  const signOut = () => { drive.signOut(); setSignedIn(false); setData(null); };
  const openAdd = (group = null) => { setEditing(null); setFormGroup(group); setShowForm(true); };

  // ── render gates ──────────────────────────────────────────────────────────────
  if (!unlocked) return <div style={{ fontFamily: t.font }}><PinGate t={t} onUnlock={() => setUnlocked(true)} /></div>;

  if (clientIdMissing) {
    return <Centered t={t}>
      <h2 style={{ marginBottom: 12 }}>Almost there</h2>
      <p style={{ color: t.dim, lineHeight: 1.6, fontSize: 15 }}>Your Google Client ID isn't set yet. Open <code style={{ color: t.accent }}>src/lib/config.js</code> and paste it in (SETUP.md, Step 3). Then rebuild.</p>
    </Centered>;
  }

  if (!signedIn) {
    return <Centered t={t}>
      <div style={{ fontSize: 13, letterSpacing: 3, color: t.dim, marginBottom: 10 }}>LEDGER</div>
      <h2 style={{ marginBottom: 10 }}>Connect your Drive</h2>
      <p style={{ color: t.dim, lineHeight: 1.6, fontSize: 15, marginBottom: 24, maxWidth: 320 }}>
        Your data is stored as a single file in your own Google Drive. The app can only see files it creates — never the rest of your Drive.
      </p>
      {error && <div style={{ color: t.red, fontSize: 14, marginBottom: 16 }}>{error}</div>}
      <button style={{ ...primaryBtn(t), opacity: loading ? 0.6 : 1 }} disabled={loading} onClick={connect}>
        {loading ? "Connecting…" : "Sign in with Google"}
      </button>
    </Centered>;
  }

  if (!data) return <Centered t={t}><div style={{ color: t.dim }}>Loading your ledger…</div></Centered>;

  const netWorth = data.accounts.reduce((s, a) => s + (function bal() {
    let b = 0; for (const x of data.tx) {
      if (x.type === "income" && x.account === a.id) b += x.amount;
      if (x.type === "expense" && x.account === a.id) { b -= x.amount; b += (x.repayments || []).reduce((q, r) => q + r.amount, 0); }
      if (x.type === "transfer") { if (x.account === a.id) b -= x.amount; if (x.toAccount === a.id) b += x.amount; }
    } return b;
  })(), 0);

  const titles = { home: "NET WORTH", analyze: "ANALYZE", owed: "OWED TO YOU", settings: "SETTINGS" };

  return (
    <div style={{ ...styles.app, background: t.bg, color: t.text, fontFamily: t.font }}>
      <style>{`* { box-sizing: border-box; } html, body, #root { margin:0; padding:0; min-height:100%; background:${t.bg}; } body { overflow-x:hidden; } ::-webkit-scrollbar{width:7px;height:7px} ::-webkit-scrollbar-thumb{background:${t.line};border-radius:4px} input,select,button{font-family:inherit}`}</style>

      <div style={{ ...styles.header, borderBottom: `1px solid ${t.line}` }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: t.dim }}>{titles[view]}</div>
          {view === "home" && <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{netWorth < 0 ? "−" : ""}₹{Math.abs(netWorth).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SyncDot t={t} state={syncState} />
          <button onClick={() => setDark(!dark)} style={{ ...styles.iconBtn, border: `1px solid ${t.line}`, color: t.text, background: t.card }}>{dark ? "☀" : "☾"}</button>
        </div>
      </div>

      <div style={styles.body}>
        {view === "home" && <Home t={t} accounts={data.accounts} currentAccount={currentAccount} setCurrentAccount={setCurrentAccount} tx={data.tx} acct={acct} grp={grp} tagConfig={data.tagConfig} onEdit={(x) => { setEditing(x); setShowForm(true); }} onDelete={deleteTx} onViewInvoice={setViewingInvoice} />}
        {view === "analyze" && <Analyze t={t} tx={data.tx} acct={acct} grp={grp} accounts={data.accounts} groups={data.groups} tagConfig={data.tagConfig} />}
        {view === "owed" && <Owed t={t} tx={data.tx} acct={acct} tagConfig={data.tagConfig} netWorth={netWorth} onAddRepayment={addRepayment} onRemoveRepayment={removeRepayment} onAddOldLend={addOldLend} onDelete={deleteTx} onEdit={(x) => { setEditing(x); setShowForm(true); }} />}
        {view === "settings" && <Settings t={t} accounts={data.accounts} setAccounts={setAccounts} groups={data.groups} setGroups={setGroups} tx={data.tx} setTx={setTx} allTags={allTags} tagConfig={data.tagConfig} setTagConfig={setTagConfig} currentAccount={currentAccount} setCurrentAccount={setCurrentAccount} onAddToGroup={openAdd} onSignOut={signOut} driveEmail={driveEmail} />}
      </div>

      {showForm && <TxForm t={t} accounts={data.accounts} groups={data.groups} allTags={allTags} tagConfig={data.tagConfig} initial={editing} defaultAccount={currentAccount} defaultGroup={formGroup} onSave={saveTx} onClose={() => { setShowForm(false); setEditing(null); setFormGroup(null); }} />}
      {viewingInvoice && <InvoiceViewer t={t} invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />}

      <button style={{ ...styles.fab, background: t.accent }} onClick={() => openAdd(null)} aria-label="Add">+</button>

      <div style={{ ...styles.nav, background: t.bg, borderTop: `1px solid ${t.line}` }}>
        {[["home", "Home", "▦"], ["analyze", "Analyze", "▤"], ["owed", "Owed", "↩"], ["settings", "Settings", "⚙"]].map(([id, label, icon]) => (
          <button key={id} onClick={() => setView(id)} style={{ flex: 1, border: "none", background: "transparent", color: view === id ? t.accent : t.dim, cursor: "pointer", padding: "10px 0", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>{label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Centered({ t, children }) {
  return <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: t.font, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>{children}</div>;
}

function SyncDot({ t, state }) {
  const map = { idle: [t.dim, ""], saving: [t.amber, "saving"], saved: [t.green, "saved"], error: [t.red, "sync error"] };
  const [c, label] = map[state] || map.idle;
  return <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.dim }}>
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />{label}
  </div>;
}

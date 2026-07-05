// ─────────────────────────────────────────────────────────────────────────────
// drive.js — all Google Drive interaction lives here.
//
// Auth uses Google Identity Services (GIS) token flow, which runs entirely in
// the browser (no server, no client secret). You sign in on Google's own page;
// this code never sees your password. The access token it receives is kept only
// in memory for the session.
//
// v2 change — silent relogin with multiple Google accounts:
//   The old flow used prompt:"none" with no account hint, so when a device has
//   several Google accounts, Google couldn't tell which one to use and the
//   silent grant failed — dropping you to the button, which used
//   prompt:"consent" and forced the account chooser EVERY time.
//   Now: after a successful sign-in we fetch your account email (userinfo
//   scope) and keep it in localStorage as a login hint. Every request — silent
//   or explicit — passes that hint, so Google knows exactly which account and
//   never needs to ask. Explicit sign-in uses prompt:"" (only prompts when
//   Google genuinely needs it, e.g. the very first consent).
// ─────────────────────────────────────────────────────────────────────────────

import { GOOGLE_CLIENT_ID, AUTH_SCOPES, LEDGER_FILENAME, RECEIPTS_FOLDER, BACKUP_FILENAME } from "./config";

let accessToken = null;
let tokenClient = null;
let ledgerFileId = null;     // cached id of ledger-data.json once found/created
let receiptsFolderId = null; // cached id of the receipts folder

// We never store the access token on disk (that would be a security risk). We
// only store: a harmless boolean ("this user has linked Drive before") and the
// account email used purely as a login hint for silent re-auth.
const CONNECTED_FLAG = "ledger_drive_connected";
const HINT_KEY = "ledger_drive_hint";

export function getDriveEmail() { return localStorage.getItem(HINT_KEY) || null; }

// Load the GIS script once.
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(s);
  });
}

// After getting a token, remember which account it belongs to (login hint).
// Failure here is non-fatal — the app works, silent relogin just stays flaky
// until a fetch succeeds.
async function rememberAccountEmail() {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const { email } = await res.json();
    if (email) localStorage.setItem(HINT_KEY, email);
  } catch { /* ignore */ }
}

export async function signIn() {
  await loadGis();
  return new Promise((resolve, reject) => {
    const hint = getDriveEmail();
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: AUTH_SCOPES,
      ...(hint ? { hint } : {}),
      callback: async (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        localStorage.setItem(CONNECTED_FLAG, "1"); // remember the user has linked Drive
        await rememberAccountEmail();              // remember WHICH account, for next time
        resolve(accessToken);
      },
    });
    // prompt:"" → Google only shows UI when it must (first consent, revoked
    // access). With a hint present, repeat sign-ins skip the account chooser.
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

// Attempt a SILENT token grant — no popup, no consent screen. Works only if the
// user has already granted access in a prior session. The stored email hint is
// what lets this succeed on devices with multiple Google accounts.
export function trySilentSignIn() {
  if (localStorage.getItem(CONNECTED_FLAG) !== "1") return Promise.resolve(null);
  return loadGis().then(() => new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const hint = getDriveEmail();
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: AUTH_SCOPES,
      ...(hint ? { hint } : {}),
      callback: (resp) => {
        if (resp.error || !resp.access_token) return done(null);
        accessToken = resp.access_token;
        if (!hint) rememberAccountEmail(); // backfill hint for pre-v2 sessions
        done(accessToken);
      },
      error_callback: () => done(null), // e.g. consent needed, popup blocked
    });
    try { tokenClient.requestAccessToken({ prompt: "none", ...(hint ? { hint } : {}) }); } catch { done(null); }
    setTimeout(() => done(null), 4000); // safety: don't hang the app on open
  }));
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null; ledgerFileId = null; receiptsFolderId = null;
  localStorage.removeItem(CONNECTED_FLAG); // explicit logout → require button next time
  localStorage.removeItem(HINT_KEY);       // and forget the account hint
}

export function isSignedIn() { return !!accessToken; }

// ── low-level authed fetch ────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`https://www.googleapis.com/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${accessToken}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) throw new Error("AUTH_EXPIRED");
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res;
}

// ── generic JSON file helpers ─────────────────────────────────────────────────
async function findFileIdByName(name) {
  const q = encodeURIComponent(`name='${name}' and trashed=false`);
  const res = await api(`drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`);
  const { files } = await res.json();
  return files.length ? files[0].id : null;
}

async function createJsonFile(name, body) {
  const boundary = "ledger" + Math.random().toString(36).slice(2);
  const metadata = { name, mimeType: "application/json" };
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    `${body}\r\n--${boundary}--`;
  const res = await api(`upload/drive/v3/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  return (await res.json()).id;
}

// ── ledger file ───────────────────────────────────────────────────────────────
async function findLedgerFileId() {
  if (ledgerFileId) return ledgerFileId;
  ledgerFileId = await findFileIdByName(LEDGER_FILENAME);
  return ledgerFileId;
}

export async function loadLedger() {
  const id = await findLedgerFileId();
  if (!id) return null; // no file yet → first run
  const res = await api(`drive/v3/files/${id}?alt=media`);
  return res.json();
}

export async function saveLedger(data) {
  const body = JSON.stringify(data);
  const id = await findLedgerFileId();
  if (id) {
    await api(`upload/drive/v3/files/${id}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } else {
    ledgerFileId = await createJsonFile(LEDGER_FILENAME, body);
  }
  return true;
}

// One-time v1 safety copy. Never overwrites: if the backup already exists in
// your Drive, this is a no-op. Returns true when a backup exists (old or new).
export async function backupLedgerV1(data) {
  const existing = await findFileIdByName(BACKUP_FILENAME);
  if (existing) return true;
  await createJsonFile(BACKUP_FILENAME, JSON.stringify(data));
  return true;
}

// ── receipts (used for both invoices and payment proofs) ─────────────────────
async function getReceiptsFolderId() {
  if (receiptsFolderId) return receiptsFolderId;
  const q = encodeURIComponent(`name='${RECEIPTS_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await api(`drive/v3/files?q=${q}&fields=files(id)`);
  const { files } = await res.json();
  if (files.length) { receiptsFolderId = files[0].id; return receiptsFolderId; }
  // create it
  const create = await api(`drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: RECEIPTS_FOLDER, mimeType: "application/vnd.google-apps.folder" }),
  });
  receiptsFolderId = (await create.json()).id;
  return receiptsFolderId;
}

export async function uploadReceipt(blob, filename) {
  const folderId = await getReceiptsFolderId();
  const boundary = "rcpt" + Math.random().toString(36).slice(2);
  const metadata = { name: filename || `receipt-${Date.now()}.jpg`, parents: [folderId] };
  const meta = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const head = `--${boundary}\r\nContent-Type: ${blob.type || "image/jpeg"}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = new Blob([meta, head, blob, tail], { type: `multipart/related; boundary=${boundary}` });
  const res = await api(`upload/drive/v3/files?uploadType=multipart&fields=id`, {
    method: "POST",
    body,
  });
  return (await res.json()).id; // store this id on the transaction
}

// Fetch a receipt's bytes (authed) and return a local object URL for <img src>.
export async function receiptUrl(fileId) {
  const res = await api(`drive/v3/files/${fileId}?alt=media`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function deleteReceipt(fileId) {
  try { await api(`drive/v3/files/${fileId}`, { method: "DELETE" }); } catch { /* ignore */ }
}

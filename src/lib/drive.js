// ─────────────────────────────────────────────────────────────────────────────
// drive.js — all Google Drive interaction lives here.
//
// Auth uses Google Identity Services (GIS) token flow, which runs entirely in
// the browser (no server, no client secret). You sign in on Google's own page;
// this code never sees your password. The access token it receives is kept only
// in memory for the session.
//
// What this module does:
//   • signIn()            → prompt Google sign-in, get an access token
//   • loadLedger()        → find/read ledger-data.json from your Drive
//   • saveLedger(data)    → write ledger-data.json back (debounced by caller)
//   • uploadReceipt(blob) → put an image in LedgerReceipts/, return its file id
//   • receiptUrl(id)      → a URL the <img> can load (auth'd fetch → object URL)
// ─────────────────────────────────────────────────────────────────────────────

import { GOOGLE_CLIENT_ID, DRIVE_SCOPE, LEDGER_FILENAME, RECEIPTS_FOLDER } from "./config";

let accessToken = null;
let tokenClient = null;
let ledgerFileId = null;     // cached id of ledger-data.json once found/created
let receiptsFolderId = null; // cached id of the receipts folder

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

export async function signIn() {
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        resolve(accessToken);
      },
    });
    tokenClient.requestAccessToken({ prompt: "" }); // "" = silent if already granted
  });
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null; ledgerFileId = null; receiptsFolderId = null;
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

// ── ledger file ───────────────────────────────────────────────────────────────
async function findLedgerFileId() {
  if (ledgerFileId) return ledgerFileId;
  const q = encodeURIComponent(`name='${LEDGER_FILENAME}' and trashed=false`);
  const res = await api(`drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`);
  const { files } = await res.json();
  if (files.length) ledgerFileId = files[0].id;
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
    // update existing
    await api(`upload/drive/v3/files/${id}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } else {
    // create new with multipart (metadata + content)
    const boundary = "ledger" + Math.random().toString(36).slice(2);
    const metadata = { name: LEDGER_FILENAME, mimeType: "application/json" };
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
    ledgerFileId = (await res.json()).id;
  }
  return true;
}

// ── receipts ──────────────────────────────────────────────────────────────────
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
  // build multipart body with a binary part
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

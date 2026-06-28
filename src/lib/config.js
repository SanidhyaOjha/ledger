// ─────────────────────────────────────────────────────────────────────────────
// THE ONE THING YOU MUST EDIT.
//
// Paste your Google OAuth Client ID below (SETUP.md, Step 3 explains how to get
// it). It looks like:  1234567890-abc123def456.apps.googleusercontent.com
//
// Nothing else here is secret. This ID is safe to commit publicly — it only
// identifies your app to Google; it does NOT grant access to anything by itself.
// Access only happens when YOU click "Sign in with Google" and approve.
// ─────────────────────────────────────────────────────────────────────────────

export const GOOGLE_CLIENT_ID = "PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com";

// Minimal scope: the app can ONLY see files it creates itself — never the rest
// of your Drive. This is the most restrictive Drive scope Google offers.
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// File + folder names the app creates in your Drive.
export const LEDGER_FILENAME = "ledger-data.json";
export const RECEIPTS_FOLDER = "LedgerReceipts";

// The 4-digit PIN gate is stored locally (hashed) on first run; see lib/pin.js.

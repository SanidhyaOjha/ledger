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

export const GOOGLE_CLIENT_ID =
  "644679919884-9fqid9u6e4r2mdf41vnl523kfckhud47.apps.googleusercontent.com";

// Minimal scope: the app can ONLY see files it creates itself — never the rest
// of your Drive. This is the most restrictive Drive scope Google offers.
// v2 adds the email scope so we can remember WHICH Google account you used —
// that stored email is what makes silent relogin work when your device has
// multiple Google accounts (it's passed as a login hint, nothing more).
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const AUTH_SCOPES =
  DRIVE_SCOPE + " https://www.googleapis.com/auth/userinfo.email";

// One-time safety copy of your v1 data, written before the first v2 save.
export const BACKUP_FILENAME = "ledger-data-backup-v1.json";

// File + folder names the app creates in your Drive.
export const LEDGER_FILENAME = "ledger-data.json";
export const RECEIPTS_FOLDER = "LedgerReceipts";

// The 4-digit PIN gate is stored locally (hashed) on first run; see lib/pin.js.

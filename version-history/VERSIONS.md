# Ledger — Version History

Ledger is a self-hosted personal finance tracker. It runs entirely in the
browser (Vite + React on GitHub Pages) with no backend — all data lives in a
single JSON file in the owner's own Google Drive.

---

## v2 — July 2026

**Data schema:** `version: 2`. Fully backward compatible with v1 — every new
field is additive and optional, and no existing transaction is rewritten on
upgrade. Before the first v2 save, the app writes a one-time safety copy of the
v1 data to Drive as `ledger-data-backup-v1.json`.

### New features

- **Payment modes** — income and expenses can record how they were paid:
  cash, UPI, debit card, credit card, or NEFT. Shown as muted text on
  transaction rows. Transfers don't carry a mode. Older entries simply show no
  mode until edited.
- **Split payments** — one transaction can be paid through multiple modes
  (e.g. ₹300 cash + ₹50 UPI). Negative amounts are supported for cases like
  card cashback, with live validation that the splits sum to the total.
- **Combined multi-item entries** — a single expense can contain a list of
  items (e.g. a day out: auto ₹120, lunch ₹400, snacks ₹80) that appears as
  one row for the entry total and expands on tap to show the items. Tags,
  payment split, and repayment tracking apply to the entry as a whole.
- **Receiver tagging** *(tag feature)* — tags can enable a Receiver field
  recording who the money was for; the name shows in light grey next to the
  note.
- **Payment proof tracking** *(tag feature)* — same mechanics as invoice
  attachment: tags can enable attaching a payment-proof image, stored in
  Drive. A transaction can carry both an invoice and a proof.
- **Ghost tags** *(tag feature)* — tags that stay attached to transactions and
  keep powering any other features enabled on them, but are hidden on Home, in
  Analyze (including tag slicing), and in PDF exports. Visible only in the
  add/edit form. Features stack, so one tag can be e.g. ghost + proof.

### Improvements & fixes

- **Silent relogin fixed for devices with multiple Google accounts** — the app
  now remembers which Google account it's linked to and passes it as a login
  hint, so re-authentication is truly silent instead of showing the account
  chooser on every open. Settings shows the connected account's email.
- **Home list is date-sorted** — transactions display newest-first by date
  rather than in the order they were added.
- **Analyze can filter by payment mode** — a new dropdown alongside account,
  group, and type filters, including a "No mode set" option that surfaces
  pre-v2 entries. When filtering by a specific mode, split payments count only
  that mode's share of the amount.
- **PDF statements** gained a payment-mode column (shown only when mode data
  exists), list the items of combined entries, and include receiver names.

---

## v1 — Initial release

The complete foundation, still the core of the app today.

### Core

- **Transactions** — expenses, income, and transfers between accounts, each
  with amount, note, date, account, optional group, and free-form tags.
- **Multiple accounts** with per-account balances; transfers move money
  between them.
- **Groups** — long-running buckets (a trip, a project) that transactions can
  belong to, with per-group filtering and bulk add.
- **Tags** — lightweight labels with autocomplete, used for slicing and for
  enabling tag features.

### Tag features (configurable in Settings, per tag)

- **Repayment tracking** — expenses with an enabled tag record how much is
  owed back, log partial repayments, and appear in the Owed tab until settled.
- **Invoice attachment** — transactions with an enabled tag can attach a
  receipt/invoice image (with optional compression), stored in a dedicated
  Drive folder.

### Analysis & export

- **Analyze tab** — filter by account, group, transaction type, date range,
  and tag combinations (AND/OR), with income/spend/net totals.
- **PDF statements** — export any filtered view as a lean PDF, including
  owed/repaid columns when relevant.

### Platform & security

- **No backend** — static site on GitHub Pages; all data in a single
  `ledger-data.json` in the owner's Google Drive using the most restrictive
  `drive.file` scope (the app can only ever see files it created itself).
- **Google sign-in** via Google Identity Services token flow, entirely
  in-browser, with silent re-auth on return visits.
- **PIN gate** on every open for on-device privacy.
- **Cross-device** — works on mobile and desktop, syncing through the same
  Drive file.

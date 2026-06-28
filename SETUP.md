# Ledger — Setup & Deploy Guide

This walks you from zero to a working app on your phone and laptop, synced through
your own Google Drive. Budget ~30 minutes, mostly the one-time Google setup.

You'll do four things:
1. Put the code on GitHub
2. Create a Google OAuth Client ID (the tedious-but-one-time part)
3. Paste that ID into the code
4. Deploy to GitHub Pages and add it to your home screen

Nothing here costs money. You never type your Google password into the app.

---

## Before you start

Install **Node.js** (v18+) if you don't have it: https://nodejs.org (LTS version).
Check it works — open a terminal and run:

```
node -v
npm -v
```

You should already have a GitHub account (you've used Pages before for CAIC-Calendar).

---

## Step 1 — Get the code onto GitHub

1. Create a new repository on GitHub. **Name it `ledger`** (lowercase). Keep it
   Public — that's fine, there are no secrets in this code. Don't add a README.

2. In your terminal, go into the project folder (the one with `package.json`) and run:

```
git init
git add .
git commit -m "Ledger app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ledger.git
git push -u origin main
```

Replace `YOUR_USERNAME`. If you named the repo something other than `ledger`,
see the note at the very bottom — you'll need to change one line.

---

## Step 2 — Create your Google OAuth Client ID

This tells Google "this app is allowed to ask me for Drive access." It's clicky
but you only do it once.

### 2a. Create a project
1. Go to https://console.cloud.google.com
2. Top bar, click the project dropdown → **New Project**. Name it `Ledger`. Create.
3. Make sure that new project is selected (top bar shows "Ledger").

### 2b. Enable the Drive API
1. Left menu (☰) → **APIs & Services → Library**.
2. Search **Google Drive API**, click it, click **Enable**.

### 2c. Configure the consent screen
1. **APIs & Services → OAuth consent screen**.
2. User Type: **External** → Create.
3. Fill the required fields:
   - App name: `Ledger`
   - User support email: your email
   - Developer contact email: your email
   - Leave everything else blank. **Save and Continue**.
4. **Scopes** screen: just **Save and Continue** (we request the scope from code).
5. **Test users** screen: click **Add Users**, add your own Google email.
   **Save and Continue**. (This matters — see note in 2e.)
6. Back to dashboard.

### 2d. Create the OAuth Client ID
1. **APIs & Services → Credentials**.
2. **+ Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Ledger Web`.
5. Under **Authorized JavaScript origins**, click **Add URI** and add BOTH:
   - `http://localhost:5173`  (for testing on your laptop)
   - `https://YOUR_USERNAME.github.io`  (your live app — use your real username)
6. You can leave "Authorized redirect URIs" empty (this app uses the token flow,
   not redirects).
7. **Create**. A box pops up with your **Client ID**. Copy it. It looks like:
   `1234567890-abcdef.apps.googleusercontent.com`

### 2e. A note on "unverified app"
Because this is your personal app, Google will show a "Google hasn't verified
this app" screen the first time you sign in. That's expected for personal use.
Click **Advanced → Go to Ledger (unsafe)**. It's your own app; it's safe. Adding
yourself as a Test User in step 2c is what makes this work without a formal review.

---

## Step 3 — Paste the Client ID into the code

Open `src/lib/config.js`. Replace the placeholder:

```js
export const GOOGLE_CLIENT_ID = "PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com";
```

with your real ID:

```js
export const GOOGLE_CLIENT_ID = "1234567890-abcdef.apps.googleusercontent.com";
```

Save.

### Test it locally first (optional but smart)
```
npm install
npm run dev
```
Open the printed `http://localhost:5173/ledger/` link. Set a PIN, click
"Sign in with Google", approve. Add a transaction — reload the page — it should
still be there (it's in your Drive now). If that works, you're golden.

---

## Step 4 — Deploy to GitHub Pages

1. Commit the config change:
```
git add .
git commit -m "Add client id"
git push
```

2. Deploy:
```
npm run deploy
```
This builds the app and pushes it to a `gh-pages` branch automatically.

3. Turn on Pages: on GitHub, your repo → **Settings → Pages**. Under "Build and
   deployment", Source = **Deploy from a branch**, Branch = **gh-pages** / `(root)`.
   Save. Wait ~1 minute.

4. Your app is live at: `https://YOUR_USERNAME.github.io/ledger/`

---

## Step 5 — Add it to your home screen

**iPhone (Safari):** open the live URL → Share button → **Add to Home Screen**.
**Android (Chrome):** open the URL → menu (⋮) → **Install app** / **Add to Home screen**.

It now opens full-screen like a normal app. Do this on both phone and laptop;
they share the same data through your Drive automatically.

---

## Everyday use

- Just open the app. Changes save to Drive automatically (watch the little dot
  near the top — amber = saving, green = saved).
- Edit on your laptop, open your phone later, it's there. (Avoid editing on both
  at the exact same moment — last save wins.)
- Your data is one file in your Drive: `ledger-data.json`. Receipts live in a
  `LedgerReceipts` folder. You can download or back these up anytime.

---

## Making changes later

Edit code → `git add . && git commit -m "…" && git push` → `npm run deploy`.
The live app updates in about a minute.

---

## If you named your repo something other than `ledger`

Two places must match your repo name:
1. `vite.config.js` → `base: "/your-repo-name/"`
2. The home-screen URL becomes `https://YOUR_USERNAME.github.io/your-repo-name/`

That's it. Enjoy your ledger.

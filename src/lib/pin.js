// pin.js — local 4-digit gate. Stored as a SHA-256 hash in localStorage so the
// raw PIN is never persisted. This guards the app on a shared device; it is not
// bank-grade security (your real protection is your Google account + device lock).

const KEY = "ledger_pin_hash";

async function hash(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hasPin() { return !!localStorage.getItem(KEY); }

export async function setPin(pin) { localStorage.setItem(KEY, await hash(pin)); }

export async function checkPin(pin) { return localStorage.getItem(KEY) === (await hash(pin)); }

export function clearPin() { localStorage.removeItem(KEY); }

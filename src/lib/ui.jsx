// ui.js — theme palettes and small style helpers shared by all components.

export function theme(dark) {
  return dark
    ? { bg: "#0e0f13", card: "#1a1c22", text: "#f0f1f4", dim: "#8a8d96", line: "#2a2d35", hover: "#1a1c22", pill: "#23262e", accent: "#6366f1", green: "#34d399", red: "#f87171", amber: "#fbbf24", font: "system-ui, -apple-system, sans-serif" }
    : { bg: "#faf9f7", card: "#ffffff", text: "#1a1c22", dim: "#7a7d86", line: "#e6e4df", hover: "#f3f1ee", pill: "#f0eeea", accent: "#6366f1", green: "#059669", red: "#dc2626", amber: "#d97706", font: "system-ui, -apple-system, sans-serif" };
}

export const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#8b5cf6", "#14b8a6"];

export const pill = (t) => ({ fontSize: 12, padding: "3px 9px", borderRadius: 8, background: t.pill, color: t.dim, whiteSpace: "nowrap" });
export const miniBtn = (t) => ({ padding: "6px 12px", borderRadius: 9, border: `1px solid ${t.line}`, background: t.card, color: t.text, fontSize: 13, cursor: "pointer" });
export const primaryBtn = (t) => ({ padding: "12px 18px", borderRadius: 12, border: "none", background: t.accent, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" });
export const secondaryBtn = (t) => ({ padding: "11px 18px", borderRadius: 12, border: `1px solid ${t.line}`, background: "transparent", color: t.text, fontSize: 14, cursor: "pointer" });
export const inp = (t) => ({ width: "100%", padding: "11px 13px", borderRadius: 11, border: `1px solid ${t.line}`, background: t.card, color: t.text, fontSize: 15, outline: "none" });
export const sel = (t) => ({ padding: "9px 12px", borderRadius: 11, border: `1px solid ${t.line}`, background: t.card, color: t.text, fontSize: 14, outline: "none", cursor: "pointer" });
export const lbl = (t) => ({ display: "block", fontSize: 12, color: t.dim, marginBottom: 6, letterSpacing: 0.3 });

export const styles = {
  app: { maxWidth: 460, margin: "0 auto", minHeight: "100vh", paddingBottom: 140, position: "relative" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 18px 16px" },
  iconBtn: { width: 40, height: 40, borderRadius: 12, cursor: "pointer", fontSize: 18 },
  body: { padding: "8px 16px" },
  fab: { position: "fixed", bottom: 84, right: "calc(50% - 230px + 18px)", width: 56, height: 56, borderRadius: "50%", border: "none", color: "#fff", fontSize: 30, cursor: "pointer", boxShadow: "0 6px 20px rgba(0,0,0,.3)", zIndex: 50 },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 460, display: "flex", paddingBottom: "env(safe-area-inset-bottom)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  modal: { width: "100%", maxWidth: 460, borderRadius: "22px 22px 0 0", padding: "22px 20px 30px", maxHeight: "92vh", overflowY: "auto" },
  pinScreen: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
};

export function Modal({ t, children, onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, background: t.bg, border: `1px solid ${t.line}`, color: t.text }} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function Seg({ t, options, value, onChange, full, disabled }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: 4, background: t.card, borderRadius: 12, border: `1px solid ${t.line}`, opacity: disabled ? 0.4 : 1, width: full ? "100%" : "auto" }}>
      {options.map((o) => (
        <button key={o} disabled={disabled} onClick={() => onChange(o)} style={{
          flex: full ? 1 : "none", padding: "8px 14px", borderRadius: 9, border: "none", cursor: disabled ? "not-allowed" : "pointer",
          background: value === o ? t.accent : "transparent", color: value === o ? "#fff" : t.dim, fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{o}</button>
      ))}
    </div>
  );
}

export function Stat({ t, label, value, color, big }) {
  return (
    <div style={{ padding: big ? "18px 16px" : 12, borderRadius: 14, background: t.card, border: `1px solid ${t.line}` }}>
      <div style={{ fontSize: 11, color: t.dim, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: big ? 30 : 17, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function Toggle({ t, on, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: on ? t.accent : t.line, position: "relative", transition: "all .15s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "all .15s" }} />
    </button>
  );
}

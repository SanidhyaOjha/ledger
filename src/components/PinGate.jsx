import React, { useState } from "react";
import { styles, theme } from "../lib/ui.jsx";
import { hasPin, setPin, checkPin } from "../lib/pin";

const padBtn = (t) => ({ width: 72, height: 72, borderRadius: "50%", border: `1px solid ${t.line}`, background: t.card, color: t.text, fontSize: 24, cursor: "pointer" });

export default function PinGate({ t, onUnlock }) {
  const firstRun = !hasPin();
  const [stage, setStage] = useState(firstRun ? "set" : "enter"); // set | confirm | enter
  const [first, setFirst] = useState("");
  const [pin, setPinVal] = useState("");
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState(firstRun ? "Create a 4-digit PIN" : "Enter your PIN");

  const reset = (m) => { setErr(true); setTimeout(() => { setPinVal(""); setErr(false); if (m) setMsg(m); }, 450); };

  const complete = async (val) => {
    if (stage === "set") {
      setFirst(val); setStage("confirm"); setMsg("Confirm your PIN"); setPinVal("");
    } else if (stage === "confirm") {
      if (val === first) { await setPin(val); onUnlock(); }
      else { setStage("set"); setFirst(""); reset("PINs didn't match — try again"); }
    } else {
      if (await checkPin(val)) onUnlock();
      else reset();
    }
  };

  const press = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d; setPinVal(next);
    if (next.length === 4) setTimeout(() => complete(next), 120);
  };

  return (
    <div style={{ ...styles.pinScreen, background: t.bg, color: t.text, fontFamily: t.font }}>
      <div style={{ fontSize: 13, letterSpacing: 3, color: t.dim, marginBottom: 8 }}>LEDGER</div>
      <div style={{ fontSize: 15, color: err ? "#ef4444" : t.dim, marginBottom: 28 }}>{msg}</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 36, animation: err ? "shake .4s" : "none" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: "50%",
            background: i < pin.length ? (err ? "#ef4444" : t.accent) : "transparent",
            border: `2px solid ${i < pin.length ? (err ? "#ef4444" : t.accent) : t.line}`, transition: "all .15s" }} />
        ))}
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,72px)", gap: 14 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <button key={n} onClick={() => press(String(n))} style={padBtn(t)}>{n}</button>)}
        <div />
        <button onClick={() => press("0")} style={padBtn(t)}>0</button>
        <button onClick={() => setPinVal(pin.slice(0, -1))} style={{ ...padBtn(t), fontSize: 18 }}>⌫</button>
      </div>
    </div>
  );
}

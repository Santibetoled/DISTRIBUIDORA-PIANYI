import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

/* ── Logos (same as control-transferencias) ── */
var LOGO_BIG = "data:image/jpeg;base64,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";

/* ── Panda SVG Icons per module ── */
function PandaIcon({ type, size = 80 }) {
  const common = {
    width: size, height: size, viewBox: "0 0 120 120",
    xmlns: "http://www.w3.org/2000/svg",
    style: { display: "block" }
  };

  // Base panda face elements
  const pandaBase = (
    <>
      {/* Ears */}
      <circle cx="30" cy="28" r="18" fill="#1a1a1a"/>
      <circle cx="90" cy="28" r="18" fill="#1a1a1a"/>
      {/* Head */}
      <ellipse cx="60" cy="55" rx="38" ry="35" fill="#fff"/>
      {/* Eye patches */}
      <ellipse cx="42" cy="50" rx="13" ry="11" fill="#1a1a1a" transform="rotate(-10 42 50)"/>
      <ellipse cx="78" cy="50" rx="13" ry="11" fill="#1a1a1a" transform="rotate(10 78 50)"/>
      {/* Eyes */}
      <circle cx="44" cy="49" r="5" fill="#fff"/>
      <circle cx="76" cy="49" r="5" fill="#fff"/>
      <circle cx="45" cy="50" r="2.5" fill="#1a1a1a"/>
      <circle cx="77" cy="50" r="2.5" fill="#1a1a1a"/>
      {/* Eye shine */}
      <circle cx="46" cy="48" r="1" fill="#fff"/>
      <circle cx="78" cy="48" r="1" fill="#fff"/>
      {/* Nose */}
      <ellipse cx="60" cy="62" rx="5" ry="3.5" fill="#1a1a1a"/>
      {/* Mouth */}
      <path d="M54 66 Q60 72 66 66" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
    </>
  );

  if (type === "transferencias") {
    return (
      <svg {...common}>
        {pandaBase}
        {/* Dollar signs floating */}
        <text x="10" y="105" fontSize="16" fontWeight="800" fill="#16a34a" opacity="0.8">$</text>
        <text x="95" y="95" fontSize="14" fontWeight="800" fill="#16a34a" opacity="0.6">$</text>
        <text x="55" y="110" fontSize="18" fontWeight="800" fill="#16a34a">$</text>
        {/* Arrow (transfer) */}
        <path d="M20 85 L45 85" stroke="#E65100" strokeWidth="3" strokeLinecap="round" markerEnd="url(#arr)"/>
        <path d="M75 85 L100 85" stroke="#E65100" strokeWidth="3" strokeLinecap="round" markerEnd="url(#arr)"/>
        <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#E65100"/></marker></defs>
      </svg>
    );
  }
  if (type === "comisiones") {
    return (
      <svg {...common}>
        {pandaBase}
        {/* Chart bars */}
        <rect x="18" y="100" width="12" height="15" rx="2" fill="#E65100" opacity="0.7"/>
        <rect x="34" y="92" width="12" height="23" rx="2" fill="#E65100" opacity="0.8"/>
        <rect x="50" y="85" width="12" height="30" rx="2" fill="#E65100" opacity="0.9"/>
        <rect x="66" y="88" width="12" height="27" rx="2" fill="#16a34a" opacity="0.8"/>
        <rect x="82" y="82" width="12" height="33" rx="2" fill="#16a34a"/>
        {/* Star */}
        <text x="96" y="82" fontSize="14">⭐</text>
      </svg>
    );
  }
  if (type === "reparto") {
    return (
      <svg {...common}>
        {pandaBase}
        {/* Truck */}
        <rect x="15" y="88" width="45" height="22" rx="4" fill="#E65100"/>
        <rect x="55" y="95" width="20" height="15" rx="3" fill="#FFB74D"/>
        <circle cx="30" cy="113" r="5" fill="#1a1a1a"/><circle cx="30" cy="113" r="2" fill="#888"/>
        <circle cx="50" cy="113" r="5" fill="#1a1a1a"/><circle cx="50" cy="113" r="2" fill="#888"/>
        <circle cx="68" cy="113" r="5" fill="#1a1a1a"/><circle cx="68" cy="113" r="2" fill="#888"/>
        {/* Package */}
        <rect x="82" y="92" width="18" height="16" rx="2" fill="#FFD600" stroke="#E65100" strokeWidth="1.5"/>
        <line x1="91" y1="92" x2="91" y2="108" stroke="#E65100" strokeWidth="1"/>
        <line x1="82" y1="100" x2="100" y2="100" stroke="#E65100" strokeWidth="1"/>
      </svg>
    );
  }
  if (type === "calendario") {
    return (
      <svg {...common}>
        {pandaBase}
        {/* Calendar */}
        <rect x="25" y="82" width="70" height="34" rx="5" fill="#fff" stroke="#E65100" strokeWidth="2"/>
        <rect x="25" y="82" width="70" height="12" rx="5" fill="#E65100"/>
        <rect x="25" y="89" width="70" height="5" fill="#E65100"/>
        {/* Calendar dots */}
        <circle cx="40" cy="102" r="3" fill="#1a1a1a"/>
        <circle cx="55" cy="102" r="3" fill="#16a34a"/>
        <circle cx="70" cy="102" r="3" fill="#dc2626"/>
        <circle cx="85" cy="102" r="3" fill="#1a1a1a"/>
        {/* Calendar rings */}
        <rect x="38" y="78" width="4" height="8" rx="2" fill="#666"/>
        <rect x="58" y="78" width="4" height="8" rx="2" fill="#666"/>
        <rect x="78" y="78" width="4" height="8" rx="2" fill="#666"/>
      </svg>
    );
  }
  if (type === "vehiculos") {
    return (
      <svg {...common}>
        {pandaBase}
        {/* Wrench */}
        <g transform="translate(25,82) rotate(-30 20 15)">
          <rect x="8" y="12" width="30" height="6" rx="3" fill="#666"/>
          <circle cx="8" cy="15" r="8" fill="none" stroke="#666" strokeWidth="3"/>
        </g>
        {/* Key/gauge */}
        <circle cx="85" cy="95" r="12" fill="none" stroke="#E65100" strokeWidth="2.5"/>
        <line x1="85" y1="95" x2="85" y2="86" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="85" y1="95" x2="91" y2="92" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
        {/* Small tire */}
        <circle cx="50" cy="110" r="7" fill="#1a1a1a"/>
        <circle cx="50" cy="110" r="3" fill="#888"/>
      </svg>
    );
  }
  if (type === "presentismo") {
    return (
      <svg {...common}>
        {pandaBase}
        {/* Clipboard */}
        <rect x="30" y="80" width="60" height="36" rx="4" fill="#fff" stroke="#1a1a1a" strokeWidth="2"/>
        <rect x="45" y="76" width="30" height="8" rx="4" fill="#E65100"/>
        {/* Checkmarks */}
        <path d="M38 93 L42 97 L50 89" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M38 103 L42 107 L50 99" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Lines */}
        <line x1="55" y1="93" x2="82" y2="93" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
        <line x1="55" y1="103" x2="82" y2="103" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  return <svg {...common}>{pandaBase}</svg>;
}

/* ── Styles ── */
const S = {
  btn: function (c) { return { background: c || "#E65100", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }; },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" },
  label: { display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
};

/* ── Module definitions ── */
var MODULES = [
  {
    id: "transferencias",
    name: "Control de Transferencias",
    desc: "Ruteo de cobros, comprobantes y reportes de pago",
    icon: "transferencias",
    color: "#E65100",
    active: true,
    url: "https://control-transferencias.vercel.app"
  },
  {
    id: "comisiones",
    name: "Comisiones de Vendedores",
    desc: "Cálculo y seguimiento de comisiones por vendedor",
    icon: "comisiones",
    color: "#7C3AED",
    active: false
  },
  {
    id: "reparto",
    name: "Control del Reparto",
    desc: "Seguimiento de vehículos, pedidos y entregas",
    icon: "reparto",
    color: "#0284C7",
    active: false
  },
  {
    id: "calendario",
    name: "Calendario de Pagos / Gastos",
    desc: "Agenda de vencimientos, pagos y gastos fijos",
    icon: "calendario",
    color: "#059669",
    active: false
  },
  {
    id: "vehiculos",
    name: "Control de Vehículos",
    desc: "Mantenimiento, combustible y estado de la flota",
    icon: "vehiculos",
    color: "#DC2626",
    active: false
  },
  {
    id: "presentismo",
    name: "Presentismo",
    desc: "Asistencia, horarios y registro del equipo",
    icon: "presentismo",
    color: "#D97706",
    active: false
  },
];

/* ══════════════════════════════════════════ */
/* ══  MAIN APP                           ══ */
/* ══════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ usuario: "", contrasena: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [hoveredModule, setHoveredModule] = useState(null);

  /* ── Auth ── */
  useEffect(function () {
    try {
      var saved = localStorage.getItem("pianyi-user");
      if (saved) setUser(JSON.parse(saved));
    } catch (e) {}
  }, []);

  async function handleLogin() {
    if (!loginForm.usuario || !loginForm.contrasena) return;
    setLoggingIn(true);
    setLoginError("");
    var res = await supabase.from("usuarios").select("*").eq("usuario", loginForm.usuario).eq("contrasena", loginForm.contrasena).single();
    if (res.data) {
      var u = { id: res.data.id, usuario: res.data.usuario, nombre: res.data.nombre_display };
      setUser(u);
      try { localStorage.setItem("pianyi-user", JSON.stringify(u)); } catch (e) {}
    } else {
      setLoginError("Usuario o contraseña incorrectos");
    }
    setLoggingIn(false);
  }

  function handleLogout() {
    setUser(null);
    try { localStorage.removeItem("pianyi-user"); } catch (e) {}
  }

  function openModule(mod) {
    if (mod.active && mod.url) {
      window.open(mod.url, "_blank");
    }
  }

  /* ── Login Screen ── */
  if (!user) {
    return (
      <div style={{ fontFamily: "'Segoe UI',Arial,sans-serif", background: "linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: "40px 32px", width: "100%", maxWidth: 400, boxShadow: "0 12px 48px rgba(0,0,0,.4)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <img src={LOGO_BIG} alt="Pianyi" style={{ width: 160, height: 160, objectFit: "contain", marginBottom: 16, borderRadius: 16 }} />
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#1a1a1a", letterSpacing: "1.5px" }}>DISTRIBUIDORA PIANYI</h1>
            <div style={{ width: 80, height: 4, background: "linear-gradient(90deg,#E65100,#FFD600)", margin: "12px auto", borderRadius: 2 }} />
            <p style={{ color: "#64748b", fontSize: 14, margin: "10px 0 0" }}>Sistema de Gestión Integral</p>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Usuario</label>
            <input style={S.input} placeholder="Tu usuario" value={loginForm.usuario} onChange={function (e) { setLoginForm({ ...loginForm, usuario: e.target.value }); }} onKeyDown={function (e) { if (e.key === "Enter") handleLogin(); }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Contraseña</label>
            <input type="password" style={S.input} placeholder="Tu contraseña" value={loginForm.contrasena} onChange={function (e) { setLoginForm({ ...loginForm, contrasena: e.target.value }); }} onKeyDown={function (e) { if (e.key === "Enter") handleLogin(); }} />
          </div>
          {loginError && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{loginError}</div>}
          <button onClick={handleLogin} disabled={loggingIn || !loginForm.usuario || !loginForm.contrasena} style={{ ...S.btn(), width: "100%", padding: 14, fontSize: 16, background: "linear-gradient(135deg,#E65100,#FF8F00)", borderRadius: 10 }}>{loggingIn ? "Ingresando..." : "Ingresar"}</button>
        </div>
      </div>
    );
  }

  /* ── Portal Menu ── */
  return (
    <div style={{ fontFamily: "'Segoe UI',Arial,sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1a1a1a,#2d2d2d)", padding: "20px 24px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={LOGO_BIG} alt="Pianyi" style={{ width: 50, height: 50, borderRadius: 10, objectFit: "contain", background: "#fff", padding: 3 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "1px" }}>DISTRIBUIDORA PIANYI</h1>
            <p style={{ margin: "3px 0 0", fontSize: 12, opacity: 0.7 }}>Sistema de Gestión Integral</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{user.nombre}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Salir</button>
        </div>
      </div>

      {/* Welcome + Module Grid */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>¡Bienvenido, {user.nombre}!</h2>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>Seleccioná una herramienta para comenzar</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {MODULES.map(function (mod) {
            var isHovered = hoveredModule === mod.id;
            var isActive = mod.active;
            return (
              <div
                key={mod.id}
                onClick={function () { openModule(mod); }}
                onMouseEnter={function () { setHoveredModule(mod.id); }}
                onMouseLeave={function () { setHoveredModule(null); }}
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "24px 20px",
                  cursor: isActive ? "pointer" : "default",
                  border: isHovered && isActive ? "2px solid " + mod.color : "2px solid #e2e8f0",
                  boxShadow: isHovered && isActive ? "0 8px 24px rgba(0,0,0,.12)" : "0 2px 8px rgba(0,0,0,.05)",
                  transition: "all 0.2s ease",
                  transform: isHovered && isActive ? "translateY(-4px)" : "none",
                  opacity: isActive ? 1 : 0.75,
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                {/* Color accent bar */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: mod.color, opacity: isHovered && isActive ? 1 : 0.5 }} />

                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flexShrink: 0, background: isActive ? mod.color + "12" : "#f5f5f5", borderRadius: 14, padding: 6 }}>
                    <PandaIcon type={mod.icon} size={70} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{mod.name}</div>
                    <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.4 }}>{mod.desc}</div>
                    <div style={{ marginTop: 10 }}>
                      {isActive ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: mod.color, background: mod.color + "15", padding: "4px 12px", borderRadius: 20 }}>
                          ● Disponible
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#94a3b8", background: "#f1f5f9", padding: "4px 12px", borderRadius: 20 }}>
                          🔒 Próximamente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 40, paddingTop: 20, borderTop: "1px solid #e2e8f0", color: "#94a3b8", fontSize: 12 }}>
          Distribuidora Pianyi — Sistema de Gestión Integral — {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

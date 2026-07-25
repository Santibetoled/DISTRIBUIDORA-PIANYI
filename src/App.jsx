import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

/* ── Logos (same as control-transferencias) ── */
var LOGO_BIG = "data:image/jpeg;base64,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";
var LOGO_SMALL = "data:image/jpeg;base64,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";

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
    id: "zonificacion",
    name: "Zonificación",
    desc: "Carga de pedidos, asignación a vehículos y armado de repartos",
    icon: "transferencias",
    color: "#0284C7",
    active: false
  },
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
    id: "reparto",
    name: "Control del Reparto",
    desc: "Seguimiento de entregas, cobranza y cierre del día en vivo",
    icon: "reparto",
    color: "#7C3AED",
    active: false
  },
  {
    id: "cobros",
    name: "Cobros Pendientes",
    desc: "Clientes con saldos pendientes, seguimiento y alertas en HDR",
    icon: "calendario",
    color: "#DC2626",
    active: false
  },
  {
    id: "comisiones",
    name: "Comisiones de Vendedores",
    desc: "Cálculo automático al 2% sobre lo cobrado, reportes por vendedor",
    icon: "comisiones",
    color: "#059669",
    active: false
  },
  {
    id: "calendario",
    name: "Calendario de Pagos / Gastos",
    desc: "Agenda de vencimientos, pagos a proveedores y gastos fijos",
    icon: "calendario",
    color: "#D97706",
    active: false
  },
  {
    id: "vehiculos",
    name: "Control de Vehículos",
    desc: "Siniestros, VTV, services, kilometraje y estado de la flota",
    icon: "vehiculos",
    color: "#6366F1",
    active: false
  },
  {
    id: "presentismo",
    name: "Presentismo",
    desc: "Asistencia, fichero, vacaciones y premios/sanciones",
    icon: "presentismo",
    color: "#0891B2",
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

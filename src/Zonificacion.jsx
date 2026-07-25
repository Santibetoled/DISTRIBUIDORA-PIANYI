import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";

/* ── Helpers ── */
function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  if (!d) return "-";
  return new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
}
function fmtMoney(n) { return "$" + Number(n || 0).toLocaleString("es-AR"); }

function normalize(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

/* ── Styles ── */
var S = {
  btn: function (c) { return { background: c || "#E65100", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }; },
  btnSm: function (c) { return { background: c || "#E65100", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }; },
  input: { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" },
  label: { display: "block", fontSize: 10, fontWeight: 600, color: "#475569", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 },
  select: { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, background: "#fff", boxSizing: "border-box" },
  card: { background: "#fff", borderRadius: 10, padding: 14, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,.07)" },
  badge: function (bg, fg) { return { display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: bg, color: fg }; },
};

/* ── Parse pasted text from WhatsApp ── */
function parsePedido(text, barriosList) {
  var lines = text.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
  if (lines.length === 0) return null;

  var header = lines[0];
  var productos = [];
  var direccion = "";
  var localidad = "";
  var rangoHorario = "";
  var vendedor = "";
  var barrioMatch = null;

  // Try to extract time range like "9 a 14", "9-21", "9 A 21", "9 a 13.30"
  var timeMatch = header.match(/(\d{1,2})\s*(?:a|A|-)\s*(\d{1,2}(?:[:.]\d{1,2})?)/);
  if (timeMatch) {
    rangoHorario = timeMatch[0].toUpperCase().replace(/-/g, " A ");
    header = header.replace(timeMatch[0], "").trim();
  }

  // Try to extract date at the beginning like "24/7" or "23/7"
  var dateMatch = header.match(/^(\d{1,2}\/\d{1,2})\s*/);
  if (dateMatch) {
    header = header.replace(dateMatch[0], "").trim();
  }

  // Try to find a barrio match in the header
  var headerNorm = normalize(header);
  var bestMatch = null;
  var bestLen = 0;
  for (var i = 0; i < barriosList.length; i++) {
    var bNorm = normalize(barriosList[i].nombre);
    if (headerNorm.indexOf(bNorm) >= 0 && bNorm.length > bestLen) {
      bestMatch = barriosList[i];
      bestLen = bNorm.length;
    }
  }

  if (bestMatch) {
    localidad = bestMatch.nombre;
    barrioMatch = bestMatch;
    // Remove the barrio name from header to get the address
    var bRegex = new RegExp(bestMatch.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
    direccion = header.replace(bRegex, "").replace(/,\s*$/, "").replace(/^\s*,/, "").trim();
  } else {
    // If no barrio detected, entire header might be address + locality
    var parts = header.split(",").map(function (p) { return p.trim(); });
    if (parts.length >= 2) {
      direccion = parts[0];
      localidad = parts[parts.length - 1];
      // Try to match the locality part
      for (var j = 0; j < barriosList.length; j++) {
        if (normalize(localidad) === normalize(barriosList[j].nombre)) {
          barrioMatch = barriosList[j];
          break;
        }
      }
    } else {
      direccion = header;
    }
  }

  // Parse remaining lines: vendor line (no numbers at start) or product lines
  for (var k = 1; k < lines.length; k++) {
    var line = lines[k];
    // Product line: starts with a number
    var prodMatch = line.match(/^(\d+)\s+(.+?)(?:\s+\$\s*([\d.,]+))?$/);
    if (prodMatch) {
      var precio = prodMatch[3] ? Number(prodMatch[3].replace(/\./g, "").replace(",", ".")) : 0;
      productos.push({
        producto: prodMatch[2].trim(),
        cantidad: parseInt(prodMatch[1]),
        precio: precio
      });
    } else if (line.indexOf("|") >= 0) {
      // Multiple products separated by |
      var subItems = line.split("|");
      for (var m = 0; m < subItems.length; m++) {
        var sub = subItems[m].trim();
        var subMatch = sub.match(/^(\d+)\s+(.+?)(?:\s+\$\s*([\d.,]+))?$/);
        if (subMatch) {
          var subPrecio = subMatch[3] ? Number(subMatch[3].replace(/\./g, "").replace(",", ".")) : 0;
          productos.push({
            producto: subMatch[2].trim(),
            cantidad: parseInt(subMatch[1]),
            precio: subPrecio
          });
        }
      }
    } else {
      // Likely a vendor name line
      if (!vendedor && line.length < 30 && !line.match(/^\d/)) {
        vendedor = line;
      }
    }
  }

  return {
    direccion: direccion,
    localidad: localidad,
    rangoHorario: rangoHorario,
    vendedor: vendedor,
    barrioMatch: barrioMatch,
    productos: productos
  };
}

/* ══════════════════════════════════════════ */
/* ══  ZONIFICACIÓN MODULE               ══ */
/* ══════════════════════════════════════════ */
export default function Zonificacion({ user, onBack }) {
  var [zonas, setZonas] = useState([]);
  var [barrios, setBarrios] = useState([]);
  var [vendedores, setVendedores] = useState([]);
  var [vehiculos, setVehiculos] = useState([]);
  var [pedidos, setPedidos] = useState([]);
  var [productosPedido, setProductosPedido] = useState([]);
  var [loading, setLoading] = useState(true);
  var [tab, setTab] = useState("zonificacion"); // zonificacion, agregar, depurar
  var [pasteText, setPasteText] = useState("");
  var [parsedPreview, setParsedPreview] = useState(null);
  var [editParsed, setEditParsed] = useState(null);
  var [saving, setSaving] = useState(false);
  var [search, setSearch] = useState("");
  var [selectedPedidos, setSelectedPedidos] = useState({});
  var [expandedZonas, setExpandedZonas] = useState({});
  var [showAssign, setShowAssign] = useState(false);
  var [viewMode, setViewMode] = useState("zona"); // zona, camioneta
  var searchRef = useRef();

  /* ── Load Data ── */
  var loadData = useCallback(async function () {
    var [zRes, bRes, vRes, vhRes, pRes, ppRes] = await Promise.all([
      supabase.from("zonas").select("*").order("nombre"),
      supabase.from("barrios").select("*").order("nombre"),
      supabase.from("vendedores").select("*").eq("activo", true).order("nombre"),
      supabase.from("vehiculos").select("*").eq("activo", true).order("patente"),
      supabase.from("pedidos").select("*").neq("estado", "depurado").order("created_at", { ascending: false }),
      supabase.from("productos_pedido").select("*"),
    ]);
    if (zRes.data) setZonas(zRes.data);
    if (bRes.data) setBarrios(bRes.data);
    if (vRes.data) setVendedores(vRes.data);
    if (vhRes.data) setVehiculos(vhRes.data);
    if (pRes.data) setPedidos(pRes.data);
    if (ppRes.data) setProductosPedido(ppRes.data);
    // Expand all zonas by default
    if (zRes.data) {
      var exp = {};
      zRes.data.forEach(function (z) { exp[z.id] = true; });
      setExpandedZonas(exp);
    }
    setLoading(false);
  }, []);

  useEffect(function () { loadData(); }, [loadData]);

  /* ── Keyboard shortcut for search ── */
  useEffect(function () {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "b")) {
        e.preventDefault();
        if (searchRef.current) searchRef.current.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return function () { window.removeEventListener("keydown", handleKey); };
  }, []);

  /* ── Parse paste ── */
  function handleParse() {
    if (!pasteText.trim()) return;
    var parsed = parsePedido(pasteText, barrios);
    if (parsed) {
      setEditParsed({
        direccion: parsed.direccion,
        localidad: parsed.localidad,
        barrio_id: parsed.barrioMatch ? parsed.barrioMatch.id : "",
        zona_nombre: parsed.barrioMatch ? (zonas.find(function (z) { return z.id === parsed.barrioMatch.zona_id; }) || {}).nombre || "" : "",
        rango_horario: parsed.rangoHorario,
        vendedor: parsed.vendedor,
        vendedor_id: "",
        productos: parsed.productos.length > 0 ? parsed.productos : [{ producto: "", cantidad: 1, precio: 0 }],
        texto_original: pasteText
      });
      // Try to match vendor
      if (parsed.vendedor) {
        var vNorm = normalize(parsed.vendedor);
        var vMatch = vendedores.find(function (v) { return normalize(v.nombre) === vNorm; });
        if (vMatch) {
          setEditParsed(function (prev) { return { ...prev, vendedor_id: vMatch.id }; });
        }
      }
      setParsedPreview(parsed);
    }
  }

  /* ── Save pedido ── */
  async function savePedido() {
    if (!editParsed || !editParsed.direccion) return;
    setSaving(true);

    // Check for duplicate (same address, same day)
    var dup = pedidos.find(function (p) {
      return normalize(p.direccion) === normalize(editParsed.direccion) && p.fecha_pedido === today() && p.estado !== "depurado";
    });

    if (dup && !confirm("⚠️ Ya existe un pedido para \"" + dup.direccion + "\" hoy. ¿Querés agregar otro de todos modos?")) {
      setSaving(false);
      return;
    }

    var res = await supabase.from("pedidos").insert({
      barrio_id: editParsed.barrio_id || null,
      vendedor_id: editParsed.vendedor_id || null,
      fecha_pedido: today(),
      direccion: editParsed.direccion,
      localidad: editParsed.localidad,
      rango_horario: editParsed.rango_horario,
      cliente_nombre: editParsed.direccion,
      estado: "disponible",
      texto_original: editParsed.texto_original
    }).select();

    if (res.data && res.data[0]) {
      var pedidoId = res.data[0].id;
      var prods = editParsed.productos.filter(function (p) { return p.producto; });
      if (prods.length > 0) {
        var prodInserts = prods.map(function (p) {
          return {
            pedido_id: pedidoId,
            producto: p.producto,
            cantidad_pedida: p.cantidad || 1,
            precio_unitario: p.precio || 0
          };
        });
        var ppRes = await supabase.from("productos_pedido").insert(prodInserts).select();
        if (ppRes.data) setProductosPedido(function (prev) { return [...prev, ...ppRes.data]; });
      }
      setPedidos(function (prev) { return [res.data[0], ...prev]; });
    }

    setPasteText("");
    setEditParsed(null);
    setParsedPreview(null);
    setSaving(false);
  }

  /* ── Add product row ── */
  function addProductRow() {
    setEditParsed(function (prev) {
      return { ...prev, productos: [...prev.productos, { producto: "", cantidad: 1, precio: 0 }] };
    });
  }

  function updateProduct(idx, field, value) {
    setEditParsed(function (prev) {
      var prods = [...prev.productos];
      prods[idx] = { ...prods[idx], [field]: value };
      return { ...prev, productos: prods };
    });
  }

  function removeProduct(idx) {
    setEditParsed(function (prev) {
      var prods = prev.productos.filter(function (_, i) { return i !== idx; });
      return { ...prev, productos: prods };
    });
  }

  /* ── Selection ── */
  function toggleSelect(id) {
    setSelectedPedidos(function (prev) {
      var copy = { ...prev };
      if (copy[id]) delete copy[id]; else copy[id] = true;
      return copy;
    });
  }

  function selectAllInZona(zonaId) {
    var zonaPedidos = getFilteredPedidos().filter(function (p) {
      var b = barrios.find(function (bb) { return bb.id === p.barrio_id; });
      return b && b.zona_id === zonaId && p.estado === "disponible";
    });
    setSelectedPedidos(function (prev) {
      var copy = { ...prev };
      zonaPedidos.forEach(function (p) { copy[p.id] = true; });
      return copy;
    });
  }

  /* ── Assign to vehicle ── */
  async function assignToVehicle(vehiculoId) {
    var veh = vehiculos.find(function (v) { return v.id === vehiculoId; });
    if (!veh) return;
    var ids = Object.keys(selectedPedidos);
    if (ids.length === 0) return;

    // Create reparto
    var rRes = await supabase.from("repartos").insert({
      vehiculo_id: vehiculoId,
      fecha: today(),
      chofer: veh.chofer_habitual || "",
      acompanante: veh.acompanante_habitual || "",
      estado: "preparando"
    }).select();

    if (rRes.data && rRes.data[0]) {
      var repartoId = rRes.data[0].id;
      // Link pedidos to reparto
      var links = ids.map(function (pid, idx) {
        return { reparto_id: repartoId, pedido_id: pid, orden_ruta: idx + 1 };
      });
      await supabase.from("reparto_pedidos").insert(links);

      // Update pedido states
      await supabase.from("pedidos").update({ estado: "en_calle", color_asignado: veh.color_hex }).in("id", ids);

      setPedidos(function (prev) {
        return prev.map(function (p) {
          if (ids.indexOf(p.id) >= 0) return { ...p, estado: "en_calle", color_asignado: veh.color_hex };
          return p;
        });
      });
    }

    setSelectedPedidos({});
    setShowAssign(false);
  }

  /* ── Depurar ── */
  async function depurarPedido(id) {
    await supabase.from("pedidos").update({ estado: "depurado", fecha_depurado: today(), nota_depuracion: "Depurado el " + fmtDate(today()) }).eq("id", id);
    setPedidos(function (prev) { return prev.filter(function (p) { return p.id !== id; }); });
  }

  /* ── Delete pedido ── */
  async function deletePedido(id) {
    if (!confirm("¿Eliminar este pedido?")) return;
    await supabase.from("productos_pedido").delete().eq("pedido_id", id);
    await supabase.from("pedidos").delete().eq("id", id);
    setPedidos(function (prev) { return prev.filter(function (p) { return p.id !== id; }); });
    setProductosPedido(function (prev) { return prev.filter(function (pp) { return pp.pedido_id !== id; }); });
  }

  /* ── Filter & Group ── */
  function getFilteredPedidos() {
    if (!search) return pedidos;
    var s = normalize(search);
    return pedidos.filter(function (p) {
      return normalize(p.direccion).indexOf(s) >= 0 || normalize(p.localidad || "").indexOf(s) >= 0 || normalize(p.cliente_nombre || "").indexOf(s) >= 0;
    });
  }

  function getPedidosByZona() {
    var filtered = getFilteredPedidos();
    var grouped = {};
    zonas.forEach(function (z) { grouped[z.id] = { zona: z, pedidos: [] }; });
    grouped["sin_zona"] = { zona: { id: "sin_zona", nombre: "Sin zona asignada", codigo: "SIN_ZONA" }, pedidos: [] };

    filtered.forEach(function (p) {
      var b = barrios.find(function (bb) { return bb.id === p.barrio_id; });
      if (b && grouped[b.zona_id]) {
        grouped[b.zona_id].pedidos.push(p);
      } else {
        grouped["sin_zona"].pedidos.push(p);
      }
    });
    return grouped;
  }

  function getPedidosByVehiculo() {
    var filtered = getFilteredPedidos().filter(function (p) { return p.estado === "en_calle"; });
    var grouped = {};
    vehiculos.forEach(function (v) { grouped[v.id] = { vehiculo: v, pedidos: [] }; });
    filtered.forEach(function (p) {
      var veh = vehiculos.find(function (v) { return v.color_hex === p.color_asignado; });
      if (veh && grouped[veh.id]) {
        grouped[veh.id].pedidos.push(p);
      }
    });
    return grouped;
  }

  var selectedCount = Object.keys(selectedPedidos).length;
  var totalPedidos = pedidos.length;
  var disponibles = pedidos.filter(function (p) { return p.estado === "disponible"; }).length;
  var enCalle = pedidos.filter(function (p) { return p.estado === "en_calle"; }).length;

  /* ── RENDER ── */
  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Cargando zonificación...</div>;

  return (
    <div style={{ fontFamily: "'Segoe UI',Arial,sans-serif", background: "#f1f5f9", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0284C7,#0369A1)", padding: "14px 20px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>← Menú</button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Zonificación</h1>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{fmtDate(today())}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{user.nombre}</span>
          <span style={S.badge("#dcfce7", "#166534")}>{disponibles} disponibles</span>
          <span style={S.badge("#fef3c7", "#92400e")}>{enCalle} en calle</span>
          <span style={S.badge("#f1f5f9", "#475569")}>{totalPedidos} total</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={function () { setTab("agregar"); }} style={S.btn(tab === "agregar" ? "#0284C7" : "#64748b")}>+ Cargar pedido</button>
          <button onClick={function () { setViewMode("zona"); }} style={S.btn(viewMode === "zona" ? "#0284C7" : "#94a3b8")}>Por zona</button>
          <button onClick={function () { setViewMode("camioneta"); }} style={S.btn(viewMode === "camioneta" ? "#E65100" : "#94a3b8")}>Por camioneta</button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selectedCount > 0 && (
            <button onClick={function () { setShowAssign(true); }} style={S.btn("#16a34a")}>
              Asignar {selectedCount} pedido{selectedCount !== 1 ? "s" : ""} a camioneta
            </button>
          )}
          <div style={{ position: "relative" }}>
            <input ref={searchRef} type="text" placeholder="Buscar... (Ctrl+F)" style={{ ...S.input, width: 220, paddingLeft: 30 }} value={search} onChange={function (e) { setSearch(e.target.value); }} />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 14 }}>🔍</span>
          </div>
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>

        {/* ═══ AGREGAR PEDIDO ═══ */}
        {tab === "agregar" && (
          <div style={{ ...S.card, border: "2px solid #0284C7", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: "#0284C7" }}>Cargar pedido</h3>
              <button onClick={function () { setTab("zonificacion"); setEditParsed(null); setPasteText(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18 }}>✕</button>
            </div>

            {!editParsed ? (
              <div>
                <label style={S.label}>Pegá el pedido de WhatsApp</label>
                <textarea style={{ ...S.input, height: 120, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} placeholder={"Ejemplo:\nMurguiando 639, Liniers\nBenjamin\n3 imperial Golden $1599\n2 Heineken lata $2190"} value={pasteText} onChange={function (e) { setPasteText(e.target.value); }} />
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button onClick={handleParse} style={S.btn("#0284C7")} disabled={!pasteText.trim()}>Procesar pedido</button>
                  <button onClick={function () { setEditParsed({ direccion: "", localidad: "", barrio_id: "", rango_horario: "", vendedor: "", vendedor_id: "", productos: [{ producto: "", cantidad: 1, precio: 0 }], texto_original: "" }); }} style={S.btn("#64748b")}>Carga manual</button>
                </div>
              </div>
            ) : (
              <div>
                {parsedPreview && parsedPreview.barrioMatch && (
                  <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#166534" }}>
                    ✓ Zona detectada: <strong>{editParsed.zona_nombre}</strong> — Barrio: <strong>{editParsed.localidad}</strong>
                  </div>
                )}
                {parsedPreview && !parsedPreview.barrioMatch && editParsed.localidad && (
                  <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#92400e" }}>
                    ⚠ No se detectó el barrio "{editParsed.localidad}". Seleccionalo manualmente.
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Dirección</label>
                    <input style={S.input} value={editParsed.direccion} onChange={function (e) { setEditParsed({ ...editParsed, direccion: e.target.value }); }} />
                  </div>
                  <div>
                    <label style={S.label}>Barrio</label>
                    <select style={S.select} value={editParsed.barrio_id} onChange={function (e) {
                      var bid = e.target.value;
                      var b = barrios.find(function (bb) { return bb.id === bid; });
                      var z = b ? zonas.find(function (zz) { return zz.id === b.zona_id; }) : null;
                      setEditParsed({ ...editParsed, barrio_id: bid, localidad: b ? b.nombre : "", zona_nombre: z ? z.nombre : "" });
                    }}>
                      <option value="">— Seleccionar barrio —</option>
                      {zonas.map(function (z) {
                        var zBarrios = barrios.filter(function (b) { return b.zona_id === z.id; });
                        return (
                          <optgroup key={z.id} label={z.nombre}>
                            {zBarrios.map(function (b) {
                              return <option key={b.id} value={b.id}>{b.nombre}</option>;
                            })}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Rango horario</label>
                    <input style={S.input} placeholder="Ej: 9 A 14" value={editParsed.rango_horario} onChange={function (e) { setEditParsed({ ...editParsed, rango_horario: e.target.value }); }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={S.label}>Vendedor</label>
                    <select style={S.select} value={editParsed.vendedor_id} onChange={function (e) { setEditParsed({ ...editParsed, vendedor_id: e.target.value }); }}>
                      <option value="">— Seleccionar —</option>
                      {vendedores.map(function (v) {
                        return <option key={v.id} value={v.id}>{v.nombre}</option>;
                      })}
                    </select>
                    {editParsed.vendedor && !editParsed.vendedor_id && (
                      <div style={{ fontSize: 11, color: "#d97706", marginTop: 3 }}>Detectado: "{editParsed.vendedor}" — seleccioná de la lista o creá uno nuevo</div>
                    )}
                  </div>
                  <div>
                    <label style={S.label}>Zona asignada</label>
                    <input style={{ ...S.input, background: "#f1f5f9" }} value={editParsed.zona_nombre || "Sin zona"} readOnly />
                  </div>
                </div>

                {/* Products */}
                <label style={{ ...S.label, marginBottom: 8 }}>Productos</label>
                {editParsed.productos.map(function (prod, idx) {
                  return (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "60px 1fr 100px 30px", gap: 6, marginBottom: 4 }}>
                      <input type="number" style={S.input} placeholder="Cant" value={prod.cantidad} onChange={function (e) { updateProduct(idx, "cantidad", parseInt(e.target.value) || 0); }} />
                      <input style={S.input} placeholder="Producto" value={prod.producto} onChange={function (e) { updateProduct(idx, "producto", e.target.value); }} />
                      <input type="number" style={S.input} placeholder="Precio" value={prod.precio || ""} onChange={function (e) { updateProduct(idx, "precio", parseFloat(e.target.value) || 0); }} />
                      <button onClick={function () { removeProduct(idx); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16 }}>✕</button>
                    </div>
                  );
                })}
                <button onClick={addProductRow} style={{ background: "none", border: "1px dashed #d1d5db", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#64748b", marginTop: 4 }}>+ Agregar producto</button>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={function () { setEditParsed(null); setPasteText(""); setParsedPreview(null); }} style={S.btn("#94a3b8")}>Cancelar</button>
                  <button onClick={savePedido} disabled={!editParsed.direccion || saving} style={S.btn("#16a34a")}>{saving ? "Guardando..." : "Guardar pedido"}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ASSIGN MODAL ═══ */}
        {showAssign && (
          <div style={{ ...S.card, border: "2px solid #16a34a", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#16a34a" }}>Asignar {selectedCount} pedido{selectedCount !== 1 ? "s" : ""} a:</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {vehiculos.map(function (v) {
                return (
                  <button key={v.id} onClick={function () { assignToVehicle(v.id); }} style={{ background: "#fff", border: "2px solid " + v.color_hex, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "center" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: v.color_hex, margin: "0 auto 8px" }} />
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{v.patente}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{v.chofer_habitual || v.alias || ""}</div>
                  </button>
                );
              })}
            </div>
            <button onClick={function () { setShowAssign(false); }} style={{ ...S.btn("#94a3b8"), marginTop: 10 }}>Cancelar</button>
          </div>
        )}

        {/* ═══ VISTA POR ZONA ═══ */}
        {viewMode === "zona" && (function () {
          var grouped = getPedidosByZona();
          return Object.keys(grouped).map(function (zonaId) {
            var group = grouped[zonaId];
            if (group.pedidos.length === 0) return null;
            var isExpanded = expandedZonas[zonaId];
            return (
              <div key={zonaId} style={{ marginBottom: 12 }}>
                <div onClick={function () { setExpandedZonas(function (prev) { return { ...prev, [zonaId]: !prev[zonaId] }; }); }}
                  style={{ background: "#1a1a1a", color: "#fff", padding: "10px 16px", borderRadius: isExpanded ? "10px 10px 0 0" : 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12 }}>{isExpanded ? "▼" : "▶"}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{group.zona.nombre}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{group.pedidos.length} pedido{group.pedidos.length !== 1 ? "s" : ""}</span>
                    <button onClick={function (e) { e.stopPropagation(); selectAllInZona(zonaId); }} style={S.btnSm("rgba(255,255,255,.2)")}>Seleccionar</button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ background: "#fff", borderRadius: "0 0 10px 10px", border: "1px solid #e2e8f0", borderTop: "none" }}>
                    {group.pedidos.map(function (p) {
                      var prods = productosPedido.filter(function (pp) { return pp.pedido_id === p.id; });
                      var total = prods.reduce(function (s, pp) { return s + (pp.cantidad_pedida * pp.precio_unitario); }, 0);
                      var isSelected = selectedPedidos[p.id];
                      var enCalleStyle = p.estado === "en_calle" ? { borderLeft: "4px solid " + (p.color_asignado || "#ccc"), opacity: 0.7 } : {};
                      var vend = vendedores.find(function (v) { return v.id === p.vendedor_id; });

                      return (
                        <div key={p.id} style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 10, alignItems: "flex-start", ...enCalleStyle, background: isSelected ? "#eff6ff" : "transparent" }}>
                          {p.estado === "disponible" && (
                            <input type="checkbox" checked={!!isSelected} onChange={function () { toggleSelect(p.id); }} style={{ marginTop: 4, cursor: "pointer", accentColor: "#0284C7" }} />
                          )}
                          {p.estado === "en_calle" && (
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: p.color_asignado || "#ccc", marginTop: 4, flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                              <div>
                                <span style={{ fontWeight: 700, fontSize: 13 }}>{p.direccion}</span>
                                {p.localidad && <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>{p.localidad}</span>}
                                {p.rango_horario && <span style={{ fontSize: 11, color: "#0284C7", marginLeft: 6 }}>{p.rango_horario}</span>}
                              </div>
                              <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                                {total > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#E65100" }}>{fmtMoney(total)}</span>}
                                {p.estado === "disponible" && (
                                  <button onClick={function () { deletePedido(p.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14 }}>✕</button>
                                )}
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                              {fmtDate(p.fecha_pedido)}{vend ? " — " + vend.nombre : ""}{p.estado === "en_calle" ? " — EN CALLE" : ""}
                            </div>
                            {prods.length > 0 && (
                              <div style={{ marginTop: 6 }}>
                                {prods.map(function (pp) {
                                  return (
                                    <div key={pp.id} style={{ fontSize: 12, color: "#475569", padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
                                      <span>{pp.cantidad_pedida} {pp.producto}</span>
                                      {pp.precio_unitario > 0 && <span style={{ color: "#94a3b8" }}>{fmtMoney(pp.precio_unitario)}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {p.estado === "en_calle" && (
                              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                                <button onClick={function () { depurarPedido(p.id); }} style={S.btnSm("#16a34a")}>Depurar ✓</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          });
        })()}

        {/* ═══ VISTA POR CAMIONETA ═══ */}
        {viewMode === "camioneta" && (function () {
          var grouped = getPedidosByVehiculo();
          return Object.keys(grouped).map(function (vehId) {
            var group = grouped[vehId];
            if (group.pedidos.length === 0) return null;
            var v = group.vehiculo;
            return (
              <div key={vehId} style={{ marginBottom: 12 }}>
                <div style={{ background: v.color_hex, color: "#fff", padding: "10px 16px", borderRadius: "10px 10px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{v.patente} — {v.chofer_habitual || v.alias || ""}</span>
                  <span style={{ fontSize: 12, opacity: 0.9 }}>{group.pedidos.length} pedido{group.pedidos.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ background: "#fff", borderRadius: "0 0 10px 10px", border: "1px solid #e2e8f0", borderTop: "none" }}>
                  {group.pedidos.map(function (p, idx) {
                    var prods = productosPedido.filter(function (pp) { return pp.pedido_id === p.id; });
                    var total = prods.reduce(function (s, pp) { return s + (pp.cantidad_pedida * pp.precio_unitario); }, 0);
                    return (
                      <div key={p.id} style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", borderLeft: "4px solid " + v.color_hex }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{idx + 1}. {p.direccion}</span>
                            <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>{p.localidad}</span>
                          </div>
                          {total > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#E65100" }}>{fmtMoney(total)}</span>}
                        </div>
                        {prods.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            {prods.map(function (pp) {
                              return (
                                <div key={pp.id} style={{ fontSize: 12, color: "#475569", padding: "1px 0" }}>
                                  {pp.cantidad_pedida} {pp.producto} {pp.precio_unitario > 0 ? fmtMoney(pp.precio_unitario) : ""}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                          <button onClick={function () { depurarPedido(p.id); }} style={S.btnSm("#16a34a")}>Depurar ✓</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}

        {/* Empty state */}
        {pedidos.length === 0 && (
          <div style={{ ...S.card, textAlign: "center", color: "#94a3b8", padding: 40 }}>
            <p style={{ margin: "0 0 8px", fontSize: 16 }}>No hay pedidos cargados</p>
            <p style={{ fontSize: 13, margin: 0 }}>Hacé click en "+ Cargar pedido" para comenzar</p>
          </div>
        )}
      </div>
    </div>
  );
}

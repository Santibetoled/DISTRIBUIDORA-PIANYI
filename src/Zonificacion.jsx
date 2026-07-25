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
  btnOutline: function (c) { return { background: "none", border: "1px solid " + (c || "#d1d5db"), borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: c || "#475569" }; },
  input: { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" },
  label: { display: "block", fontSize: 10, fontWeight: 600, color: "#475569", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 },
  select: { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, background: "#fff", boxSizing: "border-box" },
  card: { background: "#fff", borderRadius: 10, padding: 14, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,.07)" },
  badge: function (bg, fg) { return { display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: bg, color: fg }; },
};

/* ── Parse WhatsApp paste ── */
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

  var timeMatch = header.match(/(\d{1,2})\s*(?:a|A|-)\s*(\d{1,2}(?:[:.]\d{1,2})?)/);
  if (timeMatch) {
    rangoHorario = timeMatch[0].toUpperCase().replace(/-/g, " A ");
    header = header.replace(timeMatch[0], "").trim();
  }
  var dateMatch = header.match(/^(\d{1,2}\/\d{1,2})\s*/);
  if (dateMatch) header = header.replace(dateMatch[0], "").trim();

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
    var bRegex = new RegExp(bestMatch.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
    direccion = header.replace(bRegex, "").replace(/,\s*$/, "").replace(/^\s*,/, "").trim();
  } else {
    var parts = header.split(",").map(function (p) { return p.trim(); });
    if (parts.length >= 2) {
      direccion = parts[0];
      localidad = parts[parts.length - 1];
      for (var j = 0; j < barriosList.length; j++) {
        if (normalize(localidad) === normalize(barriosList[j].nombre)) { barrioMatch = barriosList[j]; break; }
      }
    } else { direccion = header; }
  }

  for (var k = 1; k < lines.length; k++) {
    var line = lines[k].replace(/^-\s*/, "");
    if (line.indexOf("|") >= 0) {
      var subItems = line.split("|");
      for (var m = 0; m < subItems.length; m++) {
        var sub = subItems[m].trim().replace(/^-\s*/, "");
        var subMatch = sub.match(/^(\d+)\s+(.+?)(?:\s+\$\s*([\d.,]+))?$/);
        if (subMatch) {
          productos.push({ producto: subMatch[2].trim(), cantidad: parseInt(subMatch[1]), precio: subMatch[3] ? Number(subMatch[3].replace(/\./g, "").replace(",", ".")) : 0 });
        }
      }
    } else {
      var prodMatch = line.match(/^(\d+)\s+(.+?)(?:\s+\$\s*([\d.,]+))?$/);
      if (prodMatch) {
        productos.push({ producto: prodMatch[2].trim(), cantidad: parseInt(prodMatch[1]), precio: prodMatch[3] ? Number(prodMatch[3].replace(/\./g, "").replace(",", ".")) : 0 });
      } else if (!vendedor && line.length < 30 && !line.match(/^\d/)) {
        vendedor = line;
      }
    }
  }
  return { direccion: direccion, localidad: localidad, rangoHorario: rangoHorario, vendedor: vendedor, barrioMatch: barrioMatch, productos: productos };
}

/* ── HDR Print Generator (A4 optimized) ── */
function generateHDR(vehiculo, pedidosList, productosPedido, vendedores, rutaCfg) {
  var fecha = new Date().toLocaleDateString("es-AR");
  var rows = pedidosList.map(function (p, idx) {
    var prods = productosPedido.filter(function (pp) { return pp.pedido_id === p.id; });
    var vend = vendedores.find(function (v) { return v.id === p.vendedor_id; });
    var prodLines = [];
    var line = [];
    prods.forEach(function (pp, i) {
      var txt = pp.cantidad_pedida + " " + pp.producto + (pp.precio_unitario > 0 ? " $" + Number(pp.precio_unitario).toLocaleString("es-AR") : "");
      line.push(txt);
      if (line.length === 2 || i === prods.length - 1) { prodLines.push(line.join(" | ")); line = []; }
    });
    return '<div style="margin:6px 0;page-break-inside:avoid;">'
      + '<p style="margin:0;font-weight:700;font-size:11px;">' + (p.fecha_pedido ? p.fecha_pedido.substring(5).replace("-", "/") + " " : "") + (p.direccion || "").toUpperCase() + " " + (p.localidad || "").toUpperCase() + (p.rango_horario ? " " + p.rango_horario : "") + (vend ? " " + vend.nombre.toUpperCase() : "") + '</p>'
      + prodLines.map(function (l) { return '<p style="margin:1px 0 0 12px;font-size:10px;">- ' + l + '</p>'; }).join("")
      + '</div>';
  }).join("");

  var origen = (rutaCfg && rutaCfg.origen) ? rutaCfg.origen : "Depósito";
  var destino = (rutaCfg && rutaCfg.destino) ? rutaCfg.destino : "Depósito";

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>HDR ' + vehiculo.patente + ' ' + fecha + '</title>'
    + '<style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:Arial,Helvetica,sans-serif;padding:10mm;font-size:11px;color:#000}'
    + 'table{border-collapse:collapse;width:100%;margin-bottom:3px}'
    + 'td,th{border:1px solid #000;padding:4px 6px;font-size:10px;vertical-align:middle}'
    + '.header-table td{height:22px}'
    + '@media print{.no-print{display:none!important}}'
    + '@page{size:A4;margin:8mm}'
    + '</style></head><body>'
    + '<div class="no-print" style="text-align:center;margin-bottom:10px;"><button onclick="window.print()" style="background:#E65100;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;">Imprimir / Guardar PDF</button></div>'
    // Header table
    + '<table class="header-table">'
    + '<tr><td style="width:12%"><b>FECHA</b></td><td style="width:13%">' + fecha + '</td><td style="width:12%"><b>VEHICULO</b></td><td style="width:18%">' + vehiculo.patente + '</td><td style="width:10%"><b>NV DIA</b></td><td style="width:8%"></td><td style="width:15%"><b>FALTANTES</b></td><td style="width:12%"><b>FIRMA ADM</b></td></tr>'
    + '<tr><td><b>CARGA</b></td><td></td><td><b>CHOFER</b></td><td>' + (vehiculo.chofer_habitual || "") + '</td><td><b>NV PEND</b></td><td></td><td></td><td rowspan="2" style="text-align:center"><b>FIRMA REPARTO</b></td></tr>'
    + '<tr><td><b>CONTROL</b></td><td></td><td><b>ACOMP.</b></td><td>' + (vehiculo.acompanante_habitual || "") + '</td><td><b>TOTAL NV</b></td><td><b>' + pedidosList.length + '</b></td><td></td></tr>'
    + '</table>'
    // Totals table
    + '<table class="header-table">'
    + '<tr><td><b>TOTAL NV</b></td><td><b>CASH</b></td><td><b>TRANSF.</b></td><td><b>FIRMAS</b></td><td><b>CANT</b></td><td><b>DESC.</b></td><td><b>SOBRANTES</b></td><td><b>P.CASH</b></td><td><b>P.TRANSF</b></td></tr>'
    + '<tr><td style="height:20px"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
    + '</table>'
    + '<table class="header-table"><tr><td style="width:50%"><b>FACTURACION</b></td><td></td><td><b>CAJA CASH</b></td><td></td></tr></table>'
    // Route info
    + '<div style="margin:6px 0;font-size:9px;color:#666;">Origen: ' + origen + ' — Destino: ' + destino + '</div>'
    + '<hr style="border:1px solid #000;margin:4px 0 8px;">'
    // Pedidos
    + rows
    // Footer
    + '<hr style="border:1px solid #000;margin:10px 0 4px;">'
    + '<table><tr><td style="width:25%;height:50px"><b>ROTURAS</b></td><td style="width:40%"><b>SOBRANTES</b></td><td style="width:17%"><b>FIRMA ADM</b></td><td style="width:18%"><b>FIRMA REPARTO</b></td></tr>'
    + '<tr><td style="height:50px"></td><td></td><td></td><td></td></tr></table>'
    + '</body></html>';
}

/* ══════════════════════════════════════════ */
export default function Zonificacion({ user, onBack }) {
  var [zonas, setZonas] = useState([]);
  var [barrios, setBarrios] = useState([]);
  var [vendedores, setVendedores] = useState([]);
  var [vehiculos, setVehiculos] = useState([]);
  var [pedidos, setPedidos] = useState([]);
  var [productosPedido, setProductosPedido] = useState([]);
  var [loading, setLoading] = useState(true);
  var [tab, setTab] = useState("zona");
  var [showAdd, setShowAdd] = useState(false);
  var [pasteText, setPasteText] = useState("");
  var [editParsed, setEditParsed] = useState(null);
  var [parsedPreview, setParsedPreview] = useState(null);
  var [saving, setSaving] = useState(false);
  var [search, setSearch] = useState("");
  var [selectedPedidos, setSelectedPedidos] = useState({});
  var [expandedZonas, setExpandedZonas] = useState({});
  var [showAssign, setShowAssign] = useState(false);
  var [depurando, setDepurando] = useState(null); // pedido id being depurated
  var [depurRows, setDepurRows] = useState({}); // { prod_id: "entregado"|"rechazado" }
  var [depurQty, setDepurQty] = useState({}); // { prod_id: cantidad_entregada }
  var [showHDR, setShowHDR] = useState(null);
  var [manualOrder, setManualOrder] = useState({}); // { pedido_id: number }
  var [reporteEntregas, setReporteEntregas] = useState([]);
  var [rutaConfig, setRutaConfig] = useState({}); // { vehiculo_id: { origen: "", destino: "" } }
  var searchRef = useRef();

  /* ── Load Data ── */
  var loadData = useCallback(async function () {
    var [zRes, bRes, vRes, vhRes, pRes, ppRes] = await Promise.all([
      supabase.from("zonas").select("*").order("nombre"),
      supabase.from("barrios").select("*").order("nombre"),
      supabase.from("vendedores").select("*").eq("activo", true).order("nombre"),
      supabase.from("vehiculos").select("*").eq("activo", true).order("patente"),
      supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
      supabase.from("productos_pedido").select("*"),
    ]);
    if (zRes.data) { setZonas(zRes.data); var exp = {}; zRes.data.forEach(function (z) { exp[z.id] = true; }); setExpandedZonas(exp); }
    if (bRes.data) setBarrios(bRes.data);
    if (vRes.data) setVendedores(vRes.data);
    if (vhRes.data) setVehiculos(vhRes.data);
    if (pRes.data) setPedidos(pRes.data);
    if (ppRes.data) setProductosPedido(ppRes.data);
    setLoading(false);
  }, []);
  useEffect(function () { loadData(); }, [loadData]);

  useEffect(function () {
    function hk(e) { if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "b")) { e.preventDefault(); if (searchRef.current) searchRef.current.focus(); } }
    window.addEventListener("keydown", hk);
    return function () { window.removeEventListener("keydown", hk); };
  }, []);

  /* ── Parse ── */
  function handleParse() {
    if (!pasteText.trim()) return;
    var parsed = parsePedido(pasteText, barrios);
    if (parsed) {
      var ep = { direccion: parsed.direccion, localidad: parsed.localidad, barrio_id: parsed.barrioMatch ? parsed.barrioMatch.id : "", zona_nombre: parsed.barrioMatch ? (zonas.find(function (z) { return z.id === parsed.barrioMatch.zona_id; }) || {}).nombre || "" : "", rango_horario: parsed.rangoHorario, vendedor: parsed.vendedor, vendedor_id: "", productos: parsed.productos.length > 0 ? parsed.productos : [{ producto: "", cantidad: 1, precio: 0 }], texto_original: pasteText };
      if (parsed.vendedor) {
        var vNorm = normalize(parsed.vendedor);
        var vMatch = vendedores.find(function (v) { return normalize(v.nombre) === vNorm; });
        if (vMatch) ep.vendedor_id = vMatch.id;
      }
      setEditParsed(ep);
      setParsedPreview(parsed);
    }
  }

  /* ── Save ── */
  async function savePedido() {
    if (!editParsed || !editParsed.direccion) return;
    setSaving(true);
    var dup = pedidos.find(function (p) { return normalize(p.direccion) === normalize(editParsed.direccion) && p.fecha_pedido === today() && p.estado !== "depurado"; });
    if (dup && !confirm("⚠️ Ya existe un pedido para \"" + dup.direccion + "\" hoy. ¿Agregar otro?")) { setSaving(false); return; }
    var res = await supabase.from("pedidos").insert({ barrio_id: editParsed.barrio_id || null, vendedor_id: editParsed.vendedor_id || null, fecha_pedido: today(), direccion: editParsed.direccion, localidad: editParsed.localidad, rango_horario: editParsed.rango_horario, cliente_nombre: editParsed.direccion, estado: "disponible", texto_original: editParsed.texto_original }).select();
    if (res.data && res.data[0]) {
      var pid = res.data[0].id;
      var prods = editParsed.productos.filter(function (p) { return p.producto; });
      if (prods.length > 0) {
        var ins = prods.map(function (p) { return { pedido_id: pid, producto: p.producto, cantidad_pedida: p.cantidad || 1, precio_unitario: p.precio || 0 }; });
        var ppRes = await supabase.from("productos_pedido").insert(ins).select();
        if (ppRes.data) setProductosPedido(function (prev) { return [...prev, ...ppRes.data]; });
      }
      setPedidos(function (prev) { return [res.data[0], ...prev]; });
    }
    setPasteText(""); setEditParsed(null); setParsedPreview(null); setSaving(false); setShowAdd(false);
  }

  function addProductRow() { setEditParsed(function (prev) { return { ...prev, productos: [...prev.productos, { producto: "", cantidad: 1, precio: 0 }] }; }); }
  function updateProduct(idx, field, value) { setEditParsed(function (prev) { var p = [...prev.productos]; p[idx] = { ...p[idx], [field]: value }; return { ...prev, productos: p }; }); }
  function removeProduct(idx) { setEditParsed(function (prev) { return { ...prev, productos: prev.productos.filter(function (_, i) { return i !== idx; }) }; }); }

  /* ── Selection ── */
  function toggleSelect(id) { setSelectedPedidos(function (p) { var c = { ...p }; if (c[id]) delete c[id]; else c[id] = true; return c; }); }
  function selectAllInZona(zonaId) {
    var zp = getFiltered().filter(function (p) { var b = barrios.find(function (bb) { return bb.id === p.barrio_id; }); return b && b.zona_id === zonaId && p.estado === "disponible"; });
    setSelectedPedidos(function (prev) { var c = { ...prev }; zp.forEach(function (p) { c[p.id] = true; }); return c; });
  }

  /* ── Assign ── */
  async function assignToVehicle(vehiculoId) {
    var veh = vehiculos.find(function (v) { return v.id === vehiculoId; });
    if (!veh) return;
    var ids = Object.keys(selectedPedidos);
    if (ids.length === 0) return;
    var rRes = await supabase.from("repartos").insert({ vehiculo_id: vehiculoId, fecha: today(), chofer: veh.chofer_habitual || "", acompanante: veh.acompanante_habitual || "", estado: "preparando" }).select();
    if (rRes.data && rRes.data[0]) {
      var rid = rRes.data[0].id;
      var links = ids.map(function (pid, idx) { return { reparto_id: rid, pedido_id: pid, orden_ruta: idx + 1 }; });
      await supabase.from("reparto_pedidos").insert(links);
      await supabase.from("pedidos").update({ estado: "en_calle", color_asignado: veh.color_hex }).in("id", ids);
      setPedidos(function (prev) { return prev.map(function (p) { return ids.indexOf(p.id) >= 0 ? { ...p, estado: "en_calle", color_asignado: veh.color_hex } : p; }); });
    }
    setSelectedPedidos({}); setShowAssign(false);
  }

  /* ── Depuración total: entregado ── */
  async function depurarTotal(id, resultado) {
    var pedido = pedidos.find(function (p) { return p.id === id; });
    var prods = productosPedido.filter(function (pp) { return pp.pedido_id === id; });
    // Save to daily report
    var items = prods.map(function (pp) { return { producto: pp.producto, cantidad: pp.cantidad_pedida, precio: pp.precio_unitario, rechazado: resultado === "rechazado" }; });
    setReporteEntregas(function (prev) { return [...prev, { pedido_id: id, direccion: pedido.direccion, localidad: pedido.localidad, vendedor_id: pedido.vendedor_id, fecha: today(), resultado: resultado, items: items }]; });
    await supabase.from("pedidos").update({ estado: "depurado", fecha_depurado: today(), nota_depuracion: resultado === "entregado" ? "Entregado total" : "Rechazado total" }).eq("id", id);
    setPedidos(function (prev) { return prev.map(function (p) { return p.id === id ? { ...p, estado: "depurado", fecha_depurado: today() } : p; }); });
    setDepurando(null);
  }

  /* ── Vuelve a zonificación ── */
  async function volverAZonificacion(id) {
    await supabase.from("pedidos").update({ estado: "disponible", color_asignado: null }).eq("id", id);
    setPedidos(function (prev) { return prev.map(function (p) { return p.id === id ? { ...p, estado: "disponible", color_asignado: null } : p; }); });
  }

  /* ── Depuración parcial con cantidades ── */
  async function confirmarParcial(pedidoId) {
    var prods = productosPedido.filter(function (pp) { return pp.pedido_id === pedidoId; });
    var pedido = pedidos.find(function (p) { return p.id === pedidoId; });
    var entregaItems = [];
    var pendienteUpdates = [];
    var deleteIds = [];

    for (var i = 0; i < prods.length; i++) {
      var pp = prods[i];
      var estado = depurRows[pp.id];
      var qtyEntregada = depurQty[pp.id] !== undefined ? depurQty[pp.id] : pp.cantidad_pedida;

      if (estado === "entregado") {
        if (qtyEntregada >= pp.cantidad_pedida) {
          // Entregado total de esta fila
          entregaItems.push({ producto: pp.producto, cantidad: pp.cantidad_pedida, precio: pp.precio_unitario });
          deleteIds.push(pp.id);
        } else {
          // Entregado parcial: entrega qtyEntregada, queda el resto
          var restante = pp.cantidad_pedida - qtyEntregada;
          entregaItems.push({ producto: pp.producto, cantidad: qtyEntregada, precio: pp.precio_unitario });
          pendienteUpdates.push({ id: pp.id, cantidad_pedida: restante });
        }
      } else if (estado === "rechazado") {
        entregaItems.push({ producto: pp.producto, cantidad: pp.cantidad_pedida, precio: pp.precio_unitario, rechazado: true });
        deleteIds.push(pp.id);
      }
      // Si no tiene estado, queda como está (pendiente)
    }

    // Guardar en reporte diario
    if (entregaItems.length > 0) {
      setReporteEntregas(function (prev) { return [...prev, { pedido_id: pedidoId, direccion: pedido.direccion, localidad: pedido.localidad, vendedor_id: pedido.vendedor_id, fecha: today(), items: entregaItems }]; });
    }

    // Borrar filas entregadas/rechazadas completas
    if (deleteIds.length > 0) {
      await supabase.from("productos_pedido").delete().in("id", deleteIds);
      setProductosPedido(function (prev) { return prev.filter(function (pp) { return deleteIds.indexOf(pp.id) < 0; }); });
    }

    // Actualizar cantidades de filas parciales
    for (var j = 0; j < pendienteUpdates.length; j++) {
      await supabase.from("productos_pedido").update({ cantidad_pedida: pendienteUpdates[j].cantidad_pedida }).eq("id", pendienteUpdates[j].id);
      setProductosPedido(function (prev) { return prev.map(function (pp) { var upd = pendienteUpdates.find(function (u) { return u.id === pp.id; }); return upd ? { ...pp, cantidad_pedida: upd.cantidad_pedida } : pp; }); });
    }

    // Verificar si quedan productos pendientes
    var prodsRestantes = productosPedido.filter(function (pp) { return pp.pedido_id === pedidoId && deleteIds.indexOf(pp.id) < 0; });
    if (prodsRestantes.length > 0 || pendienteUpdates.length > 0) {
      await supabase.from("pedidos").update({ estado: "disponible", color_asignado: null, nota_depuracion: "(DEPURADO " + fmtDate(today()) + ")" }).eq("id", pedidoId);
      setPedidos(function (prev) { return prev.map(function (p) { return p.id === pedidoId ? { ...p, estado: "disponible", color_asignado: null, nota_depuracion: "(DEPURADO " + fmtDate(today()) + ")" } : p; }); });
    } else {
      await supabase.from("pedidos").update({ estado: "depurado", fecha_depurado: today(), nota_depuracion: "Depurado completo" }).eq("id", pedidoId);
      setPedidos(function (prev) { return prev.map(function (p) { return p.id === pedidoId ? { ...p, estado: "depurado" } : p; }); });
    }
    setDepurando(null); setDepurRows({}); setDepurQty({});
  }

  /* ── Delete ── */
  async function deletePedido(id) {
    if (!confirm("¿Eliminar este pedido?")) return;
    await supabase.from("productos_pedido").delete().eq("pedido_id", id);
    await supabase.from("pedidos").delete().eq("id", id);
    setPedidos(function (prev) { return prev.filter(function (p) { return p.id !== id; }); });
    setProductosPedido(function (prev) { return prev.filter(function (pp) { return pp.pedido_id !== id; }); });
  }

  /* ── HDR Print ── */
  function printHDR(vehiculoId) {
    var veh = vehiculos.find(function (v) { return v.id === vehiculoId; });
    if (!veh) return;
    var vehPedidos = getEnCalle().filter(function (p) { return p.color_asignado === veh.color_hex; });
    // Sort by manual order
    vehPedidos.sort(function (a, b) { return (manualOrder[a.id] || 999) - (manualOrder[b.id] || 999); });
    var cfg = rutaConfig[vehiculoId] || { origen: "Depósito", destino: "Depósito" };
    var html = generateHDR(veh, vehPedidos, productosPedido, vendedores, cfg);
    var w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  }

  /* ── Reorder visually ── */
  function aplicarOrden(vehiculoId) {
    var veh = vehiculos.find(function (v) { return v.id === vehiculoId; });
    if (!veh) return;
    var vehPedidos = pedidos.filter(function (p) { return p.estado === "en_calle" && p.color_asignado === veh.color_hex; });
    // If no manual order set, do nothing
    var hasOrder = vehPedidos.some(function (p) { return manualOrder[p.id]; });
    if (!hasOrder) return;
    // Sort and renumber 1,2,3...
    var sorted = vehPedidos.slice().sort(function (a, b) { return (manualOrder[a.id] || 999) - (manualOrder[b.id] || 999); });
    var newOrder = {};
    sorted.forEach(function (p, idx) { newOrder[p.id] = idx + 1; });
    setManualOrder(function (prev) { return { ...prev, ...newOrder }; });
  }

  /* ── Filters ── */
  function getFiltered() {
    var visible = pedidos.filter(function (p) { return p.estado !== "depurado"; });
    if (!search) return visible;
    var s = normalize(search);
    return visible.filter(function (p) { return normalize(p.direccion).indexOf(s) >= 0 || normalize(p.localidad || "").indexOf(s) >= 0 || normalize(p.cliente_nombre || "").indexOf(s) >= 0; });
  }
  function getDisponibles() { return getFiltered().filter(function (p) { return p.estado === "disponible"; }); }
  function getEnCalle() { return getFiltered().filter(function (p) { return p.estado === "en_calle"; }); }

  function getPedidosByZona() {
    var filtered = getDisponibles();
    var grouped = {};
    zonas.forEach(function (z) { grouped[z.id] = { zona: z, pedidos: [] }; });
    grouped["sin_zona"] = { zona: { id: "sin_zona", nombre: "Sin zona asignada" }, pedidos: [] };
    filtered.forEach(function (p) {
      var b = barrios.find(function (bb) { return bb.id === p.barrio_id; });
      if (b && grouped[b.zona_id]) grouped[b.zona_id].pedidos.push(p);
      else grouped["sin_zona"].pedidos.push(p);
    });
    return grouped;
  }

  function getEnCalleByVehiculo() {
    var filtered = getEnCalle();
    var grouped = {};
    vehiculos.forEach(function (v) { grouped[v.id] = { vehiculo: v, pedidos: [] }; });
    filtered.forEach(function (p) {
      var veh = vehiculos.find(function (v) { return v.color_hex === p.color_asignado; });
      if (veh && grouped[veh.id]) grouped[veh.id].pedidos.push(p);
    });
    return grouped;
  }

  var selectedCount = Object.keys(selectedPedidos).length;
  var totalDisponibles = pedidos.filter(function (p) { return p.estado === "disponible"; }).length;
  var totalEnCalle = pedidos.filter(function (p) { return p.estado === "en_calle"; }).length;

  /* ── Render pedido card ── */
  function renderPedido(p, opts) {
    var prods = productosPedido.filter(function (pp) { return pp.pedido_id === p.id; });
    var isSelected = selectedPedidos[p.id];
    var vend = vendedores.find(function (v) { return v.id === p.vendedor_id; });
    var isDepurando = depurando === p.id;

    return (
      <div key={p.id} style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", background: isSelected ? "#eff6ff" : "transparent", borderLeft: p.color_asignado && opts.showColor ? "4px solid " + p.color_asignado : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            {opts.selectable && p.estado === "disponible" && (
              <input type="checkbox" checked={!!isSelected} onChange={function () { toggleSelect(p.id); }} style={{ marginTop: 3, cursor: "pointer", accentColor: "#0284C7" }} />
            )}
            {opts.showColor && p.color_asignado && (
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: p.color_asignado, marginTop: 3, flexShrink: 0 }} />
            )}
            <div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                {opts.orderNum ? opts.orderNum + ". " : ""}{p.direccion}
              </span>
              {p.localidad && <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>{p.localidad.toUpperCase()}</span>}
              {p.rango_horario && <span style={{ fontSize: 11, color: "#0284C7", marginLeft: 6 }}>{p.rango_horario}</span>}
              {vend && <span style={{ fontSize: 11, color: "#E65100", marginLeft: 6 }}>{vend.nombre}</span>}
              {p.nota_depuracion && <span style={S.badge("#fef3c7", "#92400e")}> {p.nota_depuracion}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {p.estado === "disponible" && (
              <button onClick={function () { deletePedido(p.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14 }}>✕</button>
            )}
          </div>
        </div>

        {/* Product rows */}
        <div style={{ marginTop: 4, marginLeft: opts.selectable ? 28 : 0 }}>
          {prods.map(function (pp) {
            var rowStyle = { fontSize: 12, color: "#475569", padding: "3px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 };
            var isMarked = isDepurando && depurRows[pp.id];
            if (isMarked) { rowStyle.opacity = 0.6; }
            return (
              <div key={pp.id} style={rowStyle}>
                <span style={{ textDecoration: isMarked ? "line-through" : "none" }}>{pp.cantidad_pedida} {pp.producto}{pp.precio_unitario > 0 ? " " + fmtMoney(pp.precio_unitario) : ""}</span>
                {isDepurando && (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {depurRows[pp.id] === "entregado" && pp.cantidad_pedida > 1 && (
                      <input type="number" min="1" max={pp.cantidad_pedida} value={depurQty[pp.id] !== undefined ? depurQty[pp.id] : pp.cantidad_pedida} onChange={function () { var ppId = pp.id; var max = pp.cantidad_pedida; return function (e) { var v = Math.min(Math.max(parseInt(e.target.value) || 1, 1), max); setDepurQty(function (pr) { return { ...pr, [ppId]: v }; }); }; }()} style={{ width: 50, padding: "2px 4px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, textAlign: "center" }} title="Cantidad entregada" />
                    )}
                    <button onClick={function () { var ppId = pp.id; return function () { setDepurRows(function (pr) { var c = { ...pr }; if (c[ppId] === "entregado") { delete c[ppId]; } else { c[ppId] = "entregado"; } return c; }); }; }()} style={S.btnSm(depurRows[pp.id] === "entregado" ? "#16a34a" : "#d1d5db")}>✓</button>
                    <button onClick={function () { var ppId = pp.id; return function () { setDepurRows(function (pr) { var c = { ...pr }; if (c[ppId] === "rechazado") { delete c[ppId]; } else { c[ppId] = "rechazado"; } return c; }); }; }()} style={S.btnSm(depurRows[pp.id] === "rechazado" ? "#dc2626" : "#d1d5db")}>✗</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons for en_calle */}
        {opts.showActions && p.estado === "en_calle" && !isDepurando && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={function () { setDepurando(p.id); setDepurRows({}); }} style={S.btnSm("#d97706")}>Entrega parcial</button>
            <button onClick={function () { depurarTotal(p.id, "entregado"); }} style={S.btnSm("#16a34a")}>Entrega total ✓</button>
            <button onClick={function () { depurarTotal(p.id, "rechazado"); }} style={S.btnSm("#dc2626")}>Rechazado ✗</button>
            <button onClick={function () { volverAZonificacion(p.id); }} style={S.btnOutline("#0284C7")}>↩ Vuelve a zonificación</button>
          </div>
        )}

        {/* Partial depuration confirm */}
        {isDepurando && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Marcá ✓ entregado o ✗ rechazado por fila. Lo no marcado vuelve a zonificación.</span>
            <button onClick={function () { confirmarParcial(p.id); }} style={S.btnSm("#16a34a")}>Confirmar</button>
            <button onClick={function () { setDepurando(null); setDepurRows({}); }} style={S.btnSm("#94a3b8")}>Cancelar</button>
          </div>
        )}

        {/* Manual order for HDR */}
        {opts.showOrder && (
          <div style={{ marginTop: 4 }}>
            <input type="number" placeholder="Orden" value={manualOrder[p.id] || ""} onChange={function (e) { setManualOrder(function (prev) { return { ...prev, [p.id]: parseInt(e.target.value) || 0 }; }); }} style={{ width: 60, padding: "3px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, textAlign: "center" }} />
          </div>
        )}

        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{fmtDate(p.fecha_pedido)}</div>
      </div>
    );
  }

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
          <span style={S.badge("#dcfce7", "#166534")}>{totalDisponibles} disponibles</span>
          <span style={S.badge("#fef3c7", "#92400e")}>{totalEnCalle} en calle</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={function () { setShowAdd(!showAdd); setTab("zona"); }} style={S.btn(showAdd ? "#94a3b8" : "#0284C7")}>+ Cargar pedido</button>
          <button onClick={function () { setTab("zona"); }} style={S.btn(tab === "zona" ? "#0284C7" : "#94a3b8")}>Por zona</button>
          <button onClick={function () { setTab("en_calle"); }} style={S.btn(tab === "en_calle" ? "#E65100" : "#94a3b8")}>Pedidos en calle ({totalEnCalle})</button>
          <button onClick={function () { setTab("reporte"); }} style={S.btn(tab === "reporte" ? "#16a34a" : "#94a3b8")}>Reporte diario ({reporteEntregas.length})</button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selectedCount > 0 && <button onClick={function () { setShowAssign(true); }} style={S.btn("#16a34a")}>Asignar {selectedCount} a camioneta</button>}
          <div style={{ position: "relative" }}>
            <input ref={searchRef} type="text" placeholder="Buscar... (Ctrl+F)" style={{ ...S.input, width: 200, paddingLeft: 28, fontSize: 12 }} value={search} onChange={function (e) { setSearch(e.target.value); }} />
            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13 }}>🔍</span>
          </div>
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>

        {/* ═══ ADD PEDIDO ═══ */}
        {showAdd && (
          <div style={{ ...S.card, border: "2px solid #0284C7", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: "#0284C7" }}>Cargar pedido</h3>
              <button onClick={function () { setShowAdd(false); setEditParsed(null); setPasteText(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18 }}>✕</button>
            </div>
            {!editParsed ? (
              <div>
                <label style={S.label}>Pegá el pedido de WhatsApp</label>
                <textarea style={{ ...S.input, height: 100, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} placeholder={"Murguiando 639, Liniers\nBenjamin\n3 imperial Golden $1599\n2 Heineken lata $2190"} value={pasteText} onChange={function (e) { setPasteText(e.target.value); }} />
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button onClick={handleParse} style={S.btn("#0284C7")} disabled={!pasteText.trim()}>Procesar</button>
                  <button onClick={function () { setEditParsed({ direccion: "", localidad: "", barrio_id: "", zona_nombre: "", rango_horario: "", vendedor: "", vendedor_id: "", productos: [{ producto: "", cantidad: 1, precio: 0 }], texto_original: "" }); }} style={S.btn("#64748b")}>Carga manual</button>
                </div>
              </div>
            ) : (
              <div>
                {parsedPreview && parsedPreview.barrioMatch && (
                  <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 12, color: "#166534" }}>✓ Zona: <strong>{editParsed.zona_nombre}</strong> — Barrio: <strong>{editParsed.localidad}</strong></div>
                )}
                {parsedPreview && !parsedPreview.barrioMatch && editParsed.localidad && (
                  <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 12, color: "#92400e" }}>⚠ Barrio no detectado. Seleccioná manualmente.</div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div><label style={S.label}>Dirección</label><input style={S.input} value={editParsed.direccion} onChange={function (e) { setEditParsed({ ...editParsed, direccion: e.target.value }); }} /></div>
                  <div><label style={S.label}>Barrio</label>
                    <select style={S.select} value={editParsed.barrio_id} onChange={function (e) { var bid = e.target.value; var b = barrios.find(function (bb) { return bb.id === bid; }); var z = b ? zonas.find(function (zz) { return zz.id === b.zona_id; }) : null; setEditParsed({ ...editParsed, barrio_id: bid, localidad: b ? b.nombre : "", zona_nombre: z ? z.nombre : "" }); }}>
                      <option value="">— Seleccionar —</option>
                      {zonas.map(function (z) { var zb = barrios.filter(function (b) { return b.zona_id === z.id; }); return <optgroup key={z.id} label={z.nombre}>{zb.map(function (b) { return <option key={b.id} value={b.id}>{b.nombre}</option>; })}</optgroup>; })}
                    </select></div>
                  <div><label style={S.label}>Horario</label><input style={S.input} placeholder="9 A 14" value={editParsed.rango_horario} onChange={function (e) { setEditParsed({ ...editParsed, rango_horario: e.target.value }); }} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div><label style={S.label}>Vendedor</label>
                    <select style={S.select} value={editParsed.vendedor_id} onChange={function (e) { setEditParsed({ ...editParsed, vendedor_id: e.target.value }); }}>
                      <option value="">— Seleccionar —</option>
                      {vendedores.map(function (v) { return <option key={v.id} value={v.id}>{v.nombre}</option>; })}
                    </select>
                    {editParsed.vendedor && !editParsed.vendedor_id && <div style={{ fontSize: 10, color: "#d97706", marginTop: 2 }}>Detectado: "{editParsed.vendedor}"</div>}
                  </div>
                  <div><label style={S.label}>Zona</label><input style={{ ...S.input, background: "#f1f5f9" }} value={editParsed.zona_nombre || "Sin zona"} readOnly /></div>
                </div>
                <label style={{ ...S.label, marginBottom: 6 }}>Productos</label>
                {editParsed.productos.map(function (prod, idx) {
                  return (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "55px 1fr 90px 24px", gap: 4, marginBottom: 3 }}>
                      <input type="number" style={S.input} placeholder="Cant" value={prod.cantidad} onChange={function (e) { updateProduct(idx, "cantidad", parseInt(e.target.value) || 0); }} />
                      <input style={S.input} placeholder="Producto" value={prod.producto} onChange={function (e) { updateProduct(idx, "producto", e.target.value); }} />
                      <input type="number" style={S.input} placeholder="$Precio" value={prod.precio || ""} onChange={function (e) { updateProduct(idx, "precio", parseFloat(e.target.value) || 0); }} />
                      <button onClick={function () { removeProduct(idx); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14 }}>✕</button>
                    </div>
                  );
                })}
                <button onClick={addProductRow} style={{ background: "none", border: "1px dashed #d1d5db", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: "#64748b", marginTop: 3 }}>+ Producto</button>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={function () { setEditParsed(null); setPasteText(""); setParsedPreview(null); }} style={S.btn("#94a3b8")}>Cancelar</button>
                  <button onClick={savePedido} disabled={!editParsed.direccion || saving} style={S.btn("#16a34a")}>{saving ? "Guardando..." : "Guardar"}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ASSIGN MODAL ═══ */}
        {showAssign && (
          <div style={{ ...S.card, border: "2px solid #16a34a", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: "#16a34a" }}>Asignar {selectedCount} pedido{selectedCount !== 1 ? "s" : ""} a:</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {vehiculos.map(function (v) {
                return (
                  <button key={v.id} onClick={function () { assignToVehicle(v.id); }} style={{ background: "#fff", border: "2px solid " + v.color_hex, borderRadius: 10, padding: 12, cursor: "pointer", textAlign: "center" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: v.color_hex, margin: "0 auto 6px" }} />
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{v.patente}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{v.chofer_habitual || ""}</div>
                  </button>
                );
              })}
            </div>
            <button onClick={function () { setShowAssign(false); }} style={{ ...S.btn("#94a3b8"), marginTop: 8 }}>Cancelar</button>
          </div>
        )}

        {/* ═══ POR ZONA ═══ */}
        {tab === "zona" && (function () {
          var grouped = getPedidosByZona();
          var hasAny = false;
          return (
            <div>
              {Object.keys(grouped).map(function (zid) {
                var g = grouped[zid];
                if (g.pedidos.length === 0) return null;
                hasAny = true;
                var isExp = expandedZonas[zid];
                return (
                  <div key={zid} style={{ marginBottom: 10 }}>
                    <div onClick={function () { setExpandedZonas(function (p) { return { ...p, [zid]: !p[zid] }; }); }}
                      style={{ background: "#1a1a1a", color: "#fff", padding: "10px 14px", borderRadius: isExp ? "10px 10px 0 0" : 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11 }}>{isExp ? "▼" : "▶"}</span>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{g.zona.nombre}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 12, opacity: 0.7 }}>{g.pedidos.length}</span>
                        <button onClick={function (e) { e.stopPropagation(); selectAllInZona(zid); }} style={S.btnSm("rgba(255,255,255,.2)")}>Seleccionar</button>
                      </div>
                    </div>
                    {isExp && (
                      <div style={{ background: "#fff", borderRadius: "0 0 10px 10px", border: "1px solid #e2e8f0", borderTop: "none" }}>
                        {g.pedidos.map(function (p) { return renderPedido(p, { selectable: true, showColor: false, showActions: false }); })}
                      </div>
                    )}
                  </div>
                );
              })}
              {!hasAny && (
                <div style={{ ...S.card, textAlign: "center", color: "#94a3b8", padding: 36 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 15 }}>No hay pedidos disponibles</p>
                  <p style={{ fontSize: 13, margin: 0 }}>Cargá pedidos con el botón "+ Cargar pedido"</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ PEDIDOS EN CALLE ═══ */}
        {tab === "en_calle" && (function () {
          var grouped = getEnCalleByVehiculo();
          var hasAny = false;
          return (
            <div>
              {Object.keys(grouped).map(function (vid) {
                var g = grouped[vid];
                if (g.pedidos.length === 0) return null;
                hasAny = true;
                var v = g.vehiculo;
                return (
                  <div key={vid} style={{ marginBottom: 14 }}>
                    <div style={{ background: v.color_hex, color: "#fff", padding: "10px 14px", borderRadius: "10px 10px 0 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{v.patente} — {v.chofer_habitual || v.alias || ""}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={{ fontSize: 12, opacity: 0.9 }}>{g.pedidos.length} pedidos</span>
                          <button onClick={function () { aplicarOrden(v.id); }} style={S.btnSm("rgba(255,255,255,.25)")}>Reordenar</button>
                          <button onClick={function () { printHDR(v.id); }} style={S.btnSm("rgba(255,255,255,.4)")}>Imprimir HDR</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ opacity: 0.7 }}>Origen:</span>
                          <input type="text" placeholder="Depósito" value={(rutaConfig[v.id] || {}).origen || ""} onClick={function (e) { e.stopPropagation(); }} onChange={function () { var vid = v.id; return function (e) { setRutaConfig(function (prev) { return { ...prev, [vid]: { ...(prev[vid] || {}), origen: e.target.value } }; }); }; }()} style={{ background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 4, padding: "2px 6px", color: "#fff", fontSize: 11, width: 150 }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ opacity: 0.7 }}>Destino:</span>
                          <input type="text" placeholder="Depósito" value={(rutaConfig[v.id] || {}).destino || ""} onClick={function (e) { e.stopPropagation(); }} onChange={function () { var vid = v.id; return function (e) { setRutaConfig(function (prev) { return { ...prev, [vid]: { ...(prev[vid] || {}), destino: e.target.value } }; }); }; }()} style={{ background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 4, padding: "2px 6px", color: "#fff", fontSize: 11, width: 150 }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: "0 0 10px 10px", border: "1px solid #e2e8f0", borderTop: "none" }}>
                      {g.pedidos.map(function (p, idx) { return renderPedido(p, { selectable: false, showColor: true, showActions: true, showOrder: true, orderNum: manualOrder[p.id] || (idx + 1) }); })}
                    </div>
                  </div>
                );
              })}
              {!hasAny && (
                <div style={{ ...S.card, textAlign: "center", color: "#94a3b8", padding: 36 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 15 }}>No hay pedidos en calle</p>
                  <p style={{ fontSize: 13, margin: 0 }}>Asigná pedidos a una camioneta desde la vista "Por zona"</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ REPORTE DIARIO ═══ */}
        {tab === "reporte" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17, color: "#1a1a1a" }}>Reporte diario — {fmtDate(today())}</h2>
              <button onClick={function () {
                if (reporteEntregas.length === 0) return;
                var rows = reporteEntregas.map(function (e) {
                  var vend = vendedores.find(function (v) { return v.id === e.vendedor_id; });
                  var itemsText = e.items.map(function (it) { return (it.rechazado ? "[RECH] " : "") + it.cantidad + " " + it.producto + (it.precio > 0 ? " $" + Number(it.precio).toLocaleString("es-AR") : ""); }).join("<br/>");
                  return "<tr><td style='border:1px solid #ccc;padding:6px;font-weight:700'>" + e.direccion + " " + (e.localidad || "").toUpperCase() + "</td><td style='border:1px solid #ccc;padding:6px'>" + (vend ? vend.nombre : "-") + "</td><td style='border:1px solid #ccc;padding:6px'>" + (e.resultado === "rechazado" ? "RECHAZADO" : "ENTREGADO") + "</td><td style='border:1px solid #ccc;padding:6px;font-size:11px'>" + itemsText + "</td></tr>";
                }).join("");
                var html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Reporte " + today() + "</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;font-size:12px}table{border-collapse:collapse;width:100%}@media print{.no-print{display:none!important}}@page{size:A4;margin:10mm}</style></head><body><div class='no-print' style='text-align:center;margin-bottom:12px'><button onclick='window.print()' style='background:#16a34a;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;cursor:pointer'>Imprimir / PDF</button></div><h2 style='text-align:center'>REPORTE DIARIO — " + new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + "</h2><p style='text-align:center;color:#666'>Total: " + reporteEntregas.length + " entregas</p><table><tr style='background:#1a1a1a;color:#fff'><th style='border:1px solid #ccc;padding:8px;text-align:left'>Cliente</th><th style='border:1px solid #ccc;padding:8px'>Vendedor</th><th style='border:1px solid #ccc;padding:8px'>Estado</th><th style='border:1px solid #ccc;padding:8px'>Productos</th></tr>" + rows + "</table><p style='text-align:center;margin-top:20px;color:#aaa;font-size:10px'>Distribuidora Pianyi — " + new Date().toLocaleString("es-AR") + "</p></body></html>";
                var w = window.open("", "_blank"); w.document.write(html); w.document.close();
              }} style={S.btn("#16a34a")} disabled={reporteEntregas.length === 0}>Exportar PDF</button>
            </div>
            {reporteEntregas.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", color: "#94a3b8", padding: 36 }}>
                <p style={{ margin: "0 0 6px", fontSize: 15 }}>No hay entregas registradas hoy</p>
                <p style={{ fontSize: 13, margin: 0 }}>Las entregas aparecen cuando depurás pedidos desde "Pedidos en calle"</p>
              </div>
            ) : (
              reporteEntregas.map(function (e, idx) {
                var vend = vendedores.find(function (v) { return v.id === e.vendedor_id; });
                return (
                  <div key={idx} style={{ ...S.card, borderLeft: "4px solid " + (e.resultado === "rechazado" ? "#dc2626" : "#16a34a") }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{e.direccion}</span>
                        {e.localidad && <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>{e.localidad.toUpperCase()}</span>}
                        {vend && <span style={{ fontSize: 11, color: "#E65100", marginLeft: 6 }}>{vend.nombre}</span>}
                      </div>
                      <span style={S.badge(e.resultado === "rechazado" ? "#fee2e2" : "#dcfce7", e.resultado === "rechazado" ? "#991b1b" : "#166534")}>{e.resultado === "rechazado" ? "RECHAZADO" : "ENTREGADO"}</span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {e.items.map(function (it, j) {
                        return <div key={j} style={{ fontSize: 12, color: it.rechazado ? "#dc2626" : "#475569", padding: "1px 0", textDecoration: it.rechazado ? "line-through" : "none" }}>{it.cantidad} {it.producto}{it.precio > 0 ? " " + fmtMoney(it.precio) : ""}</div>;
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

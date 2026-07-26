import { useState, useMemo, useCallback, useRef } from "react";

const ZONES = {
  "CABA CENTRO": ["Almagro","Balvanera","Barracas","Barrio Norte","Boedo","Caballito","Congreso","Constitución","La Boca","Monserrat","Nueva Pompeya","Parque Chacabuco","Parque Patricios","Puerto Madero","Recoleta","Retiro","San Cristóbal","San Nicolás","San Telmo","Villa Crespo"],
  "CABA NORTE": ["Agronomía","Belgrano","Chacarita","Coghlan","Colegiales","La Paternal","Monte Castro","Núñez","Palermo","Parque Chas","Saavedra","Villa del Parque","Villa Devoto","Villa Mitre","Villa Ortúzar","Villa Pueyrredón","Villa Santa Rita","Villa Urquiza"],
  "CABA OESTE": ["Bajo Flores","Flores","Floresta","Liniers","Mataderos","Parque Avellaneda","Vélez Sarsfield","Versalles","Villa Lugano","Villa Luro","Villa Real","Villa Riachuelo","Villa Soldati"],
  "ZONA NORTE": ["Acassuso","Baradero","Beccar","Bella Vista","Benavídez","Billinghurst","Boulogne","Carapachay","Del Viso","Don Torcuato","Escobar","Florida","Grand Bourg","Maschwitz","José C. Paz","José León Suárez","Loma Hermosa","Los Polvorines","Martínez","Manuel Alberti","Munro","Muñiz","Olivos","Pablo Nogués","Pacheco","Pilar","Presidente Derqui","Ricardo Rojas","San Andrés","San Fernando","San Isidro","San Martín","San Miguel","Sordeaux","Troncos del Talar","Tigre","Tortuguitas","Vicente López","Victoria","Villa Adelina","Villa Ballester","Villa de Mayo","Villa Lynch","Villa Maipú","Villa Martelli","Villa Libertad","Virreyes","William Morris","Zárate"],
  "ZONA OESTE 1": ["Caseros","Ciudad Jardín","Ciudadela","El Palomar","Hurlingham","José Ingenieros","Martín Coronado","Pablo Podestá","Sáenz Peña","Santos Lugares","Villa Bosch","Villa Raffo","Villa Tesei"],
  "ZONA OESTE 2": ["Castelar","Francisco Álvarez","Gral Rodríguez","Ituzaingó","La Reja","Libertad","Luján","Marcos Paz","Mariano Acosta","Merlo","Moreno","Padua","Parque Leloir","Paso del Rey","Pontevedra","Trujui","Udaondo"],
  "ZONA OESTE 3": ["Haedo","Morón","Ramos Mejía","Villa Sarmiento"],
  "ZONA OESTE 4": ["Aldo Bonzi","Ciudad Evita","La Tablada","Lomas del Mirador","Tapiales","Villa Celina","Villa Madero"],
  "ZONA OESTE 5": ["González Catán","Isidro Casanova","Laferrere","Rafael Castillo","San Justo","Villa Luzuriaga","Virrey del Pino"],
  "ZONA SUR 1": ["Avellaneda","Berazategui","Bernal","Dock Sud","Ezpeleta","Gerli","Quilmes","Sarandí","Wilde","Villa Dominico"],
  "ZONA SUR 2": ["9 de Abril","Banfield","Budge","Lanús","Lomas de Zamora","Monte Chingolo","Remedios de Escalada","Temperley","Valentín Alsina","Villa Centenario","Villa Fiorito"],
  "ZONA SUR 3": ["Bosques","Claypole","Don Orione","Florencio Varela","Gobernador Costa","José Mármol","Rafael Calzada","San José","Solano","Villa San Luis"],
  "ZONA SUR 4": ["Adrogué","Alejandro Korn","Burzaco","Carlos Segazzini","Canning","Cañuelas","El Jagüel","Esteban Echeverría","Ezeiza","Glew","Guernica","La Unión","Llavallol","Longchamps","Luis Guillón","Malvinas Argentinas","Monte Grande","San Vicente","Tristán Suárez","Turdera"],
  "ZONA SUR 5": ["Berisso","Brandsen","City Bell","Ensenada","Gonnet","La Plata","Lisandro Olmos","Melchor Romero","Ringuelet","Villa Elisa","Villa Elvira","Tolosa"],
};

const VENDEDORES = ["Jose Costa", "Pianyi 1", "Pianyi 4", "Benjamin"];

const VEHICLES = [
  { id: "t1", name: "Transit 1", color: "#3B82F6" },
  { id: "t2", name: "Transit 2", color: "#10B981" },
  { id: "t3", name: "Transit 3", color: "#F59E0B" },
  { id: "t4", name: "Transit 4", color: "#EF4444" },
  { id: "t5", name: "Transit 5", color: "#8B5CF6" },
  { id: "rb", name: "Ranger Beto", color: "#EC4899" },
  { id: "rbj", name: "Ranger Benji", color: "#14B8A6" },
];

function findZone(localidad) {
  const loc = localidad.trim().toLowerCase();
  for (const [zone, barrios] of Object.entries(ZONES)) {
    if (barrios.some(b => b.toLowerCase() === loc)) return zone;
  }
  return null;
}

function normalizeProduct(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function mergeOrders(existingItems, newItems) {
  const merged = [...existingItems];
  for (const newItem of newItems) {
    const normNew = normalizeProduct(newItem.product);
    const existingIdx = merged.findIndex(m => normalizeProduct(m.product) === normNew);
    if (existingIdx >= 0) {
      const ex = merged[existingIdx];
      if (newItem.qty > ex.qty || (newItem.qty === ex.qty && newItem.price > ex.price)) {
        merged[existingIdx] = { ...newItem };
      }
    } else {
      merged.push({ ...newItem });
    }
  }
  return merged;
}

function parseWhatsAppPaste(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const orders = [];
  let current = null;

  for (const line of lines) {
    const headerMatch = line.match(/^(.+?)\s+(\d{3,4})\s+(.+?)(?:\s+(\d{1,2}(?::?\d{2})?\s*a\s*\d{1,2}(?::?\d{2})?))?$/i);
    const itemMatch = line.match(/^(\d+)\s+(.+?)\s+\$?([\d.,]+)$/);
    const vendorLine = line.match(/^(Jose Costa|Pianyi\s*\d+|Benjamin)$/i);
    const dateMatch = line.match(/^pas[oó]\s+.+/i);

    if (dateMatch) continue;

    if (vendorLine && current) {
      current.vendor = vendorLine[1];
      continue;
    }

    if (itemMatch) {
      if (current) {
        current.items.push({
          qty: parseInt(itemMatch[1]),
          product: itemMatch[2].trim(),
          price: parseFloat(itemMatch[3].replace(/\./g, "").replace(",", ".")),
          vendor: current.vendor || "",
          id: Math.random().toString(36).slice(2, 8),
        });
      }
      continue;
    }

    if (!itemMatch && !vendorLine && line.length > 5 && !dateMatch) {
      if (current && current.items.length > 0) {
        orders.push(current);
      }

      let address = line;
      let localidad = "";
      let horario = "";
      let vendor = "";

      const parts = line.split(/\s+/);
      for (const v of VENDEDORES) {
        const vLower = v.toLowerCase();
        if (line.toLowerCase().includes(vLower)) {
          vendor = v;
          address = address.replace(new RegExp(v, "i"), "").trim();
        }
      }

      const horarioMatch = address.match(/(\d{1,2}(?::?\d{2})?\s*a\s*\d{1,2}(?::?\d{2})?)/i);
      if (horarioMatch) {
        horario = horarioMatch[1];
        address = address.replace(horarioMatch[0], "").trim();
      }

      for (const [zone, barrios] of Object.entries(ZONES)) {
        for (const b of barrios) {
          if (address.toLowerCase().includes(b.toLowerCase())) {
            localidad = b;
            address = address.replace(new RegExp(b, "i"), "").trim();
            break;
          }
        }
        if (localidad) break;
      }

      address = address.replace(/[,\s]+$/, "").replace(/^\s*[,\s]+/, "").trim();

      current = {
        id: Math.random().toString(36).slice(2, 10),
        address: address || line,
        localidad,
        zone: findZone(localidad) || "SIN ZONA",
        horario,
        vendor,
        items: [],
        vehicleId: null,
        status: "pending",
      };
    }
  }
  if (current && current.items.length > 0) orders.push(current);

  for (const o of orders) {
    o.items = o.items.map(it => ({ ...it, vendor: it.vendor || o.vendor }));
  }

  return orders;
}

const SAMPLE_DEBTS = [
  { id: "d1", client: "La Esquina de Juan", address: "Av. Corrientes 4521", localidad: "Almagro", zone: "CABA CENTRO", amount: 45000, paid: 15000 },
  { id: "d2", client: "Kiosco Marta", address: "Cabildo 1230", localidad: "Belgrano", zone: "CABA NORTE", amount: 22000, paid: 0 },
  { id: "d3", client: "Almacén Don Pedro", address: "Rivadavia 8800", localidad: "Liniers", zone: "CABA OESTE", amount: 18500, paid: 5000 },
];

export default function Zonificacion() {
  const [orders, setOrders] = useState([]);
  const [debts, setDebts] = useState(SAMPLE_DEBTS);
  const [pasteText, setPasteText] = useState("");
  const [activeTab, setActiveTab] = useState("zonificacion");
  const [expandedZones, setExpandedZones] = useState({});
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [newDebt, setNewDebt] = useState({ client: "", address: "", localidad: "", amount: "", paid: "" });
  const [parsePreview, setParsePreview] = useState(null);
  const [mergeConflicts, setMergeConflicts] = useState([]);
  const textareaRef = useRef(null);

  const ordersByZone = useMemo(() => {
    const grouped = {};
    for (const z of Object.keys(ZONES)) grouped[z] = [];
    grouped["SIN ZONA"] = [];
    for (const o of orders) {
      if (o.status === "pending" || o.status === "depurado") {
        const z = o.zone || "SIN ZONA";
        if (!grouped[z]) grouped[z] = [];
        grouped[z].push(o);
      }
    }
    return grouped;
  }, [orders]);

  const debtsByZone = useMemo(() => {
    const grouped = {};
    for (const d of debts) {
      if (!grouped[d.zone]) grouped[d.zone] = [];
      grouped[d.zone].push(d);
    }
    return grouped;
  }, [debts]);

  const streetOrders = useMemo(() => {
    return orders.filter(o => o.status === "en_calle" || o.status === "preparando");
  }, [orders]);

  const streetByVehicle = useMemo(() => {
    const grouped = {};
    for (const o of streetOrders) {
      const v = o.vehicleId || "sin_asignar";
      if (!grouped[v]) grouped[v] = [];
      grouped[v].push(o);
    }
    return grouped;
  }, [streetOrders]);

  const handleParse = () => {
    if (!pasteText.trim()) return;
    const parsed = parseWhatsAppPaste(pasteText);
    if (parsed.length === 0) return;

    const conflicts = [];
    const clean = [];

    for (const newOrder of parsed) {
      const addrKey = newOrder.address.toLowerCase().replace(/\s+/g, " ");
      const existing = orders.find(o =>
        o.address.toLowerCase().replace(/\s+/g, " ") === addrKey && o.status === "pending"
      );
      if (existing) {
        conflicts.push({ existing, incoming: newOrder, merged: mergeOrders(existing.items, newOrder.items) });
      } else {
        clean.push(newOrder);
      }
    }

    if (conflicts.length > 0) {
      setMergeConflicts(conflicts);
      setParsePreview(clean);
    } else {
      setOrders(prev => [...prev, ...parsed]);
      setPasteText("");
      setShowPasteModal(false);
    }
  };

  const handleConfirmMerge = () => {
    setOrders(prev => {
      let updated = [...prev];
      for (const c of mergeConflicts) {
        const idx = updated.findIndex(o => o.id === c.existing.id);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], items: c.merged };
        }
      }
      return [...updated, ...(parsePreview || [])];
    });
    setMergeConflicts([]);
    setParsePreview(null);
    setPasteText("");
    setShowPasteModal(false);
  };

  const handleAssign = (vehicleId) => {
    setOrders(prev => prev.map(o =>
      selectedOrders.has(o.id) ? { ...o, vehicleId, status: "preparando" } : o
    ));
    setSelectedOrders(new Set());
    setShowAssignModal(false);
  };

  const handleToggleSelect = (id) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteOrder = (id) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const handleDeleteVehicleOrders = (vehicleId) => {
    setOrders(prev => prev.filter(o => o.vehicleId !== vehicleId));
  };

  const handleReturnToZone = (id) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "pending", vehicleId: null } : o));
  };

  const toggleZone = (zone) => {
    setExpandedZones(prev => ({ ...prev, [zone]: !prev[zone] }));
  };

  const handleAddDebt = () => {
    const zone = findZone(newDebt.localidad) || "SIN ZONA";
    setDebts(prev => [...prev, {
      id: Math.random().toString(36).slice(2, 8),
      client: newDebt.client,
      address: newDebt.address,
      localidad: newDebt.localidad,
      zone,
      amount: parseFloat(newDebt.amount) || 0,
      paid: parseFloat(newDebt.paid) || 0,
    }]);
    setNewDebt({ client: "", address: "", localidad: "", amount: "", paid: "" });
    setShowDebtModal(false);
  };

  const handleDeleteDebt = (id) => {
    setDebts(prev => prev.filter(d => d.id !== id));
  };

  const filteredZones = useMemo(() => {
    if (!searchTerm) return Object.keys(ZONES);
    const term = searchTerm.toLowerCase();
    return Object.keys(ZONES).filter(z => {
      if (z.toLowerCase().includes(term)) return true;
      const zoneOrders = ordersByZone[z] || [];
      return zoneOrders.some(o =>
        o.address.toLowerCase().includes(term) ||
        o.localidad.toLowerCase().includes(term) ||
        o.items.some(it => it.product.toLowerCase().includes(term))
      );
    });
  }, [searchTerm, ordersByZone]);

  const fmt = (n) => "$" + n.toLocaleString("es-AR");

  const styles = {
    app: { fontFamily: "'Inter', -apple-system, sans-serif", background: "#0F1117", color: "#E2E4E9", minHeight: "100vh" },
    header: { padding: "16px 20px", borderBottom: "1px solid #1E2028", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
    logo: { fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" },
    tabs: { display: "flex", gap: 4, background: "#1A1C24", borderRadius: 8, padding: 3 },
    tab: (active) => ({ padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: active ? "#2A2D38" : "transparent", color: active ? "#fff" : "#8B8D97", transition: "all 0.15s" }),
    toolbar: { padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #1E2028" },
    btn: (variant) => ({
      padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
      ...(variant === "primary" ? { background: "#3B82F6", color: "#fff" } :
        variant === "danger" ? { background: "#DC2626", color: "#fff" } :
        variant === "success" ? { background: "#059669", color: "#fff" } :
        variant === "warning" ? { background: "#D97706", color: "#fff" } :
        { background: "#2A2D38", color: "#C5C7CD" })
    }),
    searchInput: { padding: "8px 12px", borderRadius: 6, border: "1px solid #2A2D38", background: "#1A1C24", color: "#E2E4E9", fontSize: 13, flex: 1, minWidth: 200, outline: "none" },
    zone: { margin: "0 12px 8px", borderRadius: 8, overflow: "hidden", border: "1px solid #1E2028" },
    zoneHeader: (hasOrders) => ({ padding: "10px 16px", background: hasOrders ? "#1A1C24" : "#15161D", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", userSelect: "none" }),
    zoneName: { fontWeight: 600, fontSize: 14 },
    badge: (color) => ({ background: color || "#3B82F6", color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }),
    orderCard: (vehicleColor) => ({
      padding: "10px 16px", borderBottom: "1px solid #1E2028", background: vehicleColor ? `${vehicleColor}12` : "#13141B",
      borderLeft: vehicleColor ? `3px solid ${vehicleColor}` : "3px solid transparent",
    }),
    itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", fontSize: 13 },
    debtRow: { background: "#DC262615", borderLeft: "3px solid #DC2626", padding: "10px 16px", borderBottom: "1px solid #1E2028" },
    debtBadge: { background: "#DC2626", color: "#fff", padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: "0.5px" },
    debtGroupHeader: { padding: "6px 16px", background: "#DC262610", borderBottom: "1px solid #1E2028", fontSize: 12, fontWeight: 600, color: "#F87171" },
    modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
    modalContent: { background: "#1A1C24", borderRadius: 12, padding: 24, maxWidth: 600, width: "100%", maxHeight: "80vh", overflow: "auto", border: "1px solid #2A2D38" },
    textarea: { width: "100%", minHeight: 200, background: "#0F1117", color: "#E2E4E9", border: "1px solid #2A2D38", borderRadius: 8, padding: 12, fontSize: 13, fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box" },
    input: { padding: "8px 12px", borderRadius: 6, border: "1px solid #2A2D38", background: "#0F1117", color: "#E2E4E9", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" },
    vehicleCard: (color) => ({ padding: "12px 16px", margin: "0 12px 8px", borderRadius: 8, border: `1px solid ${color}40`, background: `${color}08`, borderLeft: `4px solid ${color}` }),
    reportSection: { margin: "0 12px 12px", borderRadius: 8, border: "1px solid #1E2028", overflow: "hidden" },
    vendorTag: (vendor) => {
      const colors = { "Jose Costa": "#F59E0B", "Pianyi 1": "#3B82F6", "Pianyi 4": "#8B5CF6", "Benjamin": "#10B981" };
      const c = colors[vendor] || "#6B7280";
      return { fontSize: 11, color: c, fontWeight: 600, marginLeft: 8, padding: "1px 6px", borderRadius: 4, background: `${c}18` };
    },
    select: { padding: "8px 12px", borderRadius: 6, border: "1px solid #2A2D38", background: "#0F1117", color: "#E2E4E9", fontSize: 13, outline: "none" },
  };

  const renderZonificacion = () => (
    <>
      <div style={styles.toolbar}>
        <button style={styles.btn("primary")} onClick={() => setShowPasteModal(true)}>+ Pegar pedidos</button>
        {selectedOrders.size > 0 && (
          <button style={styles.btn("success")} onClick={() => setShowAssignModal(true)}>
            Asignar {selectedOrders.size} pedido{selectedOrders.size > 1 ? "s" : ""} a camioneta
          </button>
        )}
        <button style={styles.btn()} onClick={() => setShowDebtModal(true)}>+ Cobro pendiente</button>
        <input
          style={styles.searchInput}
          placeholder="Buscar dirección, localidad, producto..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={{ padding: "8px 0" }}>
        {filteredZones.map(zone => {
          const zOrders = (ordersByZone[zone] || []).filter(o => {
            if (!searchTerm) return true;
            const t = searchTerm.toLowerCase();
            return o.address.toLowerCase().includes(t) || o.localidad.toLowerCase().includes(t) || o.items.some(it => it.product.toLowerCase().includes(t));
          });
          const zDebts = (debtsByZone[zone] || []);
          const debtsWithoutOrder = zDebts.filter(d => {
            return !zOrders.some(o => o.address.toLowerCase().replace(/\s+/g, " ") === d.address.toLowerCase().replace(/\s+/g, " "));
          });
          const debtsWithOrder = zDebts.filter(d => {
            return zOrders.some(o => o.address.toLowerCase().replace(/\s+/g, " ") === d.address.toLowerCase().replace(/\s+/g, " "));
          });

          const totalItems = zOrders.length + debtsWithoutOrder.length;
          const isExpanded = expandedZones[zone];

          return (
            <div key={zone} style={styles.zone}>
              <div style={styles.zoneHeader(totalItems > 0)} onClick={() => toggleZone(zone)}>
                <span style={styles.zoneName}>{isExpanded ? "▼" : "▶"} {zone}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {zOrders.length > 0 && <span style={styles.badge("#3B82F6")}>{zOrders.length} pedido{zOrders.length > 1 ? "s" : ""}</span>}
                  {zDebts.length > 0 && <span style={styles.badge("#DC2626")}>{zDebts.length} deuda{zDebts.length > 1 ? "s" : ""}</span>}
                </div>
              </div>

              {isExpanded && (
                <div>
                  {zOrders.map(order => {
                    const vehicle = VEHICLES.find(v => v.id === order.vehicleId);
                    const matchingDebt = debtsWithOrder.find(d =>
                      d.address.toLowerCase().replace(/\s+/g, " ") === order.address.toLowerCase().replace(/\s+/g, " ")
                    );
                    return (
                      <div key={order.id} style={styles.orderCard(vehicle?.color)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {order.status === "pending" && (
                              <input
                                type="checkbox"
                                checked={selectedOrders.has(order.id)}
                                onChange={() => handleToggleSelect(order.id)}
                                style={{ accentColor: "#3B82F6" }}
                              />
                            )}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{order.address}</div>
                              <div style={{ fontSize: 12, color: "#8B8D97" }}>
                                {order.localidad}{order.horario ? ` • ${order.horario}` : ""}
                                {order.status === "depurado" && <span style={{ color: "#F59E0B", marginLeft: 8 }}>DEPURADO</span>}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => handleDeleteOrder(order.id)} style={{ ...styles.btn("danger"), padding: "4px 8px", fontSize: 11 }}>✕</button>
                          </div>
                        </div>

                        {matchingDebt && (
                          <div style={{ background: "#DC262618", border: "1px solid #DC262640", borderRadius: 6, padding: "6px 10px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={styles.debtBadge}>DEUDA PENDIENTE DE PAGO</span>
                            <span style={{ color: "#F87171", fontWeight: 700, fontSize: 14 }}>{fmt(matchingDebt.amount - matchingDebt.paid)}</span>
                          </div>
                        )}

                        {order.items.map(item => (
                          <div key={item.id} style={styles.itemRow}>
                            <span>
                              <span style={{ color: "#8B8D97", marginRight: 6 }}>{item.qty}x</span>
                              {item.product}
                              {item.vendor && <span style={styles.vendorTag(item.vendor)}>{item.vendor}</span>}
                            </span>
                            <span style={{ color: "#9CA3AF" }}>{fmt(item.price)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {debtsWithoutOrder.length > 0 && (
                    <>
                      <div style={styles.debtGroupHeader}>COBROS PENDIENTES SIN PEDIDO</div>
                      {debtsWithoutOrder.map(debt => (
                        <div key={debt.id} style={styles.debtRow}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{debt.client}</div>
                              <div style={{ fontSize: 12, color: "#8B8D97" }}>{debt.address} • {debt.localidad}</div>
                            </div>
                            <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 8 }}>
                              <div>
                                <span style={styles.debtBadge}>DEUDA PENDIENTE DE PAGO</span>
                                <div style={{ color: "#F87171", fontWeight: 700, fontSize: 16, marginTop: 4 }}>
                                  {fmt(debt.amount - debt.paid)}
                                </div>
                                {debt.paid > 0 && <div style={{ fontSize: 11, color: "#8B8D97" }}>Pagó parcial: {fmt(debt.paid)}</div>}
                              </div>
                              <button onClick={() => handleDeleteDebt(debt.id)} style={{ ...styles.btn("danger"), padding: "4px 8px", fontSize: 11 }}>✕</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {zOrders.length === 0 && debtsWithoutOrder.length === 0 && (
                    <div style={{ padding: 16, textAlign: "center", color: "#6B7280", fontSize: 13 }}>Sin pedidos ni cobros pendientes</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const renderPedidosEnCalle = () => (
    <div style={{ padding: "12px 0" }}>
      {Object.keys(streetByVehicle).length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>No hay pedidos en calle</div>
      ) : (
        Object.entries(streetByVehicle).map(([vId, vOrders]) => {
          const vehicle = VEHICLES.find(v => v.id === vId);
          return (
            <div key={vId} style={styles.vehicleCard(vehicle?.color || "#6B7280")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{vehicle?.name || "Sin asignar"}</span>
                  <span style={{ ...styles.badge(vehicle?.color), marginLeft: 8 }}>{vOrders.length} pedido{vOrders.length > 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={styles.btn("warning")} onClick={() => {/* Print HDR */}}>Imprimir HDR</button>
                  <button style={styles.btn("danger")} onClick={() => handleDeleteVehicleOrders(vId)}>Eliminar camioneta</button>
                </div>
              </div>
              {vOrders.map(order => (
                <div key={order.id} style={{ padding: "8px 0", borderTop: "1px solid #ffffff10" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{order.address}</div>
                      <div style={{ fontSize: 12, color: "#8B8D97" }}>{order.localidad}{order.horario ? ` • ${order.horario}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleReturnToZone(order.id)} style={{ ...styles.btn(), padding: "4px 8px", fontSize: 11 }}>↩ Volver</button>
                      <button onClick={() => handleDeleteOrder(order.id)} style={{ ...styles.btn("danger"), padding: "4px 8px", fontSize: 11 }}>✕</button>
                    </div>
                  </div>
                  {order.items.map(item => (
                    <div key={item.id} style={{ ...styles.itemRow, paddingLeft: 8 }}>
                      <span>
                        <span style={{ color: "#8B8D97" }}>{item.qty}x</span> {item.product}
                        {item.vendor && <span style={styles.vendorTag(item.vendor)}>{item.vendor}</span>}
                      </span>
                      <span style={{ color: "#9CA3AF" }}>{fmt(item.price)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );

  const renderReporte = () => {
    const allDelivered = orders.filter(o => o.status === "preparando" || o.status === "en_calle");
    const byVehicle = {};
    for (const o of allDelivered) {
      const v = o.vehicleId || "sin";
      if (!byVehicle[v]) byVehicle[v] = [];
      byVehicle[v].push(o);
    }

    return (
      <div style={{ padding: "12px 0" }}>
        <div style={{ padding: "0 20px 12px", fontSize: 13, color: "#8B8D97" }}>
          Reporte segmentado por camioneta — eliminá pedidos individuales o camionetas completas
        </div>
        {Object.keys(byVehicle).length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>Sin datos para reportar</div>
        ) : (
          Object.entries(byVehicle).map(([vId, vOrders]) => {
            const vehicle = VEHICLES.find(v => v.id === vId);
            return (
              <div key={vId} style={styles.reportSection}>
                <div style={{ padding: "10px 16px", background: "#1A1C24", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{vehicle?.name || "Sin asignar"}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={styles.badge(vehicle?.color)}>{vOrders.length}</span>
                    <button onClick={() => handleDeleteVehicleOrders(vId)} style={{ ...styles.btn("danger"), padding: "4px 8px", fontSize: 11 }}>Eliminar camioneta</button>
                  </div>
                </div>
                {vOrders.map(order => (
                  <div key={order.id} style={{ padding: "8px 16px", borderTop: "1px solid #1E2028", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{order.address} — {order.localidad}</div>
                      <div style={{ fontSize: 12, color: "#8B8D97" }}>{order.items.length} artículo{order.items.length > 1 ? "s" : ""}</div>
                    </div>
                    <button onClick={() => handleDeleteOrder(order.id)} style={{ ...styles.btn("danger"), padding: "4px 8px", fontSize: 11 }}>✕</button>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={styles.logo}>PIANYI — Zonificación</span>
        <div style={styles.tabs}>
          <button style={styles.tab(activeTab === "zonificacion")} onClick={() => setActiveTab("zonificacion")}>Zonificación</button>
          <button style={styles.tab(activeTab === "en_calle")} onClick={() => setActiveTab("en_calle")}>Pedidos en calle</button>
          <button style={styles.tab(activeTab === "reporte")} onClick={() => setActiveTab("reporte")}>Reporte diario</button>
        </div>
      </div>

      {activeTab === "zonificacion" && renderZonificacion()}
      {activeTab === "en_calle" && renderPedidosEnCalle()}
      {activeTab === "reporte" && renderReporte()}

      {/* Modal: Pegar pedidos */}
      {showPasteModal && (
        <div style={styles.modal} onClick={() => setShowPasteModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>Pegar pedidos de WhatsApp</h3>
            <p style={{ fontSize: 13, color: "#8B8D97", margin: "0 0 12px" }}>
              Pegá los pedidos directamente del grupo. El sistema detecta dirección, localidad, horario, vendedor y artículos.
            </p>
            <textarea
              ref={textareaRef}
              style={styles.textarea}
              placeholder={"Ej:\n24/7 murguiondo 639 Liniers 0930 a 14\nPianyi 4\n3 imperial Golden $1599\n2 Heineken sin alcohol $1875"}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={styles.btn("primary")} onClick={handleParse}>Procesar</button>
              <button style={styles.btn()} onClick={() => setShowPasteModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Merge conflicts */}
      {mergeConflicts.length > 0 && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={{ margin: "0 0 12px", fontSize: 18, color: "#F59E0B" }}>Pedidos duplicados detectados</h3>
            <p style={{ fontSize: 13, color: "#8B8D97", margin: "0 0 16px" }}>
              Se encontraron {mergeConflicts.length} cliente{mergeConflicts.length > 1 ? "s" : ""} con pedidos existentes. Se fusionarán con la lógica: cantidad más alta + precio más alto, asignando vendedor ganador.
            </p>
            {mergeConflicts.map((c, i) => (
              <div key={i} style={{ padding: 12, background: "#0F1117", borderRadius: 8, marginBottom: 8, border: "1px solid #2A2D38" }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{c.existing.address}</div>
                <div style={{ fontSize: 12, color: "#8B8D97", marginBottom: 4 }}>Resultado fusionado:</div>
                {c.merged.map(item => (
                  <div key={item.id} style={styles.itemRow}>
                    <span>
                      {item.qty}x {item.product}
                      {item.vendor && <span style={styles.vendorTag(item.vendor)}>{item.vendor}</span>}
                    </span>
                    <span style={{ color: "#9CA3AF" }}>{fmt(item.price)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={styles.btn("success")} onClick={handleConfirmMerge}>Confirmar fusión</button>
              <button style={styles.btn()} onClick={() => { setMergeConflicts([]); setParsePreview(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignar camioneta */}
      {showAssignModal && (
        <div style={styles.modal} onClick={() => setShowAssignModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>Asignar a camioneta</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {VEHICLES.map(v => (
                <button
                  key={v.id}
                  onClick={() => handleAssign(v.id)}
                  style={{ ...styles.btn(), padding: "12px 16px", textAlign: "left", borderLeft: `4px solid ${v.color}`, display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ fontWeight: 600 }}>{v.name}</span>
                  <span style={{ color: "#8B8D97" }}>{(streetByVehicle[v.id] || []).length} pedidos asignados</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agregar cobro pendiente manual */}
      {showDebtModal && (
        <div style={styles.modal} onClick={() => setShowDebtModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>Agregar cobro pendiente</h3>
            <div style={{ display: "grid", gap: 10 }}>
              <input style={styles.input} placeholder="Cliente" value={newDebt.client} onChange={e => setNewDebt(p => ({ ...p, client: e.target.value }))} />
              <input style={styles.input} placeholder="Dirección" value={newDebt.address} onChange={e => setNewDebt(p => ({ ...p, address: e.target.value }))} />
              <input style={styles.input} placeholder="Localidad" value={newDebt.localidad} onChange={e => setNewDebt(p => ({ ...p, localidad: e.target.value }))} />
              <div style={{ display: "flex", gap: 10 }}>
                <input style={styles.input} placeholder="Monto total" type="number" value={newDebt.amount} onChange={e => setNewDebt(p => ({ ...p, amount: e.target.value }))} />
                <input style={styles.input} placeholder="Pagó (parcial)" type="number" value={newDebt.paid} onChange={e => setNewDebt(p => ({ ...p, paid: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button style={styles.btn("primary")} onClick={handleAddDebt}>Agregar</button>
                <button style={styles.btn()} onClick={() => setShowDebtModal(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

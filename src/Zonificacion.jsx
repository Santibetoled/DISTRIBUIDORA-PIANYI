import { useState, useMemo, useRef } from "react";

/* ── ZONES ── */
const ZONES = {
  "CABA CENTRO":["Almagro","Balvanera","Barracas","Barrio Norte","Boedo","Caballito","Congreso","Constitución","La Boca","Monserrat","Nueva Pompeya","Parque Chacabuco","Parque Patricios","Puerto Madero","Recoleta","Retiro","San Cristóbal","San Nicolás","San Telmo","Villa Crespo"],
  "CABA NORTE":["Agronomía","Belgrano","Chacarita","Coghlan","Colegiales","La Paternal","Monte Castro","Núñez","Palermo","Parque Chas","Saavedra","Villa del Parque","Villa Devoto","Villa Mitre","Villa Ortúzar","Villa Pueyrredón","Villa Santa Rita","Villa Urquiza"],
  "CABA OESTE":["Bajo Flores","Flores","Floresta","Liniers","Mataderos","Parque Avellaneda","Vélez Sarsfield","Versalles","Villa Lugano","Villa Luro","Villa Real","Villa Riachuelo","Villa Soldati"],
  "ZONA NORTE":["Acassuso","Baradero","Beccar","Bella Vista","Benavídez","Billinghurst","Boulogne","Carapachay","Del Viso","Don Torcuato","Escobar","Florida","Grand Bourg","Maschwitz","José C. Paz","José León Suárez","Loma Hermosa","Los Polvorines","Martínez","Manuel Alberti","Munro","Muñiz","Olivos","Pablo Nogués","Pacheco","Pilar","Presidente Derqui","Ricardo Rojas","San Andrés","San Fernando","San Isidro","San Martín","San Miguel","Sordeaux","Troncos del Talar","Tigre","Tortuguitas","Vicente López","Victoria","Villa Adelina","Villa Ballester","Villa de Mayo","Villa Lynch","Villa Maipú","Villa Martelli","Villa Libertad","Virreyes","William Morris","Zárate"],
  "ZONA OESTE 1":["Caseros","Ciudad Jardín","Ciudadela","El Palomar","Hurlingham","José Ingenieros","Martín Coronado","Pablo Podestá","Sáenz Peña","Santos Lugares","Villa Bosch","Villa Raffo","Villa Tesei"],
  "ZONA OESTE 2":["Castelar","Francisco Álvarez","Gral Rodríguez","Ituzaingó","La Reja","Libertad","Luján","Marcos Paz","Mariano Acosta","Merlo","Moreno","Padua","Parque Leloir","Paso del Rey","Pontevedra","Trujui","Udaondo"],
  "ZONA OESTE 3":["Haedo","Morón","Ramos Mejía","Villa Sarmiento"],
  "ZONA OESTE 4":["Aldo Bonzi","Ciudad Evita","La Tablada","Lomas del Mirador","Tapiales","Villa Celina","Villa Madero"],
  "ZONA OESTE 5":["González Catán","Isidro Casanova","Laferrere","Rafael Castillo","San Justo","Villa Luzuriaga","Virrey del Pino"],
  "ZONA SUR 1":["Avellaneda","Berazategui","Bernal","Dock Sud","Ezpeleta","Gerli","Quilmes","Sarandí","Wilde","Villa Dominico"],
  "ZONA SUR 2":["9 de Abril","Banfield","Budge","Lanús","Lomas de Zamora","Monte Chingolo","Remedios de Escalada","Temperley","Valentín Alsina","Villa Centenario","Villa Fiorito"],
  "ZONA SUR 3":["Bosques","Claypole","Don Orione","Florencio Varela","Gobernador Costa","José Mármol","Rafael Calzada","San José","Solano","Villa San Luis"],
  "ZONA SUR 4":["Adrogué","Alejandro Korn","Burzaco","Carlos Segazzini","Canning","Cañuelas","El Jagüel","Esteban Echeverría","Ezeiza","Glew","Guernica","La Unión","Llavallol","Longchamps","Luis Guillón","Malvinas Argentinas","Monte Grande","San Vicente","Tristán Suárez","Turdera"],
  "ZONA SUR 5":["Berisso","Brandsen","City Bell","Ensenada","Gonnet","La Plata","Lisandro Olmos","Melchor Romero","Ringuelet","Villa Elisa","Villa Elvira","Tolosa"],
};
const VENDEDORES = ["Jose Costa","Pianyi 1","Pianyi 4","Benjamin"];
const VEHICLES = [
  {id:"t1",name:"Transit 1",color:"#3B82F6"},{id:"t2",name:"Transit 2",color:"#10B981"},
  {id:"t3",name:"Transit 3",color:"#F59E0B"},{id:"t4",name:"Transit 4",color:"#EF4444"},
  {id:"t5",name:"Transit 5",color:"#8B5CF6"},{id:"rb",name:"Ranger Beto",color:"#EC4899"},
  {id:"rbj",name:"Ranger Benji",color:"#14B8A6"},
];

/* ── HELPERS ── */
const uid = () => Math.random().toString(36).slice(2,10);
const fmt = (n) => "$" + Number(n).toLocaleString("es-AR");

function findZone(loc) {
  if (!loc) return null;
  const l = loc.trim().toLowerCase();
  for (const [z,bs] of Object.entries(ZONES)) {
    if (bs.some(b => b.toLowerCase() === l)) return z;
  }
  return null;
}

// Extracts "street number" for comparison, case-insensitive
function normalizeAddr(addr) {
  const s = addr.toLowerCase().replace(/[,.\-\/]+/g," ").replace(/\s+/g," ").trim();
  const m = s.match(/([a-záéíóúüñ\s]+)\s+(\d{1,5})/);
  return m ? (m[1].trim()+" "+m[2]) : s;
}

// Case-insensitive product comparison
function normProd(name) {
  return name.trim().toLowerCase().replace(/\s+/g," ");
}

// Merge items: for same product keep highest qty, then highest price. Winner gets the vendor.
function mergeItems(existing, incoming) {
  const result = existing.map(it => ({...it}));
  for (const inc of incoming) {
    const idx = result.findIndex(r => normProd(r.product) === normProd(inc.product));
    if (idx >= 0) {
      const ex = result[idx];
      if (inc.qty > ex.qty || (inc.qty === ex.qty && inc.price > ex.price)) {
        result[idx] = { ...inc, id: ex.id };
      }
    } else {
      result.push({ ...inc });
    }
  }
  return result;
}

/* ── PARSER ── */
function parseWhatsApp(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const orders = [];
  let cur = null;

  for (const line of lines) {
    // Skip "pasó" lines
    if (/^pas[oó]\s+/i.test(line)) continue;

    // Vendor line (standalone)
    if (VENDEDORES.some(v => v.toLowerCase() === line.toLowerCase())) {
      if (cur) cur.vendor = VENDEDORES.find(v => v.toLowerCase() === line.toLowerCase());
      continue;
    }

    // Item line: starts with number, ends with price
    const itemM = line.match(/^(\d+)\s+(.+?)\s+\$?\s*([\d.,]+)\s*$/);
    if (itemM) {
      if (cur) {
        cur.items.push({
          id: uid(),
          qty: parseInt(itemM[1]),
          product: itemM[2].trim(),
          price: parseFloat(itemM[3].replace(/\./g,"").replace(",",".")),
          vendor: cur.vendor || "",
        });
      }
      continue;
    }

    // Otherwise it's an address/header line
    if (cur && cur.items.length > 0) orders.push(cur);

    let addr = line;
    let localidad = "";
    let horario = "";
    let vendor = "";

    // Extract horario
    const hm = addr.match(/(\d{1,4})\s*a\s*(\d{1,4})/i);
    if (hm) { horario = hm[0]; addr = addr.replace(hm[0],"").trim(); }

    // Extract localidad
    for (const [,bs] of Object.entries(ZONES)) {
      for (const b of bs) {
        const esc = b.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        const re = new RegExp("\\b"+esc+"\\b","i");
        if (re.test(addr)) { localidad = b; addr = addr.replace(re,"").trim(); break; }
      }
      if (localidad) break;
    }

    // Extract inline vendor
    for (const v of VENDEDORES) {
      const esc = v.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      const re = new RegExp("\\b"+esc+"\\b","i");
      if (re.test(addr)) { vendor = v; addr = addr.replace(re,"").trim(); }
    }

    addr = addr.replace(/[,\s]+$/,"").replace(/^\s*[,\s]+/,"").replace(/\s+/g," ").trim();

    cur = { id:uid(), address:addr||line, localidad, zone:findZone(localidad)||"SIN ZONA", horario, vendor, items:[], vehicleId:null, status:"pending" };
  }
  if (cur && cur.items.length > 0) orders.push(cur);

  // Assign vendor to items
  for (const o of orders) {
    o.items = o.items.map(it => ({ ...it, vendor: it.vendor || o.vendor }));
  }

  // Auto-merge within same paste (same address)
  const merged = [];
  const map = new Map();
  for (const o of orders) {
    const key = normalizeAddr(o.address);
    if (map.has(key)) {
      const ex = map.get(key);
      ex.items = mergeItems(ex.items, o.items);
      if (o.address.length > ex.address.length) ex.address = o.address;
      if (o.horario && !ex.horario) ex.horario = o.horario;
    } else {
      const clone = { ...o, items: o.items.map(i=>({...i})) };
      map.set(key, clone);
      merged.push(clone);
    }
  }
  return merged;
}

/* ── SAMPLE DEBTS ── */
const SAMPLE_DEBTS = [
  {id:"d1",client:"La Esquina de Juan",address:"Av. Corrientes 4521",localidad:"Almagro",zone:"CABA CENTRO",amount:45000,paid:15000},
  {id:"d2",client:"Kiosco Marta",address:"Cabildo 1230",localidad:"Belgrano",zone:"CABA NORTE",amount:22000,paid:0},
  {id:"d3",client:"Almacén Don Pedro",address:"Rivadavia 8800",localidad:"Liniers",zone:"CABA OESTE",amount:18500,paid:5000},
];

/* ── COMPONENT ── */
export default function Zonificacion() {
  const [orders, setOrders] = useState([]);
  const [debts, setDebts] = useState(SAMPLE_DEBTS);
  const [pasteText, setPasteText] = useState("");
  const [activeTab, setActiveTab] = useState("zonificacion");
  const [expandedZones, setExpandedZones] = useState({});
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showDebt, setShowDebt] = useState(false);
  const [mergeInfo, setMergeInfo] = useState(null); // {conflicts, clean}
  const [newDebt, setNewDebt] = useState({client:"",address:"",localidad:"",amount:"",paid:""});
  const [editingItem, setEditingItem] = useState(null); // {orderId, itemId, qty, price, product, vendor}

  /* ── Grouped data ── */
  const ordersByZone = useMemo(() => {
    const g = {}; for (const z of Object.keys(ZONES)) g[z] = []; g["SIN ZONA"] = [];
    for (const o of orders) if (o.status==="pending"||o.status==="depurado") { (g[o.zone]||(g[o.zone]=[])).push(o); }
    return g;
  }, [orders]);

  const debtsByZone = useMemo(() => {
    const g = {};
    for (const d of debts) { (g[d.zone]||(g[d.zone]=[])).push(d); }
    return g;
  }, [debts]);

  const streetByVehicle = useMemo(() => {
    const g = {};
    for (const o of orders) {
      if (o.status==="preparando"||o.status==="en_calle") {
        (g[o.vehicleId||"sin"]||(g[o.vehicleId||"sin"]=[])).push(o);
      }
    }
    return g;
  }, [orders]);

  /* ── Handlers ── */
  const handleParse = () => {
    if (!pasteText.trim()) return;
    const parsed = parseWhatsApp(pasteText);
    if (parsed.length === 0) return;

    // Check against existing orders
    const conflicts = [];
    const clean = [];
    for (const p of parsed) {
      const key = normalizeAddr(p.address);
      const ex = orders.find(o => normalizeAddr(o.address)===key && o.status==="pending");
      if (ex) {
        conflicts.push({ existingId:ex.id, existing:ex, incoming:p, merged:mergeItems(ex.items, p.items) });
      } else {
        clean.push(p);
      }
    }

    if (conflicts.length > 0) {
      setMergeInfo({ conflicts, clean });
    } else {
      setOrders(prev => [...prev, ...parsed]);
      setPasteText("");
      setShowPaste(false);
    }
  };

  const handleConfirmMerge = () => {
    if (!mergeInfo) return;
    setOrders(prev => {
      let updated = [...prev];
      for (const c of mergeInfo.conflicts) {
        const idx = updated.findIndex(o => o.id === c.existingId);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], items: c.merged };
        }
      }
      return [...updated, ...mergeInfo.clean];
    });
    setMergeInfo(null);
    setPasteText("");
    setShowPaste(false);
  };

  const handleAssign = (vehicleId) => {
    setOrders(prev => prev.map(o => selectedOrders.has(o.id) ? {...o, vehicleId, status:"preparando"} : o));
    setSelectedOrders(new Set());
    setShowAssign(false);
  };

  const toggleSelect = (id) => {
    setSelectedOrders(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  };

  const deleteOrder = (id) => setOrders(prev => prev.filter(o => o.id !== id));
  const deleteVehicle = (vid) => setOrders(prev => prev.filter(o => o.vehicleId !== vid));
  const returnToZone = (id) => setOrders(prev => prev.map(o => o.id===id ? {...o, status:"pending", vehicleId:null} : o));

  const startEdit = (orderId, item) => setEditingItem({orderId, itemId:item.id, qty:item.qty, price:item.price, product:item.product, vendor:item.vendor||""});
  const cancelEdit = () => setEditingItem(null);
  const saveEdit = () => {
    if (!editingItem) return;
    setOrders(prev => prev.map(o => {
      if (o.id !== editingItem.orderId) return o;
      return {...o, items: o.items.map(it => it.id !== editingItem.itemId ? it : {...it, qty:parseInt(editingItem.qty)||1, price:parseFloat(editingItem.price)||0, product:editingItem.product, vendor:editingItem.vendor})};
    }));
    setEditingItem(null);
  };
  const deleteItem = (orderId, itemId) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const newItems = o.items.filter(it => it.id !== itemId);
      return newItems.length > 0 ? {...o, items:newItems} : null;
    }).filter(Boolean));
  };

  const moveOrder = (vid, oid, dir) => {
    setOrders(prev => {
      const all = [...prev];
      const vIds = all.reduce((acc,o,i) => {
        if (o.vehicleId===vid && (o.status==="preparando"||o.status==="en_calle")) acc.push(i);
        return acc;
      }, []);
      const pos = vIds.findIndex(i => all[i].id === oid);
      if (pos < 0) return prev;
      const swapPos = dir==="up" ? pos-1 : pos+1;
      if (swapPos < 0 || swapPos >= vIds.length) return prev;
      const a = vIds[pos], b = vIds[swapPos];
      [all[a], all[b]] = [all[b], all[a]];
      return all;
    });
  };

  const setOrderPos = (vid, oid, newPos) => {
    setOrders(prev => {
      const all = [...prev];
      const vIndices = all.reduce((acc,o,i) => {
        if (o.vehicleId===vid && (o.status==="preparando"||o.status==="en_calle")) acc.push(i);
        return acc;
      }, []);
      const curPos = vIndices.findIndex(i => all[i].id === oid);
      if (curPos < 0) return prev;
      const target = Math.max(0, Math.min(newPos-1, vIndices.length-1));
      if (target === curPos) return prev;
      const vOrders = vIndices.map(i => all[i]);
      const [moved] = vOrders.splice(curPos, 1);
      vOrders.splice(target, 0, moved);
      for (let j=0; j<vIndices.length; j++) all[vIndices[j]] = vOrders[j];
      return all;
    });
  };

  const toggleZone = (z) => setExpandedZones(p => ({...p, [z]: !p[z]}));

  const addDebt = () => {
    const zone = findZone(newDebt.localidad) || "SIN ZONA";
    setDebts(prev => [...prev, {id:uid(),client:newDebt.client,address:newDebt.address,localidad:newDebt.localidad,zone,amount:parseFloat(newDebt.amount)||0,paid:parseFloat(newDebt.paid)||0}]);
    setNewDebt({client:"",address:"",localidad:"",amount:"",paid:""});
    setShowDebt(false);
  };

  const deleteDebt = (id) => setDebts(prev => prev.filter(d => d.id !== id));

  /* ── Print HDR ── */
  const printHDR = (vehicleId) => {
    const vehicle = VEHICLES.find(v => v.id === vehicleId);
    const vOrders = orders.filter(o => o.vehicleId===vehicleId && (o.status==="preparando"||o.status==="en_calle"));
    const vDebts = debts.filter(d => vOrders.some(o => normalizeAddr(o.address)===normalizeAddr(d.address)));
    const today = new Date().toLocaleDateString("es-AR");

    let tableRows = "";
    vOrders.forEach((o, i) => {
      const debt = vDebts.find(d => normalizeAddr(d.address)===normalizeAddr(o.address));
      tableRows += '<tr style="background:#f3f4f6;font-weight:700"><td colspan="8">Parada '+(i+1)+': '+o.address+', '+o.localidad+'</td></tr>';
      o.items.forEach((item, j) => {
        tableRows += '<tr>';
        tableRows += '<td>'+(j===0?(i+1):'')+'</td>';
        tableRows += '<td>'+(j===0?o.address:'')+'</td>';
        tableRows += '<td>'+(j===0?o.localidad:'')+'</td>';
        tableRows += '<td>'+(j===0?(o.horario||'-'):'')+'</td>';
        tableRows += '<td>'+item.product+'</td>';
        tableRows += '<td>'+item.qty+'</td>';
        tableRows += '<td>$'+Number(item.price).toLocaleString("es-AR")+'</td>';
        tableRows += '<td>'+(item.vendor||'-')+'</td>';
        tableRows += '</tr>';
      });
      if (debt) {
        tableRows += '<tr style="background:#fef2f2"><td></td><td colspan="4"><strong style="color:#dc2626">⚠ DEUDA PENDIENTE DE PAGO</strong></td><td colspan="3"><strong>$'+(debt.amount-debt.paid).toLocaleString("es-AR")+'</strong></td></tr>';
      }
    });

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>HDR '+vehicle.name+'</title>'
      +'<style>'
      +'*{margin:0;padding:0;box-sizing:border-box}'
      +'body{font-family:Arial,sans-serif;padding:20px;font-size:12px;color:#111}'
      +'h1{font-size:18px;margin-bottom:2px}'
      +'.sub{color:#555;margin-bottom:12px;font-size:11px}'
      +'table{width:100%;border-collapse:collapse;margin-bottom:16px}'
      +'th,td{border:1px solid #333;padding:5px 8px;text-align:left;font-size:11px}'
      +'th{background:#e5e7eb;font-weight:700}'
      +'.notes-section{margin-top:20px;border:1px solid #333;padding:12px}'
      +'.notes-section h3{font-size:13px;margin-bottom:8px}'
      +'.notes-box{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:8px}'
      +'.note-field{border:1px solid #999;min-height:90px;padding:6px;font-size:10px}'
      +'.note-field .label{font-weight:700;margin-bottom:4px;font-size:10px}'
      +'.firma-section{margin-top:24px;display:flex;justify-content:space-between;gap:20px}'
      +'.firma-box{flex:1;border:1px solid #999;min-height:110px;padding:8px}'
      +'.firma-box .label{font-weight:700;font-size:10px;margin-bottom:4px}'
      +'@media print{body{padding:10px}button{display:none!important}}'
      +'</style></head><body>'
      +'<h1>HOJA DE RUTA &mdash; '+vehicle.name+'</h1>'
      +'<div class="sub">Fecha: '+today+' &bull; Pedidos: '+vOrders.length+'</div>'
      +'<table><thead><tr><th style="width:30px">#</th><th>Dirección</th><th>Localidad</th><th>Horario</th><th>Producto</th><th>Cant.</th><th>Precio</th><th>Vendedor</th></tr></thead>'
      +'<tbody>'+tableRows+'</tbody></table>'
      +'<div class="notes-section"><h3>Observaciones del reparto</h3>'
      +'<div class="notes-box">'
      +'<div class="note-field"><div class="label">SOBRANTES</div></div>'
      +'<div class="note-field"><div class="label">DEVOLUCIONES</div></div>'
      +'<div class="note-field"><div class="label">ROTURAS</div></div>'
      +'</div></div>'
      +'<div class="firma-section">'
      +'<div class="firma-box"><div class="label">OBSERVACIONES GENERALES</div></div>'
      +'<div class="firma-box"><div class="label">FIRMA CHOFER</div></div>'
      +'<div class="firma-box"><div class="label">FIRMA RESPONSABLE</div></div>'
      +'</div></body></html>';

    const w = window.open("","_blank","width=900,height=700");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  /* ── Search filter ── */
  const filteredZones = useMemo(() => {
    if (!searchTerm) return Object.keys(ZONES);
    const t = searchTerm.toLowerCase();
    return Object.keys(ZONES).filter(z => {
      if (z.toLowerCase().includes(t)) return true;
      return (ordersByZone[z]||[]).some(o => o.address.toLowerCase().includes(t) || o.localidad.toLowerCase().includes(t) || o.items.some(it => it.product.toLowerCase().includes(t)));
    });
  }, [searchTerm, ordersByZone]);

  /* ── STYLES ── */
  const S = {
    app:{fontFamily:"'Inter',-apple-system,sans-serif",background:"#fff",color:"#1A1A2E",minHeight:"100vh"},
    header:{padding:"16px 20px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
    logo:{fontSize:20,fontWeight:700,color:"#1A1A2E",letterSpacing:"-0.5px"},
    tabs:{display:"flex",gap:4,background:"#F3F4F6",borderRadius:8,padding:3},
    tab:(a)=>({padding:"8px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:a?"#fff":"transparent",color:a?"#1A1A2E":"#6B7280",boxShadow:a?"0 1px 3px rgba(0,0,0,0.1)":"none"}),
    toolbar:{padding:"12px 20px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",borderBottom:"1px solid #E5E7EB"},
    btn:(v)=>({padding:"8px 14px",borderRadius:6,border:v?"none":"1px solid #D1D5DB",cursor:"pointer",fontSize:13,fontWeight:600,
      ...(v==="primary"?{background:"#3B82F6",color:"#fff"}:v==="danger"?{background:"#DC2626",color:"#fff"}:v==="success"?{background:"#059669",color:"#fff"}:v==="warning"?{background:"#D97706",color:"#fff"}:{background:"#F3F4F6",color:"#374151"})}),
    search:{padding:"8px 12px",borderRadius:6,border:"1px solid #D1D5DB",background:"#fff",color:"#1A1A2E",fontSize:13,flex:1,minWidth:200,outline:"none"},
    zone:{margin:"0 12px 8px",borderRadius:8,overflow:"hidden",border:"1px solid #E5E7EB"},
    zoneHead:(has)=>({padding:"10px 16px",background:has?"#F9FAFB":"#FAFAFA",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none"}),
    badge:(c)=>({background:c||"#3B82F6",color:"#fff",padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}),
    orderCard:(vc)=>({padding:"10px 16px",borderBottom:"1px solid #E5E7EB",background:vc?vc+"08":"#fff",borderLeft:vc?"3px solid "+vc:"3px solid transparent"}),
    itemRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",fontSize:13},
    debtRow:{background:"#FEF2F2",borderLeft:"3px solid #DC2626",padding:"10px 16px",borderBottom:"1px solid #E5E7EB"},
    debtBadge:{background:"#DC2626",color:"#fff",padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:700,letterSpacing:"0.5px"},
    debtGroupHead:{padding:"6px 16px",background:"#FEF2F2",borderBottom:"1px solid #E5E7EB",fontSize:12,fontWeight:600,color:"#DC2626"},
    modal:{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16},
    modalBox:{background:"#fff",borderRadius:12,padding:24,maxWidth:600,width:"100%",maxHeight:"80vh",overflow:"auto",border:"1px solid #E5E7EB",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"},
    textarea:{width:"100%",minHeight:200,background:"#F9FAFB",color:"#1A1A2E",border:"1px solid #D1D5DB",borderRadius:8,padding:12,fontSize:13,fontFamily:"monospace",resize:"vertical",outline:"none",boxSizing:"border-box"},
    input:{padding:"8px 12px",borderRadius:6,border:"1px solid #D1D5DB",background:"#F9FAFB",color:"#1A1A2E",fontSize:13,width:"100%",outline:"none",boxSizing:"border-box"},
    vCard:(c)=>({padding:"12px 16px",margin:"0 12px 8px",borderRadius:8,border:"1px solid "+c+"30",background:c+"06",borderLeft:"4px solid "+c}),
    vtag:(v)=>{const cs={"Jose Costa":"#D97706","Pianyi 1":"#2563EB","Pianyi 4":"#7C3AED","Benjamin":"#059669"};const c=cs[v]||"#6B7280";return{fontSize:11,color:c,fontWeight:600,marginLeft:8,padding:"1px 6px",borderRadius:4,background:c+"12"};},
  };

  /* ── RENDER: Zonificación ── */
  const renderZonificacion = () => (
    <>
      <div style={S.toolbar}>
        <button style={S.btn("primary")} onClick={()=>setShowPaste(true)}>+ Pegar pedidos</button>
        {selectedOrders.size>0 && <button style={S.btn("success")} onClick={()=>setShowAssign(true)}>Asignar {selectedOrders.size} pedido{selectedOrders.size>1?"s":""}</button>}
        <button style={S.btn()} onClick={()=>setShowDebt(true)}>+ Cobro pendiente</button>
        <input style={S.search} placeholder="Buscar dirección, localidad, producto..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
      </div>
      <div style={{padding:"8px 0"}}>
        {filteredZones.map(zone => {
          const zOrds = (ordersByZone[zone]||[]).filter(o => {
            if (!searchTerm) return true;
            const t = searchTerm.toLowerCase();
            return o.address.toLowerCase().includes(t)||o.localidad.toLowerCase().includes(t)||o.items.some(it=>it.product.toLowerCase().includes(t));
          });
          const zDebts = debtsByZone[zone]||[];
          const debtsWithOrder = zDebts.filter(d => zOrds.some(o => normalizeAddr(o.address)===normalizeAddr(d.address)));
          const debtsNoOrder = zDebts.filter(d => !zOrds.some(o => normalizeAddr(o.address)===normalizeAddr(d.address)));
          const total = zOrds.length + debtsNoOrder.length;
          const exp = expandedZones[zone];

          return (
            <div key={zone} style={S.zone}>
              <div style={S.zoneHead(total>0)} onClick={()=>toggleZone(zone)}>
                <span style={{fontWeight:600,fontSize:14}}>{exp?"▼":"▶"} {zone}</span>
                <div style={{display:"flex",gap:6}}>
                  {zOrds.length>0 && <span style={S.badge("#3B82F6")}>{zOrds.length}</span>}
                  {zDebts.length>0 && <span style={S.badge("#DC2626")}>{zDebts.length} deuda{zDebts.length>1?"s":""}</span>}
                </div>
              </div>
              {exp && (
                <div>
                  {zOrds.map(order => {
                    const vc = VEHICLES.find(v=>v.id===order.vehicleId);
                    const debt = debtsWithOrder.find(d=>normalizeAddr(d.address)===normalizeAddr(order.address));
                    return (
                      <div key={order.id} style={S.orderCard(vc?.color)}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {order.status==="pending" && <input type="checkbox" checked={selectedOrders.has(order.id)} onChange={()=>toggleSelect(order.id)} style={{accentColor:"#3B82F6"}} />}
                            <div>
                              <div style={{fontWeight:600,fontSize:14}}>{order.address}</div>
                              <div style={{fontSize:12,color:"#6B7280"}}>{order.localidad}{order.horario?` • ${order.horario}`:""}{order.status==="depurado"?<span style={{color:"#D97706",marginLeft:8}}>DEPURADO</span>:null}</div>
                            </div>
                          </div>
                          <button onClick={()=>deleteOrder(order.id)} style={{...S.btn("danger"),padding:"4px 8px",fontSize:11}}>✕</button>
                        </div>
                        {debt && (
                          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:6,padding:"6px 10px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={S.debtBadge}>DEUDA PENDIENTE DE PAGO</span>
                            <span style={{color:"#DC2626",fontWeight:700,fontSize:14}}>{fmt(debt.amount-debt.paid)}</span>
                          </div>
                        )}
                        {order.items.map(item => {
                          const isEditing = editingItem && editingItem.orderId===order.id && editingItem.itemId===item.id;
                          if (isEditing) {
                            return (
                              <div key={item.id} style={{padding:"4px 0",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",fontSize:12}}>
                                <input type="number" min={1} value={editingItem.qty} onChange={e=>setEditingItem(p=>({...p,qty:e.target.value}))} style={{width:45,padding:"3px 6px",border:"1px solid #D1D5DB",borderRadius:4,fontSize:12,textAlign:"center"}} />
                                <input value={editingItem.product} onChange={e=>setEditingItem(p=>({...p,product:e.target.value}))} style={{flex:1,minWidth:100,padding:"3px 6px",border:"1px solid #D1D5DB",borderRadius:4,fontSize:12}} />
                                <input type="number" value={editingItem.price} onChange={e=>setEditingItem(p=>({...p,price:e.target.value}))} style={{width:70,padding:"3px 6px",border:"1px solid #D1D5DB",borderRadius:4,fontSize:12,textAlign:"right"}} placeholder="$" />
                                <select value={editingItem.vendor} onChange={e=>setEditingItem(p=>({...p,vendor:e.target.value}))} style={{padding:"3px 6px",border:"1px solid #D1D5DB",borderRadius:4,fontSize:12,background:"#F9FAFB"}}>
                                  <option value="">Sin vendedor</option>
                                  {VENDEDORES.map(v=><option key={v} value={v}>{v}</option>)}
                                </select>
                                <button onClick={saveEdit} style={{...S.btn("success"),padding:"3px 8px",fontSize:11}}>✓</button>
                                <button onClick={cancelEdit} style={{...S.btn(),padding:"3px 8px",fontSize:11}}>✕</button>
                              </div>
                            );
                          }
                          return (
                            <div key={item.id} style={{...S.itemRow,cursor:"pointer"}} onClick={()=>startEdit(order.id,item)} title="Click para editar">
                              <span><span style={{color:"#6B7280",marginRight:6}}>{item.qty}x</span>{item.product}{item.vendor && <span style={S.vtag(item.vendor)}>{item.vendor}</span>}</span>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <span style={{color:"#6B7280"}}>{fmt(item.price)}</span>
                                <button onClick={e=>{e.stopPropagation();deleteItem(order.id,item.id)}} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:11,padding:"0 2px"}}>✕</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {debtsNoOrder.length>0 && (
                    <>
                      <div style={S.debtGroupHead}>COBROS PENDIENTES SIN PEDIDO</div>
                      {debtsNoOrder.map(d => (
                        <div key={d.id} style={S.debtRow}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <div style={{fontWeight:600,fontSize:14}}>{d.client}</div>
                              <div style={{fontSize:12,color:"#6B7280"}}>{d.address} • {d.localidad}</div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{textAlign:"right"}}>
                                <span style={S.debtBadge}>DEUDA PENDIENTE DE PAGO</span>
                                <div style={{color:"#DC2626",fontWeight:700,fontSize:16,marginTop:4}}>{fmt(d.amount-d.paid)}</div>
                                {d.paid>0 && <div style={{fontSize:11,color:"#6B7280"}}>Pagó parcial: {fmt(d.paid)}</div>}
                              </div>
                              <button onClick={()=>deleteDebt(d.id)} style={{...S.btn("danger"),padding:"4px 8px",fontSize:11}}>✕</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {zOrds.length===0 && debtsNoOrder.length===0 && <div style={{padding:16,textAlign:"center",color:"#9CA3AF",fontSize:13}}>Sin pedidos ni cobros pendientes</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  /* ── RENDER: Pedidos en calle ── */
  const renderEnCalle = () => (
    <div style={{padding:"12px 0"}}>
      {Object.keys(streetByVehicle).length===0 ? (
        <div style={{textAlign:"center",padding:40,color:"#6B7280"}}>No hay pedidos en calle</div>
      ) : (
        Object.entries(streetByVehicle).map(([vid,vOrds]) => {
          const veh = VEHICLES.find(v=>v.id===vid);
          return (
            <div key={vid} style={S.vCard(veh?.color||"#6B7280")}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <span style={{fontWeight:700,fontSize:16}}>{veh?.name||"Sin asignar"}</span>
                  <span style={{...S.badge(veh?.color),marginLeft:8}}>{vOrds.length} pedido{vOrds.length>1?"s":""}</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={S.btn("primary")} onClick={()=>printHDR(vid)}>🖨 Imprimir HDR</button>
                  <button style={S.btn("danger")} onClick={()=>deleteVehicle(vid)}>Eliminar camioneta</button>
                </div>
              </div>
              {vOrds.map((order,idx) => (
                <div key={order.id} style={{padding:"8px 0",borderTop:"1px solid #E5E7EB"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                        <button onClick={()=>moveOrder(vid,order.id,"up")} disabled={idx===0} style={{...S.btn(),padding:"2px 6px",fontSize:10,opacity:idx===0?0.3:1}}>▲</button>
                        <input type="number" min={1} max={vOrds.length} value={idx+1} onChange={e=>setOrderPos(vid,order.id,parseInt(e.target.value)||1)} style={{width:36,textAlign:"center",padding:"2px",border:"1px solid #D1D5DB",borderRadius:4,fontSize:12,fontWeight:700,background:"#F9FAFB"}} />
                        <button onClick={()=>moveOrder(vid,order.id,"down")} disabled={idx===vOrds.length-1} style={{...S.btn(),padding:"2px 6px",fontSize:10,opacity:idx===vOrds.length-1?0.3:1}}>▼</button>
                      </div>
                      <div>
                        <div style={{fontWeight:600,fontSize:13}}>{order.address}</div>
                        <div style={{fontSize:12,color:"#6B7280"}}>{order.localidad}{order.horario?` • ${order.horario}`:""}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>returnToZone(order.id)} style={{...S.btn(),padding:"4px 8px",fontSize:11}}>↩ Volver</button>
                      <button onClick={()=>deleteOrder(order.id)} style={{...S.btn("danger"),padding:"4px 8px",fontSize:11}}>✕</button>
                    </div>
                  </div>
                  {order.items.map(item => (
                    <div key={item.id} style={{...S.itemRow,paddingLeft:52}}>
                      <span><span style={{color:"#6B7280"}}>{item.qty}x</span> {item.product}{item.vendor && <span style={S.vtag(item.vendor)}>{item.vendor}</span>}</span>
                      <span style={{color:"#6B7280"}}>{fmt(item.price)}</span>
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

  /* ── RENDER: Reporte ── */
  const renderReporte = () => {
    const byV = {};
    for (const o of orders) if (o.status==="preparando"||o.status==="en_calle") { (byV[o.vehicleId||"sin"]||(byV[o.vehicleId||"sin"]=[])).push(o); }
    return (
      <div style={{padding:"12px 0"}}>
        <div style={{padding:"0 20px 12px",fontSize:13,color:"#6B7280"}}>Reporte segmentado por camioneta</div>
        {Object.keys(byV).length===0 ? <div style={{textAlign:"center",padding:40,color:"#6B7280"}}>Sin datos</div> : (
          Object.entries(byV).map(([vid,vOrds]) => {
            const veh = VEHICLES.find(v=>v.id===vid);
            return (
              <div key={vid} style={{margin:"0 12px 12px",borderRadius:8,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                <div style={{padding:"10px 16px",background:"#F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:700,fontSize:15}}>{veh?.name||"Sin asignar"}</span>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={S.badge(veh?.color)}>{vOrds.length}</span>
                    <button onClick={()=>deleteVehicle(vid)} style={{...S.btn("danger"),padding:"4px 8px",fontSize:11}}>Eliminar camioneta</button>
                  </div>
                </div>
                {vOrds.map(o => (
                  <div key={o.id} style={{padding:"8px 16px",borderTop:"1px solid #E5E7EB",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:500,fontSize:13}}>{o.address} — {o.localidad}</div>
                      <div style={{fontSize:12,color:"#6B7280"}}>{o.items.length} artículo{o.items.length>1?"s":""}</div>
                    </div>
                    <button onClick={()=>deleteOrder(o.id)} style={{...S.btn("danger"),padding:"4px 8px",fontSize:11}}>✕</button>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    );
  };

  /* ── MAIN RENDER ── */
  return (
    <div style={S.app}>
      <div style={S.header}>
        <span style={S.logo}>PIANYI — Zonificación</span>
        <div style={S.tabs}>
          <button style={S.tab(activeTab==="zonificacion")} onClick={()=>setActiveTab("zonificacion")}>Zonificación</button>
          <button style={S.tab(activeTab==="en_calle")} onClick={()=>setActiveTab("en_calle")}>Pedidos en calle</button>
          <button style={S.tab(activeTab==="reporte")} onClick={()=>setActiveTab("reporte")}>Reporte diario</button>
        </div>
      </div>

      {activeTab==="zonificacion" && renderZonificacion()}
      {activeTab==="en_calle" && renderEnCalle()}
      {activeTab==="reporte" && renderReporte()}

      {/* Modal: Pegar pedidos */}
      {showPaste && (
        <div style={S.modal} onClick={()=>setShowPaste(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 12px",fontSize:18}}>Pegar pedidos de WhatsApp</h3>
            <p style={{fontSize:13,color:"#6B7280",margin:"0 0 12px"}}>Pegá los pedidos del grupo. El sistema detecta dirección, localidad, horario, vendedor y artículos. Si hay duplicados, te muestra la fusión antes de confirmar.</p>
            <textarea style={S.textarea} placeholder={"Ej:\n24/7 murguiondo 639 Liniers 0930 a 14\nPianyi 4\n3 imperial Golden $1599\n2 Heineken sin alcohol $1875"} value={pasteText} onChange={e=>setPasteText(e.target.value)} />
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button style={S.btn("primary")} onClick={handleParse}>Procesar</button>
              <button style={S.btn()} onClick={()=>setShowPaste(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Merge conflicts */}
      {mergeInfo && (
        <div style={S.modal}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 12px",fontSize:18,color:"#D97706"}}>Pedidos duplicados detectados</h3>
            <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>
              {mergeInfo.conflicts.length} cliente{mergeInfo.conflicts.length>1?"s":""} con pedido existente. Se fusionan: cantidad más alta + precio más alto, vendedor ganador por línea.
            </p>
            {mergeInfo.conflicts.map((c,i) => (
              <div key={i} style={{padding:12,background:"#F9FAFB",borderRadius:8,marginBottom:8,border:"1px solid #E5E7EB"}}>
                <div style={{fontWeight:600,marginBottom:6}}>{c.existing.address} — {c.existing.localidad}</div>
                <div style={{fontSize:12,color:"#6B7280",marginBottom:4}}>Resultado fusionado:</div>
                {c.merged.map(item => (
                  <div key={item.id} style={S.itemRow}>
                    <span>{item.qty}x {item.product}{item.vendor && <span style={S.vtag(item.vendor)}>{item.vendor}</span>}</span>
                    <span style={{color:"#6B7280"}}>{fmt(item.price)}</span>
                  </div>
                ))}
              </div>
            ))}
            {mergeInfo.clean.length>0 && <p style={{fontSize:12,color:"#6B7280",marginTop:8}}>+ {mergeInfo.clean.length} pedido{mergeInfo.clean.length>1?"s":""} nuevo{mergeInfo.clean.length>1?"s":""} sin conflicto</p>}
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button style={S.btn("success")} onClick={handleConfirmMerge}>Confirmar fusión</button>
              <button style={S.btn()} onClick={()=>setMergeInfo(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignar camioneta */}
      {showAssign && (
        <div style={S.modal} onClick={()=>setShowAssign(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 16px",fontSize:18}}>Asignar a camioneta</h3>
            <div style={{display:"grid",gap:8}}>
              {VEHICLES.map(v => (
                <button key={v.id} onClick={()=>handleAssign(v.id)} style={{...S.btn(),padding:"12px 16px",textAlign:"left",borderLeft:"4px solid "+v.color,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontWeight:600}}>{v.name}</span>
                  <span style={{color:"#6B7280"}}>{(streetByVehicle[v.id]||[]).length} asignados</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cobro pendiente */}
      {showDebt && (
        <div style={S.modal} onClick={()=>setShowDebt(false)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 16px",fontSize:18}}>Agregar cobro pendiente</h3>
            <div style={{display:"grid",gap:10}}>
              <input style={S.input} placeholder="Cliente" value={newDebt.client} onChange={e=>setNewDebt(p=>({...p,client:e.target.value}))} />
              <input style={S.input} placeholder="Dirección" value={newDebt.address} onChange={e=>setNewDebt(p=>({...p,address:e.target.value}))} />
              <input style={S.input} placeholder="Localidad" value={newDebt.localidad} onChange={e=>setNewDebt(p=>({...p,localidad:e.target.value}))} />
              <div style={{display:"flex",gap:10}}>
                <input style={S.input} placeholder="Monto total" type="number" value={newDebt.amount} onChange={e=>setNewDebt(p=>({...p,amount:e.target.value}))} />
                <input style={S.input} placeholder="Pagó (parcial)" type="number" value={newDebt.paid} onChange={e=>setNewDebt(p=>({...p,paid:e.target.value}))} />
              </div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button style={S.btn("primary")} onClick={addDebt}>Agregar</button>
                <button style={S.btn()} onClick={()=>setShowDebt(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";

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
const VENDEDORES = ["Alejandra","Benjamin","Santiago","Pianyi 1","Pianyi 2","Pianyi 3","Pianyi 4","Jeremias","Jose Costa","Mingo","Gerardo","Aly","Stella Fernandez","Ariel Tricariche"];
const VENDOR_ALIASES = {"jeremías":"Jeremias","gera":"Gerardo","gerar":"Gerardo","ali":"Aly"};
const VEHICLES = [
  {id:"t1",name:"Transit 1",color:"#3B82F6"},{id:"t2",name:"Transit 2",color:"#10B981"},
  {id:"t3",name:"Transit 3",color:"#F59E0B"},{id:"t4",name:"Transit 4",color:"#EF4444"},
  {id:"t5",name:"Transit 5",color:"#8B5CF6"},{id:"rb",name:"Ranger Beto",color:"#EC4899"},
  {id:"rbj",name:"Ranger Benji",color:"#14B8A6"},
];

const uid = () => Math.random().toString(36).slice(2,10);
const fmt = (n) => n ? ("$" + Number(n).toLocaleString("es-AR")) : "";

function findZone(loc) {
  if (!loc) return null;
  const l = loc.trim().toLowerCase();
  for (const [z,bs] of Object.entries(ZONES)) if (bs.some(b => b.toLowerCase() === l)) return z;
  return null;
}
function normalizeAddr(a) {
  const s = a.toLowerCase().replace(/[,.\-\/]+/g," ").replace(/\s+/g," ").trim();
  const m = s.match(/([a-záéíóúüñ\s]+)\s+(\d{1,5})/);
  return m ? (m[1].trim()+" "+m[2]) : s;
}
function stripAcc(s){return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function normProd(n) { return n.trim().toLowerCase().replace(/\s+/g," "); }
function mergeItems(ex, inc) {
  const r = ex.map(i=>({...i}));
  for (const ni of inc) {
    const idx = r.findIndex(x => normProd(x.product)===normProd(ni.product));
    if (idx>=0) { const e=r[idx]; if (ni.qty>e.qty||(ni.qty===e.qty&&ni.price>e.price)) r[idx]={...ni,id:e.id}; }
    else r.push({...ni});
  }
  return r;
}
function resolveVendor(line) {
  const low = line.toLowerCase().trim();
  if (VENDOR_ALIASES[low]) return VENDOR_ALIASES[low];
  const f = VENDEDORES.find(v => v.toLowerCase()===low);
  return f || null;
}
function isVendorLine(line) {
  const low = line.toLowerCase().trim();
  return !!(VENDOR_ALIASES[low] || VENDEDORES.find(v => v.toLowerCase()===low));
}

function parseWhatsApp(text) {
  const raw = text.replace(/\r/g,"").replace(/\u00A0/g," ").replace(/\u200B/g,"");
  const lines = raw.split("\n").map(l=>l.trim()).filter(l=>l.length>0);
  const orders = []; let cur = null;
  const hasStreet = l => /\d{3,5}/.test(l);
  const isSingleName = l => /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s]{2,30}$/.test(l) && !/\d/.test(l) && l.split(/\s+/).length<=3;
  const startsQty = l => /^\d+\s+[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/i.test(l);
  function parseItem(line) {
    const wp = line.match(/^(\d+)\s+(.+?)\s+\$?\s*([\d.,]+)\s*$/);
    if (wp) return {id:uid(),qty:parseInt(wp[1]),product:wp[2].trim(),price:parseFloat(wp[3].replace(/\./g,"").replace(",","."))};
    const np = line.match(/^(\d+)\s+(.+)$/);
    if (np) return {id:uid(),qty:parseInt(np[1]),product:np[2].trim(),price:0};
    return null;
  }
  for (let i=0;i<lines.length;i++) {
    const line = lines[i];
    if (/^pas[oó]\s+/i.test(line)) continue;
    if (isVendorLine(line)) { if (cur) cur.vendor=resolveVendor(line); continue; }
    if (isSingleName(line) && cur && !hasStreet(line)) { cur.contactName=line; continue; }
    // If we have a current order, try parsing as item FIRST (handles "1 247 lata $2175" etc)
    if (cur) {
      const it=parseItem(line);
      if (it) { it.vendor=cur.vendor||""; cur.items.push(it); continue; }
    }
    if (hasStreet(line)) {
      if (cur && cur.items.length>0) orders.push(cur);
      let addr=line,localidad="",horario="",vendor="",fecha="";
      // Extract horario
      const hm=addr.match(/(\d{1,2}(?:[.:]\d{2})?)\s*[-aA]\s*(\d{1,2}(?:[.:]\d{2})?)\s*(?:hs)?/i);
      if(hm){horario=hm[0];addr=addr.replace(hm[0],"").trim();}
      // Extract fecha (leading date like "24/7" or "23-6")
      const fm=addr.match(/^(\d{1,2}[/-]\d{1,2})\s*/);
      if(fm){fecha=fm[1];addr=addr.replace(fm[0],"").trim();}
      // Extract localidad: search AFTER the street number first (accent-insensitive)
      const numPos=addr.search(/\d{3,5}/);
      const numMatch=addr.match(/\d{3,5}/);
      const afterNum=numMatch?addr.slice(numPos+numMatch[0].length):"";
      const afterNumStrip=stripAcc(afterNum);
      let foundAfter=false;
      for(const[,bs]of Object.entries(ZONES)){for(const b of bs){const bStrip=stripAcc(b);const re=new RegExp(bStrip.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");if(re.test(afterNumStrip)){localidad=b;addr=addr.slice(0,numPos+(numMatch?numMatch[0].length:0))+afterNum.replace(new RegExp(bStrip.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"),"");addr=addr.trim();foundAfter=true;break;}}if(localidad)break;}
      if(!foundAfter){const addrStrip=stripAcc(addr);for(const[,bs]of Object.entries(ZONES)){for(const b of bs){const bStrip=stripAcc(b);const re=new RegExp(bStrip.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");if(re.test(addrStrip)){localidad=b;addr=stripAcc(addr).replace(re,"").trim();break;}}if(localidad)break;}}
      // Extract vendor
      for(const v of VENDEDORES){const re=new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");if(re.test(addr)){vendor=v;addr=addr.replace(re,"").trim();}}
      if(!vendor){const al=Object.keys(VENDOR_ALIASES);for(const a of al){const re=new RegExp("\\b"+a+"\\b","i");if(re.test(addr)){vendor=VENDOR_ALIASES[a];addr=addr.replace(re,"").trim();}}}
      addr=addr.replace(/[,\s]+$/,"").replace(/^\s*[,\s]+/,"").replace(/\s+/g," ").trim();
      // If no fecha, use today
      if(!fecha){const d=new Date();fecha=(d.getDate())+"/"+(d.getMonth()+1);}
      cur={id:uid(),address:addr||line,localidad,zone:findZone(localidad)||"SIN ZONA",horario,vendor,fecha,items:[],vehicleId:null,status:"pending",contactName:""};
    }
  }
  if(cur&&cur.items.length>0)orders.push(cur);
  for(const o of orders)o.items=o.items.map(it=>({...it,vendor:it.vendor||o.vendor}));
  const merged=[],map=new Map();
  for(const o of orders){const k=normalizeAddr(o.address);if(map.has(k)){const e=map.get(k);e.items=mergeItems(e.items,o.items);if(o.address.length>e.address.length)e.address=o.address;if(o.horario&&!e.horario)e.horario=o.horario;if(o.localidad&&!e.localidad){e.localidad=o.localidad;e.zone=o.zone;}}else{map.set(k,{...o,items:o.items.map(i=>({...i}))});merged.push(map.get(k));}}
  return merged;
}

const SAMPLE_DEBTS = [
  {id:"d1",client:"La Esquina de Juan",address:"Av. Corrientes 4521",localidad:"Almagro",zone:"CABA CENTRO",amount:45000,paid:15000},
  {id:"d2",client:"Kiosco Marta",address:"Cabildo 1230",localidad:"Belgrano",zone:"CABA NORTE",amount:22000,paid:0},
  {id:"d3",client:"Almacén Don Pedro",address:"Rivadavia 8800",localidad:"Liniers",zone:"CABA OESTE",amount:18500,paid:5000},
];

export default function Zonificacion() {
  const [orders, setOrders] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [activeTab, setActiveTab] = useState("zonificacion");
  const [expandedZones, setExpandedZones] = useState({});
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showDebt, setShowDebt] = useState(false);
  const [mergeInfo, setMergeInfo] = useState(null);
  const [newDebt, setNewDebt] = useState({client:"",address:"",localidad:"",amount:"",paid:""});
  const [editingItem, setEditingItem] = useState(null);
  const [depuratingOrder, setDepuratingOrder] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [motivoModal, setMotivoModal] = useState(null);
  const [routeModal, setRouteModal] = useState(null); // {vehicleId, origin, destination, routing:false}
  const [routeStatus, setRouteStatus] = useState("");
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Load Google Maps JS API
  useEffect(() => {
    const apiKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GOOGLE_MAPS_KEY : '';
    if (!apiKey || mapsLoaded || document.getElementById('gmaps-script')) return;
    const script = document.createElement('script');
    script.id = 'gmaps-script';
    script.src = 'https://maps.googleapis.com/maps/api/js?key='+apiKey+'&libraries=places';
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []); // {orderId, action:"rechazado"|"devuelto", motivo:""}

  useEffect(() => {
    try { const s=localStorage.getItem("pianyi_zon_orders"); if(s) setOrders(JSON.parse(s)); } catch(e){}
    try { const s=localStorage.getItem("pianyi_zon_debts"); if(s) setDebts(JSON.parse(s)); else setDebts(SAMPLE_DEBTS); } catch(e){ setDebts(SAMPLE_DEBTS); }
    setLoaded(true);
  }, []);
  useEffect(() => { if(loaded) try{localStorage.setItem("pianyi_zon_orders",JSON.stringify(orders))}catch(e){} }, [orders,loaded]);
  useEffect(() => { if(loaded) try{localStorage.setItem("pianyi_zon_debts",JSON.stringify(debts))}catch(e){} }, [debts,loaded]);

  const ordersByZone = useMemo(() => {
    const g={}; for(const z of Object.keys(ZONES))g[z]=[]; g["SIN ZONA"]=[];
    for(const o of orders){ const z=o.zone||"SIN ZONA"; if(!g[z])g[z]=[]; g[z].push(o); }
    return g;
  }, [orders]);
  const debtsByZone = useMemo(() => { const g={}; for(const d of debts)(g[d.zone]||(g[d.zone]=[])).push(d); return g; }, [debts]);
  const streetByVehicle = useMemo(() => {
    const g={};
    for(const o of orders) if(o.vehicleId&&(o.status==="preparando"||o.status==="en_calle")) (g[o.vehicleId]||(g[o.vehicleId]=[])).push(o);
    return g;
  }, [orders]);

  const handleParse = () => {
    if(!pasteText.trim()) return;
    const parsed=parseWhatsApp(pasteText);
    if(!parsed.length){setParseResult("No se detectaron pedidos.");return;}
    const conflicts=[],clean=[];
    for(const p of parsed){const k=normalizeAddr(p.address);const ex=orders.find(o=>normalizeAddr(o.address)===k&&o.status==="pending");if(ex)conflicts.push({existingId:ex.id,merged:mergeItems(ex.items,p.items)});else clean.push(p);}
    if(conflicts.length>0){setMergeInfo({conflicts,clean});}
    else{setOrders(prev=>[...prev,...clean]);setParseResult(clean.length+" pedido"+(clean.length>1?"s":"")+" cargado"+(clean.length>1?"s":""));setPasteText("");setTimeout(()=>{setShowPaste(false);setParseResult(null);},1200);}
  };
  const handleConfirmMerge = () => {
    if(!mergeInfo)return;
    setOrders(prev=>{const u=[...prev];for(const c of mergeInfo.conflicts){const i=u.findIndex(o=>o.id===c.existingId);if(i>=0)u[i]={...u[i],items:[...c.merged]};}return[...u,...mergeInfo.clean];});
    setMergeInfo(null);setPasteText("");setShowPaste(false);
  };
  const handleAssign = (vid) => {
    setOrders(prev=>prev.map(o=>selectedOrders.has(o.id)?{...o,vehicleId:vid,status:"preparando"}:o));
    setSelectedOrders(new Set());setShowAssign(false);
  };
  const toggleSelect = (id) => setSelectedOrders(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const deleteOrder = (id) => setOrders(prev=>prev.filter(o=>o.id!==id));
  const unassignVehicle = (vid) => setOrders(prev=>prev.map(o=>o.vehicleId===vid&&(o.status==="preparando"||o.status==="en_calle")?{...o,vehicleId:null,status:"pending"}:o));
  const deleteVehicle = (vid) => setOrders(prev=>prev.filter(o=>o.vehicleId!==vid));
  const startEdit = (oid,item) => setEditingItem({orderId:oid,itemId:item.id,qty:item.qty,price:item.price,product:item.product,vendor:item.vendor||""});
  const cancelEdit = () => setEditingItem(null);
  const saveEdit = () => {
    if(!editingItem)return;
    setOrders(prev=>prev.map(o=>{if(o.id!==editingItem.orderId)return o;return{...o,items:o.items.map(it=>it.id!==editingItem.itemId?it:{...it,qty:parseInt(editingItem.qty)||1,price:parseFloat(editingItem.price)||0,product:editingItem.product,vendor:editingItem.vendor})};}));
    setEditingItem(null);
  };
  const deleteItem = (oid,iid) => setOrders(prev=>prev.map(o=>{if(o.id!==oid)return o;const ni=o.items.filter(it=>it.id!==iid);return ni.length>0?{...o,items:ni}:null;}).filter(Boolean));
  const toggleZone = (z) => setExpandedZones(p=>({...p,[z]:!p[z]}));
  const addDebt = () => {
    const zone=findZone(newDebt.localidad)||"SIN ZONA";
    setDebts(prev=>[...prev,{id:uid(),client:newDebt.client,address:newDebt.address,localidad:newDebt.localidad,zone,amount:parseFloat(newDebt.amount)||0,paid:parseFloat(newDebt.paid)||0}]);
    setNewDebt({client:"",address:"",localidad:"",amount:"",paid:""});setShowDebt(false);
  };
  const deleteDebt = (id) => setDebts(prev=>prev.filter(d=>d.id!==id));

  // Depuration handlers
  const depurateTotal = (id) => setOrders(prev=>prev.map(o=>o.id===id?{...o,status:"entregado"}:o));
  const depurateReject = (id) => setMotivoModal({orderId:id, action:"rechazado", motivo:""});
  const returnToZoneStart = (id) => setMotivoModal({orderId:id, action:"devuelto", motivo:""});
  const confirmMotivo = () => {
    if(!motivoModal) return;
    const {orderId, action, motivo} = motivoModal;
    if(action==="rechazado") {
      setOrders(prev=>prev.map(o=>o.id===orderId?{...o, status:"rechazado", motivo: motivo||"Sin motivo", vehicleId:o.vehicleId}:o));
    } else {
      setOrders(prev=>prev.map(o=>o.id===orderId?{...o, status:"pending", vehicleId:null, motivo: motivo||"Sin motivo", devuelto:true}:o));
    }
    setMotivoModal(null);
  };  const depuratePartialConfirm = (oid, deliveredMap) => {
    setOrders(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(o=>o.id===oid);
      if(idx<0) return prev;
      const order = updated[idx];
      const returnItems = [];
      const deliveredItems = [];
      for(const item of order.items) {
        const dQty = deliveredMap[item.id] ?? item.qty;
        if(dQty >= item.qty) { deliveredItems.push({...item}); }
        else if(dQty > 0) {
          deliveredItems.push({...item, qty: dQty});
          returnItems.push({...item, id: uid(), qty: item.qty - dQty});
        } else { returnItems.push({...item, id: uid()}); }
      }
      updated[idx] = {...order, items: deliveredItems, status: "entregado", parcial: returnItems.length > 0};
      if(returnItems.length > 0) {
        updated.push({...order, id: uid(), items: returnItems, vehicleId: null, status: "depurado"});
      }
      return updated;
    });
    setDepuratingOrder(null);
  };

  // Automatic routing with Google
  function parseClosingTime(horario) {
    if (!horario) return 14;
    const h = horario.toLowerCase().replace(/hs/g,"").trim();
    if (h.includes("no cierra") || h.includes("corrido")) return 99;
    const match = h.match(/[-aA]\s*(\d{1,2})(?:[.:](\d{2}))?/);
    if (match) {
      const hr = parseInt(match[1]);
      const min = match[2] ? parseInt(match[2]) : 0;
      return hr + min/60;
    }
    return 14;
  }

  function getCloseCategory(closeTime) {
    if (closeTime <= 14) return "early"; // closes at 14 or before → priority
    return "noclose"; // stays open after 14 → goes after
  }

  const runAutoRoute = async (vehicleId, origin, destination) => {
    if (!window.google || !window.google.maps) { setRouteStatus("Error: Google Maps no cargó. Recargá la página."); return; }
    const vOrds = orders.filter(o=>o.vehicleId===vehicleId&&(o.status==="preparando"||o.status==="en_calle"));
    if (vOrds.length < 2) { setRouteStatus("Se necesitan al menos 2 pedidos para rutear."); return; }
    if (vOrds.length > 25) { setRouteStatus("Google permite máximo 25 paradas. Reducí los pedidos."); return; }

    setRouteStatus("Calculando ruta óptima...");

    const classified = vOrds.map(o => ({...o, closeTime: parseClosingTime(o.horario), category: getCloseCategory(parseClosingTime(o.horario))}));
    const earlyOrders = classified.filter(o => o.category === "early").sort((a,b) => a.closeTime - b.closeTime);
    const noCloseOrders = classified.filter(o => o.category === "noclose");

    // Priority order: early closers first, then mid, then no-close
    const sortedOrds = [...earlyOrders, ...noCloseOrders];
    const waypoints = sortedOrds.map(o => ({
      location: o.address + ", " + o.localidad + ", Buenos Aires, Argentina",
      stopover: true
    }));

    try {
      const directionsService = new window.google.maps.DirectionsService();
      const result = await new Promise((resolve, reject) => {
        directionsService.route({
          origin: origin + ", Buenos Aires, Argentina",
          destination: destination + ", Buenos Aires, Argentina",
          waypoints: waypoints,
          optimizeWaypoints: true,
          travelMode: window.google.maps.TravelMode.DRIVING,
          region: 'ar'
        }, (response, status) => {
          if (status === 'OK') resolve(response);
          else reject(new Error("Error de Google: " + status));
        });
      });

      const waypointOrder = result.routes[0].waypoint_order;
      const reorderedIds = waypointOrder.map(i => sortedOrds[i].id);
      const legs = result.routes[0].legs;
      const totalKm = Math.round(legs.reduce((s,l) => s + l.distance.value, 0) / 1000);
      const totalMin = Math.round(legs.reduce((s,l) => s + l.duration.value, 0) / 60);

      // Check alerts for no-close orders that end up far from the route
      let alerts = [];
      noCloseOrders.forEach(nco => {
        const posInRoute = waypointOrder.indexOf(sortedOrds.indexOf(nco));
        if (posInRoute >= 0 && posInRoute < legs.length) {
          const legDuration = Math.round(legs[posInRoute].duration.value / 60);
          if (legDuration > 25) {
            alerts.push(nco.address + " (" + nco.localidad + "): hacerlo post 14hs suma " + legDuration + " min de recorrido. Evaluar si conviene incluirlo en el orden regular.");
          }
        }
      });

      // Apply the new order
      setOrders(prev => {
        const all = [...prev];
        const vIndices = all.reduce((ac,o,i) => {
          if (o.vehicleId===vehicleId && (o.status==="preparando"||o.status==="en_calle")) ac.push(i);
          return ac;
        }, []);
        const reorderedOrders = reorderedIds.map(id => all[vIndices.find(i => all[i].id === id)]);
        for (let j=0; j<vIndices.length; j++) all[vIndices[j]] = reorderedOrders[j];
        return all;
      });

      let statusMsg = "Ruta optimizada: " + totalKm + " km, ~" + totalMin + " min. " + vOrds.length + " paradas.";
      if (alerts.length > 0) statusMsg += "\n⚠ ALERTAS:\n" + alerts.join("\n");
      setRouteStatus(statusMsg);
      if (alerts.length === 0) setTimeout(() => { setRouteModal(null); setRouteStatus(""); }, 3000);
    } catch (err) {
      setRouteStatus("Error: " + err.message);
    }
  };

  const moveOrder = (vid,oid,dir) => {
    setOrders(prev=>{const a=[...prev];const vi=a.reduce((ac,o,i)=>{if(o.vehicleId===vid&&(o.status==="preparando"||o.status==="en_calle"))ac.push(i);return ac;},[]);const p=vi.findIndex(i=>a[i].id===oid);if(p<0)return prev;const sp=dir==="up"?p-1:p+1;if(sp<0||sp>=vi.length)return prev;[a[vi[p]],a[vi[sp]]]=[a[vi[sp]],a[vi[p]]];return a;});
  };
  const setOrderPos = (vid,oid,np) => {
    setOrders(prev=>{const a=[...prev];const vi=a.reduce((ac,o,i)=>{if(o.vehicleId===vid&&(o.status==="preparando"||o.status==="en_calle"))ac.push(i);return ac;},[]);const cp=vi.findIndex(i=>a[i].id===oid);if(cp<0)return prev;const t=Math.max(0,Math.min(np-1,vi.length-1));if(t===cp)return prev;const vo=vi.map(i=>a[i]);const[m]=vo.splice(cp,1);vo.splice(t,0,m);for(let j=0;j<vi.length;j++)a[vi[j]]=vo[j];return a;});
  };

  // Print HDR - real format
  const printHDR = (vehicleId) => {
    const veh = VEHICLES.find(v=>v.id===vehicleId);
    const vOrds = orders.filter(o=>o.vehicleId===vehicleId&&(o.status==="preparando"||o.status==="en_calle"));
    const vDebts = debts.filter(d=>vOrds.some(o=>normalizeAddr(o.address)===normalizeAddr(d.address)));
    const today = new Date();
    const dd = today.getDate();
    const mm = today.getMonth()+1;
    const yy = today.getFullYear();
    const dateStr = dd+"/"+mm+"/"+yy;

    let ordersHtml = "";
    vOrds.forEach((o,i) => {
      const debt = vDebts.find(d=>normalizeAddr(d.address)===normalizeAddr(o.address));
      const itemLines = [];
      let lineItems = [];
      o.items.forEach((item,j) => {
        const pStr = item.price ? " $"+Number(item.price).toLocaleString("es-AR") : "";
        const vStr = item.vendor ? " "+item.vendor : "";
        lineItems.push(item.qty+" "+item.product+pStr+vStr);
        if(lineItems.length===2 || j===o.items.length-1) {
          itemLines.push(lineItems.join(" | "));
          lineItems = [];
        }
      });
      const addrLine = (o.horario ? o.horario+" " : "") + o.address.toUpperCase() + " " + (o.localidad||"").toUpperCase();
      const debtLine = debt ? '<div style="color:#dc2626;font-weight:700;font-size:9px;">⚠ COBRO PENDIENTE $'+(debt.amount-debt.paid).toLocaleString("es-AR")+'</div>' : "";
      ordersHtml += '<div style="margin-bottom:6px;"><div style="font-weight:700;font-size:10px;">'+addrLine+'</div>'+debtLine;
      itemLines.forEach(l => { ordersHtml += '<div style="font-size:9px;padding-left:6px;">'+l+'</div>'; });
      ordersHtml += '</div>';
    });

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>HDR '+(veh?veh.name:"")+'</title>'
    +'<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:10px;color:#111;padding:12px}'
    +'table{width:100%;border-collapse:collapse}td,th{border:1px solid #333;padding:3px 6px;font-size:9px;vertical-align:top}'
    +'.hdr-header td{font-weight:700;font-size:9px;height:22px}'
    +'@media print{body{padding:6px}}</style></head><body>'
    +'<table><tr class="hdr-header"><td>FECHA<br><span style="font-weight:400">'+dateStr+'</span></td>'
    +'<td>VEHICULO<br><span style="font-weight:400">'+(veh?veh.name.toUpperCase():"")+'</span></td>'
    +'<td>NV DIA<br><span style="font-weight:400">'+vOrds.length+'</span></td>'
    +'<td>FALTANTES</td><td>FIRMA ADM</td></tr>'
    +'<tr class="hdr-header"><td>CARGA</td><td>CHOFER</td><td>NV PEND</td><td colspan="2">FIRMA REPARTO</td></tr>'
    +'<tr class="hdr-header"><td>CONTROL</td><td>ACOMP.</td><td colspan="3">TOTAL NV</td></tr></table>'

    +'<table style="margin-top:4px"><tr class="hdr-header">'
    +'<td>TOTAL NV DIARIAS</td><td>CASH</td><td>TRANSFERENCIAS</td>'
    +'<td>CANT FIRMAS</td><td>CANT DESCUENTOS</td><td>SOBRANTES</td><td>PEND.CASH</td><td>PEND.TRANSF</td></tr>'
    +'<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table>'

    +'<table style="margin-top:4px"><tr class="hdr-header"><td colspan="2">FACTURACION</td><td colspan="2">CAJA CASH</td></tr>'
    +'<tr><td colspan="2">&nbsp;</td><td colspan="2">&nbsp;</td></tr></table>'

    +'<table style="margin-top:4px"><tr class="hdr-header"><td>ROTURAS</td><td>SOBRANTES</td><td>FIRMA ADM</td><td>FIRMA REPARTO</td></tr>'
    +'<tr><td style="height:50px">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table>'

    +'<div style="margin-top:8px;border:1px solid #333;padding:6px;">'+ordersHtml+'</div>'
    +'</body></html>';

    const w = window.open("","_blank","width=900,height=700");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
  };

  // Download zonificación as Word/PDF
  const downloadZonificacion = (format) => {
    const activeOrders = orders.filter(o => o.status !== "entregado" && o.status !== "rechazado");
    const byZone = {};
    for (const z of Object.keys(ZONES)) byZone[z] = [];
    byZone["SIN ZONA"] = [];
    for (const o of activeOrders) { const z = o.zone || "SIN ZONA"; if (!byZone[z]) byZone[z] = []; byZone[z].push(o); }

    let body = "";
    for (const [zone, zOrds] of Object.entries(byZone)) {
      if (zOrds.length === 0) continue;
      body += '<h2 style="font-size:14px;margin:16px 0 8px;border-bottom:1px solid #333;padding-bottom:4px;">'+zone+' ('+zOrds.length+' pedidos)</h2>';
      for (const o of zOrds) {
        const veh = VEHICLES.find(v => v.id === o.vehicleId);
        const vehLabel = veh ? ' <span style="color:'+veh.color+';font-weight:700;">['+veh.name+']</span>' : '';
        const depLabel = o.status === "depurado" ? ' <span style="color:#D97706;">(DEPURADO)</span>' : '';
        const fecha = o.fecha ? o.fecha + ' ' : '';
        body += '<div style="margin:6px 0;"><b>' + fecha + o.address.toUpperCase() + ' ' + (o.localidad||'').toUpperCase() + ' ' + (o.horario||'') + ' ' + (o.vendor||'') + '</b>' + vehLabel + depLabel + '</div>';
        for (const item of o.items) {
          const pStr = item.price ? ' $' + Number(item.price).toLocaleString('es-AR') : '';
          const vStr = item.vendor && item.vendor !== o.vendor ? ' ' + item.vendor : '';
          body += '<div style="padding-left:12px;font-size:11px;">- ' + item.qty + ' ' + item.product + pStr + vStr + '</div>';
        }
      }
    }

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zonificación Pianyi</title>'
      + '<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:20px;}'
      + 'h1{font-size:18px;margin-bottom:4px;}h2{font-size:14px;}'
      + '@media print{body{padding:10px}}</style></head><body>'
      + '<h1>ZONIFICACIÓN PIANYI</h1>'
      + '<div style="color:#666;margin-bottom:12px;">Generado: ' + new Date().toLocaleDateString("es-AR") + ' — ' + activeOrders.length + ' pedidos activos</div>'
      + body + '</body></html>';

    if (format === "pdf") {
      const w = window.open("", "_blank", "width=900,height=700");
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    } else {
      const blob = new Blob([html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Zonificacion_Pianyi_" + new Date().toISOString().slice(0,10) + ".doc";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const filteredZones = useMemo(() => {
    if(!searchTerm) return Object.keys(ZONES);
    const t=searchTerm.toLowerCase();
    return Object.keys(ZONES).filter(z=>{
      if(z.toLowerCase().includes(t))return true;
      return(ordersByZone[z]||[]).some(o=>o.address.toLowerCase().includes(t)||o.localidad.toLowerCase().includes(t)||o.items.some(it=>it.product.toLowerCase().includes(t)));
    });
  },[searchTerm,ordersByZone]);

  const handleReset = () => {
    if(!confirm("¿Borrar TODOS los pedidos y cobros pendientes? Esta acción no se puede deshacer."))return;
    setOrders([]);setDebts([]);
    try{localStorage.removeItem("pianyi_zon_orders")}catch(e){}
    try{localStorage.removeItem("pianyi_zon_debts")}catch(e){}
  };

  const S = {
    app:{fontFamily:"'Inter',-apple-system,sans-serif",background:"#fff",color:"#1A1A2E",minHeight:"100vh"},
    header:{padding:"16px 20px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
    logo:{fontSize:20,fontWeight:700,color:"#1A1A2E"},
    tabs:{display:"flex",gap:4,background:"#F3F4F6",borderRadius:8,padding:3},
    tab:a=>({padding:"8px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:a?"#fff":"transparent",color:a?"#1A1A2E":"#6B7280",boxShadow:a?"0 1px 3px rgba(0,0,0,0.1)":"none"}),
    toolbar:{padding:"12px 20px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",borderBottom:"1px solid #E5E7EB"},
    btn:v=>({padding:"8px 14px",borderRadius:6,border:v?"none":"1px solid #D1D5DB",cursor:"pointer",fontSize:13,fontWeight:600,...(v==="primary"?{background:"#3B82F6",color:"#fff"}:v==="danger"?{background:"#DC2626",color:"#fff"}:v==="success"?{background:"#059669",color:"#fff"}:v==="warning"?{background:"#D97706",color:"#fff"}:{background:"#F3F4F6",color:"#374151"})}),
    search:{padding:"8px 12px",borderRadius:6,border:"1px solid #D1D5DB",background:"#fff",color:"#1A1A2E",fontSize:13,flex:1,minWidth:200,outline:"none"},
    zone:{margin:"0 12px 8px",borderRadius:8,overflow:"hidden",border:"1px solid #E5E7EB"},
    zoneHead:has=>({padding:"10px 16px",background:has?"#F9FAFB":"#FAFAFA",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none"}),
    badge:c=>({background:c||"#3B82F6",color:"#fff",padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700}),
    orderCard:vc=>({padding:"10px 16px",borderBottom:"1px solid #E5E7EB",background:vc?vc+"10":"#fff",borderLeft:vc?"3px solid "+vc:"3px solid transparent"}),
    itemRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",fontSize:13},
    debtRow:{background:"#FEF2F2",borderLeft:"3px solid #DC2626",padding:"10px 16px",borderBottom:"1px solid #E5E7EB"},
    debtBadge:{background:"#DC2626",color:"#fff",padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:700},
    debtGroupHead:{padding:"6px 16px",background:"#FEF2F2",borderBottom:"1px solid #E5E7EB",fontSize:12,fontWeight:600,color:"#DC2626"},
    modal:{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16},
    modalBox:{background:"#fff",borderRadius:12,padding:24,maxWidth:600,width:"100%",maxHeight:"80vh",overflow:"auto",border:"1px solid #E5E7EB",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"},
    textarea:{width:"100%",minHeight:200,background:"#F9FAFB",color:"#1A1A2E",border:"1px solid #D1D5DB",borderRadius:8,padding:12,fontSize:13,fontFamily:"monospace",resize:"vertical",outline:"none",boxSizing:"border-box"},
    input:{padding:"8px 12px",borderRadius:6,border:"1px solid #D1D5DB",background:"#F9FAFB",color:"#1A1A2E",fontSize:13,width:"100%",outline:"none",boxSizing:"border-box"},
    vCard:c=>({padding:"12px 16px",margin:"0 12px 8px",borderRadius:8,border:"1px solid "+c+"30",background:c+"06",borderLeft:"4px solid "+c}),
    vtag:v=>{const cs={"Jose Costa":"#D97706","Pianyi 1":"#2563EB","Pianyi 2":"#0891B2","Pianyi 3":"#7C3AED","Pianyi 4":"#7C3AED","Benjamin":"#059669","Alejandra":"#DB2777","Santiago":"#EA580C","Jeremias":"#4F46E5","Mingo":"#0D9488","Gerardo":"#B45309","Aly":"#9333EA","Stella Fernandez":"#E11D48","Ariel Tricariche":"#1D4ED8"};const c=cs[v]||"#6B7280";return{fontSize:11,color:c,fontWeight:600,marginLeft:8,padding:"1px 6px",borderRadius:4,background:c+"12"};},
  };

  const renderItemRow = (order, item) => {
    const isEd = editingItem && editingItem.orderId===order.id && editingItem.itemId===item.id;
    if(isEd) return (
      <div key={item.id} style={{padding:"4px 0",display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",fontSize:12}}>
        <input type="number" min={1} value={editingItem.qty} onChange={e=>setEditingItem(p=>({...p,qty:e.target.value}))} style={{width:45,padding:"3px 6px",border:"1px solid #D1D5DB",borderRadius:4,fontSize:12,textAlign:"center"}} />
        <input value={editingItem.product} onChange={e=>setEditingItem(p=>({...p,product:e.target.value}))} style={{flex:1,minWidth:100,padding:"3px 6px",border:"1px solid #D1D5DB",borderRadius:4,fontSize:12}} />
        <input type="number" value={editingItem.price} onChange={e=>setEditingItem(p=>({...p,price:e.target.value}))} style={{width:70,padding:"3px 6px",border:"1px solid #D1D5DB",borderRadius:4,fontSize:12,textAlign:"right"}} />
        <select value={editingItem.vendor} onChange={e=>setEditingItem(p=>({...p,vendor:e.target.value}))} style={{padding:"3px 6px",border:"1px solid #D1D5DB",borderRadius:4,fontSize:12,background:"#F9FAFB"}}>
          <option value="">Sin vendedor</option>
          {VENDEDORES.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
        <button onClick={saveEdit} style={{...S.btn("success"),padding:"3px 8px",fontSize:11}}>✓</button>
        <button onClick={cancelEdit} style={{...S.btn(),padding:"3px 8px",fontSize:11}}>✕</button>
      </div>
    );
    return (
      <div key={item.id} style={{...S.itemRow,cursor:"pointer"}} onClick={()=>startEdit(order.id,item)} title="Click para editar">
        <span><span style={{color:"#6B7280",marginRight:6}}>{item.qty}x</span>{item.product}{item.vendor && <span style={S.vtag(item.vendor)}>{item.vendor}</span>}</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"#6B7280"}}>{fmt(item.price)}</span>
          <button onClick={e=>{e.stopPropagation();deleteItem(order.id,item.id)}} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:11,padding:"0 2px"}}>✕</button>
        </div>
      </div>
    );
  };

  // ZONIFICACIÓN TAB - shows ALL orders, painted when assigned
  const renderZonificacion = () => (
    <>
      <div style={S.toolbar}>
        <button style={S.btn("primary")} onClick={()=>setShowPaste(true)}>+ Pegar pedidos</button>
        {selectedOrders.size>0 && <button style={S.btn("success")} onClick={()=>setShowAssign(true)}>Asignar {selectedOrders.size} pedido{selectedOrders.size>1?"s":""}</button>}
        <button style={S.btn()} onClick={()=>setShowDebt(true)}>+ Cobro pendiente</button>
        <button style={S.btn()} onClick={()=>downloadZonificacion("word")}>📄 Word</button>
        <button style={S.btn()} onClick={()=>downloadZonificacion("pdf")}>📋 PDF</button>
        <label style={{...S.btn(),cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
          📂 Importar JSON
          <input type="file" accept=".json" style={{display:"none"}} onChange={e=>{
            const file=e.target.files[0]; if(!file)return;
            const reader=new FileReader();
            reader.onload=ev=>{
              try{
                const imported=JSON.parse(ev.target.result);
                if(!Array.isArray(imported)){alert("El archivo no tiene formato válido.");return;}
                const count=imported.length;
                if(confirm("Se van a importar "+count+" pedidos. ¿Confirmar?")){
                  setOrders(prev=>[...prev,...imported]);
                  alert(count+" pedidos importados correctamente.");
                }
              }catch(err){alert("Error al leer el archivo: "+err.message);}
            };
            reader.readAsText(file);
            e.target.value="";
          }} />
        </label>
        <input style={S.search} placeholder="Buscar dirección, localidad, producto..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
      </div>
      <div style={{padding:"8px 0"}}>
        {filteredZones.map(zone => {
          const allOrds = (ordersByZone[zone]||[]).filter(o => {
            if(o.status==="entregado"||o.status==="rechazado") return false;
            if(!searchTerm) return true;
            const t=searchTerm.toLowerCase();
            return o.address.toLowerCase().includes(t)||o.localidad.toLowerCase().includes(t)||o.items.some(it=>it.product.toLowerCase().includes(t));
          });
          const zDebts = debtsByZone[zone]||[];
          const debtsWithOrder = zDebts.filter(d=>allOrds.some(o=>normalizeAddr(o.address)===normalizeAddr(d.address)));
          const debtsNoOrder = zDebts.filter(d=>!allOrds.some(o=>normalizeAddr(o.address)===normalizeAddr(d.address)));
          const total = allOrds.length + debtsNoOrder.length;
          const exp = expandedZones[zone];
          return (
            <div key={zone} style={S.zone}>
              <div style={S.zoneHead(total>0)} onClick={()=>toggleZone(zone)}>
                <span style={{fontWeight:600,fontSize:14}}>{exp?"▼":"▶"} {zone}</span>
                <div style={{display:"flex",gap:6}}>
                  {allOrds.length>0 && <span style={S.badge("#3B82F6")}>{allOrds.length}</span>}
                  {zDebts.length>0 && <span style={S.badge("#DC2626")}>{zDebts.length} deuda{zDebts.length>1?"s":""}</span>}
                </div>
              </div>
              {exp && <div>
                {allOrds.map(order => {
                  const veh = VEHICLES.find(v=>v.id===order.vehicleId);
                  const isAssigned = !!order.vehicleId;
                  const debt = debtsWithOrder.find(d=>normalizeAddr(d.address)===normalizeAddr(order.address));
                  return (
                    <div key={order.id} style={S.orderCard(veh?.color)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {!isAssigned && (order.status==="pending"||order.status==="depurado") && <input type="checkbox" checked={selectedOrders.has(order.id)} onChange={()=>toggleSelect(order.id)} style={{accentColor:"#3B82F6"}} />}
                          <div>
                            <div style={{fontWeight:600,fontSize:14}}>
                              {order.fecha && <span style={{color:"#6B7280",fontWeight:400,fontSize:12,marginRight:6}}>{order.fecha}</span>}
                              {order.address}
                              {isAssigned && <span style={{...S.badge(veh?.color),marginLeft:8,fontSize:10}}>{veh?.name}</span>}
                            </div>
                            <div style={{fontSize:12,color:"#6B7280"}}>
                              {order.localidad}{order.horario?` • ${order.horario}`:""}
                              {order.status==="depurado" && <span style={{color:"#D97706",marginLeft:8,fontWeight:600}}>DEPURADO</span>}
                            </div>
                          </div>
                        </div>
                        {!isAssigned && <button onClick={()=>deleteOrder(order.id)} style={{...S.btn("danger"),padding:"4px 8px",fontSize:11}}>✕</button>}
                      </div>
                      {debt && (
                        <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:6,padding:"6px 10px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={S.debtBadge}>DEUDA PENDIENTE DE PAGO</span>
                          <span style={{color:"#DC2626",fontWeight:700,fontSize:14}}>{fmt(debt.amount-debt.paid)}</span>
                        </div>
                      )}
                      {order.items.map(item => renderItemRow(order, item))}
                    </div>
                  );
                })}
                {debtsNoOrder.length>0 && <>
                  <div style={S.debtGroupHead}>COBROS PENDIENTES SIN PEDIDO</div>
                  {debtsNoOrder.map(d => (
                    <div key={d.id} style={S.debtRow}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontWeight:600,fontSize:14}}>{d.client}</div><div style={{fontSize:12,color:"#6B7280"}}>{d.address} • {d.localidad}</div></div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{textAlign:"right"}}><span style={S.debtBadge}>DEUDA PENDIENTE DE PAGO</span><div style={{color:"#DC2626",fontWeight:700,fontSize:16,marginTop:4}}>{fmt(d.amount-d.paid)}</div>{d.paid>0&&<div style={{fontSize:11,color:"#6B7280"}}>Pagó parcial: {fmt(d.paid)}</div>}</div>
                          <button onClick={()=>deleteDebt(d.id)} style={{...S.btn("danger"),padding:"4px 8px",fontSize:11}}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>}
                {allOrds.length===0 && debtsNoOrder.length===0 && <div style={{padding:16,textAlign:"center",color:"#9CA3AF",fontSize:13}}>Sin pedidos ni cobros pendientes</div>}
              </div>}
            </div>
          );
        })}
      </div>
    </>
  );

  // PEDIDOS EN CALLE TAB - with depuration
  const renderEnCalle = () => (
    <div style={{padding:"12px 0"}}>
      {Object.keys(streetByVehicle).length===0 ? <div style={{textAlign:"center",padding:40,color:"#6B7280"}}>No hay pedidos en calle</div> : (
        Object.entries(streetByVehicle).map(([vid,vOrds]) => {
          const veh = VEHICLES.find(v=>v.id===vid);
          return (
            <div key={vid} style={S.vCard(veh?.color||"#6B7280")}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <span style={{fontWeight:700,fontSize:16}}>{veh?.name||"Sin asignar"}</span>
                  <span style={{...S.badge(veh?.color),marginLeft:8}}>{vOrds.length} pedido{vOrds.length>1?"s":""}</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button style={S.btn("success")} onClick={()=>setRouteModal({vehicleId:vid,origin:"Cañada de Juan Ruiz 716, Morón",destination:"Cañada de Juan Ruiz 716, Morón",routing:false})}>🗺 Ruteo auto</button>
                  <button style={S.btn("primary")} onClick={()=>printHDR(vid)}>🖨 Imprimir HDR</button>
                  <button style={S.btn("warning")} onClick={()=>unassignVehicle(vid)}>↩ Desasignar</button>
                </div>
              </div>
              {vOrds.map((order,idx) => {
                const isDepurating = depuratingOrder?.id === order.id;
                return (
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
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      <button onClick={()=>depurateTotal(order.id)} style={{...S.btn("success"),padding:"4px 8px",fontSize:11}}>✓ Entregado</button>
                      <button onClick={()=>setDepuratingOrder(isDepurating?null:{id:order.id,items:Object.fromEntries(order.items.map(i=>[i.id,i.qty]))})} style={{...S.btn("warning"),padding:"4px 8px",fontSize:11}}>{isDepurating?"Cancelar":"Parcial"}</button>
                      <button onClick={()=>depurateReject(order.id)} style={{...S.btn(),padding:"4px 8px",fontSize:11}}>✗ Rechazo</button>
                      <button onClick={()=>returnToZoneStart(order.id)} style={{...S.btn(),padding:"4px 8px",fontSize:11}}>↩ Volver</button>
                    </div>
                  </div>
                  {isDepurating ? (
                    <div style={{marginTop:8,padding:8,background:"#FFFBEB",borderRadius:6,border:"1px solid #FDE68A"}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#92400E",marginBottom:6}}>Depuración parcial — ajustá las cantidades entregadas:</div>
                      {order.items.map(item => (
                        <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"3px 0",fontSize:13}}>
                          <input type="number" min={0} max={item.qty} value={depuratingOrder.items[item.id]??item.qty} onChange={e=>{const v=Math.min(parseInt(e.target.value)||0,item.qty);setDepuratingOrder(p=>({...p,items:{...p.items,[item.id]:v}}));}} style={{width:45,padding:"3px",border:"1px solid #D1D5DB",borderRadius:4,textAlign:"center",fontSize:12}} />
                          <span style={{color:"#6B7280"}}>/ {item.qty}</span>
                          <span>{item.product}</span>
                          {item.vendor && <span style={S.vtag(item.vendor)}>{item.vendor}</span>}
                        </div>
                      ))}
                      <button onClick={()=>depuratePartialConfirm(order.id,depuratingOrder.items)} style={{...S.btn("warning"),marginTop:8,fontSize:12}}>Confirmar parcial</button>
                    </div>
                  ) : (
                    order.items.map(item => (
                      <div key={item.id} style={{...S.itemRow,paddingLeft:52}}>
                        <span><span style={{color:"#6B7280"}}>{item.qty}x</span> {item.product}{item.vendor && <span style={S.vtag(item.vendor)}>{item.vendor}</span>}</span>
                        <span style={{color:"#6B7280"}}>{fmt(item.price)}</span>
                      </div>
                    ))
                  )}
                </div>
              );})}
            </div>
          );
        })
      )}
    </div>
  );

  // REPORTE TAB
  const renderReporte = () => {
    const byV={};
    for(const o of orders) if(o.vehicleId&&(o.status==="preparando"||o.status==="en_calle"||o.status==="entregado"||o.status==="rechazado"||(o.status==="pending"&&o.devuelto))) (byV[o.vehicleId]||(byV[o.vehicleId]=[])).push(o);
    return (
      <div style={{padding:"12px 0"}}>
        <div style={{padding:"0 20px 12px",fontSize:13,color:"#6B7280"}}>Reporte segmentado por camioneta</div>
        {Object.keys(byV).length===0?<div style={{textAlign:"center",padding:40,color:"#6B7280"}}>Sin datos</div>:(
          Object.entries(byV).map(([vid,vOrds])=>{
            const veh=VEHICLES.find(v=>v.id===vid);
            return(
              <div key={vid} style={{margin:"0 12px 12px",borderRadius:8,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                <div style={{padding:"10px 16px",background:"#F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:700,fontSize:15}}>{veh?.name||"Sin asignar"}</span>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={S.badge(veh?.color)}>{vOrds.length}</span>
                    <button onClick={()=>deleteVehicle(vid)} style={{...S.btn("danger"),padding:"4px 8px",fontSize:11}}>Eliminar camioneta</button>
                  </div>
                </div>
                {vOrds.map(o=>(
                  <div key={o.id} style={{padding:"8px 16px",borderTop:"1px solid #E5E7EB",display:"flex",justifyContent:"space-between",alignItems:"center",background:o.status==="rechazado"?"#FEF2F2":o.devuelto?"#FFFBEB":"transparent"}}>
                    <div>
                      <div style={{fontWeight:500,fontSize:13}}>
                        {o.address} — {o.localidad}{" "}
                        {o.status==="entregado"&&<span style={{color:"#059669",fontSize:11,fontWeight:700}}>✓ {o.parcial?"ENTREGADO PARCIAL":"ENTREGADO"}</span>}
                        {o.status==="rechazado"&&<span style={{color:"#DC2626",fontSize:11,fontWeight:700}}>✗ RECHAZADO</span>}
                        {o.devuelto&&o.status==="pending"&&<span style={{color:"#D97706",fontSize:11,fontWeight:700}}>↩ DEVUELTO A ZONA</span>}
                      </div>
                      <div style={{fontSize:12,color:"#6B7280"}}>{o.items.length} artículo{o.items.length>1?"s":""}{o.motivo&&<span style={{marginLeft:8,fontStyle:"italic"}}>Motivo: {o.motivo}</span>}</div>
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

  if(!loaded) return <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}><span style={{fontSize:16,color:"#6B7280"}}>Cargando datos...</span></div>;

  return (
    <div style={S.app}>
      <div style={S.header}>
        <span style={S.logo}>PIANYI — Zonificación</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={S.tabs}>
            <button style={S.tab(activeTab==="zonificacion")} onClick={()=>setActiveTab("zonificacion")}>Zonificación</button>
            <button style={S.tab(activeTab==="en_calle")} onClick={()=>setActiveTab("en_calle")}>Pedidos en calle</button>
            <button style={S.tab(activeTab==="reporte")} onClick={()=>setActiveTab("reporte")}>Reporte diario</button>
          </div>
          <button onClick={handleReset} style={{...S.btn("danger"),padding:"6px 10px",fontSize:11}} title="Limpiar todos los datos">🗑</button>
        </div>
      </div>

      {activeTab==="zonificacion" && renderZonificacion()}
      {activeTab==="en_calle" && renderEnCalle()}
      {activeTab==="reporte" && renderReporte()}

      {showPaste && <div style={S.modal} onClick={()=>setShowPaste(false)}><div style={S.modalBox} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 12px",fontSize:18}}>Pegar pedidos de WhatsApp</h3>
        <p style={{fontSize:13,color:"#6B7280",margin:"0 0 12px"}}>Pegá los pedidos del grupo. Si hay duplicados te muestra la fusión.</p>
        <textarea style={S.textarea} placeholder={"Ej:\n24/7 Ontiveros 4534 Villa Tesei 09 a 13:30hs\nAlejandra\n5 novecento malbec $1.925"} value={pasteText} onChange={e=>setPasteText(e.target.value)} />
        <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center"}}>
          <button style={S.btn("primary")} onClick={handleParse}>Procesar</button>
          <button style={S.btn()} onClick={()=>{setShowPaste(false);setParseResult(null)}}>Cancelar</button>
          {parseResult && <span style={{fontSize:13,color:parseResult.includes("No se")?"#DC2626":"#059669",fontWeight:600}}>{parseResult}</span>}
        </div>
      </div></div>}

      {mergeInfo && <div style={S.modal}><div style={S.modalBox} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 12px",fontSize:18,color:"#D97706"}}>Pedidos duplicados detectados</h3>
        <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{mergeInfo.conflicts.length} cliente{mergeInfo.conflicts.length>1?"s":""} con pedido existente.</p>
        {mergeInfo.conflicts.map((c,i)=>{const ex=orders.find(o=>o.id===c.existingId);return(
          <div key={i} style={{padding:12,background:"#F9FAFB",borderRadius:8,marginBottom:8,border:"1px solid #E5E7EB"}}>
            <div style={{fontWeight:600,marginBottom:6}}>{ex?.address} — {ex?.localidad}</div>
            {c.merged.map(item=><div key={item.id} style={S.itemRow}><span>{item.qty}x {item.product}{item.vendor&&<span style={S.vtag(item.vendor)}>{item.vendor}</span>}</span><span style={{color:"#6B7280"}}>{fmt(item.price)}</span></div>)}
          </div>
        );})}
        {mergeInfo.clean.length>0&&<p style={{fontSize:12,color:"#6B7280"}}>+ {mergeInfo.clean.length} pedido{mergeInfo.clean.length>1?"s":""} nuevo{mergeInfo.clean.length>1?"s":""}</p>}
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button style={S.btn("success")} onClick={handleConfirmMerge}>Confirmar fusión</button>
          <button style={S.btn()} onClick={()=>setMergeInfo(null)}>Cancelar</button>
        </div>
      </div></div>}

      {showAssign && <div style={S.modal} onClick={()=>setShowAssign(false)}><div style={S.modalBox} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 16px",fontSize:18}}>Asignar a camioneta</h3>
        <div style={{display:"grid",gap:8}}>
          {VEHICLES.map(v=><button key={v.id} onClick={()=>handleAssign(v.id)} style={{...S.btn(),padding:"12px 16px",textAlign:"left",borderLeft:"4px solid "+v.color,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:600}}>{v.name}</span><span style={{color:"#6B7280"}}>{(streetByVehicle[v.id]||[]).length} asignados</span></button>)}
        </div>
      </div></div>}

      {showDebt && <div style={S.modal} onClick={()=>setShowDebt(false)}><div style={S.modalBox} onClick={e=>e.stopPropagation()}>
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
      </div></div>}

      {motivoModal && <div style={S.modal}><div style={S.modalBox} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 12px",fontSize:18,color:motivoModal.action==="rechazado"?"#DC2626":"#D97706"}}>
          {motivoModal.action==="rechazado"?"Rechazar pedido":"Devolver a zonificación"}
        </h3>
        <p style={{fontSize:13,color:"#6B7280",margin:"0 0 12px"}}>
          {motivoModal.action==="rechazado"?"El pedido se elimina de la zonificación y queda registrado en el reporte diario.":"El pedido vuelve a la zonificación como pendiente y queda registrado en el reporte diario."}
        </p>
        <input style={S.input} placeholder="Motivo (ej: pedido viejo, estaba cerrado...)" value={motivoModal.motivo} onChange={e=>setMotivoModal(p=>({...p,motivo:e.target.value}))} autoFocus />
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button style={S.btn(motivoModal.action==="rechazado"?"danger":"warning")} onClick={confirmMotivo}>{motivoModal.action==="rechazado"?"Confirmar rechazo":"Confirmar devolución"}</button>
          <button style={S.btn()} onClick={()=>setMotivoModal(null)}>Cancelar</button>
        </div>
      </div></div>}

      {routeModal && <div style={S.modal}><div style={S.modalBox} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 12px",fontSize:18,color:"#059669"}}>Ruteo automático</h3>
        <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>Optimiza el orden de las paradas priorizando el horario de cierre de cada cliente. Podés cambiar el origen y destino si esta camioneta tiene que pasar por otro lado.</p>
        <div style={{display:"grid",gap:10}}>
          <div>
            <label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Dirección de origen</label>
            <input style={S.input} value={routeModal.origin} onChange={e=>setRouteModal(p=>({...p,origin:e.target.value}))} />
          </div>
          <div>
            <label style={{fontSize:12,color:"#6B7280",marginBottom:4,display:"block"}}>Dirección de destino</label>
            <input style={S.input} value={routeModal.destination} onChange={e=>setRouteModal(p=>({...p,destination:e.target.value}))} />
          </div>
        </div>
        {routeStatus && <div style={{marginTop:12,padding:"8px 12px",background:routeStatus.includes("Error")?"#FEF2F2":routeStatus.includes("ALERTAS")?"#FFFBEB":routeStatus.includes("optimizada")?"#F0FDF4":"#FFFBEB",borderRadius:6,fontSize:13,color:routeStatus.includes("Error")?"#DC2626":routeStatus.includes("ALERTAS")?"#92400E":routeStatus.includes("optimizada")?"#059669":"#92400E",fontWeight:500,whiteSpace:"pre-line"}}>{routeStatus}</div>}
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button style={S.btn("success")} disabled={routeStatus==="Calculando ruta óptima..."} onClick={()=>runAutoRoute(routeModal.vehicleId,routeModal.origin,routeModal.destination)}>
            {routeStatus==="Calculando ruta óptima..."?"Calculando...":"Calcular ruta óptima"}
          </button>
          <button style={S.btn()} onClick={()=>{setRouteModal(null);setRouteStatus("")}}>Cerrar</button>
        </div>
      </div></div>}
    </div>
  );
}

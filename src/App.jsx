import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import logo from "./assets/logo.svg";

/* ====================== TEMA ====================== */
const T = {
  bg: "#241d16", surface: "#2e261d", surface2: "#382f24", card: "#2b231b",
  line: "#3d3327", line2: "#4a3d2e",
  rust: "#d2772f", rustSoft: "#e0934f", tan: "#e3ad70",
  cream: "#f4ede3", text: "#efe7da", muted: "#b3a796", dim: "#8a7d6c",
  ok: "#74c47d", okBg: "#27361f", pend: "#e8b24a", pendBg: "#352c14",
  info: "#6fb6d8", infoBg: "#1d2d35",
  danger: "#e0735a", shadow: "0 2px 10px rgba(0,0,0,.28)",
};
const display = "'Barlow Condensed', system-ui, sans-serif";
const TAGLINE = "🐾 Bienestar y mantenimiento para tu mascota";

// Medios de pago que aparecen en la factura (edítalos aquí cuando cambien)
const PAGOS = [
  { label: "Ahorros Bancolombia", valor: "39700017536" },
  { label: "Llave Nequi", valor: "3145812053" },
];
// Servicios que el cliente puede solicitar desde su enlace
const TIPOS_CLIENTE = ["paseo", "bano", "hotel"];

const USUARIO = "YELIANNY";
const CLAVE   = "Nocopeo2626";

const SERVICIOS = [
  { id: "paseo",   nombre: "Paseo por horas",      icon: "🦮", unidad: "hora"   },
  { id: "bano",    nombre: "Baño",                 icon: "🛁", unidad: "sesión" },
  { id: "banocor", nombre: "Baño + corte",         icon: "✂️", unidad: "sesión" },
  { id: "hotel",   nombre: "Hotel por noches",     icon: "🏨", unidad: "noche"  },
  { id: "guarde",  nombre: "Guardería por horas",  icon: "🐾", unidad: "hora"   },
  { id: "adiestr", nombre: "Adiestramiento",       icon: "🎓", unidad: "sesión" },
];
const servInfo = (id) => SERVICIOS.find((s) => s.id === id) || { nombre: id, icon: "•", unidad: "und" };

/* ====================== HELPERS ====================== */
const money = (n) => "$" + Number(n || 0).toLocaleString("es-CO");
// Normaliza el teléfono para WhatsApp agregando el prefijo de Colombia (57) si falta
const waTel = (t) => { const d = (t || "").replace(/\D/g, ""); if (!d) return ""; if (d.startsWith("57")) return d; if (d.length === 10) return "57" + d; return d; };
const hoy = () => new Date().toISOString().slice(0, 10);
const mesActual = () => new Date().toISOString().slice(0, 7);
const mesDe = (f) => (f || "").slice(0, 7);
const emojiMascota = (tipo) => (tipo === "gato" ? "🐈" : "🐕");
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const nombreMes = (ym) => { if (!ym) return ""; const [y, m] = ym.split("-"); const M = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]; return `${M[Number(m) - 1]} ${y}`; };
const esAbono = (m) => m.kind === "abono";
const esCargo = (m) => m.kind !== "abono";
const pagado = (m) => m.estado === "pagado";
const fmt = (d) => d.toISOString().slice(0, 10);
const inicioSemana = (base) => { const x = new Date(base); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); x.setHours(0, 0, 0, 0); return x; };
const diasEntre = (iso) => Math.round((new Date(iso + "T00:00:00") - new Date(hoy() + "T00:00:00")) / 86400000);

function comprimirImagen(file, cb, max = 700, q = 0.78) {
  let llamado = false;
  const finish = (val) => { if (llamado) return; llamado = true; cb(val || null); };
  try {
    const r = new FileReader();
    r.onerror = () => finish(null);
    r.onload = (e) => {
      const original = e.target.result;
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (!width || !height) return finish(original);
          const escala = Math.min(1, max / Math.max(width, height));
          width = Math.max(1, Math.round(width * escala));
          height = Math.max(1, Math.round(height * escala));
          const c = document.createElement("canvas"); c.width = width; c.height = height;
          c.getContext("2d").drawImage(img, 0, 0, width, height);
          const data = c.toDataURL("image/jpeg", q);
          finish(data && data.length > 20 ? data : original);
        } catch { finish(original); }
      };
      img.onerror = () => finish(original); // formato no decodificable (p.ej. HEIC en algunos navegadores)
      img.src = original;
      setTimeout(() => finish(original), 7000); // red de seguridad si onload nunca dispara
    };
    r.readAsDataURL(file);
  } catch { finish(null); }
}
const fotosDe = (m) => (m && Array.isArray(m.fotos) && m.fotos.length) ? m.fotos : (m && m.foto ? [m.foto] : []);
const carnetsDe = (m) => (m && Array.isArray(m.carnets) && m.carnets.length) ? m.carnets : (m && m.carnet ? [m.carnet] : []);
const pesoBase64 = (arr) => arr.reduce((a, s) => a + Math.ceil((s || "").length * 0.75), 0);
const clienteDe = (m, duenos) => duenos.find((d) => d.id === m.duenoId) || { nombre: m.dueno || "—", telefono: m.telefono || "", email: m.email || "" };
function totales(movs) {
  const cargos = movs.filter(esCargo), abonos = movs.filter(esAbono);
  const facturado = cargos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const pagadoServ = cargos.filter(pagado).reduce((a, m) => a + Number(m.monto || 0), 0);
  const abonado = abonos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const cobrado = pagadoServ + abonado;
  return { cargos, abonos, facturado, abonado, cobrado, saldo: facturado - cobrado };
}
function descargar(filename, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCelda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/* ====================== CSS GLOBAL ====================== */
function GlobalCSS() {
  return (<style>{`
    * { -webkit-user-select: none; -ms-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
    input, textarea, select, [contenteditable="true"], .seleccionable { -webkit-user-select: text; -ms-user-select: text; user-select: text; }
    input, select, textarea { color-scheme: dark; transition: border-color .14s ease; }
    select option { background: ${T.surface}; color: ${T.text}; }
    html { scroll-behavior: smooth; }
    html, body, #root { min-height: 100%; }
    body { margin: 0; background: ${T.bg}; }
    /* Respeta el notch / barra de estado del iPhone en modo app instalada */
    .adolf-header { padding-top: max(11px, env(safe-area-inset-top)) !important; padding-left: max(18px, env(safe-area-inset-left)) !important; padding-right: max(18px, env(safe-area-inset-right)) !important; }
    .adolf-main { padding-left: max(18px, env(safe-area-inset-left)); padding-right: max(18px, env(safe-area-inset-right)); padding-bottom: max(80px, calc(env(safe-area-inset-bottom) + 60px)); }
    button { transition: filter .12s ease, transform .08s ease, opacity .12s ease; }
    button:hover:not(:disabled) { filter: brightness(1.09); }
    button:active:not(:disabled) { transform: translateY(1px); }
    button:disabled { opacity: .45; cursor: not-allowed; }
    a { transition: opacity .12s ease; }
    @keyframes pop { from { opacity:0; transform: translateY(8px) scale(.98);} to {opacity:1; transform:none;} }
    @keyframes slideIn { from { opacity:0; transform: translateX(30px);} to {opacity:1; transform:none;} }
  `}</style>);
}

/* ====================== NOTIFICACIONES ====================== */
let _audioCtx;
function _ctx() {
  try { if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (_audioCtx.state === "suspended") _audioCtx.resume(); } catch { return null; }
  return _audioCtx;
}
function sonarNoti() {
  const ctx = _ctx(); if (!ctx) return;
  const t = ctx.currentTime;
  [[784, 0], [1047, 0.12], [1319, 0.24]].forEach(([f, off]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t + off);
    g.gain.exponentialRampToValueAtTime(0.22, t + off + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.22);
    o.start(t + off); o.stop(t + off + 0.24);
  });
}
function pedirPermisoNoti() { try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {} }
function notiNavegador(titulo, cuerpo) { try { if ("Notification" in window && Notification.permission === "granted") new Notification(titulo, { body: cuerpo, icon: logo }); } catch {} }
function tiempoRelativo(ts) { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return "hace un momento"; const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`; const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`; return `hace ${Math.floor(h / 24)} d`; }

function useNotis(storageKey) {
  const [notis, setNotis] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; } });
  const [toast, setToast] = useState(null);
  useEffect(() => {
    pedirPermisoNoti();
    const unlock = () => { _ctx(); window.removeEventListener("pointerdown", unlock); };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  const push = (noti) => {
    const n = { id: Date.now() + "_" + Math.random().toString(36).slice(2, 6), ts: Date.now(), leida: false, ...noti };
    setNotis((prev) => { const arr = [n, ...prev].slice(0, 40); try { localStorage.setItem(storageKey, JSON.stringify(arr)); } catch {} return arr; });
    setToast(n); sonarNoti(); notiNavegador(noti.titulo, noti.detalle);
  };
  const marcarLeidas = () => setNotis((prev) => { const arr = prev.map((x) => ({ ...x, leida: true })); try { localStorage.setItem(storageKey, JSON.stringify(arr)); } catch {} return arr; });
  const noLeidas = notis.filter((n) => !n.leida).length;
  return { notis, push, marcarLeidas, noLeidas, toast, cerrarToast: () => setToast(null) };
}

function Campana({ notis, noLeidas, marcarLeidas, onIr }) {
  const [open, setOpen] = useState(false);
  const toggle = () => { const n = !open; setOpen(n); if (n) setTimeout(marcarLeidas, 800); };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={toggle} title="Notificaciones" style={{ ...btnGhost, padding: "8px 11px", position: "relative", fontSize: 16 }}>🔔
        {noLeidas > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: T.danger, color: "#fff", fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: `2px solid ${T.bg}` }}>{noLeidas}</span>}
      </button>
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 300, maxHeight: 400, overflowY: "auto", background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 14, boxShadow: "0 16px 50px rgba(0,0,0,.5)", zIndex: 61, padding: 8, animation: "pop .2s ease" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, padding: "6px 8px", textTransform: "uppercase", letterSpacing: .5 }}>Notificaciones</div>
          {notis.length === 0 ? <div style={{ padding: "22px 8px", textAlign: "center", color: T.dim, fontSize: 13 }}>Sin notificaciones todavía</div>
            : notis.map((n) => {
              const accionable = onIr && n.accion;
              return (
                <div key={n.id} onClick={() => { if (accionable) { onIr(n); setOpen(false); } }} style={{ padding: "9px 8px", borderTop: `1px solid ${T.line}`, background: n.leida ? "transparent" : "rgba(210,119,47,.07)", borderRadius: 8, cursor: accionable ? "pointer" : "default" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{n.titulo}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{n.detalle}</div>
                  <div style={{ fontSize: 10.5, color: T.dim, marginTop: 2 }}>{tiempoRelativo(n.ts)}{accionable ? " · toca para ver" : ""}</div>
                </div>
              );
            })}
        </div>
      </>}
    </div>
  );
}

function Toast({ noti, onClose, onIr }) {
  useEffect(() => { const t = setTimeout(onClose, 5500); return () => clearTimeout(t); }, [noti.id]);
  const accionable = onIr && noti.accion;
  return (
    <div style={{ position: "fixed", top: 14, right: 14, zIndex: 95, maxWidth: 330, animation: "slideIn .3s ease" }}>
      <div onClick={() => { if (accionable) onIr(noti); onClose(); }} style={{ background: T.surface, border: `1px solid ${T.rust}`, borderLeft: `4px solid ${T.rust}`, borderRadius: 12, padding: "12px 16px", boxShadow: "0 14px 40px rgba(0,0,0,.5)", cursor: "pointer" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.cream }}>{noti.titulo}</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{noti.detalle}</div>
        {accionable && <div style={{ fontSize: 11, color: T.rustSoft, marginTop: 4, fontWeight: 600 }}>Toca para ver la solicitud →</div>}
      </div>
    </div>
  );
}

/* ====================== INSTALAR APP (PWA) ====================== */
let _bip = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); _bip = e; window.dispatchEvent(new Event("adolf-bip")); });
}
function useInstalar() {
  const [visible, setVisible] = useState(false);
  const [esIOS, setEsIOS] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone || localStorage.getItem("adolf_install_off") === "1") return;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
    if (ios) { setEsIOS(true); setVisible(true); return; }
    if (_bip) setVisible(true);
    const onBip = () => setVisible(true);
    const onInst = () => setVisible(false);
    window.addEventListener("adolf-bip", onBip);
    window.addEventListener("appinstalled", onInst);
    return () => { window.removeEventListener("adolf-bip", onBip); window.removeEventListener("appinstalled", onInst); };
  }, []);
  const instalar = async () => { if (!_bip) return; _bip.prompt(); try { await _bip.userChoice; } catch {} _bip = null; setVisible(false); };
  const cerrar = () => { setVisible(false); try { localStorage.setItem("adolf_install_off", "1"); } catch {} };
  return { visible, esIOS, instalar, cerrar };
}
function BannerInstalar() {
  const { visible, esIOS, instalar, cerrar } = useInstalar();
  const [pasos, setPasos] = useState(false);
  if (!visible) return null;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(180deg,#33271a,#2b2218)", border: `1px solid ${T.rust}`, borderRadius: 14, padding: "11px 14px", marginBottom: 16, boxShadow: T.shadow, animation: "pop .3s ease" }}>
        <img src={logo} alt="" style={{ height: 34, width: "auto", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.cream }}>Instala ADOLF en tu celular</div>
          <div style={{ fontSize: 11.5, color: T.muted }}>Acceso rápido, como una app, desde tu pantalla de inicio.</div>
        </div>
        <button onClick={esIOS ? () => setPasos(true) : instalar} style={{ ...btnPrim, padding: "8px 14px", fontSize: 13, flexShrink: 0 }}>📲 Instalar</button>
        <button onClick={cerrar} title="Ahora no" style={{ ...xBtn, fontSize: 16, flexShrink: 0 }}>✕</button>
      </div>
      {pasos && (
        <Modal title="Instalar en iPhone" onClose={() => setPasos(false)}>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>En 3 pasos (usando <b style={{ color: T.text }}>Safari</b>):</p>
          {[["1", "Toca el botón Compartir", "El cuadrito con la flecha hacia arriba ⬆️, en la barra de Safari."], ["2", "Elige “Agregar a inicio”", "Desliza las opciones hasta encontrarla (Add to Home Screen)."], ["3", "Toca “Agregar”", "Aparecerá el ícono del dóberman en tu pantalla de inicio."]].map(([n, t, d]) => (
            <Row key={n} style={{ gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.line}`, alignItems: "flex-start" }}>
              <div style={{ width: 26, height: 26, borderRadius: 999, background: T.rust, color: "#241405", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13 }}>{n}</div>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: T.cream }}>{t}</div><div style={{ fontSize: 12, color: T.muted }}>{d}</div></div>
            </Row>
          ))}
          <button onClick={() => setPasos(false)} style={{ ...btnPrim, width: "100%", marginTop: 16 }}>Entendido</button>
        </Modal>
      )}
    </>
  );
}

/* ====================== APP ====================== */
/* Lee el id de cliente desde la ruta /c/ID, o ?cliente=, o el hash (compatibilidad) */
function getClienteId() {
  try {
    const m = window.location.pathname.match(/\/c\/([^/?#]+)/);
    if (m) return decodeURIComponent(m[1]);
    const sp = new URLSearchParams(window.location.search);
    let id = sp.get("cliente");
    if (!id && window.location.hash) {
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      id = h.get("cliente") || h.get("c");
    }
    return id || null;
  } catch { return null; }
}
/* Prepara la instalación del cliente: usa la RUTA /c/ID (iOS siempre conserva la ruta) */
function prepararInstalacionCliente(id) {
  try {
    const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const ruta = `/c/${id}`;
    // Normaliza la barra de direcciones a /c/ID para que iOS capture esa ruta al "Agregar a inicio"
    if (window.location.pathname !== ruta) window.history.replaceState(null, "", ruta);
    const link = document.querySelector('link[rel="manifest"]');
    if (esIOS) {
      // iOS usaría el start_url "/" del manifest estático → lo quitamos para que use la ruta actual
      if (link && link.parentNode) link.parentNode.removeChild(link);
    } else {
      // Android / escritorio: manifest propio con start_url a la ruta del cliente
      const origin = window.location.origin;
      const manifest = {
        name: "ADOLF", short_name: "ADOLF", id: ruta,
        start_url: `${origin}${ruta}`, scope: "/", display: "standalone",
        background_color: "#241d16", theme_color: "#241d16",
        icons: [
          { src: `${origin}/icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${origin}/icon-512.png`, sizes: "512x512", type: "image/png" },
          { src: `${origin}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      };
      const blobURL = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
      let l = link; if (!l) { l = document.createElement("link"); l.rel = "manifest"; document.head.appendChild(l); }
      l.setAttribute("href", blobURL);
    }
  } catch {}
}

export default function App() {
  const clienteId = getClienteId();
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const guardado = (() => { try { return localStorage.getItem("adolf_cliente"); } catch { return null; } })();
  const [logged, setLogged] = useState(() => localStorage.getItem("adolf_auth") === "1");
  // Cliente: recordar + generar su manifest propio (para que su app instalada abra en su panel)
  useEffect(() => { if (clienteId) { try { localStorage.setItem("adolf_cliente", clienteId); } catch {} prepararInstalacionCliente(clienteId); } }, [clienteId]);
  // Respaldo (Android/escritorio): app instalada abierta sin cliente → ir al panel guardado
  useEffect(() => { if (!clienteId && standalone && guardado && !logged) window.location.replace(`/c/${guardado}`); }, []);
  const entrar = () => { localStorage.setItem("adolf_auth", "1"); setLogged(true); };
  const salir = () => { localStorage.removeItem("adolf_auth"); setLogged(false); };
  if (!clienteId && standalone && guardado && !logged) return null;
  if (clienteId) return <><GlobalCSS /><VistaCliente duenoId={clienteId} /></>;
  if (!logged) return <><GlobalCSS /><Login onOk={entrar} /></>;
  return <><GlobalCSS /><Panel onLogout={salir} /></>;
}

/* ====================== LOGIN ====================== */
function Login({ onOk }) {
  const [u, setU] = useState(""), [p, setP] = useState(""), [err, setErr] = useState("");
  const enviar = () => { if (u.trim().toUpperCase() === USUARIO && p === CLAVE) onOk(); else setErr("Usuario o contraseña incorrectos."); };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(1200px 600px at 50% -10%, #36291d 0%, ${T.bg} 60%)`, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, animation: "pop .4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}><img src={logo} alt="" style={{ height: 96 }} /><div style={{ fontFamily: display, fontSize: 52, fontWeight: 700, letterSpacing: 6, color: T.cream, lineHeight: 1, marginTop: 6 }}>ADOLF</div><div style={{ color: T.rust, fontSize: 11.5, marginTop: 6, fontWeight: 600 }}>{TAGLINE}</div></div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18, padding: 22, boxShadow: T.shadow }}>
          <Label>Usuario</Label><input value={u} onChange={(e) => setU(e.target.value)} placeholder="Yelianny" style={inp} onKeyDown={(e) => e.key === "Enter" && enviar()} />
          <div style={{ height: 14 }} /><Label>Contraseña</Label><input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" style={inp} onKeyDown={(e) => e.key === "Enter" && enviar()} />
          {err && <div style={{ color: T.danger, fontSize: 12.5, marginTop: 12 }}>{err}</div>}
          <button onClick={enviar} style={{ ...btnPrim, width: "100%", marginTop: 18, padding: "13px" }}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

/* ====================== HOOK DATOS ====================== */
function useDatos() {
  const [duenos, setDuenos] = useState([]), [mascotas, setMascotas] = useState([]);
  const [servicios, setServicios] = useState([]), [movs, setMovs] = useState([]);
  const [citas, setCitas] = useState([]), [salud, setSalud] = useState([]), [bloqueos, setBloqueos] = useState([]);
  useEffect(() => {
    const subs = [
      onSnapshot(query(collection(db, "duenos"), orderBy("nombre")), (s) => setDuenos(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, "mascotas"), orderBy("nombre")), (s) => setMascotas(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "servicios"), (s) => setServicios(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "movimientos"), (s) => setMovs(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "citas"), (s) => setCitas(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "salud"), (s) => setSalud(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "bloqueos"), (s) => setBloqueos(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
    ];
    return () => subs.forEach((u) => u());
  }, []);
  return { duenos, mascotas, servicios, movs, citas, salud, bloqueos };
}

/* ====================== PANEL ====================== */
function Panel({ onLogout }) {
  const datos = useDatos();
  const { duenos, mascotas, servicios, movs, citas, salud, bloqueos } = datos;
  const [vista, setVista] = useState("resumen");
  const [clienteSel, setClienteSel] = useState(null);
  const [mascotaSel, setMascotaSel] = useState(null);
  const [admin, setAdmin] = useState(false);

  // Notificaciones: avisar cuando entra una nueva solicitud de reserva
  const noti = useNotis("adolf_notis");
  const prevSolic = useRef(null);
  useEffect(() => {
    const solic = citas.filter((c) => (c.estado || "agendado") === "solicitado");
    const ids = new Set(solic.map((c) => c.id));
    if (prevSolic.current === null) { prevSolic.current = ids; return; }
    solic.filter((c) => !prevSolic.current.has(c.id)).forEach((c) => {
      const m = mascotas.find((x) => x.id === c.mascotaId);
      noti.push({ titulo: "Nueva solicitud de reserva 🔔", detalle: `${m ? m.nombre : "Mascota"} · ${servInfo(c.tipoServicio).nombre} · ${c.fecha} ${c.hora}`, accion: "agenda" });
    });
    prevSolic.current = ids;
  }, [citas]);

  const cliente = duenos.find((d) => d.id === clienteSel);
  const mascota = mascotas.find((m) => m.id === mascotaSel);
  const reset = (v) => { setVista(v); setClienteSel(null); setMascotaSel(null); };
  const irANoti = (n) => { if (n && n.accion === "agenda") reset("agenda"); };
  const citasHoy = citas.filter((c) => c.fecha === hoy() && c.estado !== "completado").length;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "linear-gradient(180deg, rgba(46,38,29,.96), rgba(36,29,22,.92))", backdropFilter: "blur(8px)", borderBottom: `1px solid ${T.line}` }}>
        <div className="adolf-header" style={{ maxWidth: 1100, margin: "0 auto", padding: "11px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <img src={logo} alt="" style={{ height: 38, cursor: "pointer" }} onClick={() => reset("resumen")} />
          <div style={{ cursor: "pointer" }} onClick={() => reset("resumen")}><div style={{ fontFamily: display, fontSize: 27, fontWeight: 700, letterSpacing: 3, color: T.cream, lineHeight: .9 }}>ADOLF</div><div style={{ fontSize: 9.5, color: T.rust, letterSpacing: 2.5, textTransform: "uppercase" }}>Gestión de servicios</div></div>
          <nav style={{ marginLeft: "auto", display: "flex", gap: 4, background: T.surface, borderRadius: 12, padding: 4, border: `1px solid ${T.line}`, flexWrap: "wrap" }}>
            {[["resumen","Resumen"],["clientes","Clientes"],["agenda", citasHoy ? `Agenda (${citasHoy})` : "Agenda"],["servicios","Servicios"]].map(([k, l]) => (
              <button key={k} onClick={() => reset(k)} style={tab(vista === k && !clienteSel && !mascotaSel)}>{l}</button>
            ))}
          </nav>
          <Campana notis={noti.notis} noLeidas={noti.noLeidas} marcarLeidas={noti.marcarLeidas} onIr={irANoti} />
          <button onClick={() => setAdmin(true)} title="Administración" style={{ ...btnGhost, padding: "8px 11px", fontSize: 16 }}>⚙️</button>
          <button onClick={onLogout} style={{ ...btnGhost, padding: "8px 12px" }}>Salir</button>
        </div>
      </header>
      <main className="adolf-main" style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 18px 80px" }}>
        <BannerInstalar />
        {mascota ? <MascotaDetalle mascota={mascota} duenos={duenos} servicios={servicios} movs={movs} salud={salud} onBack={() => setMascotaSel(null)} />
          : cliente ? <ClienteDetalle cliente={cliente} mascotas={mascotas} servicios={servicios} movs={movs} duenos={duenos} abrirMascota={(id) => setMascotaSel(id)} onBack={() => setClienteSel(null)} />
          : vista === "resumen" ? <Resumen datos={datos} irMascota={(id) => setMascotaSel(id)} />
          : vista === "clientes" ? <Clientes duenos={duenos} mascotas={mascotas} abrir={(id) => setClienteSel(id)} abrirMascota={(id) => setMascotaSel(id)} />
          : vista === "agenda" ? <Agenda mascotas={mascotas} servicios={servicios} citas={citas} movs={movs} bloqueos={bloqueos} />
          : <Servicios mascotas={mascotas} servicios={servicios} movs={movs} />}
      </main>
      {noti.toast && <Toast noti={noti.toast} onClose={noti.cerrarToast} onIr={irANoti} />}
      {admin && <AdminPanel datos={datos} onClose={() => setAdmin(false)} />}
    </div>
  );
}

/* ====================== RESUMEN + REPORTES + HERRAMIENTAS ====================== */
function Resumen({ datos, irMascota }) {
  const { duenos, mascotas, servicios, movs, citas, salud } = datos;
  const [mes, setMes] = useState(mesActual());
  const mesesDisp = useMemo(() => { const s = new Set(movs.map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); }, [movs]);
  const t = totales(movs.filter((m) => mesDe(m.fecha) === mes));

  const porTipo = SERVICIOS.map((s) => { const it = t.cargos.filter((m) => m.tipoServicio === s.id); return { ...s, total: it.reduce((a, m) => a + Number(m.monto || 0), 0), n: it.length }; }).filter((x) => x.n > 0).sort((a, b) => b.total - a.total);
  const ranking = mascotas.map((mc) => { const it = t.cargos.filter((m) => m.mascotaId === mc.id); return { ...mc, total: it.reduce((a, m) => a + Number(m.monto || 0), 0), n: it.length }; }).filter((x) => x.n > 0).sort((a, b) => b.total - a.total);

  // por cliente (para reportes)
  const porCliente = duenos.map((d) => {
    const ids = mascotas.filter((m) => m.duenoId === d.id).map((m) => m.id);
    const tc = totales(movs.filter((m) => ids.includes(m.mascotaId) && mesDe(m.fecha) === mes));
    return { ...d, ...tc };
  }).filter((x) => x.facturado > 0 || x.saldo !== 0).sort((a, b) => b.facturado - a.facturado);

  const pendientes = porCliente.filter((c) => c.saldo > 0);

  // alertas de vacunas
  const alertasVac = salud.filter((s) => s.proxima && diasEntre(s.proxima) <= 30).map((s) => { const m = mascotas.find((x) => x.id === s.mascotaId); return { ...s, mascota: m, dias: diasEntre(s.proxima) }; }).filter((x) => x.mascota).sort((a, b) => a.dias - b.dias);

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between style={{ flexWrap: "wrap", gap: 8 }}><H1>Resumen del mes</H1>
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto", padding: "9px 12px" }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select>
      </Row>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 16 }}>
        <Stat label="Facturado" value={money(t.facturado)} accent={T.tan} sub={`${t.cargos.length} servicios`} />
        <Stat label="Cobrado" value={money(t.cobrado)} accent={T.ok} sub="pagos + abonos" />
        <Stat label={t.saldo >= 0 ? "Saldo pendiente" : "Saldo a favor"} value={money(Math.abs(t.saldo))} accent={t.saldo > 0 ? T.pend : T.ok} sub={`${pendientes.length} clientes deben`} />
        <Stat label="Clientes" value={duenos.length} accent={T.rust} sub={`${mascotas.length} mascotas`} />
      </div>

      {alertasVac.length > 0 && (
        <Card style={{ marginTop: 16, borderColor: T.pend }}>
          <H2>💉 Alertas de vacunas</H2>
          {alertasVac.map((a) => (
            <Row key={a.id} between style={{ padding: "8px 0", borderBottom: `1px solid ${T.line}`, cursor: "pointer" }} onClick={() => irMascota(a.mascota.id)}>
              <span style={{ fontSize: 13.5 }}>{a.mascota.nombre} · {a.titulo}</span>
              <b style={{ color: a.dias < 0 ? T.danger : T.pend, fontSize: 12.5 }}>{a.dias < 0 ? `vencida hace ${Math.abs(a.dias)} d` : a.dias === 0 ? "es hoy" : `en ${a.dias} d`}</b>
            </Row>
          ))}
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Card><H2>Ingresos por servicio</H2>
          {porTipo.length === 0 ? <Empty texto="Sin servicios este mes." /> : porTipo.map((x) => { const pct = t.facturado ? Math.round((x.total / t.facturado) * 100) : 0; return (
            <div key={x.id} style={{ marginTop: 12 }}><Row between><span style={{ fontSize: 13.5 }}>{x.icon} {x.nombre} <span style={{ color: T.dim }}>· {x.n}</span></span><b style={{ fontVariantNumeric: "tabular-nums" }}>{money(x.total)}</b></Row>
              <div style={{ height: 7, background: T.surface2, borderRadius: 6, marginTop: 6, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: `linear-gradient(90deg,${T.rust},${T.tan})`, borderRadius: 6 }} /></div></div>); })}
        </Card>
        <Card><H2>Cuánto genera cada mascota</H2>
          {ranking.length === 0 ? <Empty texto="Sin servicios este mes." /> : ranking.map((m, i) => (
            <Row key={m.id} between style={{ padding: "10px 0", borderBottom: i < ranking.length - 1 ? `1px solid ${T.line}` : "none", cursor: "pointer" }} onClick={() => irMascota(m.id)}>
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar mascota={m} /><span><b style={{ fontSize: 14 }}>{m.nombre}</b><div style={{ fontSize: 11.5, color: T.muted }}>{m.raza} · {m.n} serv.</div></span></span>
              <b style={{ fontVariantNumeric: "tabular-nums", color: T.tan }}>{money(m.total)}</b></Row>))}
        </Card>
      </div>
    </div>
  );
}

/* ====================== RECORDATORIOS DE PAGO ====================== */
function RecordatoriosPago({ pendientes, duenos, mes, onClose }) {
  const msg = (c) => `Hola ${c.nombre} 🐾 Te recordamos tu saldo pendiente de ${money(c.saldo)} por los servicios de ${nombreMes(mes)} en ADOLF. Cuando puedas, agradecemos tu pago.\n\n*Medios de pago*\n${PAGOS.map((p) => `${p.label}: ${p.valor}`).join("\n")}\n\n¡Gracias!`;
  return (
    <Modal title="Recordatorios de pago" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>Clientes con saldo pendiente de {nombreMes(mes)}. Envía el recordatorio con un toque (WhatsApp no permite envío masivo desde la web).</p>
      {pendientes.length === 0 ? <Empty texto="Nadie tiene saldo pendiente este mes. 🎉" /> : pendientes.map((c) => {
        const tel = waTel(c.telefono);
        return (
          <Row key={c.id} between style={{ padding: "10px 0", borderBottom: `1px solid ${T.line}`, gap: 8, flexWrap: "wrap" }}>
            <div><b style={{ fontSize: 14 }}>{c.nombre}</b><div style={{ fontSize: 12, color: T.pend }}>debe {money(c.saldo)}</div></div>
            <Row style={{ gap: 6 }}>
              <button onClick={() => { navigator.clipboard?.writeText(msg(c)); }} style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }} title="Copiar mensaje">📋</button>
              <button onClick={() => window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg(c))}`, "_blank")} disabled={!tel} title={!tel ? "Sin teléfono" : ""} style={{ ...btnPrim, padding: "7px 12px", fontSize: 12.5, background: tel ? "linear-gradient(180deg,#3ed47e,#1faa5a)" : T.surface2, color: tel ? "#0e2412" : T.dim }}>💬 Recordar</button>
            </Row>
          </Row>
        );
      })}
    </Modal>
  );
}

/* ====================== RECORDATORIOS DE VACUNAS ====================== */
function RecordatoriosVacunas({ alertas, onClose }) {
  const estadoTxt = (d) => d < 0 ? `venció hace ${Math.abs(d)} día${Math.abs(d) !== 1 ? "s" : ""}` : d === 0 ? "vence hoy" : `vence en ${d} día${d !== 1 ? "s" : ""}`;
  const msg = (a) => `Hola ${a.cliente.nombre} 🐾 Recordatorio de ADOLF: la vacuna "${a.titulo}" de ${a.mascota.nombre} ${estadoTxt(a.dias)} (fecha prevista: ${a.proxima}). Escríbenos para agendar y mantenerla al día. ¡Gracias!`;
  return (
    <Modal title="Recordatorios de vacunas" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>Mascotas con vacuna próxima o vencida. Envía el aviso al dueño con un toque.</p>
      {alertas.length === 0 ? <Empty texto="Ninguna vacuna próxima o vencida. 🎉" /> : alertas.map((a) => {
        const tel = waTel(a.cliente.telefono);
        return (
          <Row key={a.id} between style={{ padding: "10px 0", borderBottom: `1px solid ${T.line}`, gap: 8, flexWrap: "wrap" }}>
            <div><b style={{ fontSize: 14 }}>{a.mascota.nombre} · {a.titulo}</b><div style={{ fontSize: 12, color: a.dias < 0 ? T.danger : T.pend }}>{estadoTxt(a.dias)} · {a.cliente.nombre}</div></div>
            <Row style={{ gap: 6 }}>
              <button onClick={() => { navigator.clipboard?.writeText(msg(a)); }} style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }} title="Copiar mensaje">📋</button>
              <button onClick={() => window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg(a))}`, "_blank")} disabled={!tel} title={!tel ? "Sin teléfono" : ""} style={{ ...btnPrim, padding: "7px 12px", fontSize: 12.5, background: tel ? "linear-gradient(180deg,#3ed47e,#1faa5a)" : T.surface2, color: tel ? "#0e2412" : T.dim }}>💬 Avisar</button>
            </Row>
          </Row>
        );
      })}
    </Modal>
  );
}

/* ====================== PANEL DE ADMINISTRACIÓN ====================== */
function AdminPanel({ datos, onClose }) {
  const { duenos, mascotas, servicios, movs, citas, salud } = datos;
  const [mes, setMes] = useState(mesActual());
  const [recordatorios, setRecordatorios] = useState(false);
  const [vacunas, setVacunas] = useState(false);
  const mesesDisp = useMemo(() => { const s = new Set(movs.map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); }, [movs]);
  const t = totales(movs.filter((m) => mesDe(m.fecha) === mes));
  const porTipo = SERVICIOS.map((s) => { const it = t.cargos.filter((m) => m.tipoServicio === s.id); return { ...s, total: it.reduce((a, m) => a + Number(m.monto || 0), 0), n: it.length }; }).filter((x) => x.n > 0).sort((a, b) => b.total - a.total);
  const porCliente = duenos.map((d) => { const ids = mascotas.filter((m) => m.duenoId === d.id).map((m) => m.id); return { ...d, ...totales(movs.filter((m) => ids.includes(m.mascotaId) && mesDe(m.fecha) === mes)) }; }).filter((x) => x.facturado > 0 || x.saldo !== 0).sort((a, b) => b.facturado - a.facturado);
  const pendientes = porCliente.filter((c) => c.saldo > 0);
  const ultBackup = Number(localStorage.getItem("adolf_backup_last") || 0);
  const alertasVac = salud.filter((s) => s.proxima && diasEntre(s.proxima) <= 30).map((s) => { const m = mascotas.find((x) => x.id === s.mascotaId); return m ? { ...s, mascota: m, cliente: clienteDe(m, duenos), dias: diasEntre(s.proxima) } : null; }).filter(Boolean).sort((a, b) => a.dias - b.dias);

  const exportarCSV = () => {
    const filas = [["Fecha", "Cliente", "Mascota", "Tipo", "Concepto", "Cantidad", "Monto", "Pago"]];
    movs.filter((m) => mesDe(m.fecha) === mes).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")).forEach((m) => {
      const masc = mascotas.find((x) => x.id === m.mascotaId) || {}; const cli = clienteDe(masc, duenos);
      const concepto = esAbono(m) ? "Abono" : servInfo(m.tipoServicio).nombre + (m.modalidad === "mensual" ? " (mensualidad)" : "");
      filas.push([m.fecha, cli.nombre, masc.nombre || "—", esAbono(m) ? "Abono" : "Servicio", concepto, m.cantidad || 1, Number(m.monto || 0), esAbono(m) ? "abono" : (pagado(m) ? "pagado" : "pendiente")]);
    });
    filas.push([], ["Facturado", "", "", "", "", "", t.facturado], ["Cobrado", "", "", "", "", "", t.cobrado], ["Saldo", "", "", "", "", "", t.saldo]);
    descargar(`ADOLF_${mes}.csv`, "\uFEFF" + filas.map((f) => f.map(csvCelda).join(",")).join("\n"), "text/csv;charset=utf-8;");
  };
  const reportePDF = () => {
    const fTipo = porTipo.map((x) => `<tr><td>${x.nombre}</td><td class="r">${x.n}</td><td class="r">${money(x.total)}</td></tr>`).join("") || '<tr><td colspan="3" style="color:#999">Sin datos</td></tr>';
    const fCli = porCliente.map((c) => `<tr><td>${c.nombre}</td><td class="r">${money(c.facturado)}</td><td class="r">${money(c.cobrado)}</td><td class="r">${money(c.saldo)}</td></tr>`).join("") || '<tr><td colspan="4" style="color:#999">Sin datos</td></tr>';
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte ADOLF ${nombreMes(mes)}</title>
      <style>*{box-sizing:border-box;font-family:Arial}body{margin:0;padding:32px;color:#1c1712}.wrap{max-width:680px;margin:0 auto}
      .head{display:flex;justify-content:space-between;border-bottom:3px solid #d2772f;padding-bottom:12px}.brand{font-size:32px;font-weight:800;letter-spacing:3px}.brand small{display:block;font-size:11px;color:#d2772f;font-weight:700}
      h2{font-size:14px;text-transform:uppercase;color:#d2772f;margin:22px 0 6px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #eee}th{font-size:11px;color:#999;text-transform:uppercase}.r{text-align:right}
      .tot{display:flex;gap:24px;margin-top:14px;font-size:14px}.tot b{display:block;font-size:20px}.foot{margin-top:26px;text-align:center;font-family:sans-serif;font-weight:800;letter-spacing:3px;font-size:18px}</style></head>
      <body><div class="wrap"><div class="head"><div class="brand">ADOLF<small>${TAGLINE}</small></div><div style="text-align:right;font-size:12px;color:#555"><b>Reporte mensual</b><br>${nombreMes(mes)}<br>${hoy()}</div></div>
      <div class="tot"><div>Facturado<b>${money(t.facturado)}</b></div><div>Cobrado<b style="color:#2f8f3a">${money(t.cobrado)}</b></div><div>Saldo<b style="color:#c47d10">${money(t.saldo)}</b></div></div>
      <h2>Ingresos por servicio</h2><table><thead><tr><th>Servicio</th><th class="r">Cant.</th><th class="r">Total</th></tr></thead><tbody>${fTipo}</tbody></table>
      <h2>Por cliente</h2><table><thead><tr><th>Cliente</th><th class="r">Facturado</th><th class="r">Cobrado</th><th class="r">Saldo</th></tr></thead><tbody>${fCli}</tbody></table>
      <div class="foot">ADOLF</div></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return alert("Permite las ventanas emergentes."); w.document.write(html); w.document.close();
  };
  const respaldo = () => {
    descargar(`ADOLF_respaldo_${hoy()}.json`, JSON.stringify({ generado: new Date().toISOString(), duenos, mascotas, servicios, movimientos: movs, citas, salud }, null, 2), "application/json");
    localStorage.setItem("adolf_backup_last", String(Date.now())); alert("Respaldo descargado. Guárdalo en un lugar seguro.");
  };

  const opcion = (icon, titulo, desc, onClick, extra) => (
    <button onClick={onClick} style={{ ...btnGhost, width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", marginBottom: 8 }} {...extra}>
      <span style={{ fontSize: 22, width: 26, textAlign: "center" }}>{icon}</span>
      <span><span style={{ display: "block", fontWeight: 700, color: T.cream, fontSize: 14 }}>{titulo}</span><span style={{ fontSize: 11.5, color: T.muted }}>{desc}</span></span>
    </button>
  );

  return (
    <Modal title="⚙️ Administración" onClose={onClose}>
      <Label>Mes para reportes y exportación</Label>
      <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, marginBottom: 16 }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select>

      {opcion("📣", `Recordatorios de pago${pendientes.length ? ` (${pendientes.length})` : ""}`, pendientes.length ? "Avisar por WhatsApp a quienes deben" : "Nadie tiene saldo pendiente este mes", () => pendientes.length && setRecordatorios(true), { disabled: pendientes.length === 0 })}
      {opcion("💉", `Recordatorios de vacunas${alertasVac.length ? ` (${alertasVac.length})` : ""}`, alertasVac.length ? "Avisar a clientes por WhatsApp" : "Ninguna vacuna próxima o vencida", () => alertasVac.length && setVacunas(true), { disabled: alertasVac.length === 0 })}
      {opcion("📊", "Exportar a Excel (CSV)", `Detalle de movimientos de ${nombreMes(mes)}`, exportarCSV)}
      {opcion("🧾", "Reporte PDF del mes", "Totales, por servicio y por cliente", reportePDF)}
      {opcion("💾", "Descargar respaldo", ultBackup ? `Última copia: ${new Date(ultBackup).toLocaleDateString("es-CO")}` : "Aún no has descargado un respaldo", respaldo)}

      <p style={{ fontSize: 11.5, color: T.dim, marginTop: 8, lineHeight: 1.6 }}>El respaldo descarga todos tus datos en un archivo. Guárdalo en un lugar seguro (correo, nube o computador) cada cierto tiempo.</p>
      {recordatorios && <RecordatoriosPago pendientes={pendientes} duenos={duenos} mes={mes} onClose={() => setRecordatorios(false)} />}
      {vacunas && <RecordatoriosVacunas alertas={alertasVac} onClose={() => setVacunas(false)} />}
    </Modal>
  );
}

/* ====================== SELECTORES DE FECHA Y HORA ====================== */
const SLOTS_HORA = (() => { const a = []; for (let h = 7; h <= 20; h++) { a.push(`${String(h).padStart(2, "0")}:00`); if (h < 20) a.push(`${String(h).padStart(2, "0")}:30`); } return a; })();
const TOPE_TARDE = "18:00"; // paseo y baño no después de las 6 PM
const limitadoTarde = (tipo) => tipo === "paseo" || tipo === "bano";
const DIA_ABBR = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const diaBloqueado = (iso, bloqueos) => bloqueos.some((b) => b.fecha === iso && !b.hora);

function PickerDia({ fecha, setFecha, bloqueos = [], dias = 21 }) {
  const base = new Date(); base.setHours(0, 0, 0, 0);
  const arr = [...Array(dias)].map((_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d; });
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
      {arr.map((d, i) => { const iso = fmt(d); const sel = fecha === iso; const bloq = diaBloqueado(iso, bloqueos); return (
        <button key={i} disabled={bloq} onClick={() => setFecha(iso)} style={{ flex: "0 0 auto", width: 56, padding: "8px 0", borderRadius: 11, border: `1px solid ${sel ? T.rust : T.line2}`, background: sel ? "#4a2f17" : T.surface2, cursor: bloq ? "not-allowed" : "pointer", textAlign: "center", opacity: bloq ? .4 : 1 }}>
          <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase" }}>{DIA_ABBR[d.getDay()]}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: sel ? T.rustSoft : T.cream }}>{d.getDate()}</div>
          <div style={{ fontSize: 9, color: T.dim }}>{bloq ? "🔒" : MES_ABBR[d.getMonth()]}</div>
        </button>); })}
    </div>
  );
}

function PickerHora({ fecha, hora, setHora, citas = [], bloqueos = [], tipoServicio }) {
  const ocupadas = citas.filter((c) => c.fecha === fecha && (c.estado || "agendado") === "agendado").map((c) => c.hora);
  const bloqSlot = bloqueos.filter((b) => b.fecha === fecha && b.hora).map((b) => b.hora);
  const slots = SLOTS_HORA.filter((s) => !limitadoTarde(tipoServicio) || s <= TOPE_TARDE);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        {slots.map((s) => { const no = ocupadas.includes(s) || bloqSlot.includes(s); const sel = hora === s; return (
          <button key={s} disabled={no} onClick={() => setHora(s)} style={{ padding: "9px 0", borderRadius: 9, border: `1px solid ${sel ? T.rust : T.line2}`, background: sel ? "#4a2f17" : T.surface2, color: no ? T.dim : (sel ? T.rustSoft : T.text), cursor: no ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, textDecoration: no ? "line-through" : "none", opacity: no ? .45 : 1 }}>{s}</button>); })}
      </div>
      {limitadoTarde(tipoServicio) && <div style={{ fontSize: 11, color: T.dim, marginTop: 6 }}>Paseo y baño solo hasta las 6:00 PM.</div>}
    </div>
  );
}

/* ====================== AGENDA ====================== */
function Agenda({ mascotas, servicios, citas, movs, bloqueos = [] }) {
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState(null);
  const [bloqueo, setBloqueo] = useState(false);
  const base = inicioSemana(new Date()); base.setDate(base.getDate() + offset * 7);
  const dias = [...Array(7)].map((_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d; });
  const nombreMascota = (id) => (mascotas.find((m) => m.id === id) || {}).nombre || "—";
  const quitarBloqueo = async (b) => { if (confirm("¿Quitar este bloqueo?")) await deleteDoc(doc(db, "bloqueos", b.id)); };

  const confirmar = async (c) => { await updateDoc(doc(db, "citas", c.id), { estado: "agendado" }); };
  const rechazar = async (c) => { if (confirm("¿Rechazar esta solicitud? Se le avisará al cliente.")) await updateDoc(doc(db, "citas", c.id), { estado: "rechazado" }); };
  const borrar = async (c) => { if (confirm("¿Eliminar esta cita?")) { for (const m of movs.filter((x) => x.citaId === c.id)) await deleteDoc(doc(db, "movimientos", m.id)); await deleteDoc(doc(db, "citas", c.id)); } };

  // Completar = marcar completado y facturar automáticamente
  const completar = async (c) => {
    const serv = servicios.find((s) => s.mascotaId === c.mascotaId && s.tipo === c.tipoServicio) || servicios.find((s) => s.mascotaId === c.mascotaId);
    if (serv && !movs.find((m) => m.citaId === c.id)) {
      await addDoc(collection(db, "movimientos"), { kind: "cargo", citaId: c.id, mascotaId: c.mascotaId, servicioId: serv.id, tipoServicio: c.tipoServicio, modalidad: serv.modalidad, unidad: serv.unidad, fecha: c.fecha, cantidad: 1, monto: Number(serv.valor || 0), estado: "pendiente", notas: "Servicio agendado", createdAt: Date.now() });
    }
    await updateDoc(doc(db, "citas", c.id), { estado: "completado", facturado: !!serv });
    if (!serv) alert("Cita completada. Aún no tiene tarifa, así que no se facturó: crea la tarifa en el perfil de la mascota.");
  };
  // Revertir a agendado = quitar la facturación automática
  const revertir = async (c) => {
    for (const m of movs.filter((x) => x.citaId === c.id)) await deleteDoc(doc(db, "movimientos", m.id));
    await updateDoc(doc(db, "citas", c.id), { estado: "agendado", facturado: false });
  };
  const avanzar = (c) => { const e = c.estado || "agendado"; if (e === "agendado") completar(c); else if (e === "completado") revertir(c); };

  const colorEstado = (e) => e === "completado" ? T.ok : e === "solicitado" ? T.rustSoft : e === "rechazado" ? T.danger : T.pend;
  const labelEstado = (e) => e === "completado" ? "✓ Completado" : e === "solicitado" ? "Solicitado" : e === "rechazado" ? "Rechazada" : "Agendado";
  const solicitudes = citas.filter((c) => (c.estado || "agendado") === "solicitado").sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between style={{ flexWrap: "wrap", gap: 8 }}><H1>Agenda</H1><Row style={{ gap: 8 }}><button onClick={() => setBloqueo(true)} style={btnGhost}>🔒 Bloquear</button><button onClick={() => setForm({})} style={btnPrim} disabled={mascotas.length === 0}>+ Nueva cita</button></Row></Row>

      {solicitudes.length > 0 && (
        <Card style={{ marginTop: 14, borderColor: T.rust }}>
          <H2>🔔 {solicitudes.length} solicitud{solicitudes.length !== 1 ? "es" : ""} de clientes por confirmar</H2>
          {solicitudes.map((c) => { const inf = servInfo(c.tipoServicio); return (
            <Row key={c.id} between style={{ padding: "9px 0", borderBottom: `1px solid ${T.line}`, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13.5 }}>{inf.icon} {nombreMascota(c.mascotaId)} · {inf.nombre}<div style={{ fontSize: 11.5, color: T.muted }}>{c.fecha} {c.hora}{c.nota ? ` · ${c.nota}` : ""}</div></div>
              <Row style={{ gap: 6 }}>
                <button onClick={() => confirmar(c)} style={{ ...btnSmall, background: `linear-gradient(180deg,#86d18e,${T.ok})`, color: "#0e2412" }}>✓ Confirmar</button>
                <button onClick={() => rechazar(c)} style={{ ...btnGhost, color: T.danger, borderColor: "#4a2a22", padding: "7px 10px", fontSize: 12.5 }}>Rechazar</button>
              </Row>
            </Row>
          ); })}
        </Card>
      )}

      <Row between style={{ marginTop: 16 }}>
        <button onClick={() => setOffset(offset - 1)} style={btnGhost}>← Semana</button>
        <b style={{ fontFamily: display, fontSize: 18, color: T.cream }}>{offset === 0 ? "Esta semana" : `${fmt(dias[0]).slice(5)} — ${fmt(dias[6]).slice(5)}`}</b>
        <button onClick={() => setOffset(offset + 1)} style={btnGhost}>Semana →</button>
      </Row>

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(150px,1fr))", gap: 8, minWidth: 980 }}>
          {dias.map((d, i) => {
            const iso = fmt(d); const esHoy = iso === hoy();
            const delDia = citas.filter((c) => c.fecha === iso).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
            const bloqDia = bloqueos.filter((b) => b.fecha === iso).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
            const todoBloq = bloqDia.find((b) => !b.hora);
            return (
              <div key={i} style={{ background: esHoy ? "#33271a" : T.card, border: `1px solid ${esHoy ? T.rust : T.line}`, borderRadius: 13, padding: 10, minHeight: 160 }}>
                <div style={{ textAlign: "center", paddingBottom: 8, borderBottom: `1px solid ${T.line}`, marginBottom: 8 }}><div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase" }}>{DIAS[i]}</div><div style={{ fontSize: 18, fontWeight: 800, color: esHoy ? T.rust : T.cream }}>{d.getDate()}</div></div>
                {todoBloq && <div style={{ background: "#3a1f1a", border: `1px solid ${T.danger}`, borderRadius: 8, padding: "5px 7px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 10.5, color: T.danger, fontWeight: 700 }}>🔒 Día bloqueado{todoBloq.motivo ? `: ${todoBloq.motivo}` : ""}</span><button onClick={() => quitarBloqueo(todoBloq)} style={{ ...xBtn, fontSize: 11 }}>✕</button></div>}
                {!todoBloq && bloqDia.filter((b) => b.hora).map((b) => (
                  <div key={b.id} style={{ background: "#33271a", border: `1px dashed ${T.danger}`, borderRadius: 8, padding: "5px 7px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 10.5, color: T.danger, fontWeight: 700 }}>🔒 {b.hora}{b.motivo ? ` · ${b.motivo}` : ""}</span><button onClick={() => quitarBloqueo(b)} style={{ ...xBtn, fontSize: 11 }}>✕</button></div>
                ))}
                {delDia.length === 0 && !bloqDia.length ? <div style={{ fontSize: 11, color: T.dim, textAlign: "center", paddingTop: 8 }}>—</div> : delDia.map((c) => { const inf = servInfo(c.tipoServicio); const est = c.estado || "agendado"; const esSol = est === "solicitado"; const esRec = est === "rechazado"; return (
                  <div key={c.id} style={{ background: T.surface2, border: esSol ? `1px dashed ${T.rust}` : `1px solid ${T.line2}`, borderLeft: `3px solid ${colorEstado(est)}`, borderRadius: 8, padding: "7px 8px", marginBottom: 6, opacity: esRec ? .6 : 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.cream }}>{c.hora || "--:--"} {inf.icon}{esSol && " 🔔"}</div>
                    <div style={{ fontSize: 12, color: T.text, textDecoration: esRec ? "line-through" : "none" }}>{nombreMascota(c.mascotaId)}</div>
                    <div style={{ fontSize: 10.5, color: T.muted }}>{inf.nombre}{c.nota ? ` · ${c.nota}` : ""}</div>
                    {esSol ? (
                      <Row style={{ marginTop: 5, gap: 4 }}>
                        <button onClick={() => confirmar(c)} style={{ fontSize: 9.5, fontWeight: 700, color: T.ok, background: "transparent", border: `1px solid ${T.ok}`, borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}>✓ Confirmar</button>
                        <button onClick={() => rechazar(c)} style={{ ...xBtn, fontSize: 12 }} title="Rechazar">✕</button>
                      </Row>
                    ) : esRec ? (
                      <Row between style={{ marginTop: 5 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: T.danger }}>Rechazada</span>
                        <button onClick={() => borrar(c)} style={{ ...xBtn, fontSize: 12 }} title="Eliminar">✕</button>
                      </Row>
                    ) : (
                      <Row between style={{ marginTop: 5 }}>
                        <button onClick={() => avanzar(c)} style={{ fontSize: 9.5, fontWeight: 700, color: colorEstado(est), background: "transparent", border: `1px solid ${colorEstado(est)}`, borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}>{labelEstado(est)}</button>
                        <Row style={{ gap: 4, alignItems: "center" }}>
                          {est === "completado" && c.facturado && <span style={{ fontSize: 9.5, color: T.ok }}>facturado</span>}
                          <button onClick={() => borrar(c)} style={{ ...xBtn, fontSize: 12 }}>✕</button>
                        </Row>
                      </Row>
                    )}
                  </div>
                ); })}
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: T.dim, marginTop: 10 }}>Las citas 🔔 son solicitudes de clientes por confirmar. Toca <b>Agendado</b> para marcar el servicio como <b>Completado</b>: se factura solo y aparece en Servicios y en la factura del mes.</p>
      {form && <FormCita mascotas={mascotas} citas={citas} bloqueos={bloqueos} onClose={() => setForm(null)} />}
      {bloqueo && <FormBloqueo bloqueos={bloqueos} onClose={() => setBloqueo(false)} />}
    </div>
  );
}

function FormBloqueo({ bloqueos, onClose }) {
  const [modo, setModo] = useState("dia"); // dia | hora
  const [fecha, setFecha] = useState(hoy());
  const [hora, setHora] = useState("09:00");
  const [motivo, setMotivo] = useState("");
  const [g, setG] = useState(false);
  const guardar = async () => {
    setG(true);
    try { await addDoc(collection(db, "bloqueos"), { fecha, hora: modo === "hora" ? hora : "", motivo: motivo.trim(), createdAt: Date.now() }); onClose(); }
    catch (e) { alert("Error: " + e.message); setG(false); }
  };
  return (
    <Modal title="Bloquear agenda" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>Bloquea un día completo o una hora puntual. Los clientes no podrán reservar en lo bloqueado.</p>
      <Label>¿Qué quieres bloquear?</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setModo("dia")} style={{ ...chip, ...(modo === "dia" ? chipOn : {}), flex: 1 }}>📅 Día completo</button>
        <button onClick={() => setModo("hora")} style={{ ...chip, ...(modo === "hora" ? chipOn : {}), flex: 1 }}>🕐 Una hora</button>
      </div>
      <Label>Fecha</Label>
      <PickerDia fecha={fecha} setFecha={setFecha} bloqueos={[]} />
      {modo === "hora" && (<><div style={{ height: 8 }} /><Label>Hora a bloquear</Label><PickerHora fecha={fecha} hora={hora} setHora={setHora} citas={[]} bloqueos={bloqueos} tipoServicio="" /></>)}
      <div style={{ height: 12 }} /><Label>Motivo (opcional)</Label><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. vacaciones, cita médica…" style={inp} />
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1, background: `linear-gradient(180deg,${T.rustSoft},${T.rust})` }}>{g ? "Guardando…" : "🔒 Bloquear"}</button></Row>
    </Modal>
  );
}

function FormCita({ mascotas, citas = [], bloqueos = [], onClose }) {
  const [mascotaId, setMascotaId] = useState("");
  const [tipoServicio, setTipo] = useState("paseo");
  const [fecha, setFecha] = useState(hoy());
  const [hora, setHora] = useState("");
  const [nota, setNota] = useState("");
  const [g, setG] = useState(false);
  const guardar = async () => {
    if (!mascotaId) return alert("Selecciona una mascota.");
    if (!hora) return alert("Selecciona una hora.");
    setG(true);
    try { await addDoc(collection(db, "citas"), { mascotaId, tipoServicio, fecha, hora, nota: nota.trim(), estado: "agendado", facturado: false, createdAt: Date.now() }); onClose(); }
    catch (e) { alert("Error: " + e.message); setG(false); }
  };
  return (
    <Modal title="Nueva cita" onClose={onClose}>
      <Label>Mascota</Label>
      <select value={mascotaId} onChange={(e) => setMascotaId(e.target.value)} style={inp}><option value="">Selecciona…</option>{mascotas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
      <div style={{ height: 12 }} /><Label>Servicio</Label>
      <select value={tipoServicio} onChange={(e) => { setTipo(e.target.value); setHora(""); }} style={inp}>{SERVICIOS.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
      <div style={{ height: 12 }} /><Label>Fecha</Label>
      <PickerDia fecha={fecha} setFecha={(f) => { setFecha(f); setHora(""); }} bloqueos={bloqueos} />
      <div style={{ height: 8 }} /><Label>Hora</Label>
      <PickerHora fecha={fecha} hora={hora} setHora={setHora} citas={citas} bloqueos={bloqueos} tipoServicio={tipoServicio} />
      <div style={{ height: 12 }} /><Label>Nota (opcional)</Label><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej. recoger en casa" style={inp} />
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Agendar"}</button></Row>
    </Modal>
  );
}

/* ====================== CLIENTES ====================== */
function Clientes({ duenos, mascotas, abrir, abrirMascota }) {
  const [buscar, setBuscar] = useState(""), [form, setForm] = useState(null);
  const lista = duenos.filter((d) => { const q = buscar.toLowerCase(); return !q || [d.nombre, d.telefono, d.email].some((v) => (v || "").toLowerCase().includes(q)); });
  const sinCliente = mascotas.filter((m) => !m.duenoId || !duenos.find((d) => d.id === m.duenoId));
  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between><H1>Clientes</H1><button onClick={() => setForm({})} style={btnPrim}>+ Nuevo cliente</button></Row>
      <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar cliente…" style={{ ...inp, marginTop: 16 }} />
      {lista.length === 0 ? <Card style={{ marginTop: 16, textAlign: "center", padding: 40 }}><div style={{ fontSize: 38 }}>👤</div><p style={{ color: T.muted, marginTop: 8 }}>No hay clientes. Crea uno y agrégale sus mascotas.</p></Card>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginTop: 18 }}>
            {lista.map((d) => { const sus = mascotas.filter((m) => m.duenoId === d.id); return (
              <div key={d.id} onClick={() => abrir(d.id)} style={{ ...cardBase, cursor: "pointer", transition: "transform .12s, border-color .12s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = T.rust; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = T.line; }}>
                <Row style={{ gap: 11 }}><div style={{ width: 46, height: 46, borderRadius: 13, background: `linear-gradient(135deg,${T.rust},${T.tan})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#241405" }}>{(d.nombre || "?").charAt(0).toUpperCase()}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 17, fontWeight: 700, color: T.cream }}>{d.nombre}</div><div style={{ fontSize: 12, color: T.muted }}>{d.telefono || "sin teléfono"}</div></div></Row>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>{sus.length === 0 ? <Pill>Sin mascotas</Pill> : sus.slice(0, 4).map((m) => <Pill key={m.id}>{m.nombre}</Pill>)}{sus.length > 4 && <Pill>+{sus.length - 4}</Pill>}</div>
              </div>); })}
          </div>}
      {sinCliente.length > 0 && <Card style={{ marginTop: 22, borderColor: T.pend }}><H2>Mascotas sin cliente asignado</H2><p style={{ fontSize: 12.5, color: T.muted, margin: "4px 0 12px" }}>Ábrelas y asígnales un cliente con “Editar”.</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{sinCliente.map((m) => <button key={m.id} onClick={() => abrirMascota(m.id)} style={chip}>{m.nombre} ›</button>)}</div></Card>}
      {form && <FormDueno inicial={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function FormDueno({ inicial, onClose }) {
  const editando = !!inicial.id;
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", ...inicial });
  const [g, setG] = useState(false); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async () => { if (!f.nombre.trim()) return alert("El nombre es obligatorio."); setG(true); const data = { nombre: f.nombre.trim(), telefono: f.telefono.trim(), email: f.email.trim() }; try { if (editando) await updateDoc(doc(db, "duenos", f.id), data); else await addDoc(collection(db, "duenos"), { ...data, createdAt: Date.now() }); onClose(); } catch (e) { alert("Error: " + e.message); setG(false); } };
  return (
    <Modal title={editando ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <Campo label="Nombre del cliente *" value={f.nombre} onChange={set("nombre")} /><div style={{ height: 10 }} />
      <Grid2><Campo label="Teléfono" value={f.telefono} onChange={set("telefono")} ph="ej. 3001234567" /><Campo label="Correo" value={f.email} onChange={set("email")} /></Grid2>
      <div style={{ fontSize: 11, color: T.dim, marginTop: 6 }}>El prefijo +57 (Colombia) se agrega automáticamente al enviar por WhatsApp.</div>
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Guardar"}</button></Row>
    </Modal>
  );
}

/* ====================== DETALLE CLIENTE ====================== */
function ClienteDetalle({ cliente, mascotas, servicios, movs, duenos, abrirMascota, onBack }) {
  const [editar, setEditar] = useState(false), [formMascota, setFormMascota] = useState(null), [compartir, setCompartir] = useState(false);
  const [mes, setMes] = useState(mesActual()), [factura, setFactura] = useState(false);
  const sus = mascotas.filter((m) => m.duenoId === cliente.id);
  const idsSus = sus.map((m) => m.id);
  const movsCliente = movs.filter((m) => idsSus.includes(m.mascotaId));
  const tMes = totales(movsCliente.filter((m) => mesDe(m.fecha) === mes));
  const mesesDisp = useMemo(() => { const s = new Set(movsCliente.map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); }, [movsCliente]);
  const grupos = sus.map((m) => { const mm = movs.filter((x) => x.mascotaId === m.id && mesDe(x.fecha) === mes); return { mascota: m, cargos: mm.filter(esCargo), abonos: mm.filter(esAbono) }; }).filter((g) => g.cargos.length || g.abonos.length);
  const borrar = async () => { if (sus.length) return alert("Este cliente tiene mascotas. Reasígnalas o elimínalas primero."); if (!confirm(`¿Eliminar al cliente ${cliente.nombre}?`)) return; await deleteDoc(doc(db, "duenos", cliente.id)); onBack(); };
  return (
    <div style={{ animation: "pop .35s ease" }}>
      <button onClick={onBack} style={{ ...btnGhost, marginBottom: 14 }}>← Clientes</button>
      <Card>
        <Row between style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <Row style={{ gap: 14 }}><div style={{ width: 56, height: 56, borderRadius: 15, background: `linear-gradient(135deg,${T.rust},${T.tan})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#241405" }}>{(cliente.nombre || "?").charAt(0).toUpperCase()}</div><div><div style={{ fontSize: 26, fontWeight: 800, color: T.cream, fontFamily: display }}>{cliente.nombre}</div><div style={{ color: T.muted, fontSize: 13.5 }}>{sus.length} mascota{sus.length !== 1 ? "s" : ""}</div></div></Row>
          <Row style={{ gap: 8, flexWrap: "wrap" }}><button onClick={() => setCompartir(true)} style={btnPrim}>🔗 Compartir</button><button onClick={() => setEditar(true)} style={btnGhost}>Editar</button><button onClick={borrar} style={{ ...btnGhost, color: T.danger, borderColor: "#4a2a22" }}>Eliminar</button></Row>
        </Row>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 16 }}><Info label="Teléfono" value={cliente.telefono} link={cliente.telefono ? `tel:${cliente.telefono}` : null} /><Info label="Correo" value={cliente.email} link={cliente.email ? `mailto:${cliente.email}` : null} /></div>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Row between style={{ flexWrap: "wrap", gap: 10 }}>
          <div><Label>Factura del mes (todas las mascotas)</Label><div style={{ fontSize: 22, fontWeight: 800, color: T.tan, marginTop: 4 }}>{money(tMes.facturado)} <span style={{ fontSize: 13, color: tMes.saldo > 0 ? T.pend : T.ok, fontWeight: 600 }}>· saldo {money(Math.abs(tMes.saldo))}</span></div></div>
          <Row style={{ gap: 8, flexWrap: "wrap" }}><select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto" }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select>
            {tMes.saldo > 0 && <button onClick={async () => { const pend = movsCliente.filter((m) => mesDe(m.fecha) === mes && esCargo(m) && !pagado(m)); if (!pend.length) return; if (!confirm(`¿Marcar como PAGADOS los ${pend.length} servicios pendientes de ${cliente.nombre} en ${nombreMes(mes)}?`)) return; for (const m of pend) await updateDoc(doc(db, "movimientos", m.id), { estado: "pagado" }); }} style={{ ...btnPrim, background: `linear-gradient(180deg,#86d18e,${T.ok})`, color: "#0e2412" }}>💵 Pagar todo</button>}
            <button onClick={() => setFactura(true)} style={btnPrim} disabled={grupos.length === 0}>🧾 Generar factura</button></Row>
        </Row>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <Row between><H2>Mascotas de {cliente.nombre}</H2><button onClick={() => setFormMascota({ duenoId: cliente.id })} style={btnSmall}>+ Nueva mascota</button></Row>
        {sus.length === 0 ? <Empty texto="Sin mascotas. Agrega la primera." /> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12, marginTop: 12 }}>
          {sus.map((m) => { const nServ = servicios.filter((s) => s.mascotaId === m.id).length; return (
            <div key={m.id} onClick={() => abrirMascota(m.id)} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 13, padding: 13, cursor: "pointer", transition: "border-color .12s" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = T.rust} onMouseLeave={(e) => e.currentTarget.style.borderColor = T.line}>
              <Row style={{ gap: 11 }}><Avatar mascota={m} big /><div><div style={{ fontSize: 16, fontWeight: 700, color: T.cream }}>{m.nombre}</div><div style={{ fontSize: 12, color: T.muted }}>{m.raza || "—"} · {nServ} serv.</div></div></Row>
            </div>); })}
        </div>}
      </Card>
      {editar && <FormDueno inicial={cliente} onClose={() => setEditar(false)} />}
      {formMascota && <FormMascota inicial={formMascota} duenos={duenos} onClose={() => setFormMascota(null)} />}
      {compartir && <CompartirCliente cliente={cliente} onClose={() => setCompartir(false)} />}
      {factura && <Factura cliente={cliente} grupos={grupos} mes={mes} onClose={() => setFactura(false)} />}
    </div>
  );
}

function CompartirCliente({ cliente, onClose }) {
  const link = `${window.location.origin}/c/${cliente.id}`;
  const [copiado, setCopiado] = useState(false);
  const tel = waTel(cliente.telefono);
  const msgWA = `Hola ${cliente.nombre} 🐾 Este es tu acceso personal a ADOLF.\n\nDesde este enlace puedes:\n• Agendar paseos, baños y hotel\n• Ver la información de tus mascotas\n• Consultar tus servicios, facturas y saldos\n• Recibir avisos cuando confirmemos tus citas\n\nGuárdalo, es solo para ti:\n${link}`;
  return (
    <Modal title="Compartir con el cliente" onClose={onClose}>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>Enlace personal para <b style={{ color: T.text }}>{cliente.nombre}</b>: puede agendar citas y consultar sus mascotas, servicios y cuenta.</p>
      <Label>Enlace</Label><input className="seleccionable" readOnly value={link} onFocus={(e) => e.target.select()} style={{ ...inp, fontSize: 12.5 }} />
      <Row style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { prompt("Copia:", link); } }} style={{ ...btnGhost, flex: 1, minWidth: 130 }}>{copiado ? "✓ Copiado" : "📋 Copiar enlace"}</button>
        <button onClick={() => window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msgWA)}`, "_blank")} disabled={!tel} style={{ ...btnPrim, flex: 1, minWidth: 130, background: tel ? "linear-gradient(180deg,#3ed47e,#1faa5a)" : T.surface2, color: tel ? "#0e2412" : T.dim }}>💬 WhatsApp</button>
      </Row>
    </Modal>
  );
}

/* ====================== FORM MASCOTA ====================== */
function FormMascota({ inicial, duenos, onClose }) {
  const editando = !!inicial.id;
  const [f, setF] = useState({ tipo: "perro", nombre: "", raza: "", color: "", edad: "", duenoId: "", ...inicial, fotos: fotosDe(inicial), carnets: carnetsDe(inicial) });
  const [g, setG] = useState(false); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const fotoRef = useRef(null), carnetRef = useRef(null);
  const MAX_FOTOS = 8, MAX_CARNETS = 6;
  const addFotos = (e) => {
    const files = [...e.target.files]; e.target.value = "";
    files.forEach((file) => comprimirImagen(file, (d) => { if (!d) return alert("No se pudo procesar una imagen. Intenta con otra."); setF((p) => { if ((p.fotos || []).length >= MAX_FOTOS) { alert(`Máximo ${MAX_FOTOS} fotos.`); return p; } return { ...p, fotos: [...(p.fotos || []), d] }; }); }, 700, 0.78));
  };
  const addCarnets = (e) => {
    const files = [...e.target.files]; e.target.value = "";
    files.forEach((file) => comprimirImagen(file, (d) => { if (!d) return alert("No se pudo procesar una imagen. Intenta con otra."); setF((p) => { if ((p.carnets || []).length >= MAX_CARNETS) { alert(`Máximo ${MAX_CARNETS} páginas de carnet.`); return p; } return { ...p, carnets: [...(p.carnets || []), d] }; }); }, 1100, 0.72));
  };
  const delFoto = (i) => setF((p) => ({ ...p, fotos: p.fotos.filter((_, j) => j !== i) }));
  const delCarnet = (i) => setF((p) => ({ ...p, carnets: p.carnets.filter((_, j) => j !== i) }));
  const guardar = async () => {
    if (!f.nombre.trim()) return alert("El nombre es obligatorio.");
    if (!f.duenoId) return alert("Selecciona el cliente (dueño).");
    const fotos = f.fotos || [], carnets = f.carnets || [];
    if (pesoBase64([...fotos, ...carnets]) > 950000) return alert("Las imágenes pesan demasiado en total. Quita alguna antes de guardar.");
    setG(true);
    const data = { tipo: f.tipo, nombre: f.nombre.trim(), raza: f.raza.trim(), color: f.color.trim(), edad: f.edad.trim(), duenoId: f.duenoId, fotos, carnets, foto: fotos[0] || "", carnet: carnets[0] || "" };
    try { if (editando) await updateDoc(doc(db, "mascotas", f.id), data); else await addDoc(collection(db, "mascotas"), { ...data, createdAt: Date.now() }); onClose(); }
    catch (e) { alert("Error al guardar: " + e.message); setG(false); }
  };
  const Miniatura = ({ src, onDel }) => (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <img src={src} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", border: `1px solid ${T.line2}` }} />
      <button type="button" onClick={onDel} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 999, background: T.danger, color: "#fff", border: "none", fontSize: 12, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
    </div>
  );
  const AddTile = ({ onClick, label }) => (
    <button type="button" onClick={onClick} style={{ width: 64, height: 64, borderRadius: 12, border: `1.5px dashed ${T.line2}`, background: T.surface2, color: T.muted, cursor: "pointer", fontSize: 11, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}><span style={{ fontSize: 18 }}>＋</span>{label}</button>
  );
  return (
    <Modal title={editando ? "Editar mascota" : "Nueva mascota"} onClose={onClose}>
      <Label>Fotos de la mascota</Label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, marginTop: 4 }}>
        {(f.fotos || []).map((src, i) => <Miniatura key={i} src={src} onDel={() => delFoto(i)} />)}
        {(f.fotos || []).length < MAX_FOTOS && <AddTile onClick={() => fotoRef.current?.click()} label="Foto" />}
        <input ref={fotoRef} type="file" accept="image/*" multiple onChange={addFotos} style={{ display: "none" }} />
      </div>
      <Label>Carnet de vacunas</Label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6, marginTop: 4 }}>
        {(f.carnets || []).map((src, i) => <Miniatura key={i} src={src} onDel={() => delCarnet(i)} />)}
        {(f.carnets || []).length < MAX_CARNETS && <AddTile onClick={() => carnetRef.current?.click()} label="Carnet" />}
        <input ref={carnetRef} type="file" accept="image/*" multiple onChange={addCarnets} style={{ display: "none" }} />
      </div>
      <div style={{ fontSize: 11, color: T.dim, marginBottom: 14 }}>Puedes agregar varias imágenes. Toca ＋ para añadir y la ✕ para quitar.</div>
      <Label>Cliente (dueño) *</Label><select value={f.duenoId} onChange={set("duenoId")} style={{ ...inp, marginBottom: 12 }}><option value="">Selecciona…</option>{duenos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select>
      <Label>Tipo</Label><div style={{ display: "flex", gap: 8, marginBottom: 4 }}>{[["perro", "🐕 Perro"], ["gato", "🐈 Gato"]].map(([k, l]) => <button key={k} onClick={() => setF({ ...f, tipo: k })} style={{ ...chip, ...(f.tipo === k ? chipOn : {}), flex: 1 }}>{l}</button>)}</div>
      <Grid2><Campo label="Nombre *" value={f.nombre} onChange={set("nombre")} /><Campo label="Raza" value={f.raza} onChange={set("raza")} /><Campo label="Color" value={f.color} onChange={set("color")} /><Campo label="Edad" value={f.edad} onChange={set("edad")} ph="ej. 3 años" /></Grid2>
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Guardar"}</button></Row>
    </Modal>
  );
}

/* ====================== DETALLE MASCOTA ====================== */
function MascotaDetalle({ mascota, duenos, servicios, movs, salud, onBack }) {
  const [editar, setEditar] = useState(false), [formServ, setFormServ] = useState(null), [formMov, setFormMov] = useState(null);
  const [formAbono, setFormAbono] = useState(null), [factura, setFactura] = useState(null), [zoom, setZoom] = useState(null);
  const [formSalud, setFormSalud] = useState(null), [mes, setMes] = useState(mesActual());
  const cliente = clienteDe(mascota, duenos);
  const sus = servicios.filter((s) => s.mascotaId === mascota.id);
  const susMovs = movs.filter((m) => m.mascotaId === mascota.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const susSalud = salud.filter((s) => s.mascotaId === mascota.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const movsMes = susMovs.filter((m) => mesDe(m.fecha) === mes);
  const t = totales(movsMes);
  const pagarTodo = async () => {
    const pend = movsMes.filter((m) => esCargo(m) && !pagado(m));
    if (!pend.length) return alert("No hay servicios pendientes este periodo.");
    if (!confirm(`¿Marcar como PAGADOS los ${pend.length} servicios pendientes de ${mascota.nombre} en ${nombreMes(mes)}? (Total ${money(pend.reduce((a, m) => a + Number(m.monto || 0), 0))})`)) return;
    for (const m of pend) await updateDoc(doc(db, "movimientos", m.id), { estado: "pagado" });
  };
  const mesesDisp = useMemo(() => { const s = new Set(susMovs.map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); }, [susMovs]);
  const borrar = async () => { if (!confirm(`¿Eliminar a ${mascota.nombre}?`)) return; for (const s of sus) await deleteDoc(doc(db, "servicios", s.id)); for (const m of susMovs) await deleteDoc(doc(db, "movimientos", m.id)); for (const s of susSalud) await deleteDoc(doc(db, "salud", s.id)); await deleteDoc(doc(db, "mascotas", mascota.id)); onBack(); };
  return (
    <div style={{ animation: "pop .35s ease" }}>
      <button onClick={onBack} style={{ ...btnGhost, marginBottom: 14 }}>← Volver</button>
      <Card>
        <Row between style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <Row style={{ gap: 14 }}><Avatar mascota={mascota} big onClick={fotosDe(mascota)[0] ? () => setZoom(fotosDe(mascota)[0]) : null} /><div><div style={{ fontSize: 26, fontWeight: 800, color: T.cream, fontFamily: display }}>{mascota.nombre}</div><div style={{ color: T.muted, fontSize: 13.5 }}>{emojiMascota(mascota.tipo)} {mascota.raza || "—"} · {mascota.color || "—"} · {mascota.edad || "—"}</div><div style={{ color: T.rustSoft, fontSize: 13, marginTop: 2 }}>Cliente: {cliente.nombre}</div></div></Row>
          <Row style={{ gap: 8 }}><button onClick={() => setEditar(true)} style={btnGhost}>Editar</button><button onClick={borrar} style={{ ...btnGhost, color: T.danger, borderColor: "#4a2a22" }}>Eliminar</button></Row>
        </Row>
        <Galeria titulo="Fotos" imgs={fotosDe(mascota)} onZoom={setZoom} />
        <Galeria titulo="Carnet de vacunas" imgs={carnetsDe(mascota)} onZoom={setZoom} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginTop: 16 }}>
        <Card style={{ padding: 16 }}><Row between><Label>Periodo</Label><select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto", padding: "5px 8px", fontSize: 12 }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select></Row><div style={{ fontSize: 26, fontWeight: 800, color: T.tan, marginTop: 8 }}>{money(t.facturado)}</div><div style={{ fontSize: 11.5, color: T.muted }}>facturado</div></Card>
        <Stat label="Cobrado" value={money(t.cobrado)} accent={T.ok} sub="pagos + abonos" />
        <Stat label={t.saldo >= 0 ? "Saldo pendiente" : "Saldo a favor"} value={money(Math.abs(t.saldo))} accent={t.saldo > 0 ? T.pend : T.ok} sub={t.saldo > 0 ? "por cobrar" : "al día"} />
      </div>

      <Row style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={() => setFactura(mes)} style={btnPrim}>🧾 Generar factura del periodo</button>
        {t.saldo > 0 && <button onClick={pagarTodo} style={{ ...btnPrim, background: `linear-gradient(180deg,#86d18e,${T.ok})`, color: "#0e2412" }}>💵 Pagar todo ({money(t.saldo)})</button>}
      </Row>

      <Card style={{ marginTop: 16 }}>
        <Row between><H2>Servicios y tarifas</H2><button onClick={() => setFormServ({})} style={btnSmall}>+ Agregar servicio</button></Row>
        {sus.length === 0 ? <Empty texto="Sin servicios. Agrega uno para definir tarifas." /> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10, marginTop: 12 }}>
          {sus.map((s) => { const inf = servInfo(s.tipo); return (
            <div key={s.id} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 13 }}><Row between><span style={{ fontWeight: 700, fontSize: 14 }}>{inf.icon} {inf.nombre}</span><Row style={{ gap: 4 }}><button onClick={() => setFormServ(s)} style={xBtn} title="Editar">✎</button><button onClick={async () => { if (confirm("¿Eliminar este servicio?")) await deleteDoc(doc(db, "servicios", s.id)); }} style={xBtn}>✕</button></Row></Row><div style={{ fontSize: 22, fontWeight: 800, color: T.tan, marginTop: 6 }}>{money(s.valor)}</div><div style={{ fontSize: 12, color: T.muted }}>{s.modalidad === "mensual" ? "por mes" : `por ${s.unidad || inf.unidad}`}</div></div>); })}
        </div>}
      </Card>

      {/* Historial médico */}
      <Card style={{ marginTop: 16 }}>
        <Row between><H2>💉 Historial médico</H2><button onClick={() => setFormSalud({})} style={btnSmall}>+ Agregar</button></Row>
        {susSalud.length === 0 ? <Empty texto="Sin registros. Agrega vacunas, alergias o notas del veterinario." /> : susSalud.map((s, i) => {
          const dias = s.proxima ? diasEntre(s.proxima) : null;
          return (
            <Row key={s.id} between style={{ padding: "10px 0", borderBottom: i < susSalud.length - 1 ? `1px solid ${T.line}` : "none" }}>
              <div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.tipo === "vacuna" ? "💉" : s.tipo === "alergia" ? "⚠️" : s.tipo === "desparasitacion" ? "🪱" : "📝"} {s.titulo}</div>
                <div style={{ fontSize: 11.5, color: T.muted }}>{s.fecha}{s.proxima ? ` · próxima: ${s.proxima}` : ""}{s.nota ? ` · ${s.nota}` : ""}</div></div>
              <Row style={{ gap: 8 }}>{dias !== null && dias <= 30 && <span style={{ ...badge, background: dias < 0 ? "#3a1f1a" : T.pendBg, color: dias < 0 ? T.danger : T.pend, borderColor: dias < 0 ? T.danger : T.pend }}>{dias < 0 ? "vencida" : dias === 0 ? "hoy" : `${dias} d`}</span>}<button onClick={async () => { if (confirm("¿Eliminar este registro?")) await deleteDoc(doc(db, "salud", s.id)); }} style={xBtn}>✕</button></Row>
            </Row>
          );
        })}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Row between style={{ flexWrap: "wrap", gap: 8 }}><H2>Movimientos del periodo</H2><Row style={{ gap: 8 }}><button onClick={() => setFormAbono({ mascotaId: mascota.id })} style={{ ...btnSmall, background: "transparent", color: T.ok, border: `1px solid ${T.ok}` }}>+ Abono</button><button onClick={() => setFormMov({ mascotaId: mascota.id })} style={btnSmall} disabled={sus.length === 0}>+ Servicio</button></Row></Row>
        {movsMes.length === 0 ? <Empty texto={sus.length === 0 ? "Primero agrega un servicio." : "Sin movimientos este periodo."} /> : <AcordeonMovs movs={movsMes} />}
      </Card>

      {editar && <FormMascota inicial={mascota} duenos={duenos} onClose={() => setEditar(false)} />}
      {formServ && <FormServicio inicial={formServ} mascotaId={mascota.id} onClose={() => setFormServ(null)} />}
      {formMov && <FormMovimiento mascota={mascota} servicios={servicios} onClose={() => setFormMov(null)} />}
      {formAbono && <FormAbono mascota={mascota} onClose={() => setFormAbono(null)} />}
      {formSalud && <FormSalud mascotaId={mascota.id} onClose={() => setFormSalud(null)} />}
      {factura && <Factura cliente={cliente} grupos={[{ mascota, cargos: t.cargos, abonos: t.abonos }]} mes={factura} onClose={() => setFactura(null)} />}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function FormSalud({ mascotaId, onClose }) {
  const [tipo, setTipo] = useState("vacuna"), [titulo, setTitulo] = useState(""), [fecha, setFecha] = useState(hoy());
  const [proxima, setProxima] = useState(""), [nota, setNota] = useState(""), [g, setG] = useState(false);
  const guardar = async () => { if (!titulo.trim()) return alert("Escribe un título (ej. Rabia, Pulgas, Alergia al pollo)."); setG(true); try { await addDoc(collection(db, "salud"), { mascotaId, tipo, titulo: titulo.trim(), fecha, proxima: proxima || "", nota: nota.trim(), createdAt: Date.now() }); onClose(); } catch (e) { alert("Error: " + e.message); setG(false); } };
  const tipos = [["vacuna", "💉 Vacuna"], ["desparasitacion", "🪱 Desparasitación"], ["alergia", "⚠️ Alergia"], ["nota", "📝 Nota"]];
  return (
    <Modal title="Registro médico" onClose={onClose}>
      <Label>Tipo</Label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>{tipos.map(([k, l]) => <button key={k} onClick={() => setTipo(k)} style={{ ...chip, ...(tipo === k ? chipOn : {}) }}>{l}</button>)}</div>
      <Campo label="Título *" value={titulo} onChange={(e) => setTitulo(e.target.value)} ph="ej. Rabia, Polivalente, Alergia al pollo" /><div style={{ height: 10 }} />
      <Grid2><div><Label>Fecha</Label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></div><div><Label>Próxima (opcional)</Label><input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} style={inp} /></div></Grid2>
      <div style={{ height: 10 }} /><Label>Nota (opcional)</Label><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej. observación del veterinario" style={inp} />
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Guardar"}</button></Row>
    </Modal>
  );
}

/* ====================== FORM SERVICIO ====================== */
function FormServicio({ inicial, mascotaId, onClose }) {
  const editando = !!(inicial && inicial.id);
  const [tipo, setTipo] = useState(inicial?.tipo || "paseo"), [modalidad, setModalidad] = useState(inicial?.modalidad || "unidad"), [valor, setValor] = useState(inicial?.valor ? String(inicial.valor) : "");
  const inf = servInfo(tipo); const [g, setG] = useState(false);
  const guardar = async () => { const v = Number(valor); if (!v || v <= 0) return alert("Ingresa un valor válido."); setG(true); const data = { mascotaId, tipo, modalidad, valor: v, unidad: inf.unidad }; try { if (editando) await updateDoc(doc(db, "servicios", inicial.id), data); else await addDoc(collection(db, "servicios"), { ...data, createdAt: Date.now() }); onClose(); } catch (e) { alert("Error: " + e.message); setG(false); } };
  return (
    <Modal title={editando ? "Editar servicio" : "Agregar servicio"} onClose={onClose}>
      <Label>Tipo de servicio</Label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>{SERVICIOS.map((s) => <button key={s.id} onClick={() => setTipo(s.id)} style={{ ...chip, ...(tipo === s.id ? chipOn : {}), textAlign: "left", padding: "10px 11px" }}>{s.icon} {s.nombre}</button>)}</div>
      <Label>Modalidad</Label><div style={{ display: "flex", gap: 8, marginBottom: 14 }}><button onClick={() => setModalidad("unidad")} style={{ ...chip, ...(modalidad === "unidad" ? chipOn : {}), flex: 1 }}>Por {inf.unidad}</button><button onClick={() => setModalidad("mensual")} style={{ ...chip, ...(modalidad === "mensual" ? chipOn : {}), flex: 1 }}>Mensualidad</button></div>
      <Label>{modalidad === "mensual" ? "Valor mensualidad" : `Valor por ${inf.unidad}`}</Label><input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" style={inp} />
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Guardar"}</button></Row>
    </Modal>
  );
}

/* ====================== FORM MOVIMIENTO ====================== */
function FormMovimiento({ mascota, servicios, onClose, todasMascotas }) {
  const [mascotaId, setMascotaId] = useState(mascota ? mascota.id : "");
  const servsDeMascota = servicios.filter((s) => s.mascotaId === mascotaId);
  const [servId, setServId] = useState(mascota && servsDeMascota[0] ? servsDeMascota[0].id : "");
  const serv = servicios.find((s) => s.id === servId);
  const [fecha, setFecha] = useState(hoy()), [cantidad, setCantidad] = useState(1), [monto, setMonto] = useState(""), [estado, setEstado] = useState("pendiente"), [notas, setNotas] = useState(""), [g, setG] = useState(false);
  useEffect(() => { if (servsDeMascota.length && !servsDeMascota.find((s) => s.id === servId)) setServId(servsDeMascota[0].id); if (!servsDeMascota.length) setServId(""); }, [mascotaId, servicios.length]);
  useEffect(() => { if (serv) { const c = serv.modalidad === "mensual" ? 1 : Number(cantidad || 1); setMonto(String(Number(serv.valor || 0) * c)); } }, [servId, cantidad]);
  const guardar = async () => { if (!mascotaId) return alert("Selecciona una mascota."); if (!serv) return alert("Selecciona un servicio."); if (!Number(monto)) return alert("El monto no puede ser 0."); setG(true); try { await addDoc(collection(db, "movimientos"), { kind: "cargo", mascotaId, servicioId: servId, tipoServicio: serv.tipo, modalidad: serv.modalidad, unidad: serv.unidad, fecha, cantidad: serv.modalidad === "mensual" ? 1 : Number(cantidad), monto: Number(monto), estado, notas: notas.trim(), createdAt: Date.now() }); onClose(); } catch (e) { alert("Error: " + e.message); setG(false); } };
  const inf = serv ? servInfo(serv.tipo) : null; const sinServicios = mascotaId && servsDeMascota.length === 0;
  return (
    <Modal title="Registrar servicio" onClose={onClose}>
      {todasMascotas && (<><Label>Mascota</Label><select value={mascotaId} onChange={(e) => setMascotaId(e.target.value)} style={inp}><option value="">Selecciona…</option>{todasMascotas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select><div style={{ height: 12 }} /></>)}
      {sinServicios ? <div style={{ background: T.pendBg, border: `1px solid ${T.line2}`, borderRadius: 12, padding: 14, color: T.pend, fontSize: 13 }}>Esta mascota no tiene servicios. Agrégale uno en su perfil.</div> : (<>
        <Label>Servicio</Label><select value={servId} onChange={(e) => setServId(e.target.value)} style={inp}><option value="">Selecciona…</option>{servsDeMascota.map((s) => { const i = servInfo(s.tipo); return <option key={s.id} value={s.id}>{i.nombre} · {money(s.valor)} {s.modalidad === "mensual" ? "/mes" : "/" + (s.unidad || i.unidad)}</option>; })}</select>
        {serv && (<>
          <div style={{ height: 12 }} /><Grid2><div><Label>Fecha</Label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></div>{serv.modalidad === "mensual" ? <div><Label>Concepto</Label><input value="Mensualidad" disabled style={{ ...inp, opacity: .6 }} /></div> : <div><Label>Cantidad ({serv.unidad || inf.unidad})</Label><input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} style={inp} /></div>}</Grid2>
          <div style={{ height: 12 }} /><Label>Monto</Label><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} style={inp} />
          <div style={{ height: 12 }} /><Label>¿El cliente ya pagó?</Label><div style={{ display: "flex", gap: 8 }}><button onClick={() => setEstado("pagado")} style={{ ...chip, ...(estado === "pagado" ? { background: T.okBg, borderColor: T.ok, color: T.ok } : {}), flex: 1 }}>✓ Pagado</button><button onClick={() => setEstado("pendiente")} style={{ ...chip, ...(estado === "pendiente" ? { background: T.pendBg, borderColor: T.pend, color: T.pend } : {}), flex: 1 }}>⏳ Pendiente</button></div>
          <div style={{ height: 12 }} /><Label>Notas (opcional)</Label><input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. paseo de 2 horas" style={inp} />
        </>)}
      </>)}
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g || !serv} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Registrar"}</button></Row>
    </Modal>
  );
}

/* ====================== FORM ABONO ====================== */
function FormAbono({ mascota, onClose, todasMascotas }) {
  const [mascotaId, setMascotaId] = useState(mascota ? mascota.id : ""), [fecha, setFecha] = useState(hoy()), [monto, setMonto] = useState(""), [notas, setNotas] = useState(""), [g, setG] = useState(false);
  const guardar = async () => { if (!mascotaId) return alert("Selecciona una mascota."); if (!Number(monto)) return alert("Ingresa el monto."); setG(true); try { await addDoc(collection(db, "movimientos"), { kind: "abono", mascotaId, fecha, monto: Number(monto), notas: notas.trim(), createdAt: Date.now() }); onClose(); } catch (e) { alert("Error: " + e.message); setG(false); } };
  return (
    <Modal title="Registrar abono" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>Dinero que el cliente paga en cualquier momento. Se descuenta del saldo.</p>
      {todasMascotas && (<><Label>Mascota</Label><select value={mascotaId} onChange={(e) => setMascotaId(e.target.value)} style={inp}><option value="">Selecciona…</option>{todasMascotas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select><div style={{ height: 12 }} /></>)}
      <Grid2><div><Label>Fecha</Label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></div><div><Label>Monto</Label><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" style={inp} /></div></Grid2>
      <div style={{ height: 12 }} /><Label>Notas (opcional)</Label><input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. abono en efectivo" style={inp} />
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1, background: `linear-gradient(180deg,#86d18e,${T.ok})`, color: "#0e2412" }}>{g ? "Guardando…" : "Registrar abono"}</button></Row>
    </Modal>
  );
}

/* ====================== FACTURA ====================== */
function Factura({ cliente, grupos, mes, onClose }) {
  const sum = (arr) => arr.reduce((a, m) => a + Number(m.monto || 0), 0);
  const facturado = grupos.reduce((a, g) => a + sum(g.cargos), 0);
  const cobrado = grupos.reduce((a, g) => a + sum(g.cargos.filter(pagado)) + sum(g.abonos), 0);
  const saldo = facturado - cobrado;
  const tel = waTel(cliente.telefono);

  const plural = (u, n) => { if (n === 1) return u; const map = { hora: "horas", "sesión": "sesiones", noche: "noches" }; return map[u] || u + "s"; };
  const resumir = (cargos) => {
    const map = {};
    cargos.forEach((c) => {
      const k = c.tipoServicio + "|" + (c.modalidad || "unidad");
      if (!map[k]) map[k] = { tipo: c.tipoServicio, modalidad: c.modalidad || "unidad", unidad: c.unidad || servInfo(c.tipoServicio).unidad, cantidad: 0, monto: 0, n: 0 };
      map[k].cantidad += Number(c.cantidad || 1); map[k].monto += Number(c.monto || 0); map[k].n += 1;
    });
    return Object.values(map).sort((a, b) => b.monto - a.monto);
  };
  const detalleR = (r) => r.modalidad === "mensual" ? `${r.n} ${r.n === 1 ? "mes" : "meses"}` : `${r.cantidad} ${plural(r.unidad, r.cantidad)}`;

  const texto = () => {
    let t = `🐾 *ADOLF* — Estado de cuenta\n${nombreMes(mes)}\n\nCliente: ${cliente.nombre}\n`;
    grupos.forEach((g) => {
      t += `\n${emojiMascota(g.mascota.tipo)} *${g.mascota.nombre}*\n`;
      const rs = resumir(g.cargos); const ab = sum(g.abonos);
      if (!rs.length && !ab) t += `• Sin movimientos\n`;
      rs.forEach((r) => { t += `• ${servInfo(r.tipo).nombre}: ${detalleR(r)} — ${money(r.monto)}\n`; });
      if (ab) t += `• Abonos/pagos: −${money(ab)}\n`;
    });
    t += `\n*Total servicios: ${money(facturado)}*\n*Cobrado: ${money(cobrado)}*\n*SALDO ${saldo >= 0 ? "PENDIENTE" : "A FAVOR"}: ${money(Math.abs(saldo))}*`;
    t += `\n\n*Medios de pago*\n` + PAGOS.map((p) => `${p.label}: ${p.valor}`).join("\n");
    return t;
  };
  const imprimir = () => {
    const secc = grupos.map((g) => {
      const rs = resumir(g.cargos); const ab = sum(g.abonos);
      const fc = rs.map((r) => `<tr><td>${servInfo(r.tipo).nombre}</td><td class="r">${detalleR(r)}</td><td class="r">${money(r.monto)}</td></tr>`).join("");
      const fa = ab ? `<tr><td>Abonos / pagos</td><td class="r">—</td><td class="r">− ${money(ab)}</td></tr>` : "";
      return `<h2>${emojiMascota(g.mascota.tipo)} ${g.mascota.nombre}</h2><table><thead><tr><th>Servicio</th><th class="r">Cantidad</th><th class="r">Total</th></tr></thead><tbody>${fc || '<tr><td colspan="3" style="color:#999">Sin servicios</td></tr>'}${fa}</tbody></table>`;
    }).join("");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Factura ${cliente.nombre}</title><style>*{box-sizing:border-box;font-family:Arial}body{margin:0;padding:32px;color:#1c1712}.wrap{max-width:660px;margin:0 auto}.head{display:flex;justify-content:space-between;border-bottom:3px solid #d2772f;padding-bottom:14px}.brand{font-size:34px;font-weight:800;letter-spacing:3px}.brand small{display:block;font-size:11px;color:#d2772f;font-weight:700}.meta{text-align:right;font-size:12px;color:#555;line-height:1.6}h2{font-size:15px;margin:20px 0 6px}.cli{font-size:14px;margin-top:14px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #eee}th{font-size:11px;text-transform:uppercase;color:#999}.r{text-align:right}.tot{margin-top:22px;margin-left:auto;width:300px;font-size:14px}.tot div{display:flex;justify-content:space-between;padding:6px 0}.tot .big{border-top:2px solid #1c1712;margin-top:6px;padding-top:10px;font-size:19px;font-weight:800}.pend{color:#c47d10}.fav{color:#2f8f3a}.pagos{margin-top:22px;padding:12px 14px;background:#faf3ea;border:1px solid #ecd9c2;border-radius:10px;font-size:13px;line-height:1.7}.pagos b.t{display:block;color:#d2772f;text-transform:uppercase;font-size:11px;letter-spacing:.5px;margin-bottom:4px}.foot{margin-top:24px;text-align:center;font-weight:800;letter-spacing:3px;font-size:18px}</style></head><body><div class="wrap"><div class="head"><div class="brand">ADOLF<small>${TAGLINE}</small></div><div class="meta"><b>Estado de cuenta</b><br>${nombreMes(mes)}<br>Emitido: ${hoy()}</div></div><div class="cli"><b>Cliente:</b> ${cliente.nombre}${cliente.telefono ? " · " + cliente.telefono : ""}</div>${secc}<div class="tot"><div><span>Total servicios</span><b>${money(facturado)}</b></div><div><span>Cobrado</span><b>− ${money(cobrado)}</b></div><div class="big ${saldo >= 0 ? "pend" : "fav"}"><span>Saldo ${saldo >= 0 ? "pendiente" : "a favor"}</span><span>${money(Math.abs(saldo))}</span></div></div><div class="pagos"><b class="t">Medios de pago</b>${PAGOS.map((p) => `${p.label}: <b>${p.valor}</b>`).join("<br>")}</div><div class="foot">ADOLF</div></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return alert("Permite las ventanas emergentes."); w.document.write(html); w.document.close();
  };
  return (
    <Modal title={grupos.length > 1 ? "Factura del cliente" : "Factura del periodo"} onClose={onClose}>
      <div className="seleccionable" style={{ background: "#fff", color: "#1c1712", borderRadius: 12, padding: 18, maxHeight: "52vh", overflowY: "auto" }}>
        <Row between style={{ borderBottom: "3px solid #d2772f", paddingBottom: 10, alignItems: "flex-start" }}><div><div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>ADOLF</div><div style={{ fontSize: 10.5, color: "#d2772f", fontWeight: 700, marginTop: 2 }}>{TAGLINE}</div></div><div style={{ textAlign: "right", fontSize: 11, color: "#666" }}><b>Estado de cuenta</b><br />{nombreMes(mes)}</div></Row>
        <div style={{ fontSize: 13, marginTop: 12 }}><b>Cliente:</b> {cliente.nombre}{cliente.telefono ? " · " + cliente.telefono : ""}</div>
        {grupos.map((g) => { const rs = resumir(g.cargos); const ab = sum(g.abonos); return (
          <div key={g.mascota.id} style={{ marginTop: 14 }}><div style={{ fontSize: 14, fontWeight: 800 }}>{emojiMascota(g.mascota.tipo)} {g.mascota.nombre}</div>
            {rs.length === 0 && !ab ? <div style={{ color: "#999", fontSize: 13 }}>Sin movimientos</div> : <>
              {rs.map((r, idx) => { const i = servInfo(r.tipo); return <Row key={idx} between style={{ fontSize: 13, padding: "5px 0", borderBottom: "1px solid #eee" }}><span>{i.icon} {i.nombre} · <b style={{ fontWeight: 600 }}>{detalleR(r)}</b></span><b>{money(r.monto)}</b></Row>; })}
              {ab ? <Row between style={{ fontSize: 13, padding: "5px 0", borderBottom: "1px solid #eee", color: "#2f8f3a" }}><span>Abonos / pagos</span><b>− {money(ab)}</b></Row> : null}
            </>}
          </div>); })}
        <div style={{ marginTop: 16, fontSize: 14 }}><Row between style={{ padding: "3px 0" }}><span>Total servicios</span><b>{money(facturado)}</b></Row><Row between style={{ padding: "3px 0" }}><span>Cobrado</span><b>− {money(cobrado)}</b></Row><Row between style={{ borderTop: "2px solid #1c1712", marginTop: 6, paddingTop: 8, fontSize: 17, fontWeight: 800, color: saldo >= 0 ? "#c47d10" : "#2f8f3a" }}><span>Saldo {saldo >= 0 ? "pendiente" : "a favor"}</span><span>{money(Math.abs(saldo))}</span></Row></div>
        <div style={{ marginTop: 14, background: "#faf3ea", border: "1px solid #ecd9c2", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: .5, color: "#d2772f", fontWeight: 700, marginBottom: 4 }}>Medios de pago</div>
          {PAGOS.map((p, i) => <div key={i} style={{ fontSize: 13 }}>{p.label}: <b>{p.valor}</b></div>)}
        </div>
        <div style={{ textAlign: "center", fontFamily: display, fontWeight: 800, letterSpacing: 3, fontSize: 18, marginTop: 16 }}>ADOLF</div>
      </div>
      <Row style={{ gap: 10, marginTop: 18, flexWrap: "wrap" }}><button onClick={imprimir} style={{ ...btnPrim, flex: 1, minWidth: 130 }}>🖨️ Imprimir / PDF</button><button onClick={() => window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto())}`, "_blank")} disabled={!tel} style={{ ...btnPrim, flex: 1, minWidth: 130, background: tel ? "linear-gradient(180deg,#3ed47e,#1faa5a)" : T.surface2, color: tel ? "#0e2412" : T.dim }}>💬 WhatsApp</button></Row>
    </Modal>
  );
}

/* ====================== SERVICIOS (global) ====================== */
function Servicios({ mascotas, servicios, movs }) {
  const [mes, setMes] = useState(mesActual());
  const [estadoF, setEstadoF] = useState("todos"); // todos | pendientes | pagados
  const [abierto, setAbierto] = useState({});
  const [form, setForm] = useState(false), [abono, setAbono] = useState(false);
  const mesesDisp = useMemo(() => { const s = new Set(movs.map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); }, [movs]);
  const nombreMascota = (id) => (mascotas.find((m) => m.id === id) || {}).nombre || "—";
  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  const t = totales(delMes);
  const toggle = (k) => setAbierto((p) => ({ ...p, [k]: !p[k] }));

  const cargosF = delMes.filter(esCargo).filter((c) => estadoF === "todos" ? true : estadoF === "pagados" ? pagado(c) : !pagado(c));
  const grupos = SERVICIOS.map((s) => {
    const items = cargosF.filter((c) => c.tipoServicio === s.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const total = items.reduce((a, m) => a + Number(m.monto || 0), 0);
    const pend = items.filter((c) => !pagado(c)).reduce((a, m) => a + Number(m.monto || 0), 0);
    return { ...s, items, total, pend };
  }).filter((g) => g.items.length);
  const abonos = delMes.filter(esAbono).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const mostrarAbonos = estadoF !== "pendientes" && abonos.length > 0;

  const Seccion = ({ k, icon, nombre, n, total, pend, children }) => (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, marginBottom: 10, overflow: "hidden", background: T.surface2 }}>
      <button onClick={() => toggle(k)} style={{ width: "100%", background: "transparent", border: "none", color: T.text, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 14, color: T.cream }}>{nombre}</span><span style={{ fontSize: 11.5, color: T.muted }}> · {n} {n === 1 ? "registro" : "registros"}</span>{pend > 0 && <span style={{ fontSize: 11.5, color: T.pend }}> · {money(pend)} por cobrar</span>}</span>
        <b style={{ fontVariantNumeric: "tabular-nums", color: T.tan }}>{money(total)}</b>
        <span style={{ color: T.dim, fontSize: 13, transform: abierto[k] ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
      </button>
      {abierto[k] && <div style={{ padding: "0 14px 8px", borderTop: `1px solid ${T.line}` }}>{children}</div>}
    </div>
  );

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between style={{ flexWrap: "wrap", gap: 8 }}><H1>Servicios y pagos</H1><Row style={{ gap: 8 }}><button onClick={() => setAbono(true)} style={{ ...btnPrim, background: "transparent", color: T.ok, border: `1px solid ${T.ok}` }} disabled={mascotas.length === 0}>+ Abono</button><button onClick={() => setForm(true)} style={btnPrim} disabled={servicios.length === 0}>+ Servicio</button></Row></Row>
      <Row style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto" }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select>
        <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 12, padding: 4, border: `1px solid ${T.line}` }}>{[["todos", "Todos"], ["pendientes", "Por cobrar"], ["pagados", "Pagados"]].map(([k, l]) => <button key={k} onClick={() => setEstadoF(k)} style={tab(estadoF === k)}>{l}</button>)}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: 13 }}>Facturado: <b style={{ color: T.tan }}>{money(t.facturado)}</b></span><span style={{ fontSize: 13 }}>Cobrado: <b style={{ color: T.ok }}>{money(t.cobrado)}</b></span><span style={{ fontSize: 13 }}>Saldo: <b style={{ color: t.saldo > 0 ? T.pend : T.ok }}>{money(Math.abs(t.saldo))}</b></span></div>
      </Row>

      <div style={{ marginTop: 16 }}>
        {grupos.length === 0 && !mostrarAbonos ? <Card><Empty texto="Sin movimientos para este filtro." /></Card> : <>
          {grupos.map((g) => (
            <Seccion key={g.id} k={g.id} icon={g.icon} nombre={g.nombre} n={g.items.length} total={g.total} pend={g.pend}>
              <TablaMovs movs={g.items} mostrarMascota nombreMascota={nombreMascota} />
            </Seccion>
          ))}
          {mostrarAbonos && (
            <Seccion k="_abonos" icon="💵" nombre="Abonos / pagos recibidos" n={abonos.length} total={abonos.reduce((a, m) => a + Number(m.monto || 0), 0)} pend={0}>
              <TablaMovs movs={abonos} mostrarMascota nombreMascota={nombreMascota} />
            </Seccion>
          )}
        </>}
      </div>

      {form && <FormMovimiento servicios={servicios} todasMascotas={mascotas} onClose={() => setForm(false)} />}
      {abono && <FormAbono todasMascotas={mascotas} onClose={() => setAbono(false)} />}
    </div>
  );
}

/* ====================== TABLA MOVS ====================== */
function TablaMovs({ movs, mostrarMascota, nombreMascota, readOnly }) {
  const borrar = async (m) => { if (confirm("¿Eliminar este movimiento?")) await deleteDoc(doc(db, "movimientos", m.id)); };
  const toggle = async (m) => { await updateDoc(doc(db, "movimientos", m.id), { estado: pagado(m) ? "pendiente" : "pagado" }); };
  return (
    <div style={{ marginTop: 6 }}>{movs.map((m, i) => { const ab = esAbono(m); const inf = ab ? null : servInfo(m.tipoServicio); return (
      <Row key={m.id} between style={{ padding: "11px 0", borderBottom: i < movs.length - 1 ? `1px solid ${T.line}` : "none", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}><span style={{ fontSize: 19, width: 24, textAlign: "center" }}>{ab ? "💵" : inf.icon}</span><div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{ab ? "Abono" : `${inf.nombre}${m.modalidad === "mensual" ? " · Mensualidad" : (m.cantidad > 1 ? ` · ${m.cantidad} ${m.unidad || inf.unidad}` : "")}`}{mostrarMascota && <span style={{ color: T.rust }}> — {nombreMascota(m.mascotaId)}</span>}</div><div style={{ fontSize: 11.5, color: T.muted }}>{m.fecha}{m.notas ? ` · ${m.notas}` : ""}</div></div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}><b style={{ fontVariantNumeric: "tabular-nums", fontSize: 14.5, color: ab ? T.ok : T.text }}>{ab ? "− " : ""}{money(m.monto)}</b>{ab ? <span style={{ ...badge, background: T.okBg, color: T.ok, borderColor: "#3a5a36" }}>Abono</span> : <button onClick={() => !readOnly && toggle(m)} style={{ ...badge, cursor: readOnly ? "default" : "pointer", ...(pagado(m) ? { background: T.okBg, color: T.ok, borderColor: "#3a5a36" } : { background: T.pendBg, color: T.pend, borderColor: "#4a3c18" }) }}>{pagado(m) ? "✓ Pagado" : "⏳ Pendiente"}</button>}{!readOnly && <button onClick={() => borrar(m)} style={xBtn}>✕</button>}</div>
      </Row>); })}</div>
  );
}

/* ====================== ACORDEÓN DE MOVIMIENTOS (por tipo) ====================== */
function AcordeonMovs({ movs, nombreMascota, mostrarMascota, readOnly }) {
  const [abierto, setAbierto] = useState({});
  const toggle = (k) => setAbierto((p) => ({ ...p, [k]: !p[k] }));
  const cargos = movs.filter(esCargo);
  const abonos = movs.filter(esAbono).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const grupos = SERVICIOS.map((s) => {
    const items = cargos.filter((c) => c.tipoServicio === s.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const total = items.reduce((a, m) => a + Number(m.monto || 0), 0);
    const pend = items.filter((c) => !pagado(c)).reduce((a, m) => a + Number(m.monto || 0), 0);
    return { ...s, items, total, pend };
  }).filter((g) => g.items.length);
  if (grupos.length === 0 && abonos.length === 0) return <Empty texto="Sin movimientos este mes." />;
  const Seccion = ({ k, icon, nombre, n, total, pend, children }) => (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, marginBottom: 8, overflow: "hidden", background: T.surface2 }}>
      <button onClick={() => toggle(k)} style={{ width: "100%", background: "transparent", border: "none", color: T.text, padding: "12px 13px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 19, width: 24, textAlign: "center" }}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 13.5, color: T.cream }}>{nombre}</span><span style={{ fontSize: 11, color: T.muted }}> · {n} {n === 1 ? "registro" : "registros"}</span>{pend > 0 && <span style={{ fontSize: 11, color: T.pend }}> · {money(pend)} por cobrar</span>}</span>
        <b style={{ fontVariantNumeric: "tabular-nums", color: T.tan, fontSize: 13.5 }}>{money(total)}</b>
        <span style={{ color: T.dim, fontSize: 12, transform: abierto[k] ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
      </button>
      {abierto[k] && <div style={{ padding: "0 13px 6px", borderTop: `1px solid ${T.line}` }}>{children}</div>}
    </div>
  );
  return (
    <div>
      {grupos.map((g) => (
        <Seccion key={g.id} k={g.id} icon={g.icon} nombre={g.nombre} n={g.items.length} total={g.total} pend={g.pend}>
          <TablaMovs movs={g.items} mostrarMascota={mostrarMascota} nombreMascota={nombreMascota} readOnly={readOnly} />
        </Seccion>
      ))}
      {abonos.length > 0 && (
        <Seccion k="_abonos" icon="💵" nombre="Abonos / pagos" n={abonos.length} total={abonos.reduce((a, m) => a + Number(m.monto || 0), 0)} pend={0}>
          <TablaMovs movs={abonos} mostrarMascota={mostrarMascota} nombreMascota={nombreMascota} readOnly={readOnly} />
        </Seccion>
      )}
    </div>
  );
}

/* ====================== VISTA CLIENTE ====================== */
function VistaCliente({ duenoId }) {
  const { duenos, mascotas, servicios, movs, salud, citas, bloqueos } = useDatos();
  const [mes, setMes] = useState(mesActual()), [factura, setFactura] = useState(false), [zoom, setZoom] = useState(null), [cargando, setCargando] = useState(true);
  const [solicitar, setSolicitar] = useState(false);
  useEffect(() => { const t = setTimeout(() => setCargando(false), 1500); return () => clearTimeout(t); }, []);

  // Notificaciones del cliente: avisar cuando su reserva es confirmada o agendada
  const noti = useNotis("adolf_notis_cli_" + duenoId);
  const prevEst = useRef(null);
  useEffect(() => {
    const susM = mascotas.filter((m) => m.duenoId === duenoId);
    const mis = citas.filter((c) => susM.find((m) => m.id === c.mascotaId));
    const map = new Map(mis.map((c) => [c.id, c.estado || "agendado"]));
    if (prevEst.current === null) { prevEst.current = map; return; }
    mis.forEach((c) => {
      const antes = prevEst.current.get(c.id); const ahora = c.estado || "agendado";
      const m = mascotas.find((x) => x.id === c.mascotaId); const inf = servInfo(c.tipoServicio);
      const base = `${m ? m.nombre : ""} · ${inf.nombre} · ${c.fecha} ${c.hora}`;
      if (!antes) {
        if (ahora === "agendado") noti.push({ titulo: "Nueva cita agendada 📅", detalle: base });
      } else if (antes !== ahora) {
        if (ahora === "agendado") noti.push({ titulo: "¡Tu cita fue confirmada! ✅", detalle: base });
        else if (ahora === "rechazado") noti.push({ titulo: "Solicitud no confirmada ❌", detalle: `${base} — escríbenos para reagendar` });
        else if (ahora === "completado") noti.push({ titulo: "Servicio completado ✅", detalle: base });
      }
    });
    prevEst.current = map;
  }, [citas, mascotas]);

  // Aviso de vacunas próximas o vencidas (una sola vez por alerta)
  useEffect(() => {
    const susM = mascotas.filter((m) => m.duenoId === duenoId);
    const alertas = salud.filter((s) => s.proxima && diasEntre(s.proxima) <= 30 && susM.find((m) => m.id === s.mascotaId));
    if (!alertas.length) return;
    let avisadas; try { avisadas = new Set(JSON.parse(localStorage.getItem("adolf_vac_avis_" + duenoId) || "[]")); } catch { avisadas = new Set(); }
    const nuevas = alertas.filter((a) => !avisadas.has(a.id + "|" + a.proxima));
    if (!nuevas.length) return;
    const a0 = nuevas[0]; const m = mascotas.find((x) => x.id === a0.mascotaId); const d = diasEntre(a0.proxima);
    const det = nuevas.length > 1 ? `${nuevas.length} vacunas de tus mascotas requieren atención` : `${m ? m.nombre : ""}: ${a0.titulo} ${d < 0 ? "vencida" : d === 0 ? "vence hoy" : `vence en ${d} días`}`;
    noti.push({ titulo: "Recordatorio de vacunas 💉", detalle: det });
    nuevas.forEach((a) => avisadas.add(a.id + "|" + a.proxima));
    try { localStorage.setItem("adolf_vac_avis_" + duenoId, JSON.stringify([...avisadas])); } catch {}
  }, [salud, mascotas]);
  const cliente = duenos.find((d) => d.id === duenoId);
  const sus = mascotas.filter((m) => m.duenoId === duenoId);
  if (!cliente && cargando) return <Centro><div style={{ color: T.muted }}>Cargando…</div></Centro>;
  if (!cliente) return <Centro><img src={logo} alt="" style={{ height: 70 }} /><p style={{ color: T.muted, marginTop: 16 }}>Enlace no válido.</p></Centro>;
  const movsCliente = movs.filter((m) => sus.find((x) => x.id === m.mascotaId));
  const mesesDisp = (() => { const s = new Set(movsCliente.map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); })();
  const grupos = sus.map((m) => { const mm = movs.filter((x) => x.mascotaId === m.id && mesDe(x.fecha) === mes); return { mascota: m, cargos: mm.filter(esCargo), abonos: mm.filter(esAbono) }; }).filter((g) => g.cargos.length || g.abonos.length);
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
      <header style={{ background: "linear-gradient(180deg, rgba(46,38,29,.96), rgba(36,29,22,.92))", borderBottom: `1px solid ${T.line}` }}><div className="adolf-header" style={{ maxWidth: 760, margin: "0 auto", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}><img src={logo} alt="" style={{ height: 40 }} /><div><div style={{ fontFamily: display, fontSize: 28, fontWeight: 700, letterSpacing: 3, color: T.cream, lineHeight: .9 }}>ADOLF</div><div style={{ fontSize: 10, color: T.rust, fontWeight: 600 }}>{TAGLINE}</div></div><div style={{ marginLeft: "auto" }}><Campana notis={noti.notis} noLeidas={noti.noLeidas} marcarLeidas={noti.marcarLeidas} /></div></div></header>
      <main className="adolf-main" style={{ maxWidth: 760, margin: "0 auto", padding: "22px 18px 80px" }}>
        <BannerInstalar />
        <Row between style={{ flexWrap: "wrap", gap: 10 }}><div><div style={{ fontSize: 14, color: T.muted }}>Hola,</div><H1>{cliente.nombre}</H1></div><Row style={{ gap: 8, flexWrap: "wrap" }}><button onClick={() => setSolicitar(true)} style={btnGhost} disabled={sus.length === 0}>📅 Solicitar cita</button><select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto" }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select><button onClick={() => setFactura(true)} style={btnPrim} disabled={grupos.length === 0}>🧾 Ver factura del mes</button></Row></Row>
        <p style={{ color: T.muted, fontSize: 13, marginTop: 6 }}>Información de tus mascotas y servicios prestados. Solo consulta.</p>

        {(() => {
          const misCitas = citas.filter((c) => sus.find((m) => m.id === c.mascotaId) && c.fecha >= hoy() && (c.estado || "agendado") !== "completado").sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
          const estadoCli = (e) => e === "solicitado" ? "Pendiente de confirmar" : e === "agendado" ? "Confirmada" : e === "en_curso" ? "En curso" : e === "rechazado" ? "No disponible" : "Completada";
          const colorCli = (e) => e === "agendado" ? T.ok : e === "en_curso" ? T.info : e === "rechazado" ? T.danger : T.pend;
          if (misCitas.length === 0) return null;
          return (
            <Card style={{ marginTop: 16 }}>
              <H2>📅 Mis próximas citas</H2>
              {misCitas.map((c, i) => { const inf = servInfo(c.tipoServicio); const m = mascotas.find((x) => x.id === c.mascotaId) || {}; const est = c.estado || "agendado"; return (
                <Row key={c.id} between style={{ padding: "10px 0", borderBottom: i < misCitas.length - 1 ? `1px solid ${T.line}` : "none", gap: 8, flexWrap: "wrap", opacity: est === "rechazado" ? .7 : 1 }}>
                  <div style={{ fontSize: 13.5 }}>{inf.icon} {m.nombre} · {inf.nombre}<div style={{ fontSize: 11.5, color: T.muted }}>{c.fecha} {c.hora}</div></div>
                  <Row style={{ gap: 8 }}>
                    <span style={{ ...badge, background: T.surface2, color: colorCli(est), borderColor: colorCli(est) }}>{estadoCli(est)}</span>
                    {(est === "solicitado" || est === "rechazado") && <button onClick={async () => { if (confirm(est === "solicitado" ? "¿Cancelar esta solicitud?" : "¿Quitar de la lista?")) await deleteDoc(doc(db, "citas", c.id)); }} style={xBtn}>✕</button>}
                  </Row>
                </Row>
              ); })}
            </Card>
          );
        })()}

        {(() => {
          const av = salud.filter((s) => s.proxima && diasEntre(s.proxima) <= 30 && sus.find((m) => m.id === s.mascotaId)).map((s) => ({ ...s, mascota: mascotas.find((m) => m.id === s.mascotaId), dias: diasEntre(s.proxima) })).sort((a, b) => a.dias - b.dias);
          if (!av.length) return null;
          return (
            <Card style={{ marginTop: 16, borderColor: T.pend }}>
              <H2>💉 Vacunas por revisar</H2>
              {av.map((a, i) => (
                <Row key={a.id} between style={{ padding: "8px 0", borderBottom: i < av.length - 1 ? `1px solid ${T.line}` : "none" }}>
                  <span style={{ fontSize: 13.5 }}>{a.mascota ? a.mascota.nombre : ""} · {a.titulo}</span>
                  <b style={{ color: a.dias < 0 ? T.danger : T.pend, fontSize: 12.5 }}>{a.dias < 0 ? `vencida hace ${Math.abs(a.dias)} d` : a.dias === 0 ? "es hoy" : `en ${a.dias} d`}</b>
                </Row>
              ))}
            </Card>
          );
        })()}

        {sus.length === 0 ? <Card style={{ marginTop: 18, textAlign: "center", padding: 36 }}><div style={{ fontSize: 34 }}>🐾</div><p style={{ color: T.muted, marginTop: 8 }}>Aún no hay mascotas registradas.</p></Card>
          : sus.map((m) => { const mm = movs.filter((x) => x.mascotaId === m.id && mesDe(x.fecha) === mes); const t = totales(mm); const tarifas = servicios.filter((s) => s.mascotaId === m.id); const vac = salud.filter((s) => s.mascotaId === m.id && s.proxima); return (
            <Card key={m.id} style={{ marginTop: 16 }}>
              <Row style={{ gap: 12 }}><Avatar mascota={m} big onClick={fotosDe(m)[0] ? () => setZoom(fotosDe(m)[0]) : null} /><div><div style={{ fontSize: 19, fontWeight: 700, color: T.cream }}>{m.nombre}</div><div style={{ fontSize: 12.5, color: T.muted }}>{emojiMascota(m.tipo)} {m.raza || "—"} · {m.color || "—"} · {m.edad || "—"}</div></div></Row>
              <Galeria titulo="Fotos" imgs={fotosDe(m)} onZoom={setZoom} h={66} />
              <Galeria titulo="Carnet de vacunas" imgs={carnetsDe(m)} onZoom={setZoom} h={66} />
              {vac.length > 0 && <div style={{ marginTop: 10, fontSize: 12, color: T.muted }}>Próximas: {vac.map((v) => `${v.titulo} (${v.proxima})`).join(" · ")}</div>}
              {tarifas.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>{tarifas.map((s) => { const i = servInfo(s.tipo); return <Pill key={s.id}>{i.icon} {i.nombre}: {money(s.valor)}{s.modalidad === "mensual" ? "/mes" : "/" + (s.unidad || i.unidad)}</Pill>; })}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}><MiniStat label="Facturado" value={money(t.facturado)} color={T.tan} /><MiniStat label="Cobrado" value={money(t.cobrado)} color={T.ok} /><MiniStat label={t.saldo >= 0 ? "Pendiente" : "A favor"} value={money(Math.abs(t.saldo))} color={t.saldo > 0 ? T.pend : T.ok} /></div>
              <div style={{ marginTop: 12 }}>{mm.length === 0 ? <Empty texto="Sin servicios este mes." /> : <AcordeonMovs movs={mm} readOnly />}</div>
            </Card>); })}
        <div style={{ textAlign: "center", fontFamily: display, fontWeight: 800, letterSpacing: 3, color: T.cream, fontSize: 22, marginTop: 28 }}>ADOLF</div>
      </main>
      {factura && <Factura cliente={cliente} grupos={grupos} mes={mes} onClose={() => setFactura(false)} />}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
      {solicitar && <FormSolicitudCita mascotas={sus} citas={citas} bloqueos={bloqueos} onClose={() => setSolicitar(false)} />}
      {noti.toast && <Toast noti={noti.toast} onClose={noti.cerrarToast} />}
    </div>
  );
}
const Centro = ({ children }) => <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>{children}</div>;
const MiniStat = ({ label, value, color }) => <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 11, padding: "9px 10px", textAlign: "center" }}><div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div><div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 2 }}>{value}</div></div>;

/* ====================== SOLICITUD DE CITA (cliente) ====================== */
function FormSolicitudCita({ mascotas, citas, bloqueos = [], onClose }) {
  const opciones = SERVICIOS.filter((s) => TIPOS_CLIENTE.includes(s.id));
  const [mascotaId, setMascotaId] = useState(mascotas[0]?.id || "");
  const [tipoServicio, setTipo] = useState(opciones[0]?.id || "paseo");
  const [fecha, setFecha] = useState(hoy());
  const [hora, setHora] = useState("");
  const [nota, setNota] = useState("");
  const [g, setG] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    if (!mascotaId) return alert("Selecciona una mascota.");
    if (!hora) return alert("Selecciona una hora disponible.");
    setG(true);
    try { await addDoc(collection(db, "citas"), { mascotaId, tipoServicio, fecha, hora, nota: nota.trim(), estado: "solicitado", facturado: false, origen: "cliente", createdAt: Date.now() }); setEnviado(true); }
    catch (e) { alert("Error: " + e.message); setG(false); }
  };

  if (enviado) return (
    <Modal title="Solicitud enviada" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "8px 0" }}><div style={{ fontSize: 44 }}>✅</div>
        <p style={{ color: T.text, marginTop: 12, fontSize: 14 }}>Tu solicitud quedó registrada. Te <b>confirmaremos la disponibilidad</b> lo antes posible. Puedes ver su estado en “Mis próximas citas”.</p>
        <button onClick={onClose} style={{ ...btnPrim, marginTop: 18 }}>Entendido</button></div>
    </Modal>
  );

  const sinHoras = diaBloqueado(fecha, bloqueos);
  return (
    <Modal title="Solicitar una cita" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>Elige el servicio y el horario disponible. Tu solicitud será revisada y te confirmaremos.</p>
      <Label>Mascota</Label>
      <select value={mascotaId} onChange={(e) => setMascotaId(e.target.value)} style={inp}>{mascotas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
      <div style={{ height: 12 }} /><Label>Servicio</Label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{opciones.map((s) => <button key={s.id} onClick={() => { setTipo(s.id); setHora(""); }} style={{ ...chip, ...(tipoServicio === s.id ? chipOn : {}), flex: 1 }}>{s.icon} {s.nombre.replace(" por horas", "").replace(" por noches", "")}</button>)}</div>
      <div style={{ height: 12 }} /><Label>Fecha</Label>
      <PickerDia fecha={fecha} setFecha={(f) => { setFecha(f); setHora(""); }} bloqueos={bloqueos} />
      <div style={{ height: 8 }} /><Label>Hora disponible</Label>
      {sinHoras ? <div style={{ background: T.pendBg, border: `1px solid ${T.pend}`, color: T.pend, borderRadius: 10, padding: "10px 12px", fontSize: 12.5 }}>Ese día no está disponible. Elige otra fecha.</div>
        : <PickerHora fecha={fecha} hora={hora} setHora={setHora} citas={citas} bloqueos={bloqueos} tipoServicio={tipoServicio} />}
      <div style={{ height: 12 }} /><Label>Nota (opcional)</Label><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej. recoger en casa" style={inp} />
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={enviar} disabled={g || !hora} style={{ ...btnPrim, flex: 1 }}>{g ? "Enviando…" : "Enviar solicitud"}</button></Row>
    </Modal>
  );
}

/* ====================== LIGHTBOX ====================== */
function Lightbox({ src, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,6,4,.88)", backdropFilter: "blur(4px)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out", animation: "pop .2s ease" }}>
      <img src={src} alt="" style={{ maxWidth: "94vw", maxHeight: "90vh", borderRadius: 14, border: `2px solid ${T.line2}`, boxShadow: "0 20px 60px rgba(0,0,0,.6)" }} />
      <button onClick={onClose} style={{ position: "fixed", top: 18, right: 20, background: "rgba(0,0,0,.4)", border: "none", color: "#fff", fontSize: 22, width: 40, height: 40, borderRadius: 999, cursor: "pointer" }}>✕</button>
    </div>
  );
}

/* ====================== UI ====================== */
function Galeria({ titulo, imgs, onZoom, h = 74 }) {
  if (!imgs || !imgs.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <Label>{titulo}</Label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        {imgs.map((src, i) => <img key={i} src={src} alt="" onClick={() => onZoom(src)} style={{ height: h, width: h, borderRadius: 10, border: `1px solid ${T.line2}`, cursor: "zoom-in", objectFit: "cover" }} />)}
      </div>
    </div>
  );
}
function Avatar({ mascota, big, onClick }) {
  const sz = big ? 50 : 38; const clickable = !!onClick;
  const portada = fotosDe(mascota)[0];
  if (portada) return <img src={portada} alt="" onClick={onClick || undefined} style={{ width: sz, height: sz, borderRadius: 13, objectFit: "cover", border: `1px solid ${T.line2}`, flexShrink: 0, cursor: clickable ? "zoom-in" : "default" }} />;
  return <div onClick={onClick || undefined} style={{ width: sz, height: sz, borderRadius: 13, background: T.surface2, border: `1px solid ${T.line2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: big ? 26 : 19, flexShrink: 0, cursor: clickable ? "pointer" : "default" }}>{emojiMascota(mascota && mascota.tipo)}</div>;
}
function Stat({ label, value, accent, sub }) {
  return (<div style={{ ...cardBase, padding: 16, position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: accent, opacity: .8 }} /><div style={{ fontSize: 11.5, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div><div style={{ fontSize: 27, fontWeight: 800, color: accent, marginTop: 5, fontVariantNumeric: "tabular-nums" }}>{value}</div>{sub && <div style={{ fontSize: 11.5, color: T.dim, marginTop: 1 }}>{sub}</div>}</div>);
}
function Info({ label, value, link }) {
  return (<div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 12px" }}><div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase", letterSpacing: .6 }}>{label}</div>{link ? <a className="seleccionable" href={link} style={{ color: T.rustSoft, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>{value || "—"}</a> : <div className="seleccionable" style={{ color: T.text, fontWeight: 600, fontSize: 13.5 }}>{value || "—"}</div>}</div>);
}
function Modal({ title, children, onClose }) {
  return (<div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(12,9,6,.72)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", zIndex: 50, overflowY: "auto" }}><div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 18, padding: 22, animation: "pop .25s ease", boxShadow: "0 20px 60px rgba(0,0,0,.45)" }}><Row between style={{ marginBottom: 16 }}><h3 style={{ fontFamily: display, fontSize: 23, fontWeight: 700, color: T.cream, letterSpacing: .5 }}>{title}</h3><button onClick={onClose} style={xBtn}>✕</button></Row>{children}</div></div>);
}
function Campo({ label, value, onChange, ph }) { return <div><Label>{label}</Label><input value={value} onChange={onChange} placeholder={ph} style={inp} /></div>; }
const Label = ({ children }) => <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, marginBottom: 5, letterSpacing: .3 }}>{children}</div>;
const H1 = ({ children }) => <h1 style={{ fontFamily: display, fontSize: 30, fontWeight: 700, color: T.cream, letterSpacing: .5 }}>{children}</h1>;
const H2 = ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 700, color: T.cream }}>{children}</h2>;
const Card = ({ children, style }) => <div style={{ ...cardBase, ...style }}>{children}</div>;
const Empty = ({ texto }) => <p style={{ color: T.dim, fontSize: 13, padding: "18px 0", textAlign: "center" }}>{texto}</p>;
const Pill = ({ children }) => <span style={{ fontSize: 11.5, color: T.muted, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "3px 9px" }}>{children}</span>;
const Grid2 = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>;
function Row({ children, between, style, ...rest }) { return <div style={{ display: "flex", alignItems: "center", justifyContent: between ? "space-between" : "flex-start", ...style }} {...rest}>{children}</div>; }

/* ====================== ESTILOS ====================== */
const cardBase = { background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, boxShadow: T.shadow };
const inp = { width: "100%", background: T.surface2, border: `1px solid ${T.line2}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 14 };
const btnPrim = { background: `linear-gradient(180deg,${T.rustSoft},${T.rust})`, color: "#241405", border: "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", boxShadow: "0 2px 8px rgba(210,119,47,.25)" };
const btnGhost = { background: "transparent", color: T.text, border: `1px solid ${T.line2}`, borderRadius: 11, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const btnSmall = { ...btnPrim, padding: "7px 12px", fontSize: 12.5 };
const chip = { background: T.surface2, color: T.muted, border: `1px solid ${T.line2}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const chipOn = { background: "#4a2f17", borderColor: T.rust, color: T.rustSoft };
const tab = (on) => ({ background: on ? T.rust : "transparent", color: on ? "#241405" : T.muted, border: "none", borderRadius: 9, padding: "7px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer" });
const badge = { fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px", border: "1px solid" };
const xBtn = { background: "transparent", border: "none", color: T.dim, fontSize: 15, cursor: "pointer", padding: 4, lineHeight: 1 };

import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import logo from "./assets/logo.svg";

/* ====================== TEMA / COLORES ====================== */
const T = {
  bg: "#241d16", surface: "#2e261d", surface2: "#382f24", card: "#2b231b",
  line: "#3d3327", line2: "#4a3d2e",
  rust: "#d2772f", rustSoft: "#e0934f", tan: "#e3ad70",
  cream: "#f4ede3", text: "#efe7da", muted: "#b3a796", dim: "#8a7d6c",
  ok: "#74c47d", okBg: "#27361f", pend: "#e8b24a", pendBg: "#352c14",
  danger: "#e0735a",
  shadow: "0 2px 10px rgba(0,0,0,.28)",
};
const display = "'Barlow Condensed', system-ui, sans-serif";
const TAGLINE = "🐾 Bienestar y mantenimiento para tu mascota";

/* ====================== LOGIN (usuario unico) ====================== */
const USUARIO = "YELIANNY";
const CLAVE   = "Nocopeo2626";

/* ====================== CATALOGO DE SERVICIOS ====================== */
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
const hoy = () => new Date().toISOString().slice(0, 10);
const mesActual = () => new Date().toISOString().slice(0, 7);
const mesDe = (fecha) => (fecha || "").slice(0, 7);
const emojiMascota = (tipo) => (tipo === "gato" ? "🐈" : "🐕");
const nombreMes = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${meses[Number(m) - 1]} ${y}`;
};
const esAbono = (m) => m.kind === "abono";
const esCargo = (m) => m.kind !== "abono";

function comprimirImagen(file, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const max = 400;
      let { width, height } = img;
      if (width > height && width > max) { height = (height * max) / width; width = max; }
      else if (height >= width && height > max) { width = (width * max) / height; height = max; }
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      c.getContext("2d").drawImage(img, 0, 0, width, height);
      cb(c.toDataURL("image/jpeg", 0.8));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Datos del cliente de una mascota (con compatibilidad para registros antiguos)
const clienteDe = (mascota, duenos) =>
  duenos.find((d) => d.id === mascota.duenoId) ||
  { nombre: mascota.dueno || "—", telefono: mascota.telefono || "", email: mascota.email || "" };

/* ====================== CSS GLOBAL (desactiva el cursor de texto) ====================== */
function GlobalCSS() {
  return (
    <style>{`
      * { -webkit-user-select: none; -ms-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
      input, textarea, select, [contenteditable="true"], .seleccionable { -webkit-user-select: text; -ms-user-select: text; user-select: text; }
      input, select, textarea { color-scheme: dark; }
      select option { background: ${T.surface}; color: ${T.text}; }
      button { -webkit-user-select: none; user-select: none; }
    `}</style>
  );
}

/* ====================== APP (router admin / cliente) ====================== */
export default function App() {
  const clienteId = new URLSearchParams(window.location.search).get("cliente");
  const [logged, setLogged] = useState(() => localStorage.getItem("adolf_auth") === "1");

  if (clienteId) return <><GlobalCSS /><VistaCliente duenoId={clienteId} /></>;
  if (!logged) return <><GlobalCSS /><Login onOk={() => setLogged(true)} /></>;
  return <><GlobalCSS /><Panel onLogout={() => { localStorage.removeItem("adolf_auth"); setLogged(false); }} /></>;
}

/* ====================== LOGIN ====================== */
function Login({ onOk }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const enviar = () => {
    if (u.trim().toUpperCase() === USUARIO && p === CLAVE) { localStorage.setItem("adolf_auth", "1"); onOk(); }
    else setErr("Usuario o contraseña incorrectos.");
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(1200px 600px at 50% -10%, #36291d 0%, ${T.bg} 60%)`, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, animation: "pop .4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <img src={logo} alt="" style={{ height: 96, width: "auto" }} />
          <div style={{ fontFamily: display, fontSize: 52, fontWeight: 700, letterSpacing: 6, color: T.cream, lineHeight: 1, marginTop: 6 }}>ADOLF</div>
          <div style={{ color: T.rust, fontSize: 11.5, letterSpacing: 1, marginTop: 6, fontWeight: 600 }}>{TAGLINE}</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18, padding: 22, boxShadow: T.shadow }}>
          <Label>Usuario</Label>
          <input value={u} onChange={(e) => setU(e.target.value)} placeholder="Yelianny" style={inp} onKeyDown={(e) => e.key === "Enter" && enviar()} />
          <div style={{ height: 14 }} />
          <Label>Contraseña</Label>
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" style={inp} onKeyDown={(e) => e.key === "Enter" && enviar()} />
          {err && <div style={{ color: T.danger, fontSize: 12.5, marginTop: 12 }}>{err}</div>}
          <button onClick={enviar} style={{ ...btnPrim, width: "100%", marginTop: 18, padding: "13px" }}>Entrar</button>
        </div>
        <div style={{ textAlign: "center", color: T.dim, fontSize: 11, marginTop: 16 }}>Acceso exclusivo</div>
      </div>
    </div>
  );
}

/* ====================== HOOK: datos en tiempo real ====================== */
function useDatos() {
  const [duenos, setDuenos] = useState([]);
  const [mascotas, setMascotas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [movs, setMovs] = useState([]);
  useEffect(() => {
    const u0 = onSnapshot(query(collection(db, "duenos"), orderBy("nombre")), (s) => setDuenos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u1 = onSnapshot(query(collection(db, "mascotas"), orderBy("nombre")), (s) => setMascotas(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "servicios"), (s) => setServicios(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "movimientos"), (s) => setMovs(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u0(); u1(); u2(); u3(); };
  }, []);
  return { duenos, mascotas, servicios, movs };
}

/* ====================== PANEL PRINCIPAL (admin) ====================== */
function Panel({ onLogout }) {
  const { duenos, mascotas, servicios, movs } = useDatos();
  const [vista, setVista] = useState("resumen");
  const [clienteSel, setClienteSel] = useState(null);
  const [mascotaSel, setMascotaSel] = useState(null);

  const cliente = duenos.find((d) => d.id === clienteSel);
  const mascota = mascotas.find((m) => m.id === mascotaSel);

  const reset = (v) => { setVista(v); setClienteSel(null); setMascotaSel(null); };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "linear-gradient(180deg, rgba(46,38,29,.96), rgba(36,29,22,.92))", backdropFilter: "blur(8px)", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "11px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logo} alt="" style={{ height: 38, width: "auto", cursor: "pointer" }} onClick={() => reset("resumen")} />
          <div style={{ cursor: "pointer" }} onClick={() => reset("resumen")}>
            <div style={{ fontFamily: display, fontSize: 27, fontWeight: 700, letterSpacing: 3, color: T.cream, lineHeight: .9 }}>ADOLF</div>
            <div style={{ fontSize: 9.5, color: T.rust, letterSpacing: 2.5, textTransform: "uppercase" }}>Gestión de servicios</div>
          </div>
          <nav style={{ marginLeft: "auto", display: "flex", gap: 4, background: T.surface, borderRadius: 12, padding: 4, border: `1px solid ${T.line}` }}>
            {[["resumen","Resumen"],["clientes","Clientes"],["servicios","Servicios"]].map(([k, l]) => (
              <button key={k} onClick={() => reset(k)} style={tab(vista === k && !clienteSel && !mascotaSel)}>{l}</button>
            ))}
          </nav>
          <button onClick={onLogout} title="Salir" style={{ ...btnGhost, padding: "8px 12px" }}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 18px 80px" }}>
        {mascota ? (
          <MascotaDetalle mascota={mascota} duenos={duenos} servicios={servicios} movs={movs} onBack={() => setMascotaSel(null)} />
        ) : cliente ? (
          <ClienteDetalle cliente={cliente} mascotas={mascotas} servicios={servicios} movs={movs} duenos={duenos}
            abrirMascota={(id) => setMascotaSel(id)} onBack={() => setClienteSel(null)} />
        ) : vista === "resumen" ? (
          <Resumen mascotas={mascotas} movs={movs} duenos={duenos} irMascota={(id) => setMascotaSel(id)} />
        ) : vista === "clientes" ? (
          <Clientes duenos={duenos} mascotas={mascotas} abrir={(id) => setClienteSel(id)} abrirMascota={(id) => setMascotaSel(id)} />
        ) : (
          <Servicios mascotas={mascotas} servicios={servicios} movs={movs} />
        )}
      </main>
    </div>
  );
}

/* ====================== RESUMEN ====================== */
function Resumen({ mascotas, movs, duenos, irMascota }) {
  const [mes, setMes] = useState(mesActual());
  const mesesDisp = useMemo(() => { const s = new Set(movs.map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); }, [movs]);

  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  const cargos = delMes.filter(esCargo);
  const abonos = delMes.filter(esAbono);
  const facturado = cargos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const abonado = abonos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const saldo = facturado - abonado;

  const porTipo = SERVICIOS.map((s) => { const it = cargos.filter((m) => m.tipoServicio === s.id); return { ...s, total: it.reduce((a, m) => a + Number(m.monto || 0), 0), n: it.length }; }).filter((x) => x.n > 0).sort((a, b) => b.total - a.total);
  const ranking = mascotas.map((mc) => { const it = cargos.filter((m) => m.mascotaId === mc.id); return { ...mc, total: it.reduce((a, m) => a + Number(m.monto || 0), 0), n: it.length }; }).filter((x) => x.n > 0).sort((a, b) => b.total - a.total);

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between><H1>Resumen del mes</H1>
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto", padding: "9px 12px" }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select>
      </Row>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 16 }}>
        <Stat label="Facturado" value={money(facturado)} accent={T.tan} sub={`${cargos.length} servicios`} />
        <Stat label="Abonado" value={money(abonado)} accent={T.ok} sub={`${abonos.length} abonos`} />
        <Stat label={saldo >= 0 ? "Saldo pendiente" : "Saldo a favor"} value={money(Math.abs(saldo))} accent={saldo > 0 ? T.pend : T.ok} sub="facturado − abonado" />
        <Stat label="Clientes" value={duenos.length} accent={T.rust} sub={`${mascotas.length} mascotas`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 22 }}>
        <Card>
          <H2>Ingresos por servicio</H2>
          {porTipo.length === 0 ? <Empty texto="Sin servicios este mes." /> : porTipo.map((t) => {
            const pct = facturado ? Math.round((t.total / facturado) * 100) : 0;
            return (<div key={t.id} style={{ marginTop: 12 }}>
              <Row between><span style={{ fontSize: 13.5 }}>{t.icon} {t.nombre} <span style={{ color: T.dim }}>· {t.n}</span></span><b style={{ fontVariantNumeric: "tabular-nums" }}>{money(t.total)}</b></Row>
              <div style={{ height: 7, background: T.surface2, borderRadius: 6, marginTop: 6, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: `linear-gradient(90deg,${T.rust},${T.tan})`, borderRadius: 6 }} /></div>
            </div>);
          })}
        </Card>
        <Card>
          <H2>Cuánto genera cada mascota</H2>
          {ranking.length === 0 ? <Empty texto="Sin servicios este mes." /> : ranking.map((m, i) => (
            <Row key={m.id} between style={{ padding: "10px 0", borderBottom: i < ranking.length - 1 ? `1px solid ${T.line}` : "none", cursor: "pointer" }} onClick={() => irMascota(m.id)}>
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar mascota={m} /><span><b style={{ fontSize: 14 }}>{m.nombre}</b><div style={{ fontSize: 11.5, color: T.muted }}>{m.raza} · {m.n} serv.</div></span></span>
              <b style={{ fontVariantNumeric: "tabular-nums", color: T.tan }}>{money(m.total)}</b>
            </Row>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ====================== CLIENTES (lista de dueños) ====================== */
function Clientes({ duenos, mascotas, abrir, abrirMascota }) {
  const [buscar, setBuscar] = useState("");
  const [form, setForm] = useState(null);

  const lista = duenos.filter((d) => { const q = buscar.toLowerCase(); return !q || [d.nombre, d.telefono, d.email].some((v) => (v || "").toLowerCase().includes(q)); });
  const sinCliente = mascotas.filter((m) => !m.duenoId || !duenos.find((d) => d.id === m.duenoId));

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between><H1>Clientes</H1><button onClick={() => setForm({})} style={btnPrim}>+ Nuevo cliente</button></Row>
      <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar cliente por nombre, teléfono o correo…" style={{ ...inp, marginTop: 16 }} />

      {lista.length === 0 ? (
        <Card style={{ marginTop: 16, textAlign: "center", padding: 40 }}><div style={{ fontSize: 38 }}>👤</div><p style={{ color: T.muted, marginTop: 8 }}>No hay clientes todavía. Crea un cliente y luego agrégale sus mascotas.</p></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginTop: 18 }}>
          {lista.map((d) => {
            const sus = mascotas.filter((m) => m.duenoId === d.id);
            return (
              <div key={d.id} onClick={() => abrir(d.id)} style={{ ...cardBase, cursor: "pointer", transition: "transform .12s, border-color .12s" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = T.rust; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = T.line; }}>
                <Row style={{ gap: 11 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: `linear-gradient(135deg,${T.rust},${T.tan})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#241405", flexShrink: 0 }}>{(d.nombre || "?").charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 17, fontWeight: 700, color: T.cream }}>{d.nombre}</div><div style={{ fontSize: 12, color: T.muted }}>{d.telefono || "sin teléfono"}</div></div>
                </Row>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  {sus.length === 0 ? <Pill>Sin mascotas</Pill> : sus.slice(0, 4).map((m) => <Pill key={m.id}>{emojiMascota(m.tipo)} {m.nombre}</Pill>)}
                  {sus.length > 4 && <Pill>+{sus.length - 4}</Pill>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sinCliente.length > 0 && (
        <Card style={{ marginTop: 22, borderColor: T.pend }}>
          <H2>Mascotas sin cliente asignado</H2>
          <p style={{ fontSize: 12.5, color: T.muted, margin: "4px 0 12px" }}>Estas mascotas son de versiones anteriores. Ábrelas y asígnales un cliente con el botón “Editar”.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sinCliente.map((m) => <button key={m.id} onClick={() => abrirMascota(m.id)} style={{ ...chip }}>{emojiMascota(m.tipo)} {m.nombre} ›</button>)}
          </div>
        </Card>
      )}

      {form && <FormDueno inicial={form} onClose={() => setForm(null)} />}
    </div>
  );
}

/* ====================== FORM DUEÑO ====================== */
function FormDueno({ inicial, onClose }) {
  const editando = !!inicial.id;
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", ...inicial });
  const [g, setG] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async () => {
    if (!f.nombre.trim()) return alert("El nombre del cliente es obligatorio.");
    setG(true);
    const data = { nombre: f.nombre.trim(), telefono: f.telefono.trim(), email: f.email.trim() };
    try {
      if (editando) await updateDoc(doc(db, "duenos", f.id), data);
      else await addDoc(collection(db, "duenos"), { ...data, createdAt: Date.now() });
      onClose();
    } catch (e) { alert("Error: " + e.message); setG(false); }
  };
  return (
    <Modal title={editando ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <Campo label="Nombre del cliente *" value={f.nombre} onChange={set("nombre")} />
      <div style={{ height: 10 }} />
      <Grid2>
        <Campo label="Teléfono" value={f.telefono} onChange={set("telefono")} ph="ej. 573001234567" />
        <Campo label="Correo electrónico" value={f.email} onChange={set("email")} />
      </Grid2>
      <Row style={{ gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Guardar"}</button>
      </Row>
    </Modal>
  );
}

/* ====================== DETALLE CLIENTE ====================== */
function ClienteDetalle({ cliente, mascotas, servicios, movs, duenos, abrirMascota, onBack }) {
  const [editar, setEditar] = useState(false);
  const [formMascota, setFormMascota] = useState(null);
  const [compartir, setCompartir] = useState(false);

  const sus = mascotas.filter((m) => m.duenoId === cliente.id);
  const facturadoMes = movs.filter((m) => esCargo(m) && mesDe(m.fecha) === mesActual() && sus.find((x) => x.id === m.mascotaId)).reduce((a, m) => a + Number(m.monto || 0), 0);

  const borrar = async () => {
    if (sus.length) return alert("Este cliente tiene mascotas. Elimina o reasigna sus mascotas primero.");
    if (!confirm(`¿Eliminar al cliente ${cliente.nombre}?`)) return;
    await deleteDoc(doc(db, "duenos", cliente.id)); onBack();
  };

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <button onClick={onBack} style={{ ...btnGhost, marginBottom: 14 }}>← Clientes</button>
      <Card>
        <Row between style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <Row style={{ gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 15, background: `linear-gradient(135deg,${T.rust},${T.tan})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#241405", flexShrink: 0 }}>{(cliente.nombre || "?").charAt(0).toUpperCase()}</div>
            <div><div style={{ fontSize: 26, fontWeight: 800, color: T.cream, fontFamily: display, letterSpacing: .5 }}>{cliente.nombre}</div>
              <div style={{ color: T.muted, fontSize: 13.5 }}>{sus.length} mascota{sus.length !== 1 ? "s" : ""} · facturado este mes {money(facturadoMes)}</div></div>
          </Row>
          <Row style={{ gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setCompartir(true)} style={btnPrim}>🔗 Compartir con el cliente</button>
            <button onClick={() => setEditar(true)} style={btnGhost}>Editar</button>
            <button onClick={borrar} style={{ ...btnGhost, color: T.danger, borderColor: "#4a2a22" }}>Eliminar</button>
          </Row>
        </Row>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 16 }}>
          <Info label="Teléfono" value={cliente.telefono} link={cliente.telefono ? `tel:${cliente.telefono}` : null} />
          <Info label="Correo" value={cliente.email} link={cliente.email ? `mailto:${cliente.email}` : null} />
        </div>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Row between><H2>Mascotas de {cliente.nombre}</H2><button onClick={() => setFormMascota({ duenoId: cliente.id })} style={btnSmall}>+ Nueva mascota</button></Row>
        {sus.length === 0 ? <Empty texto="Este cliente no tiene mascotas. Agrega la primera." />
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12, marginTop: 12 }}>
              {sus.map((m) => {
                const nServ = servicios.filter((s) => s.mascotaId === m.id).length;
                return (
                  <div key={m.id} onClick={() => abrirMascota(m.id)} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 13, padding: 13, cursor: "pointer", transition: "border-color .12s" }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = T.rust} onMouseLeave={(e) => e.currentTarget.style.borderColor = T.line}>
                    <Row style={{ gap: 11 }}><Avatar mascota={m} big /><div><div style={{ fontSize: 16, fontWeight: 700, color: T.cream }}>{m.nombre}</div><div style={{ fontSize: 12, color: T.muted }}>{m.raza || "—"} · {nServ} serv.</div></div></Row>
                  </div>
                );
              })}
            </div>}
      </Card>

      {editar && <FormDueno inicial={cliente} onClose={() => setEditar(false)} />}
      {formMascota && <FormMascota inicial={formMascota} duenos={duenos} onClose={() => setFormMascota(null)} />}
      {compartir && <CompartirCliente cliente={cliente} onClose={() => setCompartir(false)} />}
    </div>
  );
}

/* ====================== COMPARTIR CON CLIENTE (link) ====================== */
function CompartirCliente({ cliente, onClose }) {
  const link = `${window.location.origin}${window.location.pathname}?cliente=${cliente.id}`;
  const [copiado, setCopiado] = useState(false);
  const tel = (cliente.telefono || "").replace(/\D/g, "");

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { prompt("Copia este enlace:", link); }
  };
  const whatsapp = () => {
    const texto = `Hola ${cliente.nombre} 🐾 Aquí puedes ver la información y los servicios de tus mascotas en ADOLF:\n${link}`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, "_blank");
  };

  return (
    <Modal title="Compartir con el cliente" onClose={onClose}>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 14 }}>Este enlace le permite a <b style={{ color: T.text }}>{cliente.nombre}</b> ver sus mascotas y los servicios prestados, solo para consulta (no puede modificar nada).</p>
      <Label>Enlace del cliente</Label>
      <input className="seleccionable" readOnly value={link} onFocus={(e) => e.target.select()} style={{ ...inp, fontSize: 12.5 }} />
      <Row style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={copiar} style={{ ...btnGhost, flex: 1, minWidth: 130 }}>{copiado ? "✓ Copiado" : "📋 Copiar enlace"}</button>
        <button onClick={whatsapp} disabled={!tel} title={!tel ? "El cliente no tiene teléfono" : ""} style={{ ...btnPrim, flex: 1, minWidth: 130, background: tel ? "linear-gradient(180deg,#3ed47e,#1faa5a)" : T.surface2, color: tel ? "#0e2412" : T.dim }}>💬 Enviar por WhatsApp</button>
      </Row>
    </Modal>
  );
}

/* ====================== FORM MASCOTA (con foto + cliente) ====================== */
function FormMascota({ inicial, duenos, onClose }) {
  const editando = !!inicial.id;
  const [f, setF] = useState({ tipo: "perro", nombre: "", raza: "", color: "", edad: "", duenoId: "", foto: "", ...inicial });
  const [g, setG] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const elegirFoto = (e) => { const file = e.target.files[0]; if (file) comprimirImagen(file, (d) => setF((p) => ({ ...p, foto: d }))); };

  const guardar = async () => {
    if (!f.nombre.trim()) return alert("El nombre es obligatorio.");
    if (!f.duenoId) return alert("Selecciona el cliente (dueño) de la mascota.");
    setG(true);
    const data = { tipo: f.tipo, nombre: f.nombre.trim(), raza: f.raza.trim(), color: f.color.trim(), edad: f.edad.trim(), duenoId: f.duenoId, foto: f.foto || "" };
    try {
      if (editando) await updateDoc(doc(db, "mascotas", f.id), data);
      else await addDoc(collection(db, "mascotas"), { ...data, createdAt: Date.now() });
      onClose();
    } catch (e) { alert("Error: " + e.message); setG(false); }
  };

  return (
    <Modal title={editando ? "Editar mascota" : "Nueva mascota"} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: 16, overflow: "hidden", background: T.surface2, border: `1px solid ${T.line2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>
          {f.foto ? <img src={f.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : emojiMascota(f.tipo)}
        </div>
        <div>
          <label style={{ ...btnGhost, display: "inline-block", cursor: "pointer" }}>{f.foto ? "Cambiar foto" : "Subir foto"}<input type="file" accept="image/*" onChange={elegirFoto} style={{ display: "none" }} /></label>
          {f.foto && <button onClick={() => setF({ ...f, foto: "" })} style={{ ...btnGhost, marginLeft: 8, color: T.danger, borderColor: "#4a2a22" }}>Quitar</button>}
        </div>
      </div>

      <Label>Cliente (dueño) *</Label>
      <select value={f.duenoId} onChange={set("duenoId")} style={{ ...inp, marginBottom: 12 }}>
        <option value="">Selecciona…</option>
        {duenos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
      </select>

      <Label>Tipo</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {[["perro","🐕 Perro"],["gato","🐈 Gato"]].map(([k, l]) => <button key={k} onClick={() => setF({ ...f, tipo: k })} style={{ ...chip, ...(f.tipo === k ? chipOn : {}), flex: 1 }}>{l}</button>)}
      </div>
      <Grid2>
        <Campo label="Nombre *" value={f.nombre} onChange={set("nombre")} />
        <Campo label="Raza" value={f.raza} onChange={set("raza")} />
        <Campo label="Color" value={f.color} onChange={set("color")} />
        <Campo label="Edad" value={f.edad} onChange={set("edad")} ph="ej. 3 años" />
      </Grid2>
      <Row style={{ gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Guardar"}</button>
      </Row>
    </Modal>
  );
}

/* ====================== DETALLE MASCOTA ====================== */
function MascotaDetalle({ mascota, duenos, servicios, movs, onBack }) {
  const [editar, setEditar] = useState(false);
  const [formServ, setFormServ] = useState(null);
  const [formMov, setFormMov] = useState(null);
  const [formAbono, setFormAbono] = useState(null);
  const [factura, setFactura] = useState(null);
  const [mes, setMes] = useState(mesActual());

  const cliente = clienteDe(mascota, duenos);
  const sus = servicios.filter((s) => s.mascotaId === mascota.id);
  const susMovs = movs.filter((m) => m.mascotaId === mascota.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const movsMes = susMovs.filter((m) => mesDe(m.fecha) === mes);
  const cargosMes = movsMes.filter(esCargo);
  const abonosMes = movsMes.filter(esAbono);
  const facturado = cargosMes.reduce((a, m) => a + Number(m.monto || 0), 0);
  const abonado = abonosMes.reduce((a, m) => a + Number(m.monto || 0), 0);
  const saldo = facturado - abonado;
  const mesesDisp = useMemo(() => { const s = new Set(susMovs.map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); }, [susMovs]);

  const borrar = async () => {
    if (!confirm(`¿Eliminar a ${mascota.nombre} y todos sus servicios y movimientos?`)) return;
    for (const s of sus) await deleteDoc(doc(db, "servicios", s.id));
    for (const m of susMovs) await deleteDoc(doc(db, "movimientos", m.id));
    await deleteDoc(doc(db, "mascotas", mascota.id)); onBack();
  };

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <button onClick={onBack} style={{ ...btnGhost, marginBottom: 14 }}>← Volver</button>
      <Card>
        <Row between style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <Row style={{ gap: 14 }}><Avatar mascota={mascota} big />
            <div><div style={{ fontSize: 26, fontWeight: 800, color: T.cream, fontFamily: display, letterSpacing: .5 }}>{mascota.nombre} {emojiMascota(mascota.tipo)}</div>
              <div style={{ color: T.muted, fontSize: 13.5 }}>{mascota.raza || "—"} · {mascota.color || "—"} · {mascota.edad || "—"}</div>
              <div style={{ color: T.rustSoft, fontSize: 13, marginTop: 2 }}>Cliente: {cliente.nombre}</div></div>
          </Row>
          <Row style={{ gap: 8 }}><button onClick={() => setEditar(true)} style={btnGhost}>Editar</button><button onClick={borrar} style={{ ...btnGhost, color: T.danger, borderColor: "#4a2a22" }}>Eliminar</button></Row>
        </Row>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginTop: 16 }}>
        <Card style={{ padding: 16 }}>
          <Row between><Label>Periodo</Label><select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto", padding: "5px 8px", fontSize: 12 }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select></Row>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.tan, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{money(facturado)}</div><div style={{ fontSize: 11.5, color: T.muted }}>facturado</div>
        </Card>
        <Stat label="Abonado" value={money(abonado)} accent={T.ok} sub={`${abonosMes.length} abonos`} />
        <Stat label={saldo >= 0 ? "Saldo pendiente" : "Saldo a favor"} value={money(Math.abs(saldo))} accent={saldo > 0 ? T.pend : T.ok} sub={saldo > 0 ? "por cobrar" : "al día"} />
      </div>

      <button onClick={() => setFactura(mes)} style={{ ...btnPrim, marginTop: 16 }}>🧾 Generar factura del periodo</button>

      <Card style={{ marginTop: 16 }}>
        <Row between><H2>Servicios y tarifas</H2><button onClick={() => setFormServ({})} style={btnSmall}>+ Agregar servicio</button></Row>
        {sus.length === 0 ? <Empty texto="Sin servicios. Agrega uno para definir tarifas." />
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10, marginTop: 12 }}>
              {sus.map((s) => { const inf = servInfo(s.tipo); return (
                <div key={s.id} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 13 }}>
                  <Row between><span style={{ fontWeight: 700, fontSize: 14 }}>{inf.icon} {inf.nombre}</span>
                    <Row style={{ gap: 4 }}>
                      <button onClick={() => setFormServ(s)} style={xBtn} title="Editar">✎</button>
                      <button onClick={async () => { if (confirm("¿Eliminar este servicio?")) await deleteDoc(doc(db, "servicios", s.id)); }} style={xBtn} title="Eliminar">✕</button>
                    </Row>
                  </Row>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.tan, marginTop: 6 }}>{money(s.valor)}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{s.modalidad === "mensual" ? "por mes (mensualidad)" : `por ${s.unidad || inf.unidad}`}</div>
                </div>); })}
            </div>}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Row between style={{ flexWrap: "wrap", gap: 8 }}><H2>Movimientos del periodo</H2>
          <Row style={{ gap: 8 }}>
            <button onClick={() => setFormAbono({ mascotaId: mascota.id })} style={{ ...btnSmall, background: "transparent", color: T.ok, border: `1px solid ${T.ok}` }}>+ Abono</button>
            <button onClick={() => setFormMov({ mascotaId: mascota.id })} style={btnSmall} disabled={sus.length === 0} title={sus.length === 0 ? "Agrega un servicio primero" : ""}>+ Servicio</button>
          </Row>
        </Row>
        {movsMes.length === 0 ? <Empty texto={sus.length === 0 ? "Primero agrega un servicio, luego registra servicios o abonos." : "Sin movimientos en este periodo."} /> : <TablaMovs movs={movsMes} />}
      </Card>

      {editar && <FormMascota inicial={mascota} duenos={duenos} onClose={() => setEditar(false)} />}
      {formServ && <FormServicio inicial={formServ} mascotaId={mascota.id} onClose={() => setFormServ(null)} />}
      {formMov && <FormMovimiento mascota={mascota} servicios={servicios} onClose={() => setFormMov(null)} />}
      {formAbono && <FormAbono mascota={mascota} onClose={() => setFormAbono(null)} />}
      {factura && <Factura mascota={mascota} cliente={cliente} cargos={cargosMes} abonos={abonosMes} mes={factura} onClose={() => setFactura(null)} />}
    </div>
  );
}

/* ====================== FORM SERVICIO (agregar / editar) ====================== */
function FormServicio({ inicial, mascotaId, onClose }) {
  const editando = !!(inicial && inicial.id);
  const [tipo, setTipo] = useState(inicial?.tipo || "paseo");
  const [modalidad, setModalidad] = useState(inicial?.modalidad || "unidad");
  const [valor, setValor] = useState(inicial?.valor ? String(inicial.valor) : "");
  const inf = servInfo(tipo);
  const [g, setG] = useState(false);

  const guardar = async () => {
    const v = Number(valor);
    if (!v || v <= 0) return alert("Ingresa un valor válido.");
    setG(true);
    const data = { mascotaId, tipo, modalidad, valor: v, unidad: inf.unidad };
    try {
      if (editando) await updateDoc(doc(db, "servicios", inicial.id), data);
      else await addDoc(collection(db, "servicios"), { ...data, createdAt: Date.now() });
      onClose();
    } catch (e) { alert("Error: " + e.message); setG(false); }
  };
  return (
    <Modal title={editando ? "Editar servicio" : "Agregar servicio"} onClose={onClose}>
      <Label>Tipo de servicio</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {SERVICIOS.map((s) => <button key={s.id} onClick={() => setTipo(s.id)} style={{ ...chip, ...(tipo === s.id ? chipOn : {}), textAlign: "left", padding: "10px 11px" }}>{s.icon} {s.nombre}</button>)}
      </div>
      <Label>Modalidad de cobro</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => setModalidad("unidad")} style={{ ...chip, ...(modalidad === "unidad" ? chipOn : {}), flex: 1 }}>Por {inf.unidad}</button>
        <button onClick={() => setModalidad("mensual")} style={{ ...chip, ...(modalidad === "mensual" ? chipOn : {}), flex: 1 }}>Mensualidad</button>
      </div>
      <Label>{modalidad === "mensual" ? "Valor de la mensualidad" : `Valor por ${inf.unidad}`}</Label>
      <input type="number" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" style={inp} />
      <Row style={{ gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Guardar servicio"}</button>
      </Row>
    </Modal>
  );
}

/* ====================== FORM MOVIMIENTO (servicio/cargo) ====================== */
function FormMovimiento({ mascota, servicios, onClose, todasMascotas }) {
  const [mascotaId, setMascotaId] = useState(mascota ? mascota.id : "");
  const servsDeMascota = servicios.filter((s) => s.mascotaId === mascotaId);
  const [servId, setServId] = useState(mascota && servsDeMascota[0] ? servsDeMascota[0].id : "");
  const serv = servicios.find((s) => s.id === servId);
  const [fecha, setFecha] = useState(hoy());
  const [cantidad, setCantidad] = useState(1);
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [g, setG] = useState(false);

  useEffect(() => {
    if (servsDeMascota.length && !servsDeMascota.find((s) => s.id === servId)) setServId(servsDeMascota[0].id);
    if (!servsDeMascota.length) setServId("");
  }, [mascotaId, servicios.length]);
  useEffect(() => { if (serv) { const c = serv.modalidad === "mensual" ? 1 : Number(cantidad || 1); setMonto(String(Number(serv.valor || 0) * c)); } }, [servId, cantidad]);

  const guardar = async () => {
    if (!mascotaId) return alert("Selecciona una mascota.");
    if (!serv) return alert("Selecciona un servicio.");
    if (!Number(monto)) return alert("El monto no puede ser 0.");
    setG(true);
    try {
      await addDoc(collection(db, "movimientos"), { kind: "cargo", mascotaId, servicioId: servId, tipoServicio: serv.tipo, modalidad: serv.modalidad, unidad: serv.unidad, fecha, cantidad: serv.modalidad === "mensual" ? 1 : Number(cantidad), monto: Number(monto), notas: notas.trim(), createdAt: Date.now() });
      onClose();
    } catch (e) { alert("Error: " + e.message); setG(false); }
  };
  const inf = serv ? servInfo(serv.tipo) : null;
  const sinServicios = mascotaId && servsDeMascota.length === 0;

  return (
    <Modal title="Registrar servicio" onClose={onClose}>
      {todasMascotas && (<><Label>Mascota</Label>
        <select value={mascotaId} onChange={(e) => setMascotaId(e.target.value)} style={inp}><option value="">Selecciona…</option>{todasMascotas.map((m) => <option key={m.id} value={m.id}>{m.nombre} {emojiMascota(m.tipo)}</option>)}</select>
        <div style={{ height: 12 }} /></>)}
      {sinServicios ? (
        <div style={{ background: T.pendBg, border: `1px solid ${T.line2}`, borderRadius: 12, padding: 14, color: T.pend, fontSize: 13 }}>Esta mascota aún no tiene servicios. Abre su perfil y agrégale uno (paseo, baño, etc.) para registrar movimientos.</div>
      ) : (<>
        <Label>Servicio</Label>
        <select value={servId} onChange={(e) => setServId(e.target.value)} style={inp}><option value="">Selecciona…</option>
          {servsDeMascota.map((s) => { const i = servInfo(s.tipo); return <option key={s.id} value={s.id}>{i.icon} {i.nombre} · {money(s.valor)} {s.modalidad === "mensual" ? "/mes" : "/" + (s.unidad || i.unidad)}</option>; })}
        </select>
        {serv && (<>
          <div style={{ height: 12 }} />
          <Grid2>
            <div><Label>Fecha</Label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></div>
            {serv.modalidad === "mensual" ? <div><Label>Concepto</Label><input value="Mensualidad" disabled style={{ ...inp, opacity: .6 }} /></div>
              : <div><Label>Cantidad ({serv.unidad || inf.unidad})</Label><input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} style={inp} /></div>}
          </Grid2>
          <div style={{ height: 12 }} /><Label>Monto</Label><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} style={inp} />
          <div style={{ height: 12 }} /><Label>Notas (opcional)</Label><input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. paseo de 2 horas" style={inp} />
        </>)}
      </>)}
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g || !serv} style={{ ...btnPrim, flex: 1 }}>{g ? "Guardando…" : "Registrar"}</button></Row>
    </Modal>
  );
}

/* ====================== FORM ABONO ====================== */
function FormAbono({ mascota, onClose, todasMascotas }) {
  const [mascotaId, setMascotaId] = useState(mascota ? mascota.id : "");
  const [fecha, setFecha] = useState(hoy());
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [g, setG] = useState(false);
  const guardar = async () => {
    if (!mascotaId) return alert("Selecciona una mascota.");
    if (!Number(monto)) return alert("Ingresa el monto del abono.");
    setG(true);
    try { await addDoc(collection(db, "movimientos"), { kind: "abono", mascotaId, fecha, monto: Number(monto), notas: notas.trim(), createdAt: Date.now() }); onClose(); }
    catch (e) { alert("Error: " + e.message); setG(false); }
  };
  return (
    <Modal title="Registrar abono" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>Dinero que el cliente paga en cualquier momento. Se descuenta del saldo pendiente.</p>
      {todasMascotas && (<><Label>Mascota</Label><select value={mascotaId} onChange={(e) => setMascotaId(e.target.value)} style={inp}><option value="">Selecciona…</option>{todasMascotas.map((m) => <option key={m.id} value={m.id}>{m.nombre} {emojiMascota(m.tipo)}</option>)}</select><div style={{ height: 12 }} /></>)}
      <Grid2>
        <div><Label>Fecha</Label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></div>
        <div><Label>Monto del abono</Label><input type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" style={inp} /></div>
      </Grid2>
      <div style={{ height: 12 }} /><Label>Notas (opcional)</Label><input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. abono en efectivo" style={inp} />
      <Row style={{ gap: 10, marginTop: 20 }}><button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button><button onClick={guardar} disabled={g} style={{ ...btnPrim, flex: 1, background: `linear-gradient(180deg,#86d18e,${T.ok})`, color: "#0e2412" }}>{g ? "Guardando…" : "Registrar abono"}</button></Row>
    </Modal>
  );
}

/* ====================== FACTURA VIRTUAL ====================== */
function Factura({ mascota, cliente, cargos, abonos, mes, onClose }) {
  const facturado = cargos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const abonado = abonos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const saldo = facturado - abonado;
  const lc = [...cargos].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const la = [...abonos].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const tel = (cliente.telefono || "").replace(/\D/g, "");
  const emj = emojiMascota(mascota.tipo);

  const texto = () => {
    let t = `🐾 *ADOLF* — Estado de cuenta\n${nombreMes(mes)}\n\nMascota: ${mascota.nombre} ${emj}\nCliente: ${cliente.nombre}\n\n*SERVICIOS*\n`;
    lc.forEach((c) => { const i = servInfo(c.tipoServicio); t += `• ${c.fecha} ${i.nombre}${c.modalidad === "mensual" ? " (mensualidad)" : (c.cantidad > 1 ? ` x${c.cantidad}` : "")}: ${money(c.monto)}\n`; });
    t += `Total servicios: ${money(facturado)}\n`;
    if (la.length) { t += `\n*ABONOS*\n`; la.forEach((a) => { t += `• ${a.fecha}: ${money(a.monto)}\n`; }); t += `Total abonado: ${money(abonado)}\n`; }
    t += `\n*SALDO ${saldo >= 0 ? "PENDIENTE" : "A FAVOR"}: ${money(Math.abs(saldo))}*\n\n${TAGLINE}`;
    return t;
  };
  const whatsapp = () => window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto())}`, "_blank");

  const imprimir = () => {
    const fc = lc.map((c) => { const i = servInfo(c.tipoServicio); return `<tr><td>${c.fecha}</td><td>${i.nombre}${c.modalidad === "mensual" ? " (mensualidad)" : (c.cantidad > 1 ? " x" + c.cantidad : "")}${c.notas ? " — " + c.notas : ""}</td><td class="r">${money(c.monto)}</td></tr>`; }).join("");
    const fa = la.map((a) => `<tr><td>${a.fecha}</td><td>Abono${a.notas ? " — " + a.notas : ""}</td><td class="r">${money(a.monto)}</td></tr>`).join("");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Factura ${mascota.nombre} ${nombreMes(mes)}</title>
      <style>*{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}body{margin:0;padding:32px;color:#1c1712;background:#fff}.wrap{max-width:640px;margin:0 auto}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #d2772f;padding-bottom:14px}
      .brand{font-size:34px;font-weight:800;letter-spacing:3px}.brand small{display:block;font-size:11px;color:#d2772f;font-weight:700;letter-spacing:.3px;margin-top:3px}
      .meta{text-align:right;font-size:12px;color:#555;line-height:1.6}h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#d2772f;margin:22px 0 6px}
      .cli{font-size:14px;line-height:1.7;margin-top:14px}table{width:100%;border-collapse:collapse;margin-top:4px;font-size:13px}
      th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #eee}th{font-size:11px;text-transform:uppercase;color:#999}.r{text-align:right}
      .tot{margin-top:18px;margin-left:auto;width:280px;font-size:14px}.tot div{display:flex;justify-content:space-between;padding:6px 0}
      .tot .big{border-top:2px solid #1c1712;margin-top:6px;padding-top:10px;font-size:18px;font-weight:800}.pend{color:#c47d10}.fav{color:#2f8f3a}
      .foot{margin-top:30px;font-size:12px;color:#d2772f;text-align:center;font-weight:600}</style></head><body><div class="wrap">
      <div class="head"><div class="brand">ADOLF<small>${TAGLINE}</small></div><div class="meta"><b>Estado de cuenta</b><br>${nombreMes(mes)}<br>Emitido: ${hoy()}</div></div>
      <div class="cli"><b>Mascota:</b> ${mascota.nombre} ${emj}${mascota.raza ? " · " + mascota.raza : ""}<br><b>Cliente:</b> ${cliente.nombre}${cliente.telefono ? " · " + cliente.telefono : ""}</div>
      <h2>Servicios del periodo</h2><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Valor</th></tr></thead><tbody>${fc || '<tr><td colspan="3" style="color:#999">Sin servicios</td></tr>'}</tbody></table>
      ${la.length ? `<h2>Abonos recibidos</h2><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Valor</th></tr></thead><tbody>${fa}</tbody></table>` : ""}
      <div class="tot"><div><span>Total servicios</span><b>${money(facturado)}</b></div><div><span>Total abonado</span><b>− ${money(abonado)}</b></div>
      <div class="big ${saldo >= 0 ? "pend" : "fav"}"><span>Saldo ${saldo >= 0 ? "pendiente" : "a favor"}</span><span>${money(Math.abs(saldo))}</span></div></div>
      <div class="foot">${TAGLINE}</div></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Permite las ventanas emergentes para imprimir/guardar la factura."); return; }
    w.document.write(html); w.document.close();
  };

  return (
    <Modal title="Factura del periodo" onClose={onClose}>
      <div className="seleccionable" style={{ background: "#fff", color: "#1c1712", borderRadius: 12, padding: 18, maxHeight: "52vh", overflowY: "auto" }}>
        <Row between style={{ borderBottom: "3px solid #d2772f", paddingBottom: 10, alignItems: "flex-start" }}>
          <div><div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>ADOLF</div><div style={{ fontSize: 10.5, color: "#d2772f", fontWeight: 700, marginTop: 2 }}>{TAGLINE}</div></div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#666" }}><b>Estado de cuenta</b><br />{nombreMes(mes)}</div>
        </Row>
        <div style={{ fontSize: 13, marginTop: 12, lineHeight: 1.6 }}><b>Mascota:</b> {mascota.nombre} {emj}<br /><b>Cliente:</b> {cliente.nombre}{cliente.telefono ? " · " + cliente.telefono : ""}</div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#d2772f", fontWeight: 700, margin: "16px 0 4px" }}>Servicios</div>
        {lc.length === 0 ? <div style={{ color: "#999", fontSize: 13 }}>Sin servicios</div> : lc.map((c) => { const i = servInfo(c.tipoServicio); return (
          <Row key={c.id} between style={{ fontSize: 13, padding: "5px 0", borderBottom: "1px solid #eee" }}><span>{c.fecha} · {i.nombre}{c.modalidad === "mensual" ? " (mens.)" : (c.cantidad > 1 ? ` x${c.cantidad}` : "")}</span><b>{money(c.monto)}</b></Row>); })}
        {la.length > 0 && <><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#2f8f3a", fontWeight: 700, margin: "16px 0 4px" }}>Abonos</div>
          {la.map((a) => <Row key={a.id} between style={{ fontSize: 13, padding: "5px 0", borderBottom: "1px solid #eee" }}><span>{a.fecha} · Abono{a.notas ? " — " + a.notas : ""}</span><b>− {money(a.monto)}</b></Row>)}</>}
        <div style={{ marginTop: 14, fontSize: 14 }}>
          <Row between style={{ padding: "3px 0" }}><span>Total servicios</span><b>{money(facturado)}</b></Row>
          <Row between style={{ padding: "3px 0" }}><span>Total abonado</span><b>− {money(abonado)}</b></Row>
          <Row between style={{ borderTop: "2px solid #1c1712", marginTop: 6, paddingTop: 8, fontSize: 17, fontWeight: 800, color: saldo >= 0 ? "#c47d10" : "#2f8f3a" }}><span>Saldo {saldo >= 0 ? "pendiente" : "a favor"}</span><span>{money(Math.abs(saldo))}</span></Row>
        </div>
        <div style={{ textAlign: "center", color: "#d2772f", fontSize: 12, fontWeight: 600, marginTop: 16 }}>{TAGLINE}</div>
      </div>
      <Row style={{ gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button onClick={imprimir} style={{ ...btnPrim, flex: 1, minWidth: 130 }}>🖨️ Imprimir / PDF</button>
        <button onClick={whatsapp} disabled={!tel} title={!tel ? "El cliente no tiene teléfono" : ""} style={{ ...btnPrim, flex: 1, minWidth: 130, background: tel ? "linear-gradient(180deg,#3ed47e,#1faa5a)" : T.surface2, color: tel ? "#0e2412" : T.dim }}>💬 WhatsApp</button>
      </Row>
    </Modal>
  );
}

/* ====================== SERVICIOS (vista global, antes Movimientos) ====================== */
function Servicios({ mascotas, servicios, movs }) {
  const [mes, setMes] = useState(mesActual());
  const [tipo, setTipo] = useState("todos");
  const [form, setForm] = useState(false);
  const [abono, setAbono] = useState(false);

  const mesesDisp = useMemo(() => { const s = new Set(movs.map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); }, [movs]);
  const lista = movs.filter((m) => mesDe(m.fecha) === mes).filter((m) => tipo === "todos" || (tipo === "abono" ? esAbono(m) : esCargo(m))).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const nombreMascota = (id) => (mascotas.find((m) => m.id === id) || {}).nombre || "—";
  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  const facturado = delMes.filter(esCargo).reduce((a, m) => a + Number(m.monto || 0), 0);
  const abonado = delMes.filter(esAbono).reduce((a, m) => a + Number(m.monto || 0), 0);

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between style={{ flexWrap: "wrap", gap: 8 }}><H1>Servicios y pagos</H1>
        <Row style={{ gap: 8 }}>
          <button onClick={() => setAbono(true)} style={{ ...btnPrim, background: "transparent", color: T.ok, border: `1px solid ${T.ok}` }} disabled={mascotas.length === 0}>+ Abono</button>
          <button onClick={() => setForm(true)} style={btnPrim} disabled={servicios.length === 0}>+ Servicio</button>
        </Row>
      </Row>
      <Row style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto" }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select>
        <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 12, padding: 4, border: `1px solid ${T.line}` }}>{[["todos","Todos"],["cargo","Servicios"],["abono","Abonos"]].map(([k, l]) => <button key={k} onClick={() => setTipo(k)} style={tab(tipo === k)}>{l}</button>)}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13 }}>Facturado: <b style={{ color: T.tan }}>{money(facturado)}</b></span>
          <span style={{ fontSize: 13 }}>Abonado: <b style={{ color: T.ok }}>{money(abonado)}</b></span>
          <span style={{ fontSize: 13 }}>Saldo: <b style={{ color: facturado - abonado > 0 ? T.pend : T.ok }}>{money(Math.abs(facturado - abonado))}</b></span>
        </div>
      </Row>
      <Card style={{ marginTop: 16 }}>{lista.length === 0 ? <Empty texto="Sin movimientos en este periodo." /> : <TablaMovs movs={lista} mostrarMascota nombreMascota={nombreMascota} />}</Card>
      {form && <FormMovimiento servicios={servicios} todasMascotas={mascotas} onClose={() => setForm(false)} />}
      {abono && <FormAbono todasMascotas={mascotas} onClose={() => setAbono(false)} />}
    </div>
  );
}

/* ====================== TABLA DE MOVIMIENTOS ====================== */
function TablaMovs({ movs, mostrarMascota, nombreMascota, readOnly }) {
  const borrar = async (m) => { if (confirm("¿Eliminar este movimiento?")) await deleteDoc(doc(db, "movimientos", m.id)); };
  return (
    <div style={{ marginTop: 6 }}>
      {movs.map((m, i) => {
        const ab = esAbono(m); const inf = ab ? null : servInfo(m.tipoServicio);
        return (
          <Row key={m.id} between style={{ padding: "11px 0", borderBottom: i < movs.length - 1 ? `1px solid ${T.line}` : "none", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 19, width: 24, textAlign: "center" }}>{ab ? "💵" : inf.icon}</span>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{ab ? "Abono" : `${inf.nombre}${m.modalidad === "mensual" ? " · Mensualidad" : (m.cantidad > 1 ? ` · ${m.cantidad} ${m.unidad || inf.unidad}` : "")}`}{mostrarMascota && <span style={{ color: T.rust }}> — {nombreMascota(m.mascotaId)}</span>}</div>
                <div style={{ fontSize: 11.5, color: T.muted }}>{m.fecha}{m.notas ? ` · ${m.notas}` : ""}</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <b style={{ fontVariantNumeric: "tabular-nums", fontSize: 14.5, color: ab ? T.ok : T.text }}>{ab ? "− " : ""}{money(m.monto)}</b>
              <span style={{ ...badge, ...(ab ? { background: T.okBg, color: T.ok, borderColor: "#3a5a36" } : { background: T.surface2, color: T.muted, borderColor: T.line2 }) }}>{ab ? "Abono" : "Servicio"}</span>
              {!readOnly && <button onClick={() => borrar(m)} style={xBtn}>✕</button>}
            </div>
          </Row>
        );
      })}
    </div>
  );
}

/* ====================== VISTA CLIENTE (solo lectura, por link) ====================== */
function VistaCliente({ duenoId }) {
  const { duenos, mascotas, servicios, movs } = useDatos();
  const [mes, setMes] = useState(mesActual());
  const [facturaMascota, setFacturaMascota] = useState(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { const t = setTimeout(() => setCargando(false), 1500); return () => clearTimeout(t); }, []);

  const cliente = duenos.find((d) => d.id === duenoId);
  const sus = mascotas.filter((m) => m.duenoId === duenoId);

  if (!cliente && cargando) return <Centro><div style={{ color: T.muted }}>Cargando…</div></Centro>;
  if (!cliente) return <Centro><img src={logo} alt="" style={{ height: 70 }} /><p style={{ color: T.muted, marginTop: 16 }}>Enlace no válido o el cliente ya no existe.</p></Centro>;

  const mesesDisp = (() => { const s = new Set(movs.filter((m) => sus.find((x) => x.id === m.mascotaId)).map((m) => mesDe(m.fecha)).filter(Boolean)); s.add(mesActual()); return [...s].sort().reverse(); })();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
      <header style={{ background: "linear-gradient(180deg, rgba(46,38,29,.96), rgba(36,29,22,.92))", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logo} alt="" style={{ height: 40, width: "auto" }} />
          <div><div style={{ fontFamily: display, fontSize: 28, fontWeight: 700, letterSpacing: 3, color: T.cream, lineHeight: .9 }}>ADOLF</div><div style={{ fontSize: 10, color: T.rust, fontWeight: 600 }}>{TAGLINE}</div></div>
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "22px 18px 80px" }}>
        <Row between style={{ flexWrap: "wrap", gap: 10 }}>
          <div><div style={{ fontSize: 14, color: T.muted }}>Hola,</div><H1>{cliente.nombre}</H1></div>
          <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto" }}>{mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select>
        </Row>
        <p style={{ color: T.muted, fontSize: 13, marginTop: 6 }}>Esta es la información de tus mascotas y los servicios prestados. Solo para consulta.</p>

        {sus.length === 0 ? <Card style={{ marginTop: 18, textAlign: "center", padding: 36 }}><div style={{ fontSize: 34 }}>🐾</div><p style={{ color: T.muted, marginTop: 8 }}>Aún no hay mascotas registradas.</p></Card>
          : sus.map((m) => {
            const movsM = movs.filter((x) => x.mascotaId === m.id && mesDe(x.fecha) === mes);
            const cargos = movsM.filter(esCargo); const abonos = movsM.filter(esAbono);
            const facturado = cargos.reduce((a, x) => a + Number(x.monto || 0), 0);
            const abonado = abonos.reduce((a, x) => a + Number(x.monto || 0), 0);
            const saldo = facturado - abonado;
            const tarifas = servicios.filter((s) => s.mascotaId === m.id);
            return (
              <Card key={m.id} style={{ marginTop: 16 }}>
                <Row between style={{ flexWrap: "wrap", gap: 8 }}>
                  <Row style={{ gap: 12 }}><Avatar mascota={m} big /><div><div style={{ fontSize: 19, fontWeight: 700, color: T.cream }}>{m.nombre} {emojiMascota(m.tipo)}</div><div style={{ fontSize: 12.5, color: T.muted }}>{m.raza || "—"} · {m.color || "—"} · {m.edad || "—"}</div></div></Row>
                  <button onClick={() => setFacturaMascota({ mascota: m, cargos, abonos })} style={btnSmall}>🧾 Ver factura</button>
                </Row>
                {tarifas.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>{tarifas.map((s) => { const i = servInfo(s.tipo); return <Pill key={s.id}>{i.icon} {i.nombre}: {money(s.valor)}{s.modalidad === "mensual" ? "/mes" : "/" + (s.unidad || i.unidad)}</Pill>; })}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
                  <MiniStat label="Facturado" value={money(facturado)} color={T.tan} />
                  <MiniStat label="Abonado" value={money(abonado)} color={T.ok} />
                  <MiniStat label={saldo >= 0 ? "Pendiente" : "A favor"} value={money(Math.abs(saldo))} color={saldo > 0 ? T.pend : T.ok} />
                </div>
                <div style={{ marginTop: 12 }}>{movsM.length === 0 ? <Empty texto="Sin servicios este mes." /> : <TablaMovs movs={[...movsM].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))} readOnly />}</div>
              </Card>
            );
          })}
        <div style={{ textAlign: "center", color: T.dim, fontSize: 12, marginTop: 28 }}>{TAGLINE}</div>
      </main>
      {facturaMascota && <Factura mascota={facturaMascota.mascota} cliente={cliente} cargos={facturaMascota.cargos} abonos={facturaMascota.abonos} mes={mes} onClose={() => setFacturaMascota(null)} />}
    </div>
  );
}
const Centro = ({ children }) => <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>{children}</div>;
const MiniStat = ({ label, value, color }) => <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 11, padding: "9px 10px", textAlign: "center" }}><div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div><div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 2 }}>{value}</div></div>;

/* ====================== COMPONENTES UI ====================== */
function Avatar({ mascota, big }) {
  const sz = big ? 50 : 38;
  if (mascota && mascota.foto) return <img src={mascota.foto} alt="" style={{ width: sz, height: sz, borderRadius: 13, objectFit: "cover", border: `1px solid ${T.line2}`, flexShrink: 0 }} />;
  return <div style={{ width: sz, height: sz, borderRadius: 13, background: T.surface2, border: `1px solid ${T.line2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: big ? 26 : 19, flexShrink: 0 }}>{emojiMascota(mascota && mascota.tipo)}</div>;
}
function Stat({ label, value, accent, sub }) {
  return (
    <div style={{ ...cardBase, padding: 16, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: accent, opacity: .8 }} />
      <div style={{ fontSize: 11.5, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 800, color: accent, marginTop: 5, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.dim, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
function Info({ label, value, link }) {
  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase", letterSpacing: .6 }}>{label}</div>
      {link ? <a className="seleccionable" href={link} style={{ color: T.rustSoft, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>{value || "—"}</a> : <div className="seleccionable" style={{ color: T.text, fontWeight: 600, fontSize: 13.5 }}>{value || "—"}</div>}
    </div>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(12,9,6,.72)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", zIndex: 50, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 18, padding: 22, animation: "pop .25s ease", boxShadow: "0 20px 60px rgba(0,0,0,.45)" }}>
        <Row between style={{ marginBottom: 16 }}><h3 style={{ fontFamily: display, fontSize: 23, fontWeight: 700, color: T.cream, letterSpacing: .5 }}>{title}</h3><button onClick={onClose} style={xBtn}>✕</button></Row>
        {children}
      </div>
    </div>
  );
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

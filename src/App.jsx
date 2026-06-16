import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import logo from "./assets/logo.svg";

/* ====================== TEMA / COLORES ====================== */
const T = {
  bg: "#100d0a", surface: "#1b1611", surface2: "#221c16", card: "#1f1913",
  line: "#2e2620", line2: "#3a3128",
  rust: "#c56a2d", rustSoft: "#d98a4a", tan: "#d9a066",
  cream: "#f2ebe2", text: "#ece3d8", muted: "#9a8e80", dim: "#6f6557",
  ok: "#5fae6a", okBg: "#16261a", pend: "#e0a93b", pendBg: "#2a2310",
  danger: "#d8654f",
};
const display = "'Barlow Condensed', system-ui, sans-serif";

/* ====================== LOGIN (usuario unico) ====================== */
// Cambia la contrasena aqui cuando quieras. El usuario es YELIANIS.
const USUARIO = "YELIANIS";
const CLAVE   = "Adolf2026";

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
const nombreMes = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${meses[Number(m) - 1]} ${y}`;
};

/* ====================== APP ====================== */
export default function App() {
  const [logged, setLogged] = useState(() => localStorage.getItem("adolf_auth") === "1");
  if (!logged) return <Login onOk={() => setLogged(true)} />;
  return <Panel onLogout={() => { localStorage.removeItem("adolf_auth"); setLogged(false); }} />;
}

/* ====================== LOGIN ====================== */
function Login({ onOk }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const enviar = () => {
    if (u.trim().toUpperCase() === USUARIO && p === CLAVE) {
      localStorage.setItem("adolf_auth", "1");
      onOk();
    } else setErr("Usuario o contraseña incorrectos.");
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(1200px 600px at 50% -10%, #241c14 0%, ${T.bg} 60%)`, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, animation: "pop .4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <img src={logo} alt="" style={{ height: 96, width: "auto" }} />
          <div style={{ fontFamily: display, fontSize: 52, fontWeight: 700, letterSpacing: 6, color: T.cream, lineHeight: 1, marginTop: 6 }}>ADOLF</div>
          <div style={{ color: T.rust, fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginTop: 4, fontWeight: 600 }}>Paseo &amp; Baño · Perros y Gatos</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18, padding: 22 }}>
          <Label>Usuario</Label>
          <input value={u} onChange={(e) => setU(e.target.value)} placeholder="YELIANIS" style={inp} onKeyDown={(e)=>e.key==="Enter"&&enviar()} />
          <div style={{ height: 14 }} />
          <Label>Contraseña</Label>
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" style={inp} onKeyDown={(e)=>e.key==="Enter"&&enviar()} />
          {err && <div style={{ color: T.danger, fontSize: 12.5, marginTop: 12 }}>{err}</div>}
          <button onClick={enviar} style={{ ...btnPrim, width: "100%", marginTop: 18, padding: "13px" }}>Entrar</button>
        </div>
        <div style={{ textAlign: "center", color: T.dim, fontSize: 11, marginTop: 16 }}>Acceso exclusivo · {USUARIO}</div>
      </div>
    </div>
  );
}

/* ====================== PANEL PRINCIPAL ====================== */
function Panel({ onLogout }) {
  const [mascotas, setMascotas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [movs, setMovs] = useState([]);
  const [vista, setVista] = useState("resumen"); // resumen | mascotas | movimientos
  const [detalle, setDetalle] = useState(null);   // mascotaId

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "mascotas"), orderBy("nombre")), (s) =>
      setMascotas(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "servicios"), (s) =>
      setServicios(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "movimientos"), (s) =>
      setMovs(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); };
  }, []);

  const mascotaDetalle = mascotas.find((m) => m.id === detalle);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(16,13,10,.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "11px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logo} alt="" style={{ height: 38, width: "auto" }} />
          <div>
            <div style={{ fontFamily: display, fontSize: 27, fontWeight: 700, letterSpacing: 3, color: T.cream, lineHeight: .9 }}>ADOLF</div>
            <div style={{ fontSize: 9.5, color: T.rust, letterSpacing: 2.5, textTransform: "uppercase" }}>Gestión de servicios</div>
          </div>
          <nav style={{ marginLeft: "auto", display: "flex", gap: 4, background: T.surface, borderRadius: 12, padding: 4, border: `1px solid ${T.line}` }}>
            {[["resumen","Resumen"],["mascotas","Mascotas"],["movimientos","Movimientos"]].map(([k, l]) => (
              <button key={k} onClick={() => { setVista(k); setDetalle(null); }} style={tab(vista === k && !detalle)}>{l}</button>
            ))}
          </nav>
          <button onClick={onLogout} title="Salir" style={{ ...btnGhost, padding: "8px 12px" }}>Salir</button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 18px 80px" }}>
        {mascotaDetalle ? (
          <DetalleMascota mascota={mascotaDetalle} servicios={servicios} movs={movs} onBack={() => setDetalle(null)} />
        ) : vista === "resumen" ? (
          <Resumen mascotas={mascotas} servicios={servicios} movs={movs} irMascota={(id) => setDetalle(id)} />
        ) : vista === "mascotas" ? (
          <Mascotas mascotas={mascotas} servicios={servicios} movs={movs} abrir={(id) => setDetalle(id)} />
        ) : (
          <Movimientos mascotas={mascotas} servicios={servicios} movs={movs} />
        )}
      </main>
    </div>
  );
}

/* ====================== RESUMEN / DASHBOARD ====================== */
function Resumen({ mascotas, servicios, movs, irMascota }) {
  const [mes, setMes] = useState(mesActual());
  const mesesDisp = useMemo(() => {
    const set = new Set(movs.map((m) => mesDe(m.fecha)).filter(Boolean));
    set.add(mesActual());
    return [...set].sort().reverse();
  }, [movs]);

  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  const facturado = delMes.reduce((a, m) => a + Number(m.monto || 0), 0);
  const cobrado = delMes.filter((m) => m.estado === "pagado").reduce((a, m) => a + Number(m.monto || 0), 0);
  const pendiente = facturado - cobrado;

  const porTipo = SERVICIOS.map((s) => {
    const items = delMes.filter((m) => m.tipoServicio === s.id);
    return { ...s, total: items.reduce((a, m) => a + Number(m.monto || 0), 0), n: items.length };
  }).filter((x) => x.n > 0).sort((a, b) => b.total - a.total);

  const ranking = mascotas.map((mc) => {
    const items = delMes.filter((m) => m.mascotaId === mc.id);
    return { ...mc, total: items.reduce((a, m) => a + Number(m.monto || 0), 0), n: items.length };
  }).filter((x) => x.n > 0).sort((a, b) => b.total - a.total);

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between>
        <H1>Resumen del mes</H1>
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto", padding: "9px 12px" }}>
          {mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
        </select>
      </Row>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 16 }}>
        <Stat label="Facturado" value={money(facturado)} accent={T.tan} sub={`${delMes.length} movimientos`} />
        <Stat label="Cobrado" value={money(cobrado)} accent={T.ok} sub="pagos recibidos" />
        <Stat label="Pendiente" value={money(pendiente)} accent={T.pend} sub="por cobrar" />
        <Stat label="Mascotas activas" value={ranking.length} accent={T.rust} sub={`de ${mascotas.length} registradas`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 22 }}>
        <Card>
          <H2>Ingresos por servicio</H2>
          {porTipo.length === 0 ? <Empty texto="Sin movimientos este mes." />
            : porTipo.map((t) => {
              const pct = facturado ? Math.round((t.total / facturado) * 100) : 0;
              return (
                <div key={t.id} style={{ marginTop: 12 }}>
                  <Row between><span style={{ fontSize: 13.5 }}>{t.icon} {t.nombre} <span style={{ color: T.dim }}>· {t.n}</span></span><b style={{ fontVariantNumeric: "tabular-nums" }}>{money(t.total)}</b></Row>
                  <div style={{ height: 7, background: T.surface2, borderRadius: 6, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ width: pct + "%", height: "100%", background: `linear-gradient(90deg,${T.rust},${T.tan})`, borderRadius: 6 }} />
                  </div>
                </div>
              );
            })}
        </Card>
        <Card>
          <H2>Cuánto genera cada mascota</H2>
          {ranking.length === 0 ? <Empty texto="Sin movimientos este mes." />
            : ranking.map((m, i) => (
              <Row key={m.id} between style={{ padding: "10px 0", borderBottom: i < ranking.length - 1 ? `1px solid ${T.line}` : "none", cursor: "pointer" }} onClick={() => irMascota(m.id)}>
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Avatar tipo={m.tipo} />
                  <span><b style={{ fontSize: 14 }}>{m.nombre}</b><div style={{ fontSize: 11.5, color: T.muted }}>{m.raza} · {m.n} serv.</div></span>
                </span>
                <b style={{ fontVariantNumeric: "tabular-nums", color: T.tan }}>{money(m.total)}</b>
              </Row>
            ))}
        </Card>
      </div>
    </div>
  );
}

/* ====================== MASCOTAS (lista) ====================== */
function Mascotas({ mascotas, servicios, movs, abrir }) {
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | perro | gato
  const [form, setForm] = useState(null); // objeto mascota o null

  const lista = mascotas.filter((m) => {
    if (filtro !== "todos" && m.tipo !== filtro) return false;
    const q = buscar.toLowerCase();
    return !q || [m.nombre, m.raza, m.dueno].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between><H1>Mascotas</H1>
        <button onClick={() => setForm({})} style={btnPrim}>+ Nueva mascota</button>
      </Row>
      <Row style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, raza o dueño…" style={{ ...inp, flex: 1, minWidth: 220 }} />
        <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 12, padding: 4, border: `1px solid ${T.line}` }}>
          {[["todos","Todos"],["perro","🐶 Perros"],["gato","🐱 Gatos"]].map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)} style={tab(filtro === k)}>{l}</button>
          ))}
        </div>
      </Row>

      {lista.length === 0 ? (
        <Card style={{ marginTop: 16, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 38 }}>🐾</div>
          <p style={{ color: T.muted, marginTop: 8 }}>No hay mascotas todavía. Crea el primer perfil para empezar.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 14, marginTop: 18 }}>
          {lista.map((m) => {
            const nServ = servicios.filter((s) => s.mascotaId === m.id).length;
            const mesIngreso = movs.filter((x) => x.mascotaId === m.id && mesDe(x.fecha) === mesActual()).reduce((a, x) => a + Number(x.monto || 0), 0);
            return (
              <div key={m.id} onClick={() => abrir(m.id)} style={{ ...cardBase, cursor: "pointer", transition: "transform .12s, border-color .12s" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = T.rust; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = T.line; }}>
                <Row style={{ gap: 11 }}>
                  <Avatar tipo={m.tipo} big />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: T.cream }}>{m.nombre}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{m.raza} · {m.color}</div>
                  </div>
                </Row>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Pill>{m.edad}</Pill><Pill>{nServ} servicio{nServ !== 1 ? "s" : ""}</Pill>
                </div>
                <Row between style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${T.line}` }}>
                  <span style={{ fontSize: 11.5, color: T.muted }}>Este mes</span>
                  <b style={{ color: T.tan }}>{money(mesIngreso)}</b>
                </Row>
              </div>
            );
          })}
        </div>
      )}

      {form && <FormMascota inicial={form} onClose={() => setForm(null)} />}
    </div>
  );
}

/* ====================== FORM MASCOTA ====================== */
function FormMascota({ inicial, onClose }) {
  const editando = !!inicial.id;
  const [f, setF] = useState({ tipo: "perro", nombre: "", raza: "", color: "", edad: "", dueno: "", telefono: "", email: "", ...inicial });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const guardar = async () => {
    if (!f.nombre.trim()) return alert("El nombre es obligatorio.");
    setGuardando(true);
    const data = { tipo: f.tipo, nombre: f.nombre.trim(), raza: f.raza.trim(), color: f.color.trim(), edad: f.edad.trim(), dueno: f.dueno.trim(), telefono: f.telefono.trim(), email: f.email.trim() };
    try {
      if (editando) await updateDoc(doc(db, "mascotas", f.id), data);
      else await addDoc(collection(db, "mascotas"), { ...data, createdAt: Date.now() });
      onClose();
    } catch (e) { alert("Error al guardar: " + e.message); setGuardando(false); }
  };

  return (
    <Modal title={editando ? "Editar mascota" : "Nueva mascota"} onClose={onClose}>
      <Label>Tipo</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {[["perro","🐶 Perro"],["gato","🐱 Gato"]].map(([k, l]) => (
          <button key={k} onClick={() => setF({ ...f, tipo: k })} style={{ ...chip, ...(f.tipo === k ? chipOn : {}), flex: 1 }}>{l}</button>
        ))}
      </div>
      <Grid2>
        <Campo label="Nombre *" value={f.nombre} onChange={set("nombre")} />
        <Campo label="Raza" value={f.raza} onChange={set("raza")} />
        <Campo label="Color" value={f.color} onChange={set("color")} />
        <Campo label="Edad" value={f.edad} onChange={set("edad")} ph="ej. 3 años" />
      </Grid2>
      <div style={{ height: 8 }} />
      <Campo label="Nombre del dueño" value={f.dueno} onChange={set("dueno")} />
      <div style={{ height: 8 }} />
      <Grid2>
        <Campo label="Teléfono" value={f.telefono} onChange={set("telefono")} />
        <Campo label="Correo electrónico" value={f.email} onChange={set("email")} />
      </Grid2>
      <Row style={{ gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={{ ...btnPrim, flex: 1 }}>{guardando ? "Guardando…" : "Guardar"}</button>
      </Row>
    </Modal>
  );
}

/* ====================== DETALLE MASCOTA ====================== */
function DetalleMascota({ mascota, servicios, movs, onBack }) {
  const [editar, setEditar] = useState(false);
  const [formServ, setFormServ] = useState(null);
  const [formMov, setFormMov] = useState(null);
  const [mes, setMes] = useState(mesActual());

  const susServicios = servicios.filter((s) => s.mascotaId === mascota.id);
  const susMovs = movs.filter((m) => m.mascotaId === mascota.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const movsMes = susMovs.filter((m) => mesDe(m.fecha) === mes);
  const totalMes = movsMes.reduce((a, m) => a + Number(m.monto || 0), 0);
  const pendMes = movsMes.filter((m) => m.estado !== "pagado").reduce((a, m) => a + Number(m.monto || 0), 0);

  const mesesDisp = useMemo(() => {
    const set = new Set(susMovs.map((m) => mesDe(m.fecha)).filter(Boolean)); set.add(mesActual());
    return [...set].sort().reverse();
  }, [susMovs]);

  const borrarMascota = async () => {
    if (!confirm(`¿Eliminar a ${mascota.nombre} y todos sus servicios y movimientos? Esta acción no se puede deshacer.`)) return;
    for (const s of susServicios) await deleteDoc(doc(db, "servicios", s.id));
    for (const m of susMovs) await deleteDoc(doc(db, "movimientos", m.id));
    await deleteDoc(doc(db, "mascotas", mascota.id));
    onBack();
  };

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <button onClick={onBack} style={{ ...btnGhost, marginBottom: 14 }}>← Volver</button>

      {/* Encabezado del perfil */}
      <Card>
        <Row between style={{ alignItems: "flex-start" }}>
          <Row style={{ gap: 14 }}>
            <Avatar tipo={mascota.tipo} big />
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.cream, fontFamily: display, letterSpacing: .5 }}>{mascota.nombre}</div>
              <div style={{ color: T.muted, fontSize: 13.5 }}>{mascota.tipo === "perro" ? "🐶 Perro" : "🐱 Gato"} · {mascota.raza || "—"} · {mascota.color || "—"} · {mascota.edad || "—"}</div>
            </div>
          </Row>
          <Row style={{ gap: 8 }}>
            <button onClick={() => setEditar(true)} style={btnGhost}>Editar</button>
            <button onClick={borrarMascota} style={{ ...btnGhost, color: T.danger, borderColor: "#3a1f1a" }}>Eliminar</button>
          </Row>
        </Row>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 16 }}>
          <Info label="Dueño" value={mascota.dueno} />
          <Info label="Teléfono" value={mascota.telefono} link={mascota.telefono ? `tel:${mascota.telefono}` : null} />
          <Info label="Correo" value={mascota.email} link={mascota.email ? `mailto:${mascota.email}` : null} />
        </div>
      </Card>

      {/* Resumen mensual de esta mascota */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 16 }}>
        <Card style={{ padding: 16 }}>
          <Row between><Label>Genera este periodo</Label>
            <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto", padding: "5px 8px", fontSize: 12 }}>
              {mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
            </select>
          </Row>
          <div style={{ fontSize: 30, fontWeight: 800, color: T.tan, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{money(totalMes)}</div>
          <div style={{ fontSize: 12, color: pendMes ? T.pend : T.ok, marginTop: 2 }}>{pendMes ? `${money(pendMes)} pendiente de cobro` : "Todo cobrado"}</div>
        </Card>
        <Stat label="Servicios contratados" value={susServicios.length} accent={T.rust} sub="planes activos" />
        <Stat label="Movimientos totales" value={susMovs.length} accent={T.cream} sub="historial completo" />
      </div>

      {/* Servicios contratados */}
      <Card style={{ marginTop: 16 }}>
        <Row between><H2>Servicios y tarifas</H2><button onClick={() => setFormServ({})} style={btnSmall}>+ Agregar servicio</button></Row>
        {susServicios.length === 0 ? <Empty texto="Sin servicios. Agrega uno para definir tarifas." />
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10, marginTop: 12 }}>
              {susServicios.map((s) => {
                const inf = servInfo(s.tipo);
                return (
                  <div key={s.id} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 13 }}>
                    <Row between>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{inf.icon} {inf.nombre}</span>
                      <button onClick={async () => { if (confirm("¿Eliminar este servicio?")) await deleteDoc(doc(db, "servicios", s.id)); }} style={xBtn}>✕</button>
                    </Row>
                    <div style={{ fontSize: 22, fontWeight: 800, color: T.tan, marginTop: 6 }}>{money(s.valor)}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{s.modalidad === "mensual" ? "por mes (mensualidad)" : `por ${s.unidad || inf.unidad}`}</div>
                  </div>
                );
              })}
            </div>}
      </Card>

      {/* Movimientos / paseos / pagos */}
      <Card style={{ marginTop: 16 }}>
        <Row between><H2>Movimientos y pagos</H2>
          <button onClick={() => setFormMov({ mascotaId: mascota.id })} style={btnSmall} disabled={susServicios.length === 0} title={susServicios.length === 0 ? "Agrega un servicio primero" : ""}>+ Registrar</button>
        </Row>
        {susMovs.length === 0 ? <Empty texto={susServicios.length === 0 ? "Primero agrega un servicio, luego registra paseos, baños o pagos." : "Aún no hay movimientos registrados."} />
          : <TablaMovs movs={susMovs} mostrarMascota={false} />}
      </Card>

      {editar && <FormMascota inicial={mascota} onClose={() => setEditar(false)} />}
      {formServ && <FormServicio mascotaId={mascota.id} onClose={() => setFormServ(null)} />}
      {formMov && <FormMovimiento mascota={mascota} servicios={susServicios} onClose={() => setFormMov(null)} />}
    </div>
  );
}

/* ====================== FORM SERVICIO ====================== */
function FormServicio({ mascotaId, onClose }) {
  const [tipo, setTipo] = useState("paseo");
  const [modalidad, setModalidad] = useState("unidad"); // unidad | mensual
  const [valor, setValor] = useState("");
  const inf = servInfo(tipo);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const v = Number(valor);
    if (!v || v <= 0) return alert("Ingresa un valor válido.");
    setGuardando(true);
    try {
      await addDoc(collection(db, "servicios"), { mascotaId, tipo, modalidad, valor: v, unidad: inf.unidad, createdAt: Date.now() });
      onClose();
    } catch (e) { alert("Error: " + e.message); setGuardando(false); }
  };

  return (
    <Modal title="Agregar servicio" onClose={onClose}>
      <Label>Tipo de servicio</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {SERVICIOS.map((s) => (
          <button key={s.id} onClick={() => setTipo(s.id)} style={{ ...chip, ...(tipo === s.id ? chipOn : {}), textAlign: "left", padding: "10px 11px" }}>{s.icon} {s.nombre}</button>
        ))}
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
        <button onClick={guardar} disabled={guardando} style={{ ...btnPrim, flex: 1 }}>{guardando ? "Guardando…" : "Guardar servicio"}</button>
      </Row>
    </Modal>
  );
}

/* ====================== FORM MOVIMIENTO ====================== */
function FormMovimiento({ mascota, servicios, onClose, todasMascotas }) {
  // Si recibe todasMascotas, permite elegir mascota (uso global). Si no, mascota fija.
  const [mascotaId, setMascotaId] = useState(mascota ? mascota.id : "");
  const servsDeMascota = servicios.filter((s) => !mascotaId || s.mascotaId === mascotaId);
  const [servId, setServId] = useState(servsDeMascota[0] ? servsDeMascota[0].id : "");
  const serv = servicios.find((s) => s.id === servId);
  const [fecha, setFecha] = useState(hoy());
  const [cantidad, setCantidad] = useState(1);
  const [monto, setMonto] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  // recalcula monto sugerido
  useEffect(() => {
    if (serv) {
      const c = serv.modalidad === "mensual" ? 1 : Number(cantidad || 1);
      setMonto(String(Number(serv.valor || 0) * c));
    }
  }, [serv, cantidad]);

  const guardar = async () => {
    if (!mascotaId) return alert("Selecciona una mascota.");
    if (!serv) return alert("Selecciona un servicio.");
    if (!Number(monto)) return alert("El monto no puede ser 0.");
    setGuardando(true);
    try {
      await addDoc(collection(db, "movimientos"), {
        mascotaId, servicioId: servId, tipoServicio: serv.tipo, modalidad: serv.modalidad,
        fecha, cantidad: serv.modalidad === "mensual" ? 1 : Number(cantidad), monto: Number(monto),
        estado, notas: notas.trim(), createdAt: Date.now(),
      });
      onClose();
    } catch (e) { alert("Error: " + e.message); setGuardando(false); }
  };

  const inf = serv ? servInfo(serv.tipo) : null;

  return (
    <Modal title="Registrar movimiento" onClose={onClose}>
      {todasMascotas && (
        <>
          <Label>Mascota</Label>
          <select value={mascotaId} onChange={(e) => { setMascotaId(e.target.value); setServId(""); }} style={inp}>
            <option value="">Selecciona…</option>
            {todasMascotas.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.tipo})</option>)}
          </select>
          <div style={{ height: 12 }} />
        </>
      )}
      <Label>Servicio</Label>
      <select value={servId} onChange={(e) => setServId(e.target.value)} style={inp}>
        <option value="">Selecciona…</option>
        {servsDeMascota.map((s) => { const i = servInfo(s.tipo); return <option key={s.id} value={s.id}>{i.icon} {i.nombre} · {money(s.valor)} {s.modalidad === "mensual" ? "/mes" : "/" + (s.unidad || i.unidad)}</option>; })}
      </select>

      {serv && (
        <>
          <div style={{ height: 12 }} />
          <Grid2>
            <div><Label>Fecha</Label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></div>
            {serv.modalidad === "mensual"
              ? <div><Label>Concepto</Label><input value="Mensualidad" disabled style={{ ...inp, opacity: .6 }} /></div>
              : <div><Label>Cantidad ({serv.unidad || inf.unidad})</Label><input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} style={inp} /></div>}
          </Grid2>
          <div style={{ height: 12 }} />
          <Label>Monto</Label>
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} style={inp} />
          <div style={{ height: 12 }} />
          <Label>Estado del pago</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEstado("pagado")} style={{ ...chip, ...(estado === "pagado" ? { background: T.okBg, borderColor: T.ok, color: T.ok } : {}), flex: 1 }}>✓ Pagado</button>
            <button onClick={() => setEstado("pendiente")} style={{ ...chip, ...(estado === "pendiente" ? { background: T.pendBg, borderColor: T.pend, color: T.pend } : {}), flex: 1 }}>⏳ Pendiente</button>
          </div>
          <div style={{ height: 12 }} />
          <Label>Notas (opcional)</Label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. paseo de 2 horas en el parque" style={inp} />
        </>
      )}

      <Row style={{ gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={guardar} disabled={guardando || !serv} style={{ ...btnPrim, flex: 1 }}>{guardando ? "Guardando…" : "Registrar"}</button>
      </Row>
    </Modal>
  );
}

/* ====================== MOVIMIENTOS (vista global) ====================== */
function Movimientos({ mascotas, servicios, movs }) {
  const [mes, setMes] = useState(mesActual());
  const [estado, setEstado] = useState("todos");
  const [form, setForm] = useState(false);

  const mesesDisp = useMemo(() => {
    const set = new Set(movs.map((m) => mesDe(m.fecha)).filter(Boolean)); set.add(mesActual());
    return [...set].sort().reverse();
  }, [movs]);

  const lista = movs
    .filter((m) => mesDe(m.fecha) === mes)
    .filter((m) => estado === "todos" || m.estado === estado)
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const nombreMascota = (id) => (mascotas.find((m) => m.id === id) || {}).nombre || "—";
  const total = lista.reduce((a, m) => a + Number(m.monto || 0), 0);
  const pend = lista.filter((m) => m.estado !== "pagado").reduce((a, m) => a + Number(m.monto || 0), 0);

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between><H1>Movimientos y pagos</H1>
        <button onClick={() => setForm(true)} style={btnPrim} disabled={servicios.length === 0}>+ Registrar movimiento</button>
      </Row>
      <Row style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto" }}>
          {mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
        </select>
        <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 12, padding: 4, border: `1px solid ${T.line}` }}>
          {[["todos","Todos"],["pagado","Pagados"],["pendiente","Pendientes"]].map(([k, l]) => (
            <button key={k} onClick={() => setEstado(k)} style={tab(estado === k)}>{l}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>Total: <b style={{ color: T.tan }}>{money(total)}</b></span>
          <span style={{ fontSize: 13 }}>Pendiente: <b style={{ color: T.pend }}>{money(pend)}</b></span>
        </div>
      </Row>

      <Card style={{ marginTop: 16 }}>
        {lista.length === 0 ? <Empty texto="Sin movimientos en este periodo." />
          : <TablaMovs movs={lista} mostrarMascota nombreMascota={nombreMascota} />}
      </Card>

      {form && <FormMovimiento servicios={servicios} todasMascotas={mascotas} onClose={() => setForm(false)} />}
    </div>
  );
}

/* ====================== TABLA DE MOVIMIENTOS ====================== */
function TablaMovs({ movs, mostrarMascota, nombreMascota }) {
  const togglePago = async (m) => {
    await updateDoc(doc(db, "movimientos", m.id), { estado: m.estado === "pagado" ? "pendiente" : "pagado" });
  };
  const borrar = async (m) => { if (confirm("¿Eliminar este movimiento?")) await deleteDoc(doc(db, "movimientos", m.id)); };

  return (
    <div style={{ marginTop: 6 }}>
      {movs.map((m, i) => {
        const inf = servInfo(m.tipoServicio);
        return (
          <Row key={m.id} between style={{ padding: "11px 0", borderBottom: i < movs.length - 1 ? `1px solid ${T.line}` : "none", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 19, width: 24, textAlign: "center" }}>{inf.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {inf.nombre}{m.modalidad === "mensual" ? " · Mensualidad" : (m.cantidad > 1 ? ` · ${m.cantidad} ${m.unidad || inf.unidad}` : "")}
                  {mostrarMascota && <span style={{ color: T.rust }}> — {nombreMascota(m.mascotaId)}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: T.muted }}>{m.fecha}{m.notas ? ` · ${m.notas}` : ""}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <b style={{ fontVariantNumeric: "tabular-nums", fontSize: 14.5 }}>{money(m.monto)}</b>
              <button onClick={() => togglePago(m)} style={{ ...badge, cursor: "pointer", ...(m.estado === "pagado" ? { background: T.okBg, color: T.ok, borderColor: "#284a30" } : { background: T.pendBg, color: T.pend, borderColor: "#4a3c18" }) }}>
                {m.estado === "pagado" ? "✓ Pagado" : "⏳ Pendiente"}
              </button>
              <button onClick={() => borrar(m)} style={xBtn}>✕</button>
            </div>
          </Row>
        );
      })}
    </div>
  );
}

/* ====================== COMPONENTES UI ====================== */
function Avatar({ tipo, big }) {
  const sz = big ? 50 : 38;
  return <div style={{ width: sz, height: sz, borderRadius: 13, background: T.surface2, border: `1px solid ${T.line2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: big ? 26 : 19, flexShrink: 0 }}>{tipo === "gato" ? "🐱" : "🐶"}</div>;
}
function Stat({ label, value, accent, sub }) {
  return (
    <div style={{ ...cardBase, padding: 16 }}>
      <div style={{ fontSize: 11.5, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 800, color: accent, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.dim, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
function Info({ label, value, link }) {
  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: T.dim, textTransform: "uppercase", letterSpacing: .6 }}>{label}</div>
      {link ? <a href={link} style={{ color: T.rustSoft, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>{value || "—"}</a>
            : <div style={{ color: T.text, fontWeight: 600, fontSize: 13.5 }}>{value || "—"}</div>}
    </div>
  );
}
function Modal({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,6,4,.72)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", zIndex: 50, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 18, padding: 22, animation: "pop .25s ease" }}>
        <Row between style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: display, fontSize: 23, fontWeight: 700, color: T.cream, letterSpacing: .5 }}>{title}</h3>
          <button onClick={onClose} style={xBtn}>✕</button>
        </Row>
        {children}
      </div>
    </div>
  );
}
function Campo({ label, value, onChange, ph }) {
  return <div><Label>{label}</Label><input value={value} onChange={onChange} placeholder={ph} style={inp} /></div>;
}
const Label = ({ children }) => <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, marginBottom: 5, letterSpacing: .3 }}>{children}</div>;
const H1 = ({ children }) => <h1 style={{ fontFamily: display, fontSize: 30, fontWeight: 700, color: T.cream, letterSpacing: .5 }}>{children}</h1>;
const H2 = ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 700, color: T.cream }}>{children}</h2>;
const Card = ({ children, style }) => <div style={{ ...cardBase, ...style }}>{children}</div>;
const Empty = ({ texto }) => <p style={{ color: T.dim, fontSize: 13, padding: "18px 0", textAlign: "center" }}>{texto}</p>;
const Pill = ({ children }) => <span style={{ fontSize: 11.5, color: T.muted, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "3px 9px" }}>{children}</span>;
const Grid2 = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>;
function Row({ children, between, style, ...rest }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: between ? "space-between" : "flex-start", ...style }} {...rest}>{children}</div>;
}

/* ====================== ESTILOS ====================== */
const cardBase = { background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 };
const inp = { width: "100%", background: T.surface2, border: `1px solid ${T.line2}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 14 };
const btnPrim = { background: `linear-gradient(180deg,${T.rustSoft},${T.rust})`, color: "#1a0f06", border: "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" };
const btnGhost = { background: "transparent", color: T.text, border: `1px solid ${T.line2}`, borderRadius: 11, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const btnSmall = { ...btnPrim, padding: "7px 12px", fontSize: 12.5 };
const chip = { background: T.surface2, color: T.muted, border: `1px solid ${T.line2}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const chipOn = { background: "#3a2414", borderColor: T.rust, color: T.rustSoft };
const tab = (on) => ({ background: on ? T.rust : "transparent", color: on ? "#1a0f06" : T.muted, border: "none", borderRadius: 9, padding: "7px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer" });
const badge = { fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "4px 11px", border: "1px solid" };
const xBtn = { background: "transparent", border: "none", color: T.dim, fontSize: 15, cursor: "pointer", padding: 4, lineHeight: 1 };

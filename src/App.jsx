import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import logo from "./assets/logo.svg";

/* ====================== TEMA / COLORES (fondo más claro) ====================== */
const T = {
  bg: "#241d16", surface: "#2e261d", surface2: "#382f24", card: "#2b231b",
  line: "#3d3327", line2: "#4a3d2e",
  rust: "#d2772f", rustSoft: "#e0934f", tan: "#e3ad70",
  cream: "#f4ede3", text: "#efe7da", muted: "#b3a796", dim: "#8a7d6c",
  ok: "#74c47d", okBg: "#27361f", pend: "#e8b24a", pendBg: "#352c14",
  danger: "#e0735a",
};
const display = "'Barlow Condensed', system-ui, sans-serif";

/* ====================== LOGIN (usuario unico) ====================== */
// Para cambiar el acceso, edita estas dos lineas:
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
const nombreMes = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${meses[Number(m) - 1]} ${y}`;
};
const esAbono = (m) => m.kind === "abono";
const esCargo = (m) => m.kind !== "abono"; // compatibilidad con registros antiguos

// Comprime una imagen a ~400px y la devuelve como dataURL (para guardarla en la base de datos)
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
      localStorage.setItem("adolf_auth", "1"); onOk();
    } else setErr("Usuario o contraseña incorrectos.");
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(1200px 600px at 50% -10%, #34291e 0%, ${T.bg} 60%)`, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, animation: "pop .4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <img src={logo} alt="" style={{ height: 96, width: "auto" }} />
          <div style={{ fontFamily: display, fontSize: 52, fontWeight: 700, letterSpacing: 6, color: T.cream, lineHeight: 1, marginTop: 6 }}>ADOLF</div>
          <div style={{ color: T.rust, fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginTop: 4, fontWeight: 600 }}>Paseo &amp; Baño · Perros y Gatos</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 18, padding: 22 }}>
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

/* ====================== PANEL PRINCIPAL ====================== */
function Panel({ onLogout }) {
  const [mascotas, setMascotas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [movs, setMovs] = useState([]);
  const [vista, setVista] = useState("resumen");
  const [detalle, setDetalle] = useState(null);

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
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(36,29,22,.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${T.line}` }}>
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
          <Resumen mascotas={mascotas} movs={movs} irMascota={(id) => setDetalle(id)} />
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
function Resumen({ mascotas, movs, irMascota }) {
  const [mes, setMes] = useState(mesActual());
  const mesesDisp = useMemo(() => {
    const set = new Set(movs.map((m) => mesDe(m.fecha)).filter(Boolean)); set.add(mesActual());
    return [...set].sort().reverse();
  }, [movs]);

  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  const cargos = delMes.filter(esCargo);
  const abonos = delMes.filter(esAbono);
  const facturado = cargos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const abonado = abonos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const saldo = facturado - abonado;

  const porTipo = SERVICIOS.map((s) => {
    const items = cargos.filter((m) => m.tipoServicio === s.id);
    return { ...s, total: items.reduce((a, m) => a + Number(m.monto || 0), 0), n: items.length };
  }).filter((x) => x.n > 0).sort((a, b) => b.total - a.total);

  const ranking = mascotas.map((mc) => {
    const items = cargos.filter((m) => m.mascotaId === mc.id);
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
        <Stat label="Facturado" value={money(facturado)} accent={T.tan} sub={`${cargos.length} servicios`} />
        <Stat label="Abonado" value={money(abonado)} accent={T.ok} sub={`${abonos.length} abonos`} />
        <Stat label={saldo >= 0 ? "Saldo pendiente" : "Saldo a favor"} value={money(Math.abs(saldo))} accent={saldo > 0 ? T.pend : T.ok} sub="facturado − abonado" />
        <Stat label="Mascotas activas" value={ranking.length} accent={T.rust} sub={`de ${mascotas.length} registradas`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 22 }}>
        <Card>
          <H2>Ingresos por servicio</H2>
          {porTipo.length === 0 ? <Empty texto="Sin servicios este mes." />
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
          {ranking.length === 0 ? <Empty texto="Sin servicios este mes." />
            : ranking.map((m, i) => (
              <Row key={m.id} between style={{ padding: "10px 0", borderBottom: i < ranking.length - 1 ? `1px solid ${T.line}` : "none", cursor: "pointer" }} onClick={() => irMascota(m.id)}>
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Avatar mascota={m} />
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
  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState(null);

  const lista = mascotas.filter((m) => {
    if (filtro !== "todos" && m.tipo !== filtro) return false;
    const q = buscar.toLowerCase();
    return !q || [m.nombre, m.raza, m.dueno].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between><H1>Mascotas</H1><button onClick={() => setForm({})} style={btnPrim}>+ Nueva mascota</button></Row>
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
            const cargosMes = movs.filter((x) => x.mascotaId === m.id && esCargo(x) && mesDe(x.fecha) === mesActual()).reduce((a, x) => a + Number(x.monto || 0), 0);
            return (
              <div key={m.id} onClick={() => abrir(m.id)} style={{ ...cardBase, cursor: "pointer", transition: "transform .12s, border-color .12s" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = T.rust; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = T.line; }}>
                <Row style={{ gap: 11 }}>
                  <Avatar mascota={m} big />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: T.cream }}>{m.nombre}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{m.raza} · {m.color}</div>
                  </div>
                </Row>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Pill>{m.edad}</Pill><Pill>{nServ} servicio{nServ !== 1 ? "s" : ""}</Pill>
                </div>
                <Row between style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${T.line}` }}>
                  <span style={{ fontSize: 11.5, color: T.muted }}>Facturado este mes</span>
                  <b style={{ color: T.tan }}>{money(cargosMes)}</b>
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

/* ====================== FORM MASCOTA (con foto) ====================== */
function FormMascota({ inicial, onClose }) {
  const editando = !!inicial.id;
  const [f, setF] = useState({ tipo: "perro", nombre: "", raza: "", color: "", edad: "", dueno: "", telefono: "", email: "", foto: "", ...inicial });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const elegirFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    comprimirImagen(file, (dataUrl) => setF((prev) => ({ ...prev, foto: dataUrl })));
  };

  const guardar = async () => {
    if (!f.nombre.trim()) return alert("El nombre es obligatorio.");
    setGuardando(true);
    const data = { tipo: f.tipo, nombre: f.nombre.trim(), raza: f.raza.trim(), color: f.color.trim(), edad: f.edad.trim(), dueno: f.dueno.trim(), telefono: f.telefono.trim(), email: f.email.trim(), foto: f.foto || "" };
    try {
      if (editando) await updateDoc(doc(db, "mascotas", f.id), data);
      else await addDoc(collection(db, "mascotas"), { ...data, createdAt: Date.now() });
      onClose();
    } catch (e) { alert("Error al guardar: " + e.message); setGuardando(false); }
  };

  return (
    <Modal title={editando ? "Editar mascota" : "Nueva mascota"} onClose={onClose}>
      {/* Foto */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: 16, overflow: "hidden", background: T.surface2, border: `1px solid ${T.line2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>
          {f.foto ? <img src={f.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (f.tipo === "gato" ? "🐱" : "🐶")}
        </div>
        <div>
          <label style={{ ...btnGhost, display: "inline-block", cursor: "pointer" }}>
            {f.foto ? "Cambiar foto" : "Subir foto"}
            <input type="file" accept="image/*" onChange={elegirFoto} style={{ display: "none" }} />
          </label>
          {f.foto && <button onClick={() => setF({ ...f, foto: "" })} style={{ ...btnGhost, marginLeft: 8, color: T.danger, borderColor: "#4a2a22" }}>Quitar</button>}
        </div>
      </div>

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
        <Campo label="Teléfono" value={f.telefono} onChange={set("telefono")} ph="ej. 3001234567" />
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
  const [formAbono, setFormAbono] = useState(null);
  const [factura, setFactura] = useState(null);
  const [mes, setMes] = useState(mesActual());

  const susServicios = servicios.filter((s) => s.mascotaId === mascota.id);
  const susMovs = movs.filter((m) => m.mascotaId === mascota.id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const movsMes = susMovs.filter((m) => mesDe(m.fecha) === mes);
  const cargosMes = movsMes.filter(esCargo);
  const abonosMes = movsMes.filter(esAbono);
  const facturado = cargosMes.reduce((a, m) => a + Number(m.monto || 0), 0);
  const abonado = abonosMes.reduce((a, m) => a + Number(m.monto || 0), 0);
  const saldo = facturado - abonado;

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

      <Card>
        <Row between style={{ alignItems: "flex-start" }}>
          <Row style={{ gap: 14 }}>
            <Avatar mascota={mascota} big />
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.cream, fontFamily: display, letterSpacing: .5 }}>{mascota.nombre}</div>
              <div style={{ color: T.muted, fontSize: 13.5 }}>{mascota.tipo === "perro" ? "🐶 Perro" : "🐱 Gato"} · {mascota.raza || "—"} · {mascota.color || "—"} · {mascota.edad || "—"}</div>
            </div>
          </Row>
          <Row style={{ gap: 8 }}>
            <button onClick={() => setEditar(true)} style={btnGhost}>Editar</button>
            <button onClick={borrarMascota} style={{ ...btnGhost, color: T.danger, borderColor: "#4a2a22" }}>Eliminar</button>
          </Row>
        </Row>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 16 }}>
          <Info label="Dueño" value={mascota.dueno} />
          <Info label="Teléfono" value={mascota.telefono} link={mascota.telefono ? `tel:${mascota.telefono}` : null} />
          <Info label="Correo" value={mascota.email} link={mascota.email ? `mailto:${mascota.email}` : null} />
        </div>
      </Card>

      {/* Resumen mensual */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginTop: 16 }}>
        <Card style={{ padding: 16 }}>
          <Row between><Label>Periodo</Label>
            <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto", padding: "5px 8px", fontSize: 12 }}>
              {mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
            </select>
          </Row>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.tan, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{money(facturado)}</div>
          <div style={{ fontSize: 11.5, color: T.muted }}>facturado</div>
        </Card>
        <Stat label="Abonado" value={money(abonado)} accent={T.ok} sub={`${abonosMes.length} abonos`} />
        <Stat label={saldo >= 0 ? "Saldo pendiente" : "Saldo a favor"} value={money(Math.abs(saldo))} accent={saldo > 0 ? T.pend : T.ok} sub={saldo > 0 ? "por cobrar" : "al día"} />
      </div>

      {/* Botón factura */}
      <button onClick={() => setFactura(mes)} style={{ ...btnPrim, marginTop: 16 }}>🧾 Generar factura del periodo</button>

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

      {/* Movimientos */}
      <Card style={{ marginTop: 16 }}>
        <Row between style={{ flexWrap: "wrap", gap: 8 }}><H2>Movimientos del periodo</H2>
          <Row style={{ gap: 8 }}>
            <button onClick={() => setFormAbono({ mascotaId: mascota.id })} style={{ ...btnSmall, background: "transparent", color: T.ok, border: `1px solid ${T.ok}` }}>+ Abono</button>
            <button onClick={() => setFormMov({ mascotaId: mascota.id })} style={btnSmall} disabled={susServicios.length === 0} title={susServicios.length === 0 ? "Agrega un servicio primero" : ""}>+ Servicio</button>
          </Row>
        </Row>
        {movsMes.length === 0 ? <Empty texto={susServicios.length === 0 ? "Primero agrega un servicio, luego registra servicios o abonos." : "Sin movimientos en este periodo."} />
          : <TablaMovs movs={movsMes} mostrarMascota={false} />}
      </Card>

      {editar && <FormMascota inicial={mascota} onClose={() => setEditar(false)} />}
      {formServ && <FormServicio mascotaId={mascota.id} onClose={() => setFormServ(null)} />}
      {formMov && <FormMovimiento mascota={mascota} servicios={servicios} onClose={() => setFormMov(null)} />}
      {formAbono && <FormAbono mascota={mascota} onClose={() => setFormAbono(null)} />}
      {factura && <Factura mascota={mascota} cargos={cargosMes} abonos={abonosMes} mes={factura} onClose={() => setFactura(null)} />}
    </div>
  );
}

/* ====================== FORM SERVICIO ====================== */
function FormServicio({ mascotaId, onClose }) {
  const [tipo, setTipo] = useState("paseo");
  const [modalidad, setModalidad] = useState("unidad");
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
  const [guardando, setGuardando] = useState(false);

  // Autoselecciona el primer servicio de la mascota (corrige el glitch del desplegable)
  useEffect(() => {
    if (servsDeMascota.length && !servsDeMascota.find((s) => s.id === servId)) setServId(servsDeMascota[0].id);
    if (!servsDeMascota.length) setServId("");
  }, [mascotaId, servicios.length]);

  useEffect(() => {
    if (serv) {
      const c = serv.modalidad === "mensual" ? 1 : Number(cantidad || 1);
      setMonto(String(Number(serv.valor || 0) * c));
    }
  }, [servId, cantidad]);

  const guardar = async () => {
    if (!mascotaId) return alert("Selecciona una mascota.");
    if (!serv) return alert("Selecciona un servicio.");
    if (!Number(monto)) return alert("El monto no puede ser 0.");
    setGuardando(true);
    try {
      await addDoc(collection(db, "movimientos"), {
        kind: "cargo", mascotaId, servicioId: servId, tipoServicio: serv.tipo, modalidad: serv.modalidad,
        unidad: serv.unidad, fecha, cantidad: serv.modalidad === "mensual" ? 1 : Number(cantidad),
        monto: Number(monto), notas: notas.trim(), createdAt: Date.now(),
      });
      onClose();
    } catch (e) { alert("Error: " + e.message); setGuardando(false); }
  };

  const inf = serv ? servInfo(serv.tipo) : null;
  const sinServicios = mascotaId && servsDeMascota.length === 0;

  return (
    <Modal title="Registrar servicio" onClose={onClose}>
      {todasMascotas && (
        <>
          <Label>Mascota</Label>
          <select value={mascotaId} onChange={(e) => setMascotaId(e.target.value)} style={inp}>
            <option value="">Selecciona…</option>
            {todasMascotas.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.tipo})</option>)}
          </select>
          <div style={{ height: 12 }} />
        </>
      )}

      {sinServicios ? (
        <div style={{ background: T.pendBg, border: `1px solid ${T.line2}`, borderRadius: 12, padding: 14, color: T.pend, fontSize: 13 }}>
          Esta mascota aún no tiene servicios. Abre su perfil y agrégale uno (paseo, baño, etc.) para poder registrar movimientos.
        </div>
      ) : (
        <>
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
              <Label>Notas (opcional)</Label>
              <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. paseo de 2 horas en el parque" style={inp} />
            </>
          )}
        </>
      )}

      <Row style={{ gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={guardar} disabled={guardando || !serv} style={{ ...btnPrim, flex: 1 }}>{guardando ? "Guardando…" : "Registrar"}</button>
      </Row>
    </Modal>
  );
}

/* ====================== FORM ABONO (pago del cliente) ====================== */
function FormAbono({ mascota, onClose, todasMascotas }) {
  const [mascotaId, setMascotaId] = useState(mascota ? mascota.id : "");
  const [fecha, setFecha] = useState(hoy());
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!mascotaId) return alert("Selecciona una mascota.");
    if (!Number(monto)) return alert("Ingresa el monto del abono.");
    setGuardando(true);
    try {
      await addDoc(collection(db, "movimientos"), {
        kind: "abono", mascotaId, fecha, monto: Number(monto), notas: notas.trim(), createdAt: Date.now(),
      });
      onClose();
    } catch (e) { alert("Error: " + e.message); setGuardando(false); }
  };

  return (
    <Modal title="Registrar abono" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>Un abono es dinero que el cliente paga en cualquier momento. Se descuenta del saldo pendiente.</p>
      {todasMascotas && (
        <>
          <Label>Mascota</Label>
          <select value={mascotaId} onChange={(e) => setMascotaId(e.target.value)} style={inp}>
            <option value="">Selecciona…</option>
            {todasMascotas.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.tipo})</option>)}
          </select>
          <div style={{ height: 12 }} />
        </>
      )}
      <Grid2>
        <div><Label>Fecha</Label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></div>
        <div><Label>Monto del abono</Label><input type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" style={inp} /></div>
      </Grid2>
      <div style={{ height: 12 }} />
      <Label>Notas (opcional)</Label>
      <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="ej. abono en efectivo" style={inp} />
      <Row style={{ gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={{ ...btnPrim, flex: 1, background: `linear-gradient(180deg,#86d18e,${T.ok})`, color: "#0e2412" }}>{guardando ? "Guardando…" : "Registrar abono"}</button>
      </Row>
    </Modal>
  );
}

/* ====================== FACTURA VIRTUAL ====================== */
function Factura({ mascota, cargos, abonos, mes, onClose }) {
  const facturado = cargos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const abonado = abonos.reduce((a, m) => a + Number(m.monto || 0), 0);
  const saldo = facturado - abonado;

  const lineasCargo = [...cargos].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const lineasAbono = [...abonos].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));

  const tel = (mascota.telefono || "").replace(/\D/g, "");

  const textoResumen = () => {
    let t = `*ADOLF* — Estado de cuenta\n${nombreMes(mes)}\n\nMascota: ${mascota.nombre} (${mascota.tipo})\nCliente: ${mascota.dueno || "—"}\n\n*SERVICIOS*\n`;
    lineasCargo.forEach((c) => { const i = servInfo(c.tipoServicio); t += `• ${c.fecha} ${i.nombre}${c.modalidad === "mensual" ? " (mensualidad)" : (c.cantidad > 1 ? ` x${c.cantidad}` : "")}: ${money(c.monto)}\n`; });
    t += `Total servicios: ${money(facturado)}\n`;
    if (lineasAbono.length) { t += `\n*ABONOS*\n`; lineasAbono.forEach((a) => { t += `• ${a.fecha}: ${money(a.monto)}\n`; }); t += `Total abonado: ${money(abonado)}\n`; }
    t += `\n*SALDO ${saldo >= 0 ? "PENDIENTE" : "A FAVOR"}: ${money(Math.abs(saldo))}*`;
    return t;
  };

  const whatsapp = () => {
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(textoResumen())}`;
    window.open(url, "_blank");
  };

  const imprimir = () => {
    const filasC = lineasCargo.map((c) => { const i = servInfo(c.tipoServicio); return `<tr><td>${c.fecha}</td><td>${i.nombre}${c.modalidad === "mensual" ? " (mensualidad)" : (c.cantidad > 1 ? " x" + c.cantidad : "")}${c.notas ? " — " + c.notas : ""}</td><td class="r">${money(c.monto)}</td></tr>`; }).join("");
    const filasA = lineasAbono.map((a) => `<tr><td>${a.fecha}</td><td>Abono${a.notas ? " — " + a.notas : ""}</td><td class="r">${money(a.monto)}</td></tr>`).join("");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Factura ${mascota.nombre} ${nombreMes(mes)}</title>
      <style>
        *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
        body{margin:0;padding:32px;color:#1c1712;background:#fff}
        .wrap{max-width:640px;margin:0 auto}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #d2772f;padding-bottom:14px}
        .brand{font-size:34px;font-weight:800;letter-spacing:3px;color:#1c1712}
        .brand small{display:block;font-size:11px;letter-spacing:2px;color:#d2772f;font-weight:700}
        .meta{text-align:right;font-size:12px;color:#555;line-height:1.6}
        h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#d2772f;margin:22px 0 6px}
        .cli{font-size:14px;line-height:1.7;margin-top:14px}
        table{width:100%;border-collapse:collapse;margin-top:4px;font-size:13px}
        th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #eee}
        th{font-size:11px;text-transform:uppercase;color:#999}
        .r{text-align:right;font-variant-numeric:tabular-nums}
        .tot{margin-top:18px;margin-left:auto;width:280px;font-size:14px}
        .tot div{display:flex;justify-content:space-between;padding:6px 0}
        .tot .big{border-top:2px solid #1c1712;margin-top:6px;padding-top:10px;font-size:18px;font-weight:800}
        .pend{color:#c47d10}.fav{color:#2f8f3a}
        .foot{margin-top:30px;font-size:11px;color:#999;text-align:center}
      </style></head><body><div class="wrap">
      <div class="head">
        <div class="brand">ADOLF<small>PASEO &amp; BAÑO · PERROS Y GATOS</small></div>
        <div class="meta"><b>Estado de cuenta</b><br>${nombreMes(mes)}<br>Emitido: ${hoy()}</div>
      </div>
      <div class="cli"><b>Mascota:</b> ${mascota.nombre} (${mascota.tipo}${mascota.raza ? " · " + mascota.raza : ""})<br>
        <b>Cliente:</b> ${mascota.dueno || "—"}${mascota.telefono ? " · " + mascota.telefono : ""}</div>
      <h2>Servicios del periodo</h2>
      <table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Valor</th></tr></thead>
      <tbody>${filasC || '<tr><td colspan="3" style="color:#999">Sin servicios</td></tr>'}</tbody></table>
      ${lineasAbono.length ? `<h2>Abonos recibidos</h2><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Valor</th></tr></thead><tbody>${filasA}</tbody></table>` : ""}
      <div class="tot">
        <div><span>Total servicios</span><b>${money(facturado)}</b></div>
        <div><span>Total abonado</span><b>− ${money(abonado)}</b></div>
        <div class="big ${saldo >= 0 ? "pend" : "fav"}"><span>Saldo ${saldo >= 0 ? "pendiente" : "a favor"}</span><span>${money(Math.abs(saldo))}</span></div>
      </div>
      <div class="foot">Gracias por confiar en ADOLF 🐾</div>
      </div>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Permite las ventanas emergentes para imprimir/guardar la factura."); return; }
    w.document.write(html); w.document.close();
  };

  return (
    <Modal title="Factura del periodo" onClose={onClose}>
      <div style={{ background: "#fff", color: "#1c1712", borderRadius: 12, padding: 18, maxHeight: "52vh", overflowY: "auto" }}>
        <Row between style={{ borderBottom: "3px solid #d2772f", paddingBottom: 10 }}>
          <div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>ADOLF</div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#666" }}><b>Estado de cuenta</b><br />{nombreMes(mes)}</div>
        </Row>
        <div style={{ fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
          <b>Mascota:</b> {mascota.nombre} ({mascota.tipo})<br />
          <b>Cliente:</b> {mascota.dueno || "—"}{mascota.telefono ? " · " + mascota.telefono : ""}
        </div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#d2772f", fontWeight: 700, margin: "16px 0 4px" }}>Servicios</div>
        {lineasCargo.length === 0 ? <div style={{ color: "#999", fontSize: 13 }}>Sin servicios</div>
          : lineasCargo.map((c) => { const i = servInfo(c.tipoServicio); return (
            <Row key={c.id} between style={{ fontSize: 13, padding: "5px 0", borderBottom: "1px solid #eee" }}>
              <span>{c.fecha} · {i.nombre}{c.modalidad === "mensual" ? " (mens.)" : (c.cantidad > 1 ? ` x${c.cantidad}` : "")}</span><b>{money(c.monto)}</b>
            </Row>); })}
        {lineasAbono.length > 0 && <>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#2f8f3a", fontWeight: 700, margin: "16px 0 4px" }}>Abonos</div>
          {lineasAbono.map((a) => (
            <Row key={a.id} between style={{ fontSize: 13, padding: "5px 0", borderBottom: "1px solid #eee" }}>
              <span>{a.fecha} · Abono{a.notas ? " — " + a.notas : ""}</span><b>− {money(a.monto)}</b>
            </Row>))}
        </>}
        <div style={{ marginTop: 14, fontSize: 14 }}>
          <Row between style={{ padding: "3px 0" }}><span>Total servicios</span><b>{money(facturado)}</b></Row>
          <Row between style={{ padding: "3px 0" }}><span>Total abonado</span><b>− {money(abonado)}</b></Row>
          <Row between style={{ borderTop: "2px solid #1c1712", marginTop: 6, paddingTop: 8, fontSize: 17, fontWeight: 800, color: saldo >= 0 ? "#c47d10" : "#2f8f3a" }}><span>Saldo {saldo >= 0 ? "pendiente" : "a favor"}</span><span>{money(Math.abs(saldo))}</span></Row>
        </div>
      </div>
      <Row style={{ gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button onClick={imprimir} style={{ ...btnPrim, flex: 1, minWidth: 130 }}>🖨️ Imprimir / PDF</button>
        <button onClick={whatsapp} disabled={!tel} title={!tel ? "La mascota no tiene teléfono" : ""} style={{ ...btnPrim, flex: 1, minWidth: 130, background: tel ? "linear-gradient(180deg,#3ed47e,#1faa5a)" : T.surface2, color: tel ? "#0e2412" : T.dim }}>💬 WhatsApp</button>
      </Row>
    </Modal>
  );
}

/* ====================== MOVIMIENTOS (vista global) ====================== */
function Movimientos({ mascotas, servicios, movs }) {
  const [mes, setMes] = useState(mesActual());
  const [tipo, setTipo] = useState("todos"); // todos | cargo | abono
  const [form, setForm] = useState(false);
  const [abono, setAbono] = useState(false);

  const mesesDisp = useMemo(() => {
    const set = new Set(movs.map((m) => mesDe(m.fecha)).filter(Boolean)); set.add(mesActual());
    return [...set].sort().reverse();
  }, [movs]);

  const lista = movs
    .filter((m) => mesDe(m.fecha) === mes)
    .filter((m) => tipo === "todos" || (tipo === "abono" ? esAbono(m) : esCargo(m)))
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const nombreMascota = (id) => (mascotas.find((m) => m.id === id) || {}).nombre || "—";
  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  const facturado = delMes.filter(esCargo).reduce((a, m) => a + Number(m.monto || 0), 0);
  const abonado = delMes.filter(esAbono).reduce((a, m) => a + Number(m.monto || 0), 0);

  return (
    <div style={{ animation: "pop .35s ease" }}>
      <Row between style={{ flexWrap: "wrap", gap: 8 }}><H1>Movimientos y pagos</H1>
        <Row style={{ gap: 8 }}>
          <button onClick={() => setAbono(true)} style={{ ...btnPrim, background: "transparent", color: T.ok, border: `1px solid ${T.ok}` }} disabled={mascotas.length === 0}>+ Abono</button>
          <button onClick={() => setForm(true)} style={btnPrim} disabled={servicios.length === 0}>+ Servicio</button>
        </Row>
      </Row>
      <Row style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inp, width: "auto" }}>
          {mesesDisp.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
        </select>
        <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 12, padding: 4, border: `1px solid ${T.line}` }}>
          {[["todos","Todos"],["cargo","Servicios"],["abono","Abonos"]].map(([k, l]) => (
            <button key={k} onClick={() => setTipo(k)} style={tab(tipo === k)}>{l}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>Facturado: <b style={{ color: T.tan }}>{money(facturado)}</b></span>
          <span style={{ fontSize: 13 }}>Abonado: <b style={{ color: T.ok }}>{money(abonado)}</b></span>
          <span style={{ fontSize: 13 }}>Saldo: <b style={{ color: facturado - abonado > 0 ? T.pend : T.ok }}>{money(Math.abs(facturado - abonado))}</b></span>
        </div>
      </Row>

      <Card style={{ marginTop: 16 }}>
        {lista.length === 0 ? <Empty texto="Sin movimientos en este periodo." />
          : <TablaMovs movs={lista} mostrarMascota nombreMascota={nombreMascota} />}
      </Card>

      {form && <FormMovimiento servicios={servicios} todasMascotas={mascotas} onClose={() => setForm(false)} />}
      {abono && <FormAbono todasMascotas={mascotas} onClose={() => setAbono(false)} />}
    </div>
  );
}

/* ====================== TABLA DE MOVIMIENTOS ====================== */
function TablaMovs({ movs, mostrarMascota, nombreMascota }) {
  const borrar = async (m) => { if (confirm("¿Eliminar este movimiento?")) await deleteDoc(doc(db, "movimientos", m.id)); };

  return (
    <div style={{ marginTop: 6 }}>
      {movs.map((m, i) => {
        const abono = esAbono(m);
        const inf = abono ? null : servInfo(m.tipoServicio);
        return (
          <Row key={m.id} between style={{ padding: "11px 0", borderBottom: i < movs.length - 1 ? `1px solid ${T.line}` : "none", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 19, width: 24, textAlign: "center" }}>{abono ? "💵" : inf.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {abono ? "Abono" : `${inf.nombre}${m.modalidad === "mensual" ? " · Mensualidad" : (m.cantidad > 1 ? ` · ${m.cantidad} ${m.unidad || inf.unidad}` : "")}`}
                  {mostrarMascota && <span style={{ color: T.rust }}> — {nombreMascota(m.mascotaId)}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: T.muted }}>{m.fecha}{m.notas ? ` · ${m.notas}` : ""}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <b style={{ fontVariantNumeric: "tabular-nums", fontSize: 14.5, color: abono ? T.ok : T.text }}>{abono ? "− " : ""}{money(m.monto)}</b>
              <span style={{ ...badge, ...(abono ? { background: T.okBg, color: T.ok, borderColor: "#3a5a36" } : { background: T.surface2, color: T.muted, borderColor: T.line2 }) }}>{abono ? "Abono" : "Servicio"}</span>
              <button onClick={() => borrar(m)} style={xBtn}>✕</button>
            </div>
          </Row>
        );
      })}
    </div>
  );
}

/* ====================== COMPONENTES UI ====================== */
function Avatar({ mascota, big }) {
  const sz = big ? 50 : 38;
  if (mascota && mascota.foto)
    return <img src={mascota.foto} alt="" style={{ width: sz, height: sz, borderRadius: 13, objectFit: "cover", border: `1px solid ${T.line2}`, flexShrink: 0 }} />;
  return <div style={{ width: sz, height: sz, borderRadius: 13, background: T.surface2, border: `1px solid ${T.line2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: big ? 26 : 19, flexShrink: 0 }}>{mascota && mascota.tipo === "gato" ? "🐱" : "🐶"}</div>;
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(12,9,6,.72)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", zIndex: 50, overflowY: "auto" }}>
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
const btnPrim = { background: `linear-gradient(180deg,${T.rustSoft},${T.rust})`, color: "#241405", border: "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" };
const btnGhost = { background: "transparent", color: T.text, border: `1px solid ${T.line2}`, borderRadius: 11, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const btnSmall = { ...btnPrim, padding: "7px 12px", fontSize: 12.5 };
const chip = { background: T.surface2, color: T.muted, border: `1px solid ${T.line2}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const chipOn = { background: "#4a2f17", borderColor: T.rust, color: T.rustSoft };
const tab = (on) => ({ background: on ? T.rust : "transparent", color: on ? "#241405" : T.muted, border: "none", borderRadius: 9, padding: "7px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer" });
const badge = { fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px", border: "1px solid" };
const xBtn = { background: "transparent", border: "none", color: T.dim, fontSize: 15, cursor: "pointer", padding: 4, lineHeight: 1 };

# 🐕 ADOLF — Sistema de Gestión de Servicios

App web en tiempo real para gestionar perros y gatos: perfiles, servicios, paseos, baños, pagos y un resumen de cuánto genera cada mascota al mes.

**Tecnología:** React + Vite + Firebase Firestore + Vercel
**Acceso:** usuario único `YELIANIS` con permisos completos.

---

## 🔑 Datos de acceso

- **Usuario:** `YELIANIS`
- **Contraseña:** `Adolf2026`

> Para cambiar la contraseña: abre `src/App.jsx`, busca la línea `const CLAVE = "Adolf2026";` y reemplázala por la que quieras. Vuelve a desplegar.

---

## PASO 1 — Crear proyecto en Firebase (5 minutos)

1. Entra a https://console.firebase.google.com
2. Clic en **"Agregar proyecto"** → nombre: `adolf-gestion`
3. Desactiva Google Analytics (no es necesario) → **Crear proyecto**
4. Cuando cargue, haz clic en el icono **`</>`** (Web) para agregar una app web
5. Nombre de la app: `Adolf` → **Registrar app**
6. **Copia el bloque `firebaseConfig`** que aparece — lo necesitarás en el Paso 3

### Activar Firestore
1. Menú izquierdo → **Compilación** → **Firestore Database** → **Crear base de datos**
2. Selecciona **"Iniciar en modo de producción"** → Siguiente
3. Ubicación: `nam5 (us-central)` → **Listo**
4. Pestaña **Reglas** → borra todo y escribe exactamente esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /mascotas/{id}    { allow read, write: if true; }
    match /servicios/{id}   { allow read, write: if true; }
    match /movimientos/{id} { allow read, write: if true; }
  }
}
```

5. Clic en **Publicar**

---

## PASO 2 — Subir el código a GitHub (5 minutos)

1. Crea una cuenta gratis en https://github.com si no tienes
2. Clic en **"New repository"** → nombre: `adolf-gestion` → **Create repository**
3. En la pantalla que aparece, haz clic en **"uploading an existing file"**
4. Descomprime el `.zip` y **arrastra TODOS los archivos y carpetas** que están adentro
   (carpeta `src`, `package.json`, `index.html`, `vite.config.js`, etc.)
   > ⚠️ No subas la carpeta `node_modules` ni el archivo `.env` (no vienen en el zip a propósito).
5. Clic en **"Commit changes"**

---

## PASO 3 — Desplegar en Vercel (5 minutos)

1. Entra a https://vercel.com y regístrate con tu cuenta de GitHub
2. Clic en **"Add New… → Project"**
3. Selecciona el repositorio `adolf-gestion` → **Import**
4. **ANTES de hacer Deploy**, abre la sección **"Environment Variables"** y agrega estas 6 claves
   con los valores reales de tu `firebaseConfig` (Paso 1):

| Nombre | Valor (ejemplo) |
|---|---|
| `VITE_FIREBASE_API_KEY` | tu apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | adolf-gestion.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | adolf-gestion |
| `VITE_FIREBASE_STORAGE_BUCKET` | adolf-gestion.appspot.com |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | tu messagingSenderId |
| `VITE_FIREBASE_APP_ID` | tu appId |

5. Clic en **"Deploy"** → espera 2-3 minutos
6. Vercel te dará una URL tipo `adolf-gestion.vercel.app`

> Si cambias variables después, ve a **Deployments → … → Redeploy** para que apliquen.

---

## ✅ Cómo se usa la app

1. **Entra** con `YELIANIS` / `Adolf2026`.
2. **Mascotas** → *Nueva mascota*: crea el perfil (perro o gato) con nombre, raza, color, edad, dueño, teléfono y correo.
3. Abre el perfil de la mascota → **Servicios y tarifas → Agregar servicio**:
   elige el tipo (paseo por horas, baño, baño + corte, hotel por noches, guardería por horas, adiestramiento)
   y define si se cobra **por mensualidad** o **por unidad** (hora / sesión / noche), con su valor.
4. **Movimientos y pagos → Registrar**: anota cada paseo, baño o cobro, con fecha y estado **pagado / pendiente**.
   Toca la etiqueta del estado para cambiarla en un clic.
5. **Resumen**: mira por mes cuánto se facturó, cuánto está cobrado, cuánto está pendiente,
   el desglose por servicio y **cuánto genera cada mascota**.

---

## 💻 Probar en tu computador (opcional)

```bash
npm install
cp .env.example .env     # rellena con tus datos de Firebase
npm run dev
```

Abre la URL que aparece (normalmente http://localhost:5173).

---

## 🗂️ Estructura del proyecto

```
adolf-gestion/
├── src/
│   ├── App.jsx          ← toda la lógica de la app
│   ├── firebase.js      ← conexión a Firebase
│   ├── main.jsx
│   └── assets/
│       ├── logo.svg     ← silueta del dóberman
│       └── favicon.svg
├── index.html
├── package.json
├── vite.config.js
├── firestore.rules
├── firebase.json
├── .env.example
└── README.md
```

Los datos se guardan en tres colecciones de Firestore: `mascotas`, `servicios` y `movimientos`.

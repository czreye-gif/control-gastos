# Control de Gastos

App web para registrar y controlar gastos personales desde cualquier dispositivo con navegador. Construida con React + Vite, Firebase (Auth + Firestore) y desplegada en GitHub Pages.

## Funciones

- Registro de gastos en 2 toques: monto + categoría + guardar.
- Inicio de sesión con Google (cada usuario ve solo sus propios gastos).
- Lista de gastos agrupada por día, con totales.
- Reportes con gráfica de pastel por categoría y barras de los últimos 6 meses.
- Funciona en cualquier dispositivo (celular, tablet, PC) con navegador e internet.

## 1. Crear el proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/) e inicia sesión con tu cuenta de Google.
2. Haz clic en **Agregar proyecto**, ponle un nombre (ej. `control-gastos`) y créalo (puedes desactivar Google Analytics, no es necesario).
3. En el menú izquierdo entra a **Compilación > Authentication**, pestaña **Sign-in method**, habilita el proveedor **Google**.
4. Entra a **Compilación > Firestore Database**, haz clic en **Crear base de datos**, elige modo **producción** y la región más cercana a ti.
5. En **Reglas** de Firestore, pega el contenido del archivo [`firestore.rules`](firestore.rules) de este repo y publica. Esto asegura que cada usuario solo pueda leer/escribir sus propios gastos.
6. Ve a **Configuración del proyecto** (ícono de engrane) > pestaña **General** > sección **Tus apps** > haz clic en el ícono `</>` (Web) para registrar una nueva app web. Ponle un nombre y registra.
7. Firebase te mostrará un objeto `firebaseConfig` con valores como `apiKey`, `authDomain`, etc. Copia esos valores.
8. Abre [`src/firebase.js`](src/firebase.js) en este proyecto y reemplaza los valores de `firebaseConfig` con los tuyos.
9. En **Authentication > Settings > Authorized domains**, agrega el dominio donde vivirá la app en GitHub Pages, por ejemplo `tu-usuario.github.io` (sin esto, el login con Google fallará en producción).

## 2. Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Primera versión de la app de control de gastos"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/control-gastos.git
git push -u origin main
```

## 3. Activar GitHub Pages

1. En GitHub, ve a **Settings > Pages** del repositorio.
2. En **Build and deployment > Source**, selecciona **GitHub Actions**.
3. Cada vez que hagas `git push` a `main`, el workflow en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compilará la app con Node 20 y la publicará automáticamente.
4. Tu app quedará disponible en `https://TU_USUARIO.github.io/control-gastos/`.

> Importante: si renombras el repositorio, actualiza la constante `REPO_NAME` en [`vite.config.js`](vite.config.js) para que coincida.

## 4. Desarrollo local (requiere Node.js 18+)

```bash
npm install
npm run dev      # servidor local con hot reload
npm run build    # compila a /dist (lo mismo que corre GitHub Actions)
npm run preview  # sirve la build de producción localmente
```

## Estructura

```
src/
  firebase.js          Configuración y conexión con Firebase
  contexts/AuthContext  Estado de sesión (login/logout con Google)
  utils/useExpenses.js  Lectura/escritura de gastos en Firestore
  utils/categories.js   Categorías predefinidas
  components/
    Login.jsx           Pantalla de inicio de sesión
    Home.jsx             Lista de gastos + botón flotante para agregar
    AddExpense.jsx       Formulario rápido (hoja inferior) para crear/editar
    ExpenseList.jsx      Lista agrupada por día
    Reports.jsx          Gráficas y totales por mes/categoría
    NavBar.jsx           Navegación inferior
```

## Modelo de datos en Firestore

```
users/{uid}/expenses/{expenseId}
  amount: number
  category: string   (id de src/utils/categories.js)
  note: string
  date: string        (YYYY-MM-DD)
  createdAt: timestamp
```

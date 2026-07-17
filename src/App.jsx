import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CategoriesProvider } from './contexts/CategoriesContext'
import { ConfirmProvider } from './contexts/ConfirmContext'
import Login from './components/Login'
import Home from './components/Home'
import Movements from './components/Movements'
import Reports from './components/Reports'
import Budgets from './components/Budgets'
import Recurring, { RecurringAlerts, RecurringConfirm } from './components/Recurring'
import Accounts from './components/Accounts'
import Migration from './components/Migration'
import Ahorros from './components/Ahorros'
import Prestamos from './components/Prestamos'
import GastosFacturables from './components/GastosFacturables'
import Categories from './components/Categories'
import NavBar from './components/NavBar'
import { useOnlineStatus } from './utils/useOnlineStatus'

function AppShell() {
  const { user, loading } = useAuth()
  const online = useOnlineStatus()

  if (loading) {
    return <div className="splash">Cargando...</div>
  }

  if (!user) {
    return <Login />
  }

  return (
    <ConfirmProvider>
    <CategoriesProvider>
      <div className="app-shell">
        {!online && (
          <div className="offline-banner">
            Sin conexión — tus cambios se guardan en el dispositivo y se sincronizarán solos
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movimientos" element={<Movements />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/presupuestos" element={<Budgets />} />
          <Route path="/recurrentes" element={<Recurring />} />
          <Route path="/cuentas" element={<Accounts />} />
          <Route path="/ahorros" element={<Ahorros />} />
          <Route path="/prestamos" element={<Prestamos />} />
          <Route path="/facturables" element={<GastosFacturables />} />
          <Route path="/categorias" element={<Categories />} />
          <Route path="/migracion" element={<Migration />} />
        </Routes>
        <NavBar />
        <RecurringConfirm />
        <RecurringAlerts />
      </div>
    </CategoriesProvider>
    </ConfirmProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AuthProvider>
  )
}

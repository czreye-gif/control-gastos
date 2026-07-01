import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CategoriesProvider } from './contexts/CategoriesContext'
import Login from './components/Login'
import Home from './components/Home'
import Reports from './components/Reports'
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
    <CategoriesProvider>
      <div className="app-shell">
        {!online && (
          <div className="offline-banner">
            Sin conexión — tus cambios se guardan en el dispositivo y se sincronizarán solos
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/categorias" element={<Categories />} />
        </Routes>
        <NavBar />
      </div>
    </CategoriesProvider>
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

import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Home from './components/Home'
import Reports from './components/Reports'
import NavBar from './components/NavBar'

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="splash">Cargando...</div>
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reportes" element={<Reports />} />
      </Routes>
      <NavBar />
    </div>
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

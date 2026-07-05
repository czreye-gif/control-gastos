import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useOnlineStatus } from '../utils/useOnlineStatus'

export default function NavBar() {
  const { user, logout } = useAuth()
  const online = useOnlineStatus()
  const [showSheet, setShowSheet] = useState(false)

  const initial = user?.email?.[0]?.toUpperCase() ?? '?'

  const handleLogout = () => {
    setShowSheet(false)
    logout()
  }

  // "Matar" la app: borra cualquier caché del navegador (Cache Storage y
  // service workers, por si algún día se agregan) y recarga con un parámetro
  // único en la URL para forzar que pida todo de nuevo al servidor en vez de
  // reusar el HTML/JS viejo que tenía guardado localmente.
  const handleForceRefresh = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } finally {
      window.location.href = `${window.location.pathname}?refresh=${Date.now()}`
    }
  }

  return (
    <>
      <nav className="navbar">
        <NavLink to="/" className="nav-item" end>
          <span>🏠</span>
          <span>Inicio</span>
        </NavLink>
        <NavLink to="/movimientos" className="nav-item">
          <span>📋</span>
          <span>Movimientos</span>
        </NavLink>
        <NavLink to="/reportes" className="nav-item">
          <span>📊</span>
          <span>Reportes</span>
        </NavLink>
        <button className="nav-item" onClick={() => setShowSheet(true)} aria-label="Mi cuenta">
          <span className="nav-avatar">
            {initial}
            <span className={`nav-online-dot ${online ? 'online' : 'offline'}`} />
          </span>
          <span>Cuenta</span>
        </button>
      </nav>

      {showSheet && (
        <div className="sheet-backdrop" onClick={() => setShowSheet(false)}>
          <div className="sheet account-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />

            <div className="account-sheet-profile">
              <div className="account-sheet-avatar">{initial}</div>
              <div className="account-sheet-info">
                <p className="account-sheet-email">{user?.email}</p>
                <p className={`account-sheet-status ${online ? 'online' : 'offline'}`}>
                  <span className="account-sheet-dot" />
                  {online ? 'En línea' : 'Sin conexión — cambios guardados localmente'}
                </p>
              </div>
            </div>

            <button className="btn-ghost account-sheet-refresh" onClick={handleForceRefresh}>
              🔄 Forzar actualización de la app
            </button>
            <p className="account-sheet-refresh-hint">
              Úsalo si hiciste cambios recientes y no se ven todavía.
            </p>

            <div className="account-sheet-actions">
              <button className="btn-ghost account-sheet-btn" onClick={() => setShowSheet(false)}>
                Cerrar
              </button>
              <button className="btn-danger-solid account-sheet-btn" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

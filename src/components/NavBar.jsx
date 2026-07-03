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

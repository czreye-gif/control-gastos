import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function NavBar() {
  const { user, logout } = useAuth()

  return (
    <nav className="navbar">
      <NavLink to="/" className="nav-item" end>
        <span>🏠</span>
        <span>Inicio</span>
      </NavLink>
      <NavLink to="/reportes" className="nav-item">
        <span>📊</span>
        <span>Reportes</span>
      </NavLink>
      <button className="nav-item" onClick={logout} title={user?.email}>
        <span>👤</span>
        <span>Salir</span>
      </button>
    </nav>
  )
}

import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">💵</div>
        <h1>Control de Gastos</h1>
        <p>Registra tus gastos en segundos y entiende en qué se va tu dinero.</p>
        <button className="btn-google" onClick={login}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.9 6 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.9 6 29.7 4 24 4c-7.5 0-14 4.1-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.6 0 10.6-1.9 14.6-5.1l-6.7-5.5C29.7 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.9 39.7 16.4 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.8l6.7 5.5C41.9 35.9 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z"/>
          </svg>
          Continuar con Google
        </button>
      </div>
    </div>
  )
}

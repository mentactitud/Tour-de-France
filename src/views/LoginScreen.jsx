import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { TITULO, SUBTITULO } from '../variante.js'

export default function LoginScreen({ onGuestAccess }) {
  const { loginWithEmail, registerWithEmail, authError, setAuthError } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setSubmitting(true)
    try {
      if (isRegister) {
        await registerWithEmail(email, password, displayName)
      } else {
        await loginWithEmail(email, password)
      }
    } catch (err) {
      // Manejado en AuthContext
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen-container">
      <div className="login-card-box">
        <div className="login-brand">
          <div className="brand-logo-icon">🎯</div>
          <h1>{TITULO}</h1>
          <p className="brand-sub">{SUBTITULO}</p>
        </div>

        <div className="auth-tab-switch">
          <button
            type="button"
            className={!isRegister ? 'active' : ''}
            onClick={() => { setIsRegister(false); setAuthError(null); }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={isRegister ? 'active' : ''}
            onClick={() => { setIsRegister(true); setAuthError(null); }}
          >
            Crear Cuenta
          </button>
        </div>

        {authError && <div className="auth-error-alert">{authError}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <div className="form-group">
              <label>Nombre del cazador</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Joan Martí"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Correo Electrónico</label>
            <input
              type="email"
              className="input-field"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Procesando...' : isRegister ? 'Registrarse en Caza Tracker' : 'Iniciar Sesión'}
          </button>
        </form>

        {onGuestAccess && (
          <div className="guest-access-link">
            <button type="button" className="link-btn-guest" onClick={onGuestAccess}>
              Continuar en modo local sin sesión →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

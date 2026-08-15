import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function AuthModal({ isOpen, onClose }) {
  const { currentUser, loginWithEmail, registerWithEmail, logout, authError, setAuthError } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

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
      onClose()
    } catch (err) {
      // Manejado por AuthContext
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    await logout()
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card auth-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{currentUser ? 'Cuenta de Cazador' : isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        {currentUser ? (
          <div className="auth-profile-view">
            <div className="user-avatar-large">
              <span>{(currentUser.displayName || currentUser.email || 'C')[0].toUpperCase()}</span>
            </div>
            <h3 className="user-name">{currentUser.displayName || 'Cazador Registrado'}</h3>
            <p className="user-email">{currentUser.email}</p>
            <div className="sync-status-badge">
              <span className="dot online"></span> Sincronizado con Cloud Firestore
            </div>

            <button className="btn btn-secondary btn-block logout-btn" onClick={handleLogout}>
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <div className="auth-form-container">
            {authError && <div className="auth-error-alert">{authError}</div>}

            <form onSubmit={handleSubmit}>
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
                {submitting ? 'Procesando...' : isRegister ? 'Registrarse' : 'Entrar'}
              </button>
            </form>

            <div className="auth-toggle-mode">
              {isRegister ? (
                <p>¿Ya tienes cuenta? <button type="button" className="link-btn" onClick={() => { setIsRegister(false); setAuthError(null); }}>Inicia Sesión</button></p>
              ) : (
                <p>¿No tienes cuenta? <button type="button" className="link-btn" onClick={() => { setIsRegister(true); setAuthError(null); }}>Regístrate gratis</button></p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

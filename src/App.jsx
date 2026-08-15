import { useState, useEffect } from 'react'
import Registro from './views/Registro.jsx'
import Historial from './views/Historial.jsx'
import Estadisticas from './views/Estadisticas.jsx'
import Mapa from './views/Mapa.jsx'
import Gastos from './views/Gastos.jsx'
import Ajustes from './views/Ajustes.jsx'
import LoginScreen from './views/LoginScreen.jsx'
import { TITULO, SUBTITULO } from './variante.js'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import AuthModal from './components/AuthModal.jsx'
import { initFirestoreSync } from './utils/firestoreSync.js'

const TABS = [
  { id: 'registro', label: 'Registro', ico: '✚' },
  { id: 'historial', label: 'Historial', ico: '☰' },
  { id: 'stats', label: 'Estadíst.', ico: '▦' },
  { id: 'mapa', label: 'Mapa', ico: '⌖' },
  { id: 'gastos', label: 'Gastos', ico: '€' },
  { id: 'ajustes', label: 'Ajustes', ico: '⚙' }
]

function AppContent() {
  const [tab, setTab] = useState('registro')
  const [editId, setEditId] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [guestMode, setGuestMode] = useState(false)
  const { currentUser, loading } = useAuth()

  useEffect(() => {
    if (currentUser?.uid) {
      initFirestoreSync(currentUser.uid)
      setGuestMode(false)
    }
  }, [currentUser?.uid])

  function editar(id) {
    setEditId(id)
    setTab('registro')
  }

  // Si no hay usuario autenticado y no ha seleccionado el modo invitado, mostrar la Pantalla de Login
  if (!loading && !currentUser && !guestMode) {
    return <LoginScreen onGuestAccess={() => setGuestMode(true)} />
  }

  return (
    <>
      <header className="app-header">
        <div className="header-titles">
          <h1>{TITULO}</h1>
          <span className="sub">{SUBTITULO}</span>
        </div>

        <button className="user-header-btn" onClick={() => setShowAuthModal(true)}>
          {currentUser ? (
            <div className="user-avatar-mini" title={currentUser.displayName || currentUser.email}>
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="Avatar" />
              ) : (
                <span>{(currentUser.displayName || currentUser.email || 'C')[0].toUpperCase()}</span>
              )}
            </div>
          ) : (
            <span className="login-pill">Entrar</span>
          )}
        </button>
      </header>

      <main className="content">
        {tab === 'registro' && (
          <Registro
            editId={editId}
            onDone={() => { setEditId(null); setTab('historial') }}
            onCancel={() => setEditId(null)}
          />
        )}
        {tab === 'historial' && <Historial onEdit={editar} />}
        {tab === 'stats' && <Estadisticas />}
        {tab === 'mapa' && <Mapa />}
        {tab === 'gastos' && <Gastos />}
        {tab === 'ajustes' && <Ajustes onOpenAuth={() => setShowAuthModal(true)} />}
      </main>

      <nav className="tabbar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => { if (t.id !== 'registro') setEditId(null); setTab(t.id) }}
          >
            <span className="ico" aria-hidden="true">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

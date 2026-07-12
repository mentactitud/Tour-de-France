import { useState } from 'react'
import Registro from './views/Registro.jsx'
import Historial from './views/Historial.jsx'
import Estadisticas from './views/Estadisticas.jsx'
import Mapa from './views/Mapa.jsx'
import Ajustes from './views/Ajustes.jsx'
import { TITULO, SUBTITULO } from './variante.js'

const TABS = [
  { id: 'registro', label: 'Registro', ico: '✚' },
  { id: 'historial', label: 'Historial', ico: '☰' },
  { id: 'stats', label: 'Estadísticas', ico: '▦' },
  { id: 'mapa', label: 'Mapa', ico: '⌖' },
  { id: 'ajustes', label: 'Ajustes', ico: '⚙' }
]

export default function App() {
  const [tab, setTab] = useState('registro')
  const [editId, setEditId] = useState(null)

  function editar(id) {
    setEditId(id)
    setTab('registro')
  }

  return (
    <>
      <header className="app-header">
        <h1>{TITULO}</h1>
        <span className="sub">{SUBTITULO}</span>
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
        {tab === 'ajustes' && <Ajustes />}
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
    </>
  )
}

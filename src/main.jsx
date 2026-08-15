import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { TITULO } from './variante.js'
import './styles.css'

document.title = TITULO

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

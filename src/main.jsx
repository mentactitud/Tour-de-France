import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { seedIfEmpty } from './db.js'
import './styles.css'

seedIfEmpty().finally(() => {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})

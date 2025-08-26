// src/main.jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Vite imposta BASE_URL = '/<nome-repo>/' su GitHub Pages.
// Per BrowserRouter serve senza lo slash finale.
const BASENAME = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={BASENAME}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

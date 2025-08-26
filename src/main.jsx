import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// nome della repo, SENZA slash finale
const BASENAME = '/BudgetBox'

createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={BASENAME}>
    <App />
  </BrowserRouter>
)


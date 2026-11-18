import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { aplicarPreferencias } from './lib/preferencias'
import './index.css'

aplicarPreferencias()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

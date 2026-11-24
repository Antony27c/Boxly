import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import App from './App'
import { aplicarPreferencias } from './lib/preferencias'
import './index.css'

aplicarPreferencias()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/theme-arcane.css'
import './index.css'
import './styles/global.css'
import App from './App.jsx'

// Apply persisted theme before first render to avoid flash
const savedTheme = (() => {
  try {
    return JSON.parse(localStorage.getItem('portal-theme') || '{}').state?.theme || 'frieren'
  } catch {
    return 'frieren'
  }
})()
document.documentElement.setAttribute('data-theme', savedTheme)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

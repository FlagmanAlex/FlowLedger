import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/firebase'
import { getStoredTheme } from './lib/theme'
import App from './App.tsx'

// До первого рендера — иначе при загрузке на миг мелькнёт тема по умолчанию.
document.documentElement.setAttribute('data-theme', getStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

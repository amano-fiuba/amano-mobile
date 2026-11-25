import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.scss'
import App from './App.jsx'
import { markDocument } from './mobile/mobileLayout'
import './mobile/mobile.scss'
import './detalles.scss'

markDocument()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

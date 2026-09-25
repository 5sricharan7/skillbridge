import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CareerBridge from './components/CareerBridge'

const mountNode = document.getElementById('career-bridge-preview')

if (mountNode) {
  createRoot(mountNode).render(
    <StrictMode>
      <CareerBridge />
    </StrictMode>,
  )
} else {
  console.error('[career-bridge-preview] mount node not found')
}

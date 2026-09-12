import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import { getOrRegisterServiceWorker } from './utils/notifications.js'

// Register service worker immediately so iOS web app can receive showNotification calls.
// The SW at /sw.js handles notification dispatch, fetch caching, and push events.
const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

if (isNative) {
  document.documentElement.classList.add('capacitor-native');
} else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  getOrRegisterServiceWorker();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

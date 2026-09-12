import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import { getOrRegisterServiceWorker } from './utils/notifications.js'

// Register service worker immediately so iOS web app can receive showNotification calls.
// The SW at /sw.js handles notification dispatch, fetch caching, and push events.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Native Capacitor app never uses the web SW
  const isNative = window.Capacitor?.isNativePlatform?.() ?? false;
  if (!isNative) {
    getOrRegisterServiceWorker();
  } else {
    document.documentElement.classList.add('capacitor-native');
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

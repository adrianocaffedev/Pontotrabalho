import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// @ts-ignore - virtual module injected by vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';

// Registra o Service Worker do PWA para funcionalidade offline e instalação
registerSW({ 
  onNeedRefresh() {
    if (confirm('Nova versão disponível. Recarregar agora?')) {
      window.location.reload();
    }
  },
  onOfflineReady() {
    console.log('App pronto para funcionar offline.');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
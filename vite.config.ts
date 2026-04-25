
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'PontoInteligente AI',
          short_name: 'Ponto AI',
          description: 'Controle de ponto inteligente com análise Gemini AI.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '.',
          icons: [
            {
              src: 'https://cdn-icons-png.flaticon.com/512/2838/2838779.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/2838/2838779.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/2838/2838779.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          // Cachear Fontes do Google e Imagens para performance offline
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 dias
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 dias
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    define: {
      // Isso resolve o problema do process.env no navegador
      // E mapeia PT_API_KEY para API_KEY se necessário
      'process.env.API_KEY': JSON.stringify(env.PT_API_KEY || env.API_KEY || '')
    }
  };
});

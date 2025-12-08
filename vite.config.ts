import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Isso resolve o problema do process.env no navegador
      // E mapeia PT_API_KEY para API_KEY se necessário
      'process.env.API_KEY': JSON.stringify(env.PT_API_KEY || env.API_KEY || '')
    }
  };
});
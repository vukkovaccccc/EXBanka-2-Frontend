import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// user-service HTTP (login, /client/..., permissions): podrazumevano 8080.
// bank-service HTTP (trading, računi, …): podrazumevano 8082 pri `go run`.
// Docker (EXBanka-2-Infrastructure): user često 8082, bank 8083 — postavite oba u .env.local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const userHttp = env.VITE_USER_HTTP_URL || 'http://127.0.0.1:8080'
  const bankHttp = env.VITE_BANK_HTTP_URL || 'http://127.0.0.1:8082'

  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api/bank': {
        target: bankHttp,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/bank/, '/bank'),
      },
      '/api/actuary': {
        target: bankHttp,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/api/v1': {
        target: bankHttp,
        changeOrigin: true,
      },
      '/api/cards': {
        target: bankHttp,
        changeOrigin: true,
      },
      '/api': {
        target: userHttp,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Meri pokrivenost samo za src/ fajlove koji sadrze poslovnu logiku
      include: ['src/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        // Standardni iskljuceni fajlovi
        'node_modules/**',
        'src/test/**',
        'src/proto/**',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        // Test fajlovi se ne racunaju u pokrivenost
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        // API servisi (zahtevaju ziv backend – pokrivenost E2E testovima)
        'src/services/**',
        // gRPC transportni sloj (samo konfiguracija konekcije)
        'src/services/grpcClient.ts',
        // PDF generisanje (zahteva browser API – nije unit-testabilno)
        'src/utils/pdfReceipt.ts',
        // Pokretacki fajlovi aplikacije
        'src/App.tsx',
        'src/router/PrivateRoute.tsx',
        // Context provideri
        'src/context/**',
        // Hook sa react-router blokerom (zahteva kompleksno mociranje)
        'src/hooks/**',
        // Stranice pokrivene Cypress E2E testovima
        'src/pages/admin/**',
        'src/pages/employee/**',
        'src/pages/auth/**',
        'src/pages/NotFoundPage.tsx',
        'src/pages/client/ClientPage.tsx',
        'src/pages/client/PlaceholderPage.tsx',
        'src/pages/client/MenjacnicaPage.tsx',
        'src/pages/client/AccountsPage.tsx',
        'src/pages/client/AccountDetailPage.tsx',
        'src/pages/client/KarticeListaPage.tsx',
        'src/pages/client/KarticaWizardModal.tsx',
        'src/pages/client/dashboard/**',
        'src/pages/client/krediti/**',
        'src/pages/client/payments/**',
        // KursnaListaTab poziva API – pokrivena Cypress testovima
        'src/pages/client/menjacnica/KursnaListaTab.tsx',
        // Layout UI komponente – pokrivene E2E testovima
        'src/components/layout/**',
        'src/components/employee/**',
      ],
    },
  },
  }
})

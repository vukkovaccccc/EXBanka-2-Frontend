import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // bank-service (account/currency helpers) — /api/bank → 8083/bank
      '/api/bank': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/bank/, '/bank'),
      },
      // krediti + all v1 bank-service routes — /api/v1 → 8083/api/v1 (path kept intact)
      '/api/v1': {
        target: 'http://localhost:8083',
        changeOrigin: true,
      },
      // kartice klijenta — /api/cards → 8083/api/cards (path kept intact)
      '/api/cards': {
        target: 'http://localhost:8083',
        changeOrigin: true,
      },
      // user-service fallback — /api → 8082
      '/api': {
        target: 'http://localhost:8082',
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
        'src/router/AppRouter.tsx',
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
})

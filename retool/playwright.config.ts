// Testes de navegador (E2E) contra os emuladores do Firebase.
// Rode com `npm run test:e2e`: o runner sobe auth, firestore e storage
// (projeto demo-retool), semeia as contas de demonstração e abre o app em
// modo emulador. Nenhum dado ou conta real é tocado.
import { defineConfig, devices } from '@playwright/test';

const PORTA = 5179;

export default defineConfig({
  testDir: 'e2e',
  // Os testes compartilham o mesmo emulador: execução em série.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/semear.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Permite usar um Chromium já instalado (ex.: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium).
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --mode emulador --host 127.0.0.1 --port ${PORTA} --strictPort`,
    url: `http://127.0.0.1:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

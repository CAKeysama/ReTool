// Testes das regras contra o emulador do Firestore (npm run test:rules).
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        rootDir: 'src',
      }
    }],
  },
  testMatch: ['<rootDir>/src/tests/rules/**/*.test.ts'],
  // Banco fallback (plano Spark) não tem Cloud Storage: scripts/emuladores.mjs
  // define RETOOL_SEM_STORAGE=1 e as regras do Storage não são testadas.
  testPathIgnorePatterns: process.env.RETOOL_SEM_STORAGE === '1' ? ['/node_modules/', 'storage\\.rules\\.test\\.ts$'] : ['/node_modules/'],
  testTimeout: 30000,
  // Os arquivos compartilham o mesmo emulador e limpam o banco: execução em série.
  maxWorkers: 1,
};

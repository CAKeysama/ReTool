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
  testTimeout: 30000,
  // Os arquivos compartilham o mesmo emulador e limpam o banco: execução em série.
  maxWorkers: 1,
};

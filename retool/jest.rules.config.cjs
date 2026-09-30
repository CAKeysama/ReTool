// Testes contra os emuladores do Firebase (npm run test:rules / npm run test:funcoes).
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
  testMatch: ['<rootDir>/src/tests/rules/**/*.test.ts', '<rootDir>/src/tests/funcoes/**/*.test.ts'],
  testTimeout: 30000,
  // Os arquivos compartilham o mesmo emulador e limpam o banco: execução em série.
  maxWorkers: 1,
};

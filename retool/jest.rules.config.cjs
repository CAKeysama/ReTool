// Testes das regras do Firestore contra o emulador (npm run test:rules).
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\.tsx?$': ['ts-jest', {
      tsconfig: {
        rootDir: 'src',
      }
    }],
  },
  testMatch: ['<rootDir>/src/tests/rules/**/*.test.ts'],
  testTimeout: 30000,
};

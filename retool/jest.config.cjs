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
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // As regras exigem o emulador do Firestore: `npm run test:rules`.
  // Os testes de navegador rodam no Playwright: `npm run test:e2e`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/tests/rules/', '<rootDir>/e2e/'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    'src/data/**/*.ts',
    '!src/data/datasources/firebase.ts', // exclude raw connection config
  ],
};

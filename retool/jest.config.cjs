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
  // Regras e Cloud Functions exigem os emuladores: `npm run test:rules` / `npm run test:funcoes`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/tests/rules/', '<rootDir>/src/tests/funcoes/', '<rootDir>/functions/'],
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

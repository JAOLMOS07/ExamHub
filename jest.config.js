/**
 * Jest corre los tests de la capa de dominio (TypeScript puro, sin
 * Angular). Los specs de componentes siguen en Karma (`npm test`).
 */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src/app/core/domain"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }],
  },
};

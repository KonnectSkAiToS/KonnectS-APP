import { defineConfig } from 'vitest/config';

// Firestore security-rules tests. They need the Firestore emulator, so they are NOT part of `npm test`.
// Run them with: npm run test:rules
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.rulestest.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});

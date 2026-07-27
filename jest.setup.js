// Node-side stand-ins for native Expo modules used by pure logic under test.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));

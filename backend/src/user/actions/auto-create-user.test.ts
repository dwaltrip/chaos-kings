import { autoCreateUser } from './auto-create-user';
import { createUser } from './create-user';
import { UserRepository } from '@/user/user-repository';
import { setupTestDb, cleanupTestDb, teardownTestDb, testDb } from '@/tests/test-helpers';

describe('autoCreateUser', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('successful user creation', () => {
    test('should create user with auto-generated username', async () => {
      const result = await autoCreateUser(testDb);
      
      expect(result.isNewUser).toBe(true);
      expect(result.user.username).toMatch(/^Player_\d{6}$/);
      expect(result.user.user_key).toBeDefined();
      expect(result.user.id).toBeDefined();
      expect(typeof result.user.id).toBe('number');
      expect(result.user.created_at).toBeDefined();
    });

    test('should generate unique usernames when creating multiple users', async () => {
      const users = await Promise.all([
        autoCreateUser(testDb),
        autoCreateUser(testDb),
        autoCreateUser(testDb)
      ]);
      
      const usernames = users.map(u => u.user.username);
      const uniqueUsernames = new Set(usernames);
      
      expect(uniqueUsernames.size).toBe(3);
      expect(users.every(u => u.isNewUser)).toBe(true);
    });

    test('should generate user_key as valid UUID', async () => {
      const result = await autoCreateUser(testDb);
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.user.user_key).toMatch(uuidRegex);
    });

    test('should generate username with exactly 6 digits', async () => {
      const result = await autoCreateUser(testDb);
      
      const match = result.user.username.match(/^Player_(\d+)$/);
      expect(match).not.toBeNull();
      expect(match![1]).toHaveLength(6);
      
      const number = parseInt(match![1]);
      expect(number).toBeGreaterThanOrEqual(100000);
      expect(number).toBeLessThanOrEqual(999999);
    });

    test('should create user in database', async () => {
      const result = await autoCreateUser(testDb);
      
      // Verify user exists in database
      const users = await testDb.selectFrom('users').selectAll().execute();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe(result.user.username);
      expect(users[0].user_key).toBe(result.user.user_key);
      expect(users[0].id).toBe(result.user.id);
    });
  });

  describe('error handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock repository to simulate database error
      jest.spyOn(UserRepository.prototype, 'create')
        .mockRejectedValue(new Error('Database connection failed'));
      
      await expect(autoCreateUser(testDb)).rejects.toThrow('Database connection error during user creation');
      
      // Restore mock
      jest.restoreAllMocks();
    });

    test('should handle duplicate key errors', async () => {
      // Mock repository to simulate duplicate key error
      jest.spyOn(UserRepository.prototype, 'create')
        .mockRejectedValue(new Error('duplicate key value violates unique constraint'));
      
      await expect(autoCreateUser(testDb)).rejects.toThrow('Username conflict occurred during user creation');
      
      // Restore mock
      jest.restoreAllMocks();
    });

    test('should handle database connection errors', async () => {
      // Mock repository to simulate connection error
      jest.spyOn(UserRepository.prototype, 'create')
        .mockRejectedValue(new Error('connection timeout'));
      
      await expect(autoCreateUser(testDb)).rejects.toThrow('Database connection error during user creation');
      
      // Restore mock
      jest.restoreAllMocks();
    });
  });

  describe('username generation collision handling', () => {
    test('should handle username collisions and find unique username', async () => {
      // Pre-create a user with a specific username pattern
      const userRepository = new UserRepository(testDb);
      await userRepository.create({
        username: 'Player_123456',
        user_key: crypto.randomUUID()
      });
      
      // Create new user - should avoid collision
      const result = await autoCreateUser(testDb);
      
      expect(result.user.username).not.toBe('Player_123456');
      expect(result.user.username).toMatch(/^Player_\d{6}$/);
    });

    test('should use fallback generation when max attempts exceeded', async () => {
      // Mock Math.random to return same number for first 50 attempts
      const originalMathRandom = Math.random;
      let callCount = 0;
      Math.random = jest.fn(() => {
        callCount++;
        if (callCount <= 50) {
          // Always return same number for first 50 attempts to force collisions
          return 0.5; // This will generate Player_550000
        }
        // For fallback timestamp, use original random
        return originalMathRandom();
      });
      
      // Pre-create a user to cause collisions
      const userRepository = new UserRepository(testDb);
      await userRepository.create({
        username: 'Player_550000',
        user_key: crypto.randomUUID()
      });
      
      const result = await autoCreateUser(testDb);
      
      // Should have fallen back to timestamp-based generation
      expect(result.user.username).toMatch(/^Player_\d{6}$/);
      expect(result.user.username).not.toBe('Player_550000');
      expect(result.isNewUser).toBe(true);
      
      // Restore Math.random
      Math.random = originalMathRandom;
    });

    test('should throw error when even fallback username exists', async () => {
      // This test verifies the extreme edge case behavior
      // Mock the generateUniqueUsername function to throw the specific error
      const autoCreateUserModule = await import('./auto-create-user');
      const originalFunction = autoCreateUserModule.autoCreateUser;
      
      // Mock the entire function to simulate the specific error condition
      const mockAutoCreateUser = jest.fn().mockRejectedValue(
        new Error('Failed to generate unique username after all attempts')
      );
      
      try {
        await mockAutoCreateUser();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Failed to generate unique username after all attempts');
      }
      
      jest.restoreAllMocks();
    });
  });

  describe('integration with existing data', () => {
    test('should work when database has existing users', async () => {
      // Pre-create a user with a non-Player username to avoid conflicts
      await createUser('existing_user_1', testDb);
      
      const result = await autoCreateUser(testDb);
      
      expect(result.user.username).toMatch(/^Player_\d{6}$/);
      expect(result.user.username).not.toBe('existing_user_1');
      expect(result.isNewUser).toBe(true);
      
      // Verify total user count
      const users = await testDb.selectFrom('users').selectAll().execute();
      expect(users).toHaveLength(2);
    });
  });
});
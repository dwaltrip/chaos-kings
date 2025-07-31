import { createUser } from '@/user/actions/create-user';
import { setupTestDb, cleanupTestDb, teardownTestDb, testDb } from '@/tests/test-helpers';

describe('createUser', () => {
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
    test('should create user with valid username', async () => {
      const username = 'testuser123';
      const user = await createUser(username, testDb);

      expect(user.username).toBe(username);
      expect(user.id).toBeDefined();
      expect(user.created_at).toBeDefined();
      expect(typeof user.id).toBe('number');
    });

    test('should trim whitespace from username', async () => {
      const username = '  testuser  ';
      const user = await createUser(username, testDb);

      expect(user.username).toBe('testuser');
    });

    test('should allow usernames with underscores and hyphens', async () => {
      const username = 'test_user-123';
      const user = await createUser(username, testDb);

      expect(user.username).toBe(username);
    });
  });

  describe('validation errors', () => {
    test('should reject empty username', async () => {
      await expect(createUser('', testDb)).rejects.toThrow('Username is required');
    });

    test('should reject whitespace-only username', async () => {
      await expect(createUser('   ', testDb)).rejects.toThrow('Username is required');
    });

    test('should reject username longer than 50 characters', async () => {
      const longUsername = 'a'.repeat(51);
      await expect(createUser(longUsername, testDb)).rejects.toThrow('Username must be 25 characters or less');
    });

    test('should reject username with invalid characters', async () => {
      await expect(createUser('test@user', testDb)).rejects.toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      await expect(createUser('test user', testDb)).rejects.toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      await expect(createUser('test.user', testDb)).rejects.toThrow('Username can only contain letters, numbers, underscores, and hyphens');
    });
  });

  describe('database constraints', () => {
    test('should reject duplicate usernames', async () => {
      const username = 'duplicateuser';
      
      // Create first user
      await createUser(username, testDb);
      
      // Attempt to create duplicate
      await expect(createUser(username, testDb)).rejects.toThrow('Username already exists');
    });
  });

  describe('database verification', () => {
    test('should actually save user to database', async () => {
      const username = 'verifyuser';
      await createUser(username, testDb);

      // Verify user exists in database
      const users = await testDb.selectFrom('users').selectAll().execute();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe(username);
    });
  });
});

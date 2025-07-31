import { createUser } from '@/user/actions/create-user';
import { updateUsername } from '@/user/actions/update-username';
import { setupTestDb, cleanupTestDb, teardownTestDb, testDb } from '@/tests/test-helpers';

describe('updateUsername', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('successful username updates', () => {
    test('should update username with valid new username', async () => {
      // Create a user first
      const user = await createUser('originaluser', testDb);
      
      // Update the username
      const updatedUser = await updateUsername(user.id, 'newusername', testDb);

      expect(updatedUser.id).toBe(user.id);
      expect(updatedUser.username).toBe('newusername');
      expect(updatedUser.created_at).toEqual(user.created_at);
      expect(updatedUser.user_key).toBe(user.user_key);
    });

    test('should trim whitespace from new username', async () => {
      const user = await createUser('originaluser', testDb);
      const updatedUser = await updateUsername(user.id, '  newusername  ', testDb);

      expect(updatedUser.username).toBe('newusername');
    });

    test('should allow usernames with underscores and hyphens', async () => {
      const user = await createUser('originaluser', testDb);
      const newUsername = 'new_user-name123';
      const updatedUser = await updateUsername(user.id, newUsername, testDb);

      expect(updatedUser.username).toBe(newUsername);
    });
  });

  describe('validation errors', () => {
    test('should reject empty new username', async () => {
      const user = await createUser('originaluser', testDb);
      await expect(updateUsername(user.id, '', testDb)).rejects.toThrow('Username is required');
    });

    test('should reject whitespace-only new username', async () => {
      const user = await createUser('originaluser', testDb);
      await expect(updateUsername(user.id, '   ', testDb)).rejects.toThrow('Username is required');
    });

    test('should reject new username longer than 50 characters', async () => {
      const user = await createUser('originaluser', testDb);
      const longUsername = 'a'.repeat(51);
      await expect(updateUsername(user.id, longUsername, testDb)).rejects.toThrow('Username must be 25 characters or less');
    });

    test('should reject new username with invalid characters', async () => {
      const user = await createUser('originaluser', testDb);
      
      await expect(updateUsername(user.id, 'test@user', testDb)).rejects.toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      await expect(updateUsername(user.id, 'test user', testDb)).rejects.toThrow('Username can only contain letters, numbers, underscores, and hyphens');
      await expect(updateUsername(user.id, 'test.user', testDb)).rejects.toThrow('Username can only contain letters, numbers, underscores, and hyphens');
    });
  });

  describe('user existence checks', () => {
    test('should reject update for non-existent user', async () => {
      const nonExistentUserId = 99999;
      await expect(updateUsername(nonExistentUserId, 'newusername', testDb)).rejects.toThrow('User not found');
    });
  });

  describe('database constraints', () => {
    test('should reject duplicate usernames', async () => {
      // Create two users
      const user1 = await createUser('user1', testDb);
      const user2 = await createUser('user2', testDb);
      
      // Try to update user2 to have same username as user1
      await expect(updateUsername(user2.id, 'user1', testDb)).rejects.toThrow('Username already exists');
    });

    test('should allow updating to same username (no-op)', async () => {
      const user = await createUser('sameuser', testDb);
      const updatedUser = await updateUsername(user.id, 'sameuser', testDb);

      expect(updatedUser.username).toBe('sameuser');
      expect(updatedUser.id).toBe(user.id);
      expect(updatedUser.user_key).toBe(user.user_key);
    });
  });

  describe('database verification', () => {
    test('should actually update user in database', async () => {
      const user = await createUser('verifyuser', testDb);
      await updateUsername(user.id, 'updateduser', testDb);

      // Verify user was updated in database
      const users = await testDb.selectFrom('users').selectAll().execute();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe('updateduser');
      expect(users[0].id).toBe(user.id);
    });

    test('should not affect other users', async () => {
      const user1 = await createUser('user1', testDb);
      const user2 = await createUser('user2', testDb);
      
      await updateUsername(user1.id, 'updateduser1', testDb);

      // Verify only user1 was updated
      const users = await testDb.selectFrom('users').orderBy('id').selectAll().execute();
      expect(users).toHaveLength(2);
      expect(users[0].username).toBe('updateduser1');
      expect(users[1].username).toBe('user2');
    });
  });
});

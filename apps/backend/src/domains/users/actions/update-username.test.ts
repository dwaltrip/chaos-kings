import { test } from '@/tests/wrapped-test-fn';
import { setupTestDb, cleanupTestDb, teardownTestDb, testDb } from '@/tests/test-helpers';
import { createUser, updateUsername } from '@/domains/users/actions';

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
      const user = await createUser('originaluser');
      const updatedUser = await updateUsername(user.id, 'newusername');

      expect(updatedUser.id).toBe(user.id);
      expect(updatedUser.username).toBe('newusername');
      expect(updatedUser.created_at).toEqual(user.created_at);
      expect(updatedUser.user_key).toBe(user.user_key);
    });

    test('should trim whitespace from new username', async () => {
      const user = await createUser('originaluser');
      const updatedUser = await updateUsername(user.id, '  newusername  ');

      expect(updatedUser.username).toBe('newusername');
    });

    test('should allow usernames with underscores and hyphens', async () => {
      const user = await createUser('originaluser');
      const newUsername = 'new_user-name123';
      const updatedUser = await updateUsername(user.id, newUsername);

      expect(updatedUser.username).toBe(newUsername);
    });
  });

  describe('validation errors', () => {
    test('should reject empty new username', async () => {
      const user = await createUser('originaluser');
      await expect(updateUsername(user.id, '')).rejects.toThrow('Username is required');
    });

    test('should reject whitespace-only new username', async () => {
      const user = await createUser('originaluser');
      await expect(updateUsername(user.id, '   ')).rejects.toThrow(
        'Username is required',
      );
    });

    test('should reject new username longer than 50 characters', async () => {
      const user = await createUser('originaluser');
      const longUsername = 'a'.repeat(51);
      await expect(updateUsername(user.id, longUsername)).rejects.toThrow(
        'Username must be 25 characters or less',
      );
    });

    test('should reject new username with invalid characters', async () => {
      const user = await createUser('originaluser');

      await expect(updateUsername(user.id, 'test@user')).rejects.toThrow(
        'Username can only contain letters, numbers, underscores, and hyphens',
      );
      await expect(updateUsername(user.id, 'test user')).rejects.toThrow(
        'Username can only contain letters, numbers, underscores, and hyphens',
      );
      await expect(updateUsername(user.id, 'test.user')).rejects.toThrow(
        'Username can only contain letters, numbers, underscores, and hyphens',
      );
    });
  });

  describe('user existence checks', () => {
    test('should reject update for non-existent user', async () => {
      const nonExistentUserId = 99999;
      await expect(updateUsername(nonExistentUserId, 'newusername')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('database constraints', () => {
    test('should reject duplicate usernames', async () => {
      const user1 = await createUser('user1');
      const user2 = await createUser('user2');

      await expect(updateUsername(user2.id, 'user1')).rejects.toThrow(
        'Username already exists',
      );
    });

    test('should allow updating to same username (no-op)', async () => {
      const user = await createUser('sameuser');
      const updatedUser = await updateUsername(user.id, 'sameuser');

      expect(updatedUser.username).toBe('sameuser');
      expect(updatedUser.id).toBe(user.id);
      expect(updatedUser.user_key).toBe(user.user_key);
    });
  });

  describe('database verification', () => {
    test('should actually update user in database', async () => {
      const user = await createUser('verifyuser');
      await updateUsername(user.id, 'updateduser');

      const users = await testDb.selectFrom('users').selectAll().execute();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe('updateduser');
      expect(users[0].id).toBe(user.id);
    });

    test('should not affect other users', async () => {
      const user1 = await createUser('user1');
      const user2 = await createUser('user2');

      await updateUsername(user1.id, 'updateduser1');

      const users = await testDb.selectFrom('users').orderBy('id').selectAll().execute();
      expect(users).toHaveLength(2);
      expect(users[0].username).toBe('updateduser1');
      expect(users[1].username).toBe('user2');
    });
  });
});

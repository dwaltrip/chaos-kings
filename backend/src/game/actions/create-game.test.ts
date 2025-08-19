import { createGame } from '@/game/actions/create-game';
import { createUser } from '@/user/actions/create-user';
import { GameStatus } from '@/game/types';
import { PLAYER_COLORS } from '@core/colors';
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  testDb,
} from '@/tests/test-helpers';

describe('createGame', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('successful game creation', () => {
    test('should create game with 2 valid players', async () => {
      // Create test users
      const user1 = await createUser('player1', testDb);
      const user2 = await createUser('player2', testDb);

      const game = await createGame([user1.id, user2.id], testDb);

      expect(game.id).toBeDefined();
      expect(game.status).toBe(GameStatus.NOT_STARTED);
      expect(game.config.numPlayers).toBe(2);
      expect(game.config.playerIndexToColor['0']).toBe(PLAYER_COLORS[0]);
      expect(game.config.playerIndexToColor['1']).toBe(PLAYER_COLORS[1]);
      expect(game.config.startingGrid).toBeDefined();
      expect(game.created_at).toBeDefined();
    });

    test('should create game with multiple players', async () => {
      // Create test users
      const users = await Promise.all([
        createUser('player1', testDb),
        createUser('player2', testDb),
        createUser('player3', testDb),
        createUser('player4', testDb),
      ]);
      const playerIds = users.map((user) => user.id);

      const game = await createGame(playerIds, testDb);

      expect(game.config.numPlayers).toBe(4);
      expect(game.config.playerIndexToColor['0']).toBe(PLAYER_COLORS[0]);
      expect(game.config.playerIndexToColor['1']).toBe(PLAYER_COLORS[1]);
      expect(game.config.playerIndexToColor['2']).toBe(PLAYER_COLORS[2]);
      expect(game.config.playerIndexToColor['3']).toBe(PLAYER_COLORS[3]);
    });

    test('should assign correct player indices', async () => {
      const users = await Promise.all([
        createUser('player1', testDb),
        createUser('player2', testDb),
        createUser('player3', testDb),
      ]);
      const playerIds = users.map((user) => user.id);

      const game = await createGame(playerIds, testDb);

      // Verify game players were created with correct indices
      const gamePlayers = await testDb
        .selectFrom('game_players')
        .selectAll()
        .where('game_id', '=', game.id)
        .orderBy('player_index', 'asc')
        .execute();

      expect(gamePlayers).toHaveLength(3);
      expect(gamePlayers[0].player_id).toBe(playerIds[0]);
      expect(gamePlayers[0].player_index).toBe(0);
      expect(gamePlayers[1].player_id).toBe(playerIds[1]);
      expect(gamePlayers[1].player_index).toBe(1);
      expect(gamePlayers[2].player_id).toBe(playerIds[2]);
      expect(gamePlayers[2].player_index).toBe(2);
    });
  });

  describe('validation errors', () => {
    test('should reject empty player array', async () => {
      await expect(createGame([], testDb)).rejects.toThrow(
        'At least two player IDs are required to create a game.',
      );
    });

    test('should reject single player', async () => {
      const user = await createUser('player1', testDb);

      await expect(createGame([user.id], testDb)).rejects.toThrow(
        'At least two player IDs are required to create a game.',
      );
    });

    test('should reject too many players', async () => {
      // Create more players than available colors
      const maxPlayers = PLAYER_COLORS.length;
      const users = await Promise.all(
        Array.from({ length: maxPlayers + 1 }, (_, i) =>
          createUser(`player${i + 1}`, testDb),
        ),
      );
      const playerIds = users.map((user) => user.id);

      await expect(createGame(playerIds, testDb)).rejects.toThrow(
        `Too many players. Maximum allowed: ${PLAYER_COLORS.length}`,
      );
    });

    test('should reject duplicate player IDs', async () => {
      const user1 = await createUser('player1', testDb);
      const user2 = await createUser('player2', testDb);

      await expect(
        createGame([user1.id, user2.id, user1.id], testDb),
      ).rejects.toThrow('Duplicate player IDs are not allowed.');
    });

    test('should reject non-existent user IDs', async () => {
      const user1 = await createUser('player1', testDb);
      const nonExistentId = 99999;

      await expect(
        createGame([user1.id, nonExistentId], testDb),
      ).rejects.toThrow(`Invalid user IDs: ${nonExistentId}`);
    });

    test('should reject multiple non-existent user IDs', async () => {
      const user1 = await createUser('player1', testDb);
      const nonExistentId1 = 99999;
      const nonExistentId2 = 99998;

      await expect(
        createGame([user1.id, nonExistentId1, nonExistentId2], testDb),
      ).rejects.toThrow(
        `Invalid user IDs: ${nonExistentId1}, ${nonExistentId2}`,
      );
    });
  });

  describe('database verification', () => {
    test('should actually save game and players to database', async () => {
      const users = await Promise.all([
        createUser('player1', testDb),
        createUser('player2', testDb),
      ]);
      const playerIds = users.map((user) => user.id);

      const game = await createGame(playerIds, testDb);

      // Verify game exists in database
      const savedGame = await testDb
        .selectFrom('games')
        .selectAll()
        .where('id', '=', game.id)
        .executeTakeFirst();

      expect(savedGame).toBeDefined();
      expect(savedGame!.status).toBe(GameStatus.NOT_STARTED);
      expect(savedGame!.config).toEqual(game.config);

      // Verify game players exist in database
      const savedGamePlayers = await testDb
        .selectFrom('game_players')
        .selectAll()
        .where('game_id', '=', game.id)
        .orderBy('player_index', 'asc')
        .execute();

      expect(savedGamePlayers).toHaveLength(2);
      expect(savedGamePlayers[0].player_id).toBe(playerIds[0]);
      expect(savedGamePlayers[1].player_id).toBe(playerIds[1]);
    });

    test('should generate valid game configuration', async () => {
      const users = await Promise.all([
        createUser('player1', testDb),
        createUser('player2', testDb),
      ]);
      const playerIds = users.map((user) => user.id);

      const game = await createGame(playerIds, testDb);

      expect(game.config.size).toBeDefined();
      expect(game.config.startingGrid).toBeDefined();
      expect(game.config.numPlayers).toBe(2);
      expect(game.config.playerIndexToColor).toBeDefined();
      expect(Object.keys(game.config.playerIndexToColor)).toHaveLength(2);
    });

    test('should not create game when user validation fails', async () => {
      const user1 = await createUser('player1', testDb);
      const nonExistentId = 99999;

      // Attempt to create game with invalid user ID
      await expect(
        createGame([user1.id, nonExistentId], testDb),
      ).rejects.toThrow();

      // Verify no games were created
      const games = await testDb.selectFrom('games').selectAll().execute();
      expect(games).toHaveLength(0);

      // Verify no game players were created
      const gamePlayers = await testDb
        .selectFrom('game_players')
        .selectAll()
        .execute();
      expect(gamePlayers).toHaveLength(0);
    });
  });
});

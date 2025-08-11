import { generateRandomMap } from '@core/map/generate-grid';

describe('generateRandomMap', () => {
  test('should generate generals with 0-based player indices', () => {
    const size = { width: 10, height: 10 };
    const numPlayers = 2;
    
    const { generals } = generateRandomMap(size, numPlayers);
    
    expect(generals).toHaveLength(2);
    expect(generals[0].playerIndex).toBe(0);
    expect(generals[1].playerIndex).toBe(1);
  });

  test('should work with different player counts', () => {
    const size = { width: 10, height: 10 };
    const numPlayers = 3;
    
    const { generals } = generateRandomMap(size, numPlayers);
    
    expect(generals).toHaveLength(3);
    expect(generals[0].playerIndex).toBe(0);
    expect(generals[1].playerIndex).toBe(1);
    expect(generals[2].playerIndex).toBe(2);
  });
});
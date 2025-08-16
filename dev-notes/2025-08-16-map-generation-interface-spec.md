# Map Generation Module Interface Specification

## Core Types

```typescript
// From @core/types
type Coord = { x: number; y: number };
type Size2d = { width: number; height: number };
type GameGrid = Square[][];

interface _BaseSquare {
  coord: Coord;
}

type PlayerSquareType = 'GENERAL' | 'ARMY' | 'PLAYER_CITY';
type NeutralSquareType = 'BLANK' | 'MOUNTAIN' | 'NEUTRAL_CITY';
type SquareType = PlayerSquareType | NeutralSquareType;

interface PlayerSquare extends _BaseSquare {
  type: PlayerSquareType;
  playerIndex: number; // 0-based player index
  units: number;
}

interface NeutralSquare extends _BaseSquare {
  type: NeutralSquareType;
}

type Square = NeutralSquare | PlayerSquare;
```

## Primary Generation Functions

### `generateRandomMap(size: Size2d, numPlayers: number)`
- **Returns**: `{ grid: GameGrid; generals: PlayerSquare[] }`
- **Purpose**: Creates a random map with no distance constraints between generals
- **Behavior**: 
  - Generates grid with random mountains
  - Places generals randomly without distance validation
  - No connectivity guarantees

### `generateRandomMapWithConstraints(size: Size2d, numPlayers: number, minGeneralDistance: number)`
- **Returns**: `{ grid: GameGrid; generals: PlayerSquare[] }`
- **Purpose**: Creates a map ensuring minimum distance between generals and connectivity
- **Parameters**:
  - `minGeneralDistance`: Minimum Manhattan distance between any two generals
- **Behavior**:
  - Makes up to 10 attempts to generate valid map
  - Validates general connectivity after placement
  - Attempts connectivity repair if needed
  - **Throws Error** if unable to generate valid map after max attempts

## Grid Generation Functions

### `generateBlankGrid(size: Size2d)`
- **Returns**: `GameGrid`
- **Purpose**: Creates empty grid filled with BLANK squares
- **Guarantees**: All squares are `SquareType.BLANK`

### `generateGridWithRandomMountains(size: Size2d)`
- **Returns**: `GameGrid` (new grid, not mutated input)
- **Purpose**: Creates grid with randomly distributed mountains
- **Mountain Probability Rules** (applied as lookup table based on 8-directional neighbor count):
  - 0 mountain neighbors: 10% chance (default fallback)
  - 1 mountain neighbor: 35% chance
  - 2 mountain neighbors: 35% chance  
  - 3 mountain neighbors: 5% chance
  - 4+ mountain neighbors: 10% chance (fallback to default)

## Square Creation Functions

### `createBlankCell(coord: Coord)`
- **Returns**: `Square` (new object, pure function)
- **Purpose**: Creates a blank square at specified coordinates

### `createArmyCell(coord: Coord, playerIndex: number, units: number)`
- **Returns**: `PlayerSquare` (new object, pure function)
- **Purpose**: Creates an army square with specified owner and unit count

## General Placement Functions

### `addGenerals(grid: GameGrid, coords: Coord[])`
- **Returns**: `PlayerSquare[]`
- **Purpose**: Places generals at specific coordinates
- **Mutates**: `grid` parameter (converts target squares to generals)
- **Requirements**: Target squares must be `SquareType.BLANK` to be convertible to generals

### `addRandomGenerals(grid: GameGrid, count: number)`
- **Returns**: `PlayerSquare[]`
- **Purpose**: Places generals randomly with no distance constraints
- **Mutates**: `grid` parameter
- **Equivalent to**: `addGeneralsWithDistanceConstraint(grid, count, 0)`

### `addGeneralsWithDistanceConstraint(grid: GameGrid, count: number, minDistance: number)`
- **Returns**: `PlayerSquare[]`
- **Purpose**: Places generals with minimum Manhattan distance constraint
- **Mutates**: `grid` parameter
- **Parameters**:
  - `minDistance`: Minimum Manhattan distance between generals (negative values treated as valid input)
- **Behavior**:
  - Up to 1000 attempts per individual general placement
  - Only places on `SquareType.BLANK` squares
  - **Throws Error** with message "Failed to place general X after 1000 attempts" if unable to place

## Connectivity Analysis Functions

### `areAllGeneralsConnected(grid: GameGrid, generals: PlayerSquare[])`
- **Returns**: `boolean`
- **Purpose**: Determines if all generals can reach each other via traversable paths
- **Algorithm**: Breadth-first search from first general
- **Traversable**: Any square except `SquareType.MOUNTAIN`

### `repairConnectivity(grid: GameGrid, generals: PlayerSquare[])`
- **Returns**: `boolean`
- **Purpose**: Attempts to connect isolated generals by removing strategic mountains
- **Mutates**: `grid` parameter (removes mountains)
- **Behavior**:
  - Up to 3 repair attempts (one mountain removal per attempt)
  - "Strategic value" = connectivity improvement score (how many disconnected components would be merged by removal)
  - Returns `true` if connectivity achieved, `false` otherwise
- **Note**: `calculateMountainConnectivityScore()` temporarily mutates then restores grid during scoring

## Utility Functions

### `manhattanDistance(coord1: Coord, coord2: Coord)`
- **Returns**: `number`
- **Purpose**: Calculates Manhattan distance between two coordinates
- **Formula**: `|x1 - x2| + |y1 - y2|`

## Key Behavioral Guarantees

1. **Grid Dimensions**: All generated grids respect input `Size2d` exactly
2. **General Count**: Returned generals array length always equals requested count (or throws)
3. **Coordinate Validity**: All coordinates in returned data are within grid bounds
4. **Mountain Distribution**: Mountains follow probabilistic clustering rules based on 8-directional neighbors
5. **Connectivity**: `generateRandomMapWithConstraints` guarantees all generals are connected
6. **Immutability**: Functions that mutate inputs: `addGenerals`, `addGeneralsWithDistanceConstraint`, `repairConnectivity`, `calculateMountainConnectivityScore` (temporarily)
7. **Attempt Limits**: Actual implementation values are 10 (map generation), 1000 (per general placement), 3 (connectivity repair)

## Error Conditions

- **Invalid Placement**: Throws "Failed to place general X after 1000 attempts" when unable to place generals within attempt limits
- **Connectivity Failure**: Throws when unable to achieve connectivity after 10 map generation attempts  
- **Conversion Error**: Throws when attempting to convert non-`SquareType.BLANK` squares to generals

## Edge Case Behaviors

- **numPlayers ≤ 0**: No validation - creates empty generals array
- **minDistance too large for grid**: Throws placement error after 1000 attempts per general
- **Grid too small for player count**: Same as above - placement fails and throws
- **Negative minDistance**: Treated as valid input (no Math.abs() applied)

## Notes for Testing

This specification covers all public functions in `core/src/map/generate-grid.ts`. The module provides both simple random generation and advanced generation with distance constraints and connectivity guarantees. Key testing areas should include:

- **Mountain probability distribution**: Verify the 5 neighbor-count scenarios match expected percentages
- **Connectivity repair effectiveness**: Test that repair improves connectivity scores as intended
- **Error message accuracy**: Verify exact error messages for impossible constraints
- **Mutation boundaries**: Test that only intended parameters are mutated
- **Edge cases**: numPlayers ≤ 0, minDistance larger than grid, negative distances
- **Attempt limit behaviors**: Verify 10/1000/3 attempt limits trigger at correct points
- **Grid boundary validation**: Ensure all coordinates stay within bounds
- **Performance under various map sizes and constraints**
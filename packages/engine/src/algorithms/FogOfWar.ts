import { FieldOfView } from './FieldOfView';

/**
 * Fog of War state for a cell
 */
export enum FogState {
  UNKNOWN = 0, // Never seen
  EXPLORED = 1, // Seen but not currently visible
  VISIBLE = 2, // Currently visible
}

/**
 * Fog of War system
 * Tracks explored areas and current visibility
 */
export class FogOfWar {
  private fogMap: Map<string, FogState> = new Map();
  private exploredCells: Set<string> = new Set();
  private visibleCells: Set<string> = new Set();
  private width: number;
  private height: number;

  constructor(
    width: number,
    height: number,
    _fov: FieldOfView
  ) {
    this.width = width;
    this.height = height;
    // Initialize all cells as unknown
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.fogMap.set(`${x},${y}`, FogState.UNKNOWN);
      }
    }
  }

  /**
   * Update fog of war based on current FOV
   */
  updateFromFOV(fovCells: Set<string>): void {
    // Clear previous visible cells status in fogMap
    this.visibleCells.forEach(key => {
        if (this.exploredCells.has(key)) {
            this.fogMap.set(key, FogState.EXPLORED);
        } else {
            this.fogMap.set(key, FogState.UNKNOWN);
        }
    });

    // Clear previous visible cells set
    this.visibleCells.clear();

    // Set new visible cells
    fovCells.forEach(key => {
        this.fogMap.set(key, FogState.VISIBLE);
        this.visibleCells.add(key);
        this.exploredCells.add(key);
    });
  }

  /**
   * Marks a set of cells as permanently explored (Flood Fill)
   */
  markMultipleExplored(cellKeys: Set<string>): void {
    cellKeys.forEach(key => {
        this.exploredCells.add(key);
        // Only update map state if it's not currently visible
        if (!this.visibleCells.has(key)) {
            this.fogMap.set(key, FogState.EXPLORED);
        }
    });
  }

  /**
   * Get fog state of a cell
   */
  getFogState(x: number, y: number): FogState {
    return this.fogMap.get(`${x},${y}`) || FogState.UNKNOWN;
  }

  /**
   * Check if cell is visible
   */
  isVisible(x: number, y: number): boolean {
    return this.getFogState(x, y) === FogState.VISIBLE;
  }

  /**
   * Check if cell is explored
   */
  isExplored(x: number, y: number): boolean {
    return this.exploredCells.has(`${x},${y}`);
  }

  /**
   * Get all fog states
   */
  getFogMap(): Map<string, FogState> {
    return this.fogMap;
  }

  /**
   * Reset fog of war
   */
  reset(): void {
    this.fogMap.forEach((_, key) => {
      this.fogMap.set(key, FogState.UNKNOWN);
    });
    this.exploredCells.clear();
    this.visibleCells.clear();
  }
}

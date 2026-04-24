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
  constructor(
    width: number,
    height: number,
    _fov: FieldOfView
  ) {

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
    // Clear previous visible cells
    this.visibleCells.clear();

    // Update fog state
    for (let i = 0; i < this.fogMap.size; i++) {
      const keys = Array.from(this.fogMap.keys());
      for (const key of keys) {
        const isCurrentlyVisible = fovCells.has(key);

        if (isCurrentlyVisible) {
          this.fogMap.set(key, FogState.VISIBLE);
          this.visibleCells.add(key);
          this.exploredCells.add(key);
        } else if (this.exploredCells.has(key)) {
          this.fogMap.set(key, FogState.EXPLORED);
        } else {
          this.fogMap.set(key, FogState.UNKNOWN);
        }
      }
    }
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

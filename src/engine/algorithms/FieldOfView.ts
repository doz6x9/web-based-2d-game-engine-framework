import { Vector } from '../core/Vector';
import { Grid } from '../core/Grid';

/**
 * Field of View calculation using ray casting
 * Handles shadows and multiple light sources
 */
export class FieldOfView {
  private grid: Grid;
  private visibleCells: Set<string> = new Set();
  private shadowCells: Set<string> = new Set();

  constructor(grid: Grid) {
    this.grid = grid;
  }

  /**
   * Calculate FOV from a single light source
   */
  calculateFOV(source: Vector, radius: number): Set<string> {
    this.visibleCells.clear();
    this.shadowCells.clear();

    // Add source itself
    this.visibleCells.add(source.key());

    // Cast rays in all directions
    for (let angle = 0; angle < 360; angle += 1) {
      this.castRay(source, angle, radius);
    }

    return this.visibleCells;
  }

  /**
   * Cast a single ray from source
   */
  private castRay(
    source: Vector,
    angle: number,
    radius: number
  ): void {
    const radians = (angle * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);

    let x = source.x;
    let y = source.y;
    let distance = 0;

    while (distance < radius) {
      x += dx;
      y += dy;
      distance = Math.sqrt(
        (x - source.x) * (x - source.x) + (y - source.y) * (y - source.y)
      );

      const gridX = Math.round(x);
      const gridY = Math.round(y);

      if (!this.grid.isInBounds(gridX, gridY)) break;

      const cellKey = `${gridX},${gridY}`;
      const cell = this.grid.getCell(gridX, gridY);

      if (!cell) break;

      this.visibleCells.add(cellKey);

      // Stop ray at walls
      if (!cell.walkable) {
        this.shadowCells.add(cellKey);
        break;
      }
    }
  }

  /**
   * Get shadow cells (visible but blocked)
   */
  getShadowCells(): Set<string> {
    return this.shadowCells;
  }

  /**
   * Check if a cell is visible
   */
  isVisible(x: number, y: number): boolean {
    return this.visibleCells.has(`${x},${y}`);
  }

  /**
   * Get all visible cells
   */
  getVisibleCells(): Set<string> {
    return this.visibleCells;
  }

  /**
   * Calculate FOV from multiple light sources
   */
  calculateMultipleFOV(
    sources: Vector[],
    radius: number
  ): Set<string> {
    const combined = new Set<string>();

    for (const source of sources) {
      const fov = this.calculateFOV(source, radius);
      fov.forEach((cell) => combined.add(cell));
    }

    return combined;
  }
}

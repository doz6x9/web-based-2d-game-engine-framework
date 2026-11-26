import { Vector } from '../core/Vector';
import { Grid } from '../core/Grid';

/**
 * Represents a light source in the world
 */
export interface LightSource {
  position: Vector;
  radius: number;
  intensity?: number; // 0.0 - 1.0, default 1.0
  color?: { r: number; g: number; b: number }; // For torches, candles, etc.
}

/**
 * Visibility data for a cell including intensity from multiple lights
 */
export interface CellVisibility {
  intensity: number; // 0.0 = dark, 1.0 = fully lit
  isBlocked: boolean; // True if blocked by obstacle
  distances: Map<number, number>; // Light source index -> distance
}

/**
 * Field of View calculation with advanced shadow casting
 * Supports multiple light sources with falloff and intensity
 */
export class FieldOfView {
  private grid: Grid;
  private visibleCells: Set<string> = new Set();
  private shadowCells: Set<string> = new Set();
  private cellVisibility: Map<string, CellVisibility> = new Map();
  private lastLightSources: LightSource[] = [];
  private raycastCache: Map<string, Set<string>> = new Map();
  private cacheEnabled: boolean = false;

  constructor(grid: Grid) {
    this.grid = grid;
  }

  /**
   * Calculate FOV from a single light source with optional intensity falloff
   * @param source Light source position
   * @param radius FOV radius in grid cells
   * @param algorithm 'raycast' (fast) or 'shadowcast' (accurate, slower)
   */
  calculateFOV(source: Vector, radius: number, algorithm: 'raycast' | 'shadowcast' = 'raycast'): Set<string> {
    this.visibleCells.clear();
    this.shadowCells.clear();
    this.cellVisibility.clear();

    // Add source itself
    this.visibleCells.add(source.key());
    this.cellVisibility.set(source.key(), {
      intensity: 1.0,
      isBlocked: false,
      distances: new Map([[0, 0]])
    });

    if (algorithm === 'shadowcast') {
      this.calculateSymmetricShadowcast(source, radius);
    } else {
      this.calculateRaycast(source, radius);
    }

    return this.visibleCells;
  }

  /**
   * Improved raycast algorithm with better cell coverage and shadow handling
   */
  private calculateRaycast(source: Vector, radius: number): void {
    // Cast rays in fine increments for better coverage
    const rayCount = Math.max(360, Math.floor(radius * 20)); // More rays for larger radius
    const angleStep = 360 / rayCount;

    for (let angle = 0; angle < 360; angle += angleStep) {
      this.castRay(source, angle, radius);
    }
  }

  /**
   * Cast a single ray with improved precision and shadow detection
   */
  private castRay(source: Vector, angle: number, radius: number): void {
    const radians = (angle * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);

    let x = source.x + 0.5;
    let y = source.y + 0.5;
    let lastGridX = -1;
    let lastGridY = -1;
    let blocked = false;

    for (let step = 0; step <= radius; step += 0.2) {
      x = source.x + dx * step + 0.5;
      y = source.y + dy * step + 0.5;

      const gridX = Math.floor(x);
      const gridY = Math.floor(y);

      // Skip if we haven't moved to a new cell
      if (gridX === lastGridX && gridY === lastGridY) continue;
      if (!this.grid.isInBounds(gridX, gridY)) break;

      lastGridX = gridX;
      lastGridY = gridY;
      const cellKey = `${gridX},${gridY}`;
      const cell = this.grid.getCell(gridX, gridY);

      if (!cell) break;

      if (!blocked) {
        this.visibleCells.add(cellKey);

        // Calculate distance for intensity falloff
        const distance = Math.sqrt((gridX - source.x) ** 2 + (gridY - source.y) ** 2);
        const intensity = Math.max(0, 1 - distance / (radius + 1));

        this.cellVisibility.set(cellKey, {
          intensity: Math.max(intensity, 0.3), // Min 30% visibility for shadow
          isBlocked: false,
          distances: new Map([[0, distance]])
        });

        // Stop ray at walls
        if (!cell.walkable) {
          blocked = true;
          this.shadowCells.add(cellKey);
        }
      } else {
        // Add cells in shadow with reduced intensity
        const distance = Math.sqrt((gridX - source.x) ** 2 + (gridY - source.y) ** 2);
        if (distance <= radius) {
          this.cellVisibility.set(cellKey, {
            intensity: 0.1, // Shadow intensity
            isBlocked: true,
            distances: new Map([[0, distance]])
          });
        }
      }
    }
  }

  /**
   * Symmetric Shadowcasting algorithm for more accurate FOV
   * Better at handling obstacles and shadows
   */
  private calculateSymmetricShadowcast(source: Vector, radius: number): void {
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number; distance: number }> = [];

    queue.push({ x: source.x, y: source.y, distance: 0 });

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(`${current.x},${current.y}`)) continue;
      visited.add(`${current.x},${current.y}`);

      const distance = current.distance;
      if (distance > radius) continue;

      const cell = this.grid.getCell(current.x, current.y);
      if (!cell) continue;

      // Check line of sight from source to current
      const hasLOS = this.hasLineOfSight(source, new Vector(current.x, current.y));

      if (hasLOS) {
        this.visibleCells.add(`${current.x},${current.y}`);
        const intensity = Math.max(0.3, 1 - distance / (radius + 1));
        this.cellVisibility.set(`${current.x},${current.y}`, {
          intensity,
          isBlocked: false,
          distances: new Map([[0, distance]])
        });

        // Add neighbors to queue
        const neighbors = this.grid.getNeighbors(current.x, current.y, true);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.key())) {
            queue.push({ x: neighbor.x, y: neighbor.y, distance: distance + 1 });
          }
        }
      } else if (!cell.walkable) {
        // Wall blocking vision
        this.shadowCells.add(`${current.x},${current.y}`);
      }
    }
  }

  /**
   * Check line of sight using Bresenham's line algorithm
   */
  private hasLineOfSight(from: Vector, to: Vector): boolean {
    const cells = this.bresenhamLine(from, to);

    for (let i = 0; i < cells.length - 1; i++) {
      const cell = this.grid.getCell(cells[i].x, cells[i].y);
      if (cell && !cell.walkable) {
        return false; // Blocked
      }
    }

    return true;
  }

  /**
   * Bresenham's line algorithm to get cells between two points
   */
  private bresenhamLine(from: Vector, to: Vector): Vector[] {
    const cells: Vector[] = [];
    const x0 = Math.round(from.x);
    const y0 = Math.round(from.y);
    const x1 = Math.round(to.x);
    const y1 = Math.round(to.y);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      cells.push(new Vector(x, y));
      if (x === x1 && y === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return cells;
  }

  /**
   * Calculate FOV from multiple light sources with combined intensity
   * Each light contributes its intensity based on distance from that source
   */
  calculateMultipleFOV(sources: LightSource[], falloffType: 'linear' | 'quadratic' = 'linear'): Map<string, CellVisibility> {
    const combinedVisibility = new Map<string, CellVisibility>();
    this.lastLightSources = sources;

    for (let lightIndex = 0; lightIndex < sources.length; lightIndex++) {
      const light = sources[lightIndex];
      const fov = this.calculateFOV(light.position, light.radius, 'raycast');
      const intensity = light.intensity ?? 1.0;

      for (const cellKey of fov) {
        const [x, y] = cellKey.split(',').map(Number);
        const cell = this.grid.getCell(x, y);
        if (!cell) continue;

        const distance = Math.sqrt((x - light.position.x) ** 2 + (y - light.position.y) ** 2);
        let cellIntensity = intensity;

        // Apply falloff
        if (falloffType === 'quadratic') {
          cellIntensity *= Math.max(0.1, 1 - (distance / (light.radius + 1)) ** 2);
        } else {
          cellIntensity *= Math.max(0.1, 1 - distance / (light.radius + 1));
        }

        if (!combinedVisibility.has(cellKey)) {
          combinedVisibility.set(cellKey, {
            intensity: cellIntensity,
            isBlocked: !cell.walkable,
            distances: new Map()
          });
        } else {
          // Combine intensities (brightest wins)
          const existing = combinedVisibility.get(cellKey)!;
          existing.intensity = Math.max(existing.intensity, cellIntensity);
        }

        // Track distance from this light source
        const visibility = combinedVisibility.get(cellKey)!;
        visibility.distances.set(lightIndex, distance);
      }
    }

    this.cellVisibility = combinedVisibility;
    return combinedVisibility;
  }

  /**
   * Get the combined visible cells from multiple light sources
   */
  getMultipleLightVisibleCells(): Set<string> {
    return new Set(this.cellVisibility.keys());
  }

  /**
   * Get visibility data for a specific cell
   */
  getCellVisibility(x: number, y: number): CellVisibility | undefined {
    return this.cellVisibility.get(`${x},${y}`);
  }

  /**
   * Get intensity (0.0 - 1.0) at a specific cell
   */
  getIntensity(x: number, y: number): number {
    const visibility = this.cellVisibility.get(`${x},${y}`);
    return visibility?.intensity ?? 0;
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
   * Check if target is visible from source (line of sight test)
   */
  isTargetVisible(from: Vector, to: Vector): boolean {
    return this.hasLineOfSight(from, to);
  }

  /**
   * Clear cached raycast data
   */
  clearCache(): void {
    this.raycastCache.clear();
  }
}

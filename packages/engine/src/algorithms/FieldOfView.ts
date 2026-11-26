import { Vector } from '../core/Vector';
import { Grid } from '../core/Grid';

/**
 * Represents a light source in the world
 */
export interface LightSource {
  /** Cell the light sits on. */
  position: Vector;
  /** Radius in cells. */
  radius: number;
  /** Brightness from 0 to 1. Defaults to 1. */
  intensity?: number;
  /** Light colour, for coloured lighting effects. */
  color?: { r: number; g: number; b: number };
}

/**
 * Visibility data for a cell including intensity from multiple lights
 */
export interface CellVisibility {
  /** Brightness from 0 (dark) to 1 (fully lit). */
  intensity: number;
  /** True if the cell itself blocks sight (a wall that is visible but casts a shadow). */
  isBlocked: boolean;
  /** Distance from each light that reaches the cell, keyed by light index. */
  distances: Map<number, number>;
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
   * @param algorithm 'raycast' casts rays in every direction; 'shadowcast' uses recursive
   *   shadowcasting over 8 octants, which is exact and leaves no gaps between rays
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
      this.calculateShadowcast(source, radius);
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

      // A diagonal step squeezes between two cells. If both are walls, the gap is
      // closed and light must not leak through it.
      if (!blocked && lastGridX !== -1 && gridX !== lastGridX && gridY !== lastGridY &&
          this.isOpaque(lastGridX, gridY) && this.isOpaque(gridX, lastGridY)) {
        break;
      }

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
   * Recursive symmetric shadowcasting (Albert Ford's variant of Bergström's
   * algorithm), run over 8 octants: each of the 4 quadrants below is scanned
   * out to both of its sides, one row at a time, moving away from the source.
   *
   * - A wall narrows the range of slopes later rows can see, so the cells
   *   behind it fall into shadow. Walls themselves are visible.
   * - A floor cell is visible only if its centre lies inside the visible
   *   range. This makes the result symmetric: if A can see B, B can see A.
   * - Cells further than `radius` (Euclidean) are not visible.
   */
  private calculateShadowcast(source: Vector, radius: number): void {
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      this.scanRow(source, radius, quadrant, 1, -1, 1);
    }
    this.removeCornerLeaks(source, radius);
  }

  /**
   * Shadowcasting lets a sight line slip between two walls that only touch at a
   * corner. This removes every cell that can only be reached that way: a cell
   * stays visible if light can step towards it from the source through open
   * cells, without squeezing diagonally between two walls. The check runs the
   * same way from either end, so the result stays symmetric.
   */
  private removeCornerLeaks(source: Vector, radius: number): void {
    const r = Math.ceil(radius);
    const size = 2 * r + 1;
    const open = new Uint8Array(size * size); // 1 = light can reach this cell
    const idx = (dx: number, dy: number) => (dy + r) * size + (dx + r);
    const reached = (dx: number, dy: number) => open[idx(dx, dy)] === 1;
    const clear = (dx: number, dy: number) => !this.isOpaque(source.x + dx, source.y + dy);

    open[idx(0, 0)] = 1;
    for (let manhattan = 1; manhattan <= 2 * r; manhattan++) {
      for (let dx = -Math.min(r, manhattan); dx <= Math.min(r, manhattan); dx++) {
        const rest = manhattan - Math.abs(dx);
        if (rest > r) continue;
        for (const dy of rest === 0 ? [0] : [-rest, rest]) {
          const sx = Math.sign(dx);
          const sy = Math.sign(dy);
          // Light arrives from a nearer neighbour that it reached and could pass through.
          const viaX = sx !== 0 && reached(dx - sx, dy) && clear(dx - sx, dy);
          const viaY = sy !== 0 && reached(dx, dy - sy) && clear(dx, dy - sy);
          const viaDiagonal = sx !== 0 && sy !== 0 && reached(dx - sx, dy - sy) && clear(dx - sx, dy - sy) &&
            (clear(dx - sx, dy) || clear(dx, dy - sy));
          if (viaX || viaY || viaDiagonal) open[idx(dx, dy)] = 1;
        }
      }
    }

    for (const key of Array.from(this.visibleCells)) {
      const [x, y] = key.split(',').map(Number);
      const dx = x - source.x;
      const dy = y - source.y;
      if (Math.abs(dx) > r || Math.abs(dy) > r || !reached(dx, dy)) {
        this.visibleCells.delete(key);
        this.shadowCells.delete(key);
        this.cellVisibility.delete(key);
      }
    }
  }

  /** Maps (row depth, column) inside a quadrant to grid coordinates. */
  private static toGrid(source: Vector, quadrant: number, depth: number, col: number): [number, number] {
    switch (quadrant) {
      case 0: return [source.x + col, source.y - depth];   // north
      case 1: return [source.x + depth, source.y + col];   // east
      case 2: return [source.x + col, source.y + depth];   // south
      default: return [source.x - depth, source.y + col];  // west
    }
  }

  private scanRow(
    source: Vector, radius: number, quadrant: number,
    depth: number, startSlope: number, endSlope: number
  ): void {
    if (depth > radius) return;
    const EPS = 1e-9;
    const minCol = Math.floor(depth * startSlope + 0.5);
    const maxCol = Math.ceil(depth * endSlope - 0.5);
    let start = startSlope;
    let prevWasWall: boolean | null = null;

    for (let col = minCol; col <= maxCol; col++) {
      const [x, y] = FieldOfView.toGrid(source, quadrant, depth, col);
      const wall = this.isOpaque(x, y);
      const centreInside = col >= depth * start - EPS && col <= depth * endSlope + EPS;

      if (wall || centreInside) this.markVisible(source, x, y, radius, wall);

      if (prevWasWall === true && !wall) {
        // Leaving a wall: the visible range now starts at this cell's near edge.
        start = (2 * col - 1) / (2 * depth);
      }
      if (prevWasWall === false && wall) {
        // Hitting a wall: scan the next row up to this wall's near edge.
        this.scanRow(source, radius, quadrant, depth + 1, start, (2 * col - 1) / (2 * depth));
      }
      prevWasWall = wall;
    }
    if (prevWasWall === false) this.scanRow(source, radius, quadrant, depth + 1, start, endSlope);
  }

  private markVisible(source: Vector, x: number, y: number, radius: number, wall: boolean): void {
    if (!this.grid.isInBounds(x, y)) return;
    const distSq = (x - source.x) ** 2 + (y - source.y) ** 2;
    if (distSq > radius * radius) return;
    const key = `${x},${y}`;
    const d = Math.sqrt(distSq);
    this.visibleCells.add(key);
    if (wall) this.shadowCells.add(key);
    this.cellVisibility.set(key, {
      intensity: Math.max(0.3, 1 - d / (radius + 1)),
      isBlocked: false,
      distances: new Map([[0, d]]),
    });
  }

  /** Walls, water and anything else that isn't walkable block light. */
  private isOpaque(x: number, y: number): boolean {
    const cell = this.grid.getCell(x, y);
    return !cell || !cell.walkable;
  }

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

import { Vector } from './Vector';

/**
 * Grid constants for cell types
 */
export enum CellType {
  EMPTY = 0,
  WALL = 1,
  GRASS = 2,
  SWAMP = 3,
  ROAD = 4,
  WATER = 5,
}

/**
 * Represents a single cell in the grid
 */
export interface Cell {
  x: number;
  y: number;
  type: CellType;
  walkable: boolean;
  cost: number; // For pathfinding
}

/**
 * 2D Grid class for managing game world
 */
export class Grid {
  private cells: Map<string, Cell> = new Map();
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.initializeCells();
  }

  /**
   * Initialize all cells in the grid
   */
  private initializeCells(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell: Cell = {
          x,
          y,
          type: CellType.EMPTY,
          walkable: true,
          cost: 1,
        };
        this.cells.set(this.getKey(x, y), cell);
      }
    }
  }

  /**
   * Get a cell by coordinates
   */
  getCell(x: number, y: number): Cell | undefined {
    if (!this.isInBounds(x, y)) return undefined;
    return this.cells.get(this.getKey(x, y));
  }

  /**
   * Set cell type
   */
  setCellType(x: number, y: number, type: CellType): void {
    if (!this.isInBounds(x, y)) return;

    const cell = this.cells.get(this.getKey(x, y));
    if (cell) {
      cell.type = type;
      cell.walkable = type !== CellType.WALL && type !== CellType.WATER;
      cell.cost = this.calculateCost(type);
    }
  }

  /**
   * Calculate movement cost based on cell type
   */
  private calculateCost(type: CellType): number {
    const costs: Record<CellType, number> = {
      [CellType.EMPTY]: 1,
      [CellType.WALL]: Infinity,
      [CellType.GRASS]: 1,
      [CellType.SWAMP]: 3,
      [CellType.ROAD]: 0.5,
      [CellType.WATER]: Infinity,
    };
    return costs[type];
  }

  /**
   * Check if coordinates are in bounds
   */
  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Get all neighbors of a cell (4-directional or 8-directional)
   */
  getNeighbors(x: number, y: number, diagonal: boolean = false): Vector[] {
    const neighbors: Vector[] = [];
    const directions = diagonal
      ? [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ]
      : [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isInBounds(nx, ny)) {
        neighbors.push(new Vector(nx, ny));
      }
    }

    return neighbors;
  }

  /**
   * Get grid dimensions
   */
  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  /**
   * Generate key for cell mapping
   */
  private getKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}

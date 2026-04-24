/**
 * 2D Vector class for grid coordinates
 */
export class Vector {
  constructor(public x: number, public y: number) {}

  /**
   * Create a copy of this vector
   */
  clone(): Vector {
    return new Vector(this.x, this.y);
  }

  /**
   * Add another vector to this one
   */
  add(other: Vector): Vector {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  /**
   * Subtract another vector from this one
   */
  subtract(other: Vector): Vector {
    return new Vector(this.x - other.x, this.y - other.y);
  }

  /**
   * Scale this vector by a scalar
   */
  scale(scalar: number): Vector {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  /**
   * Calculate Manhattan distance to another vector
   */
  manhattanDistance(other: Vector): number {
    return Math.abs(this.x - other.x) + Math.abs(this.y - other.y);
  }

  /**
   * Calculate Euclidean distance to another vector
   */
  euclideanDistance(other: Vector): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check equality
   */
  equals(other: Vector): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /**
   * Get string representation for hashing
   */
  key(): string {
    return `${this.x},${this.y}`;
  }
}

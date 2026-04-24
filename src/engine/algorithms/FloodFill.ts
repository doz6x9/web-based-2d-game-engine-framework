import { Vector } from '../core/Vector';
import { Grid } from '../core/Grid';

/**
 * Flood fill algorithm for room visibility
 * Used to mark cells visible from an opening (door)
 */
export class FloodFill {
  private grid: Grid;

  constructor(grid: Grid) {
    this.grid = grid;
  }

  /**
   * Perform flood fill from a starting position
   * Returns set of reachable cells
   */
  fillRoom(start: Vector): Set<string> {
    const visited = new Set<string>();
    const queue: Vector[] = [start];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = current.key();

      if (visited.has(key)) continue;
      if (!this.grid.isInBounds(current.x, current.y)) continue;

      const cell = this.grid.getCell(current.x, current.y);
      if (!cell || !cell.walkable) continue;

      visited.add(key);

      // Add neighbors to queue
      const neighbors = this.grid.getNeighbors(current.x, current.y, false);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.key())) {
          queue.push(neighbor);
        }
      }
    }

    return visited;
  }

  /**
   * Find all connected rooms from a starting position
   * Returns map of room ID to cells in that room
   */
  findAllRooms(): Map<number, Set<string>> {
    const rooms = new Map<number, Set<string>>();
    const visited = new Set<string>();
    let roomId = 0;

    for (let y = 0; y < this.grid.getHeight(); y++) {
      for (let x = 0; x < this.grid.getWidth(); x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        const cell = this.grid.getCell(x, y);
        if (!cell || !cell.walkable) continue;

        // Found new room
        const room = this.fillRoom(new Vector(x, y));
        room.forEach((cellKey) => visited.add(cellKey));
        rooms.set(roomId, room);
        roomId++;
      }
    }

    return rooms;
  }

  /**
   * Check if two positions are in the same room
   */
  isInSameRoom(pos1: Vector, pos2: Vector): boolean {
    const start = this.grid.getCell(pos1.x, pos1.y);
    if (!start || !start.walkable) return false;

    const room = this.fillRoom(pos1);
    return room.has(pos2.key());
  }
}

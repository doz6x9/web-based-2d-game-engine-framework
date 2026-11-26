import { Vector } from '../core/Vector';
import { Grid } from '../core/Grid';

/**
 * Node for A* pathfinding algorithm
 */
class AStarNode {
  g: number = 0; // Cost from start
  h: number = 0; // Heuristic cost to goal
  f: number = 0; // Total cost
  parent: AStarNode | null = null;

  constructor(public position: Vector) {}
}

/**
 * A* Pathfinding Algorithm
 * Finds optimal path considering different terrain costs (e.g., roads, swamps, walls).
 *
 * To define custom terrain costs:
 * 1. Define your own CellType enum or integers mapping in your game logic.
 * 2. Update the `Grid` instance by setting `.cost` on specific cells.
 *    Example:
 *    ```typescript
 *    const cell = engine.grid.getCell(x, y);
 *    if (isSwamp(x, y)) {
 *        cell.cost = 3.0; // Hard to walk through
 *    } else if (isRoad(x, y)) {
 *        cell.cost = 0.5; // Easy to walk through
 *    } else {
 *        cell.cost = 1.0; // Default terrain cost
 *    }
 *    ```
 * The A* algorithm will automatically prioritize paths with lower cumulative `g` costs.
 */
export class AStarPathfinder {
  private grid: Grid;
  private openSet: Set<string> = new Set();
  private closedSet: Set<string> = new Set();
  private nodeMap: Map<string, AStarNode> = new Map();

  constructor(grid: Grid) {
    this.grid = grid;
  }

  /**
   * Find path from start to goal
   * @param start Starting coordinates
   * @param goal Target coordinates
   * @returns Array of Vectors representing the path (excluding start, including goal)
   */
  findPath(start: Vector, goal: Vector): Vector[] {
    this.openSet.clear();
    this.closedSet.clear();
    this.nodeMap.clear();

    const startNode = new AStarNode(start);
    startNode.g = 0;
    startNode.h = this.heuristic(start, goal);
    startNode.f = startNode.h;

    this.nodeMap.set(start.key(), startNode);
    this.openSet.add(start.key());

    while (this.openSet.size > 0) {
      // Find node with lowest f cost
      let current: AStarNode | null = null;
      let lowestKey = '';
      let lowestF = Infinity;

      for (const key of this.openSet) {
        const node = this.nodeMap.get(key)!;
        if (node.f < lowestF) {
          lowestF = node.f;
          current = node;
          lowestKey = key;
        }
      }

      if (current === null) break;

      if (current.position.equals(goal)) {
        return this.reconstructPath(current);
      }

      this.openSet.delete(lowestKey);
      this.closedSet.add(lowestKey);

      // Check neighbors
      const neighbors = this.grid.getNeighbors(
        current.position.x,
        current.position.y,
        false // Allow diagonal? False by default for basic grid movement
      );

      for (const neighbor of neighbors) {
        const neighborKey = neighbor.key();

        if (this.closedSet.has(neighborKey)) continue;

        const cell = this.grid.getCell(neighbor.x, neighbor.y);
        // If there's no cell or it's explicitly not walkable (like a wall), skip it
        if (!cell || !cell.walkable) continue;

        // The critical terrain cost logic.
        // Cell.cost defaults to 1, but can be higher (swamp) or lower (road)
        const tentativeG = current.g + cell.cost;

        let neighborNode = this.nodeMap.get(neighborKey);
        if (!neighborNode) {
          neighborNode = new AStarNode(neighbor);
          this.nodeMap.set(neighborKey, neighborNode);
        }

        if (this.openSet.has(neighborKey) && tentativeG >= neighborNode.g) {
          continue;
        }

        neighborNode.parent = current;
        neighborNode.g = tentativeG;
        neighborNode.h = this.heuristic(neighbor, goal);
        neighborNode.f = neighborNode.g + neighborNode.h;

        if (!this.openSet.has(neighborKey)) {
          this.openSet.add(neighborKey);
        }
      }
    }

    // No path found
    return [];
  }

  /**
   * Heuristic function (Manhattan distance for 4-way movement)
   */
  private heuristic(a: Vector, b: Vector): number {
    return a.manhattanDistance(b);
  }

  /**
   * Reconstruct path from goal to start
   */
  private reconstructPath(node: AStarNode): Vector[] {
    const path: Vector[] = [];
    let current: AStarNode | null = node;

    // Do not include the start node in the final array
    while (current !== null && current.parent !== null) {
      path.unshift(current.position);
      current = current.parent;
    }

    return path;
  }
}

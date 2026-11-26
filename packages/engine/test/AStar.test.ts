import { describe, it, expect } from 'vitest';
import { AStarPathfinder } from '../src/algorithms/AStar';
import { Vector } from '../src/core/Vector';
import { gridFrom, pathCost } from './helpers';

/** Reference shortest-path cost (Dijkstra) to check A* is optimal. */
function dijkstra(grid: ReturnType<typeof gridFrom>, start: Vector, goal: Vector): number {
  const dist = new Map<string, number>([[start.key(), 0]]);
  const done = new Set<string>();
  while (true) {
    let best: string | null = null;
    for (const [k, d] of dist) if (!done.has(k) && (best === null || d < dist.get(best)!)) best = k;
    if (best === null) return Infinity;
    if (best === goal.key()) return dist.get(best)!;
    done.add(best);
    const [x, y] = best.split(',').map(Number);
    for (const n of grid.getNeighbors(x, y)) {
      const cell = grid.getCell(n.x, n.y)!;
      if (!cell.walkable) continue;
      const nd = dist.get(best)! + cell.cost;
      if (nd < (dist.get(n.key()) ?? Infinity)) dist.set(n.key(), nd);
    }
  }
}

function expectConnected(start: Vector, path: Vector[]) {
  let prev = start;
  for (const p of path) {
    expect(prev.manhattanDistance(p)).toBe(1);
    prev = p;
  }
}

describe('AStarPathfinder', () => {
  it('finds a straight path on open ground', () => {
    const grid = gridFrom(['.....']);
    const path = new AStarPathfinder(grid).findPath(new Vector(0, 0), new Vector(4, 0));
    expect(path.map((p) => p.key())).toEqual(['1,0', '2,0', '3,0', '4,0']);
  });

  it('returns an empty path when start equals goal', () => {
    const grid = gridFrom(['...']);
    expect(new AStarPathfinder(grid).findPath(new Vector(1, 0), new Vector(1, 0))).toEqual([]);
  });

  it('walks around walls and never steps on them', () => {
    const grid = gridFrom([
      '.....',
      '.###.',
      '.#...',
      '.#.#.',
      '...#.',
    ]);
    const start = new Vector(2, 2);
    const goal = new Vector(0, 0);
    const path = new AStarPathfinder(grid).findPath(start, goal);
    expect(path.at(-1)!.equals(goal)).toBe(true);
    expectConnected(start, path);
    for (const p of path) expect(grid.getCell(p.x, p.y)!.walkable).toBe(true);
  });

  it('returns an empty path when the goal is walled off', () => {
    const grid = gridFrom([
      '..#..',
      '..#..',
      '..#..',
    ]);
    expect(new AStarPathfinder(grid).findPath(new Vector(0, 1), new Vector(4, 1))).toEqual([]);
  });

  it('returns an empty path when the goal itself is not walkable', () => {
    const grid = gridFrom(['..w..']);
    expect(new AStarPathfinder(grid).findPath(new Vector(0, 0), new Vector(2, 0))).toEqual([]);
  });

  it('takes a longer road instead of crossing an expensive swamp', () => {
    // Straight across: 4 swamp tiles (cost 3 each) + goal = 13.
    // Road around: 8 path tiles at 0.5 each = 4.
    const grid = gridFrom([
      '======',
      '=~~~~=',
    ]);
    const start = new Vector(0, 1);
    const goal = new Vector(5, 1);
    const path = new AStarPathfinder(grid).findPath(start, goal);
    expectConnected(start, path);
    expect(path.some((p) => p.y === 1 && p.x > 0 && p.x < 5)).toBe(false);
    expect(pathCost(grid, path)).toBeCloseTo(3.5);
  });

  it('crosses the swamp when it is cheaper than the detour', () => {
    const grid = gridFrom([
      '......',
      '......',
      '......',
      '#~####',
      '......',
    ]);
    const path = new AStarPathfinder(grid).findPath(new Vector(1, 0), new Vector(1, 4));
    expect(path.map((p) => p.key())).toContain('1,3');
  });

  it('finds the cheapest route on mixed terrain (matches Dijkstra)', () => {
    const grid = gridFrom([
      '..~~~~....',
      '.#~#=====.',
      '.#~#=##~=.',
      '.#..=#.~=.',
      '.####.~~=.',
      '..~~~...=.',
      '.#####.#=.',
      '.......#..',
    ]);
    const pf = new AStarPathfinder(grid);
    const pairs: [Vector, Vector][] = [
      [new Vector(0, 0), new Vector(9, 7)],
      [new Vector(2, 3), new Vector(6, 3)],
      [new Vector(0, 7), new Vector(9, 0)],
      [new Vector(6, 5), new Vector(0, 0)],
    ];
    for (const [s, g] of pairs) {
      const path = pf.findPath(s, g);
      expectConnected(s, path);
      expect(pathCost(grid, path)).toBeCloseTo(dijkstra(grid, s, g));
    }
  });

  it('reflects a cell changed after the pathfinder was created (a door opening)', () => {
    const grid = gridFrom([
      '..#..',
    ]);
    const pf = new AStarPathfinder(grid);
    expect(pf.findPath(new Vector(0, 0), new Vector(4, 0))).toEqual([]);
    grid.setCellType(2, 0, 5); // stone floor
    expect(pf.findPath(new Vector(0, 0), new Vector(4, 0))).toHaveLength(4);
  });
});

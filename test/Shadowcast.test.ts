import { describe, it, expect } from 'vitest';
import { FieldOfView } from '../src/algorithms/FieldOfView';
import { Vector } from '../src/core/Vector';
import { gridFrom } from './helpers';

const see = (rows: string[], x: number, y: number, r: number, algo: 'raycast' | 'shadowcast' = 'shadowcast') =>
  new Set(new FieldOfView(gridFrom(rows)).calculateFOV(new Vector(x, y), r, algo));

// A wall made only of diagonal steps: every gap in it is a corner-to-corner gap.
const DIAGONAL_WALL = [
  '........#',
  '.......#.',
  '......#..',
  '.....#...',
  '....#....',
  '...#.....',
  '..#......',
  '.#.......',
  '#........',
];

describe('Recursive shadowcasting', () => {
  it('sees every cell within the radius on open ground, and nothing beyond', () => {
    const rows = Array(21).fill('.....................');
    const cells = see(rows, 10, 10, 6);
    let expected = 0;
    for (let y = 0; y < 21; y++)
      for (let x = 0; x < 21; x++) {
        const inside = (x - 10) ** 2 + (y - 10) ** 2 <= 36;
        if (inside) expected++;
        expect(cells.has(`${x},${y}`)).toBe(inside);
      }
    expect(cells.size).toBe(expected);
  });

  it('covers all 8 octants', () => {
    const cells = see(Array(9).fill('.........'), 4, 4, 3);
    for (const [x, y] of [[7, 4], [1, 4], [4, 7], [4, 1], [6, 6], [2, 2], [6, 2], [2, 6], [6, 5], [5, 6], [2, 3], [3, 2], [6, 3], [3, 6], [2, 5], [5, 2]])
      expect(cells.has(`${x},${y}`)).toBe(true);
  });

  it('sees a wall but not the cells in its shadow', () => {
    const rows = [
      '...........',
      '...........',
      '..s..#.....',
      '...........',
      '...........',
    ];
    const fov = new FieldOfView(gridFrom(rows));
    const cells = fov.calculateFOV(new Vector(2, 2), 9, 'shadowcast');
    expect(cells.has('5,2')).toBe(true);
    expect(fov.getShadowCells().has('5,2')).toBe(true);
    for (const x of [6, 7, 8, 9, 10]) expect(cells.has(`${x},2`)).toBe(false);
    // The shadow widens with distance, while cells beside it stay lit.
    expect(cells.has('9,1')).toBe(false);
    expect(cells.has('10,0')).toBe(true);
    expect(cells.has('10,4')).toBe(true);
  });

  it('keeps a closed room completely dark', () => {
    const rows = [
      '..........',
      '.######...',
      '.#....#...',
      '.#....#...',
      '.######...',
      '..........',
    ];
    const cells = see(rows, 8, 3, 10);
    for (const [x, y] of [[2, 2], [3, 3], [4, 2], [5, 3]]) expect(cells.has(`${x},${y}`)).toBe(false);
    expect(cells.has('6,3')).toBe(true);
  });

  it('lets light through a doorway in a straight line', () => {
    const rows = [
      '#########',
      '#...#...#',
      '#.......#',
      '#...#...#',
      '#########',
    ];
    const cells = see(rows, 1, 2, 10);
    for (const x of [4, 5, 6, 7]) expect(cells.has(`${x},2`)).toBe(true);
    // Past the doorway the visible cone widens.
    expect(cells.has('7,1')).toBe(true);
    expect(cells.has('7,3')).toBe(true);
    expect(cells.has('5,1')).toBe(false); // hidden behind the doorway's wall
  });

  it('does not leak light through a diagonal wall', () => {
    const cells = see(DIAGONAL_WALL, 2, 2, 12);
    for (const key of cells) {
      const [x, y] = key.split(',').map(Number);
      expect(x + y).toBeLessThanOrEqual(8);
    }
  });

  it('is symmetric on open ground with pillars: A sees B exactly when B sees A', () => {
    const rows = [
      '............',
      '..#.....#...',
      '......#.....',
      '...#........',
      '.........#..',
      '....#.......',
      '............',
      '..#....#....',
    ];
    const grid = gridFrom(rows);
    const fov = new FieldOfView(grid);
    const floor: Vector[] = [];
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[0].length; x++) if (grid.getCell(x, y)!.walkable) floor.push(new Vector(x, y));
    const views = new Map(floor.map((p) => [p.key(), new Set(fov.calculateFOV(p, 20, 'shadowcast'))]));
    let mismatches = 0;
    for (const a of floor) for (const b of floor) {
      if (views.get(a.key())!.has(b.key()) !== views.get(b.key())!.has(a.key())) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});

describe('Raycasting and diagonal gaps', () => {
  it('does not leak light through a diagonal wall', () => {
    const cells = see(DIAGONAL_WALL, 2, 2, 12, 'raycast');
    for (const key of cells) {
      const [x, y] = key.split(',').map(Number);
      expect(x + y).toBeLessThanOrEqual(8);
    }
    expect(cells.has('4,4')).toBe(true); // the wall itself is still seen
  });

  it('still passes through a diagonal gap when only one side is a wall', () => {
    const rows = [
      '.#...',
      '.....',
      '.....',
    ];
    const cells = see(rows, 0, 0, 6, 'raycast');
    expect(cells.has('1,1')).toBe(true);
    expect(cells.has('2,2')).toBe(true);
  });
});

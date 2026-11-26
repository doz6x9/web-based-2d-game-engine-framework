import { describe, it, expect } from 'vitest';
import { FieldOfView } from '../src/algorithms/FieldOfView';
import { Vector } from '../src/core/Vector';
import { gridFrom } from './helpers';

describe('FieldOfView', () => {
  const open = () => gridFrom(Array(11).fill('...........'));

  it('always sees its own cell', () => {
    const fov = new FieldOfView(open());
    expect(fov.calculateFOV(new Vector(5, 5), 3).has('5,5')).toBe(true);
  });

  it('sees cells within the radius and none beyond it', () => {
    const fov = new FieldOfView(open());
    const cells = fov.calculateFOV(new Vector(5, 5), 3);
    for (const key of ['8,5', '2,5', '5,8', '5,2', '7,7']) expect(cells.has(key)).toBe(true);
    for (const key of cells) {
      const [x, y] = key.split(',').map(Number);
      expect(Math.hypot(x - 5, y - 5)).toBeLessThanOrEqual(3 + 1); // ray steps may round into the edge cell
    }
    expect(cells.has('10,5')).toBe(false);
    expect(cells.has('5,0')).toBe(false);
  });

  it('sees the wall that blocks it but not what is behind', () => {
    const grid = gridFrom([
      '.........',
      '.........',
      '.........',
      '.........',
      '..s.#....',
      '.........',
    ]);
    const fov = new FieldOfView(grid);
    const cells = fov.calculateFOV(new Vector(2, 4), 6);
    expect(cells.has('4,4')).toBe(true);   // the wall itself is visible
    expect(cells.has('5,4')).toBe(false);  // directly behind it is in shadow
    expect(cells.has('6,4')).toBe(false);
    expect(fov.getShadowCells().has('4,4')).toBe(true);
  });

  it('does not see into a closed room', () => {
    const grid = gridFrom([
      '.........',
      '.#####...',
      '.#...#...',
      '.#...#...',
      '.#####...',
      '.........',
    ]);
    const cells = new FieldOfView(grid).calculateFOV(new Vector(7, 3), 8);
    for (const key of ['2,2', '3,2', '4,3', '3,3']) expect(cells.has(key)).toBe(false);
    expect(cells.has('5,3')).toBe(true);
  });

  it('hides cells behind a wall with shadowcasting too', () => {
    const grid = gridFrom([
      '.......',
      '..s#...',
      '.......',
    ]);
    const fov = new FieldOfView(grid);
    const cells = fov.calculateFOV(new Vector(2, 1), 4, 'shadowcast');
    expect(cells.has('3,1')).toBe(true);  // the wall itself is seen
    expect(cells.has('4,1')).toBe(false); // the cell behind it is not
    expect(cells.has('1,1')).toBe(true);
  });

  it('checks line of sight between two points', () => {
    const grid = gridFrom([
      '.....',
      '..#..',
      '.....',
    ]);
    const fov = new FieldOfView(grid);
    expect(fov.isTargetVisible(new Vector(0, 1), new Vector(4, 1))).toBe(false);
    expect(fov.isTargetVisible(new Vector(0, 0), new Vector(4, 0))).toBe(true);
  });

  it('gets dimmer further from the light', () => {
    const fov = new FieldOfView(open());
    fov.calculateFOV(new Vector(5, 5), 5);
    expect(fov.getIntensity(5, 5)).toBe(1);
    expect(fov.getIntensity(6, 5)).toBeGreaterThan(fov.getIntensity(8, 5));
  });
});

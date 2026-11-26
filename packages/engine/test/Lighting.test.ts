import { describe, it, expect } from 'vitest';
import { FieldOfView } from '../src/algorithms/FieldOfView';
import { FogOfWar } from '../src/algorithms/FogOfWar';
import { LightingSystem } from '../src/systems/LightingSystem';
import { Vector } from '../src/core/Vector';
import { gridFrom } from './helpers';

const twoRooms = () =>
  gridFrom([
    '###########',
    '#...#.....#',
    '#...#.....#',
    '#...#.....#',
    '###########',
  ]);

describe('LightingSystem (several lights)', () => {
  it('lights the union of every light', () => {
    const grid = twoRooms();
    const fov = new FieldOfView(grid);
    const lighting = new LightingSystem(fov);
    lighting.addLight({ id: 'a', position: new Vector(2, 2), radius: 3 });
    lighting.addLight({ id: 'b', position: new Vector(7, 2), radius: 3 });
    lighting.update();

    const a = new FieldOfView(grid).calculateFOV(new Vector(2, 2), 3);
    const b = new FieldOfView(grid).calculateFOV(new Vector(7, 2), 3);
    const union = new Set([...a, ...b]);
    expect(new Set(lighting.getVisibleCells())).toEqual(union);
    expect(lighting.isLit(1, 1)).toBe(true);
    expect(lighting.isLit(9, 3)).toBe(true);
  });

  it('keeps each light inside its own room', () => {
    const lighting = new LightingSystem(new FieldOfView(twoRooms()));
    lighting.addLight({ id: 'a', position: new Vector(2, 2), radius: 8 });
    lighting.update();
    expect(lighting.isLit(3, 2)).toBe(true);
    expect(lighting.isLit(6, 2)).toBe(false);
  });

  it('skips work when nothing changed, and recomputes when a light moves', () => {
    const lighting = new LightingSystem(new FieldOfView(twoRooms()));
    const light = { id: 'a', position: new Vector(2, 2), radius: 2 };
    lighting.addLight(light);
    expect(lighting.update()).toBe(true);
    expect(lighting.update()).toBe(false);
    light.position = new Vector(7, 2);
    expect(lighting.update()).toBe(true);
    expect(lighting.isLit(7, 2)).toBe(true);
    expect(lighting.isLit(2, 2)).toBe(false);
  });

  it('turns lights off and removes them', () => {
    const lighting = new LightingSystem(new FieldOfView(twoRooms()));
    lighting.addLight({ id: 'a', position: new Vector(2, 2), radius: 2 });
    lighting.addLight({ id: 'b', position: new Vector(7, 2), radius: 2 });
    lighting.setEnabled('a', false);
    lighting.update();
    expect(lighting.isLit(2, 2)).toBe(false);
    expect(lighting.isLit(7, 2)).toBe(true);
    lighting.removeLight('b');
    lighting.update();
    expect(lighting.getVisibleCells().size).toBe(0);
  });

  it('keeps a hidden-until-explored torch dark until its cell is explored', () => {
    const grid = twoRooms();
    const fov = new FieldOfView(grid);
    const fog = new FogOfWar(11, 5, fov);
    const lighting = new LightingSystem(fov);
    lighting.addLight({ id: 'player', position: new Vector(2, 2), radius: 3 });
    lighting.addLight({ id: 'torch', position: new Vector(7, 2), radius: 3, hiddenUntilExplored: true });
    lighting.update(fog);
    expect(lighting.isLit(7, 2)).toBe(false);

    fog.markMultipleExplored(new Set(['7,2']));
    expect(lighting.update(fog)).toBe(true);
    expect(lighting.isLit(7, 2)).toBe(true);
  });

  it('merges brightness with calculateMultipleFOV, keeping the brightest light per cell', () => {
    const grid = gridFrom(['...........']);
    const fov = new FieldOfView(grid);
    const map = fov.calculateMultipleFOV([
      { position: new Vector(0, 0), radius: 6 },
      { position: new Vector(10, 0), radius: 6 },
    ]);
    // The middle cell is reached by both lights.
    expect(map.get('5,0')!.distances.size).toBe(2);
    // Each end is brightest next to its own light.
    expect(map.get('1,0')!.intensity).toBeGreaterThan(map.get('4,0')!.intensity);
    expect(map.get('9,0')!.intensity).toBeGreaterThan(map.get('6,0')!.intensity);
    expect(map.get('1,0')!.intensity).toBeCloseTo(map.get('9,0')!.intensity);
  });
});

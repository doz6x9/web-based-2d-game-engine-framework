import { describe, it, expect, vi } from 'vitest';
import { FloodFill } from '../src/algorithms/FloodFill';
import { FogOfWar, FogState } from '../src/algorithms/FogOfWar';
import { FieldOfView } from '../src/algorithms/FieldOfView';
import { GameEngine } from '../src/GameEngine';
import { Vector } from '../src/core/Vector';
import { CellType } from '../src/core/Grid';
import { gridFrom } from './helpers';

// Two rooms joined by a door at (4,2). '#' at the door means it is closed.
const ROOMS = [
  '#########',
  '#...#...#',
  '#...#...#',
  '#...#...#',
  '#########',
];

describe('FloodFill', () => {
  it('fills exactly the floor of the starting room', () => {
    const room = new FloodFill(gridFrom(ROOMS)).fillRoom(new Vector(1, 1));
    expect(room.size).toBe(9);
    expect(room.has('3,3')).toBe(true);
    expect(room.has('5,1')).toBe(false);
    expect(room.has('0,0')).toBe(false);
  });

  it('spreads through a door once it is open', () => {
    const grid = gridFrom(ROOMS);
    grid.setCellType(4, 2, CellType.STONE_FLOOR);
    const room = new FloodFill(grid).fillRoom(new Vector(1, 1));
    expect(room.size).toBe(19);
    expect(room.has('7,3')).toBe(true);
  });

  it('returns nothing when started on a wall', () => {
    expect(new FloodFill(gridFrom(ROOMS)).fillRoom(new Vector(0, 0)).size).toBe(0);
  });

  it('stops at the cell limit', () => {
    const room = new FloodFill(gridFrom(Array(10).fill('..........'))).fillRoom(new Vector(0, 0), 25);
    expect(room.size).toBe(25);
  });

  it('finds every separate room and tells if two cells share one', () => {
    const ff = new FloodFill(gridFrom(ROOMS));
    const rooms = ff.findAllRooms();
    expect(rooms.size).toBe(2);
    expect([...rooms.values()].map((r) => r.size).sort()).toEqual([9, 9]);
    expect(ff.isInSameRoom(new Vector(1, 1), new Vector(3, 3))).toBe(true);
    expect(ff.isInSameRoom(new Vector(1, 1), new Vector(6, 2))).toBe(false);
  });
});

describe('GameEngine.revealRoom', () => {
  // The engine listens for keys on window; tests run without a browser.
  vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });

  function engineWith(rows: string[]) {
    const engine = new GameEngine();
    const grid = (engine as any).grid;
    grid.resize(rows[0].length, rows.length);
    const src = gridFrom(rows);
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[0].length; x++) grid.setCellType(x, y, src.getCell(x, y)!.type);
    engine.fogOfWar = new FogOfWar(rows[0].length, rows.length, new FieldOfView(grid));
    return engine;
  }

  it('reveals the room behind a closed door, with its walls, and nothing past it', () => {
    const engine = engineWith(ROOMS);
    // The player opens the door at (4,2) and the room to the east is revealed.
    const cells = engine.revealRoom(new Vector(5, 2));
    const fog = engine.fogOfWar;
    expect(fog.getFogState(6, 2)).toBe(FogState.EXPLORED);
    expect(fog.getFogState(8, 0)).toBe(FogState.EXPLORED); // corner wall outline
    expect(fog.getFogState(4, 2)).toBe(FogState.EXPLORED); // the door's wall cell
    expect(fog.getFogState(2, 2)).toBe(FogState.UNKNOWN);  // the other room stays hidden
    expect(cells.has('1,1')).toBe(false);
  });

  it('can reveal only the floor', () => {
    const engine = engineWith(ROOMS);
    const cells = engine.revealRoom(new Vector(5, 2), 400, false);
    expect(cells.size).toBe(9);
    expect(engine.fogOfWar.getFogState(8, 2)).toBe(FogState.UNKNOWN);
  });
});

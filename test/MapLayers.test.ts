import { describe, it, expect, vi } from 'vitest';
import { MapLoader, type MapJSON } from '../src/map/MapLayer';
import { GameEngine } from '../src/GameEngine';
import { Grid, CellType } from '../src/core/Grid';
import { TileRegistry } from '../src/core/TileRegistry';

vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });

const W = 1, G = 0, S = 10;
const base = (layers: MapJSON['layers'], extra: Partial<MapJSON> = {}): MapJSON => ({ width: 3, height: 2, layers, ...extra });

function engineWith(map: MapJSON, layerNames?: { ground?: string; collision?: string }) {
  const engine = new GameEngine(layerNames ? { layerNames } : {});
  // Skip view fitting, which needs a renderer.
  (engine as any).fitViewToMap = () => {};
  engine.loadMapData(map);
  return engine;
}

describe('Map layer roles', () => {
  it('uses "terrain" as ground and "collision" as collision by default, the rest are overlays', () => {
    const map = MapLoader.parseMapJSON(base([
      { name: 'terrain', data: [[G, G, G], [G, G, G]] },
      { name: 'landmarks', data: [[0, 20, 0], [0, 0, 0]] },
      { name: 'collision', data: [[0, 0, 0], [0, 0, 0]] },
    ]));
    expect(map.getLayers().map((l) => l.getRole())).toEqual(['ground', 'overlay', 'collision']);
  });

  it('reads the layer names from the map itself', () => {
    const map = MapLoader.parseMapJSON(base([
      { name: 'floor', data: [[G, G, G], [G, G, G]] },
      { name: 'blocks', data: [[W, 0, 0], [0, 0, 0]] },
    ], { groundLayer: 'floor', collisionLayer: 'blocks' }));
    expect(map.getGroundLayer()!.getName()).toBe('floor');
    expect(map.getCollisionLayer()!.getName()).toBe('blocks');
  });

  it('prefers an explicit role on the layer', () => {
    const map = MapLoader.parseMapJSON(base([
      { name: 'decor', role: 'overlay', data: [[0, 0, 0], [0, 0, 0]] },
      { name: 'base', role: 'ground', data: [[G, G, G], [G, G, G]] },
      { name: 'solid', role: 'collision', data: [[0, 0, 0], [0, 0, 0]] },
    ]));
    expect(map.getGroundLayer()!.getName()).toBe('base');
    expect(map.getCollisionLayer()!.getName()).toBe('solid');
  });

  it('falls back to the first layer as ground when nothing is named', () => {
    const map = MapLoader.parseMapJSON(base([
      { name: 'whatever', data: [[G, W, S], [G, G, G]] },
      { name: 'trees', data: [[0, 0, 0], [0, 0, 0]] },
    ]));
    expect(map.getGroundLayer()!.getName()).toBe('whatever');
    expect(map.getCollisionLayer()).toBeUndefined();
  });

  it('takes layer names passed to the engine', () => {
    const engine = engineWith(base([
      { name: 'ground', data: [[G, G, G], [G, G, G]] },
      { name: 'walls', data: [[0, W, 0], [0, 0, 0]] },
    ]), { ground: 'ground', collision: 'walls' });
    expect(engine.grid.getCell(1, 0)!.walkable).toBe(false);
    expect(engine.grid.getCell(0, 0)!.walkable).toBe(true);
  });
});

describe('Building the grid from map layers', () => {
  it('builds walls and costs from a single ground layer with no collision layer', () => {
    const engine = engineWith(base([{ name: 'ground', data: [[G, W, S], [G, G, G]] }]));
    expect(engine.grid.getCell(1, 0)!.walkable).toBe(false);
    expect(engine.grid.getCell(2, 0)!.cost).toBe(3);
  });

  it('lets a collision value override the ground tile', () => {
    const engine = engineWith(base([
      { name: 'terrain', data: [[G, G, G], [G, G, G]] },
      { name: 'collision', data: [[0, 0, W], [0, 0, 0]] },
    ]));
    expect(engine.grid.getCell(2, 0)!.walkable).toBe(false);
  });

  it('ignores overlay layers for walkability', () => {
    const engine = engineWith(base([
      { name: 'terrain', data: [[G, G, G], [G, G, G]] },
      { name: 'landmarks', data: [[W, W, W], [W, W, W]] },
    ]));
    expect(engine.grid.getCell(0, 0)!.walkable).toBe(true);
  });
});

describe('Tile costs have one source of truth', () => {
  it('gives every grid cell the walkability and cost from TileRegistry', () => {
    const grid = new Grid(1, 1);
    for (const [id, tile] of TileRegistry.getAllTiles()) {
      grid.setCellType(0, 0, id as CellType);
      const cell = grid.getCell(0, 0)!;
      expect(cell.walkable).toBe(tile.walkable);
      expect(cell.cost).toBe(tile.walkable ? tile.cost : Infinity);
    }
  });

  it('uses custom tiles registered by a game', () => {
    TileRegistry.registerTile(42, { cost: 2, walkable: true, sprite: 'ice', name: 'Ice', color: 0xffffff });
    const grid = new Grid(1, 1);
    grid.setCellType(0, 0, 42 as CellType);
    expect(grid.getCell(0, 0)!.cost).toBe(2);
  });
});

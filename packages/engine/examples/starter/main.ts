// A minimal game built straight from the engine source in this repository.
// It shows the core features: a layered JSON map (ground, landmarks, entities),
// a camera that follows the player, A* click-to-move over terrain costs,
// field of view with two lights, Fog of War and a flood-fill room reveal.
//
// Run it with `npm run example`. To build your own game, copy this folder and
// change the map, the sprites and the rules below.
import { GameEngine, TileRegistry, Vector, type AssetConfig, type IEntity, type MapJSON } from '../../src/index.ts';

// Built-in tiles (grass, walls, water, road, stone, swamp) already have
// costs and sprite names. The example adds its own overlay tiles for the
// "landmarks" layer. Overlay tiles are only drawn; they never block movement.
const FLOWERS = 20, ROCK = 21, BANNER = 22, GATE = 23, GATE_OPEN = 24;
const overlays: [number, string][] = [[FLOWERS, 'flowers'], [ROCK, 'rock'], [BANNER, 'banner'], [GATE, 'gate'], [GATE_OPEN, 'gate_open']];
for (const [id, sprite] of overlays) {
  TileRegistry.registerTile(id, { sprite, name: sprite, walkable: true, cost: 1, color: 0xffffff });
}

const sprites = ['grass', 'cave_wall', 'water', 'path', 'stone_floor', 'swamp', 'hero', 'torch', ...overlays.map(([, s]) => s)];
const assets: AssetConfig[] = sprites.map((id) => ({ id, path: `/sprites/${id}.png` }));

/** Walks one cell along its path every STEP seconds. */
class Player implements IEntity {
  id = 'player';
  spriteName = 'hero';
  isActive = true;
  path: Vector[] = [];
  private timer = 0;
  private static readonly STEP = 0.12;

  constructor(public position: Vector) {}

  update(deltaTime: number): void {
    this.timer += deltaTime;
    if (this.path.length === 0 || this.timer < Player.STEP) return;
    this.timer = 0;
    const next = this.path.shift()!;
    // Move the Vector in place: the player's light follows the same object.
    this.position.x = next.x;
    this.position.y = next.y;
  }
}

/** A static sprite, such as a torch, that only appears once its cell has been explored. */
class Prop implements IEntity {
  isActive = true;
  pixiSprite?: IEntity['pixiSprite'];
  constructor(public id: string, public position: Vector, public spriteName: string) {}
  update(): void {}
}

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const status = document.querySelector<HTMLDivElement>('#status')!;
const engine = new GameEngine();
const loaded: { map?: MapJSON } = {};
engine.on('mapLoaded', (data) => (loaded.map = data));

// The canvas shows 20 x 12 cells; the 32 x 20 map scrolls with the player.
await engine.initWithOptions({ canvas, width: 640, height: 384, assets, initialMapUrl: '/maps/starter.json', showMouseCoordinates: true });

const map = engine.map!;
// Handy for poking at the engine from the browser console.
Object.assign(window, { engine });
const objects = (loaded.map?.objects ?? []) as { type: string; id?: string; x: number; y: number; radius?: number; sprite?: string }[];
const player = new Player(engine.getSpawnPoint() ?? new Vector(1, 1));
engine.addEntity(player);
engine.lighting.addLight({ id: 'player', position: player.position, radius: 7 });

for (const o of objects.filter((o) => o.type === 'LIGHT_SOURCE')) {
  const position = new Vector(o.x, o.y);
  engine.addEntity(new Prop(o.id!, position, o.sprite ?? 'torch'));
  // Torches stay dark until the player has seen their cell.
  engine.lighting.addLight({ id: o.id!, position, radius: o.radius ?? 5, hiddenUntilExplored: true });
}
const door = objects.find((o) => o.type === 'DOOR');

engine.on('gridClick', (x, y, button) => {
  if (button === 'right') {
    player.path = engine.pathfinder.findPath(player.position, new Vector(x, y));
    status.textContent = player.path.length ? `Walking to (${x}, ${y}), ${player.path.length} steps.` : `No path to (${x}, ${y}).`;
    return;
  }
  // Left click: open the door if the player stands next to it.
  if (door && x === door.x && y === door.y && player.position.manhattanDistance(new Vector(x, y)) === 1) {
    // Flood fill: reveal the room behind the door. Do it while the door still
    // blocks, so the fill stops at the doorway instead of spilling back outside.
    const beyond = new Vector(x + (x - player.position.x), y + (y - player.position.y));
    const cells = engine.revealRoom(beyond);
    map.getLayerByName('landmarks')!.getData()[y][x] = GATE_OPEN;
    engine.grid.setCellType(x, y, map.getGroundLayer()!.getData()[y][x]);
    status.textContent = `Door opened: ${cells.size} cells revealed.`;
  }
});

engine.on('beforeRender', () => {
  engine.renderer.getCamera().centerOn(player.position);
  for (const entity of engine.getAllEntities()) {
    if (entity instanceof Prop && entity.pixiSprite) {
      entity.pixiSprite.visible = engine.fogOfWar.isExplored(entity.position.x, entity.position.y);
    }
  }
});

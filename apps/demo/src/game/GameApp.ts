import {
  CellType,
  GameEngine,
  Vector,
  type AssetConfig,
  type IEntity,
  type MapJSON,
} from 'web-based-2d-game-engine-framework';
import * as PIXI from 'pixi.js';
import { Hud } from './Hud';

/** Raw object entry from a map JSON file (demo-specific schema). */
interface MapObjectData {
  type: string;
  id?: string;
  x: number;
  y: number;
  sprite?: string;
  name?: string;
  keyId?: string;
  isLevelExit?: boolean;
  radius?: number;
  health?: number;
  attack?: number;
  contents?: Array<{ id: string; name: string; type?: string }>;
}

/** A spawned dungeon object: an engine entity plus demo game state. */
interface DungeonObject extends IEntity {
  data: MapObjectData;
  kind: string;
  open: boolean;
  health: number;
  /** Cell type under a closed door, restored when it opens. */
  originalCell?: CellType;
}

const LEVELS: Record<number, string> = {
  1: '/maps/dungeon_adventure.json',
  2: '/maps/level2.json',
};

const PLAYER_LIGHT_RADIUS = 10;
const PLAYER_MAX_HEALTH = 100;

const ASSETS: AssetConfig[] = [
  // Characters and objects
  { id: 'hero', path: '/assets/hero.png' },
  { id: 'goblin', path: '/assets/goblin.png' },
  { id: 'torch', path: '/assets/torch.png' },
  { id: 'gate', path: '/assets/gate.png' },
  { id: 'gate_open', path: '/assets/gate_open.png' },
  { id: 'chest', path: '/assets/chest.png' },
  { id: 'chest_open', path: '/assets/chest_open.png' },
  { id: 'key', path: '/assets/key.png' },
  { id: 'potion', path: '/assets/potion.png' },
  { id: 'mana_potion', path: '/assets/mana_potion.png' },
  { id: 'sword', path: '/assets/sword.png' },
  // Terrain
  { id: 'grass', path: '/assets/textures/grass.png' },
  { id: 'swamp', path: '/assets/textures/mud.png' },
  { id: 'path', path: '/assets/textures/path.png' },
  { id: 'forest', path: '/assets/textures/trees.png' },
  { id: 'water', path: '/assets/textures/water.png' },
  { id: 'tall_grass', path: '/assets/textures/junglegrass.png' },
  { id: 'stone_floor', path: '/assets/textures/stone%20tile.png' },
  { id: 'wood_floor', path: '/assets/textures/wood%20tile.png' },
  { id: 'deep_water', path: '/assets/textures/deepocean.png' },
  { id: 'snow', path: '/assets/textures/snow.png' },
  { id: 'cave_floor', path: '/assets/textures/cave%20gravel.png' },
  { id: 'sand', path: '/assets/textures/sand.png' },
  { id: 'cave_wall', path: '/assets/textures/caveCliff2.png' },
  { id: 'wall_horizontal', path: '/assets/textures/caveCliff2.png' },
  { id: 'wall_vertical', path: '/assets/textures/caveCliff2.png' },
  { id: 'wall_corner_tl', path: '/assets/textures/caveCliff2.png' },
  { id: 'wall_corner_tr', path: '/assets/textures/caveCliff2.png' },
  { id: 'wall_corner_bl', path: '/assets/textures/caveCliff2.png' },
  { id: 'wall_corner_br', path: '/assets/textures/caveCliff2.png' },
];

/**
 * Dungeon demo built on the published engine package.
 * Engine: rendering, map loading, pathfinding, lighting and fog of war.
 * Demo (this file): player, doors, keys, chests, enemies and HUD.
 */
export class GameApp {
  private engine = new GameEngine();
  private hud = new Hud();
  private level = 1;
  private transitioning = false;

  // Player state. These Vectors are mutated in place because the
  // player entity and the player light keep references to them.
  private playerTile = new Vector(1, 1);
  private playerRenderPos = new Vector(1, 1);
  private playerHealth = PLAYER_MAX_HEALTH;
  private inventory: Map<string, string> = new Map(); // id -> display name

  // Movement
  private path: Vector[] = [];
  private pathIndex = 0;
  private moveProgress = 0;
  private readonly moveSpeed = 0.006;
  private pendingInteraction: DungeonObject | null = null;
  private selectedCell: Vector | null = null;

  private objects: Map<string, DungeonObject> = new Map();

  async start(): Promise<void> {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('Canvas element #gameCanvas not found');

    this.engine.on('mapLoaded', (mapData) => this.onMapLoaded(mapData));
    this.engine.on('update', (dt) => this.onUpdate(dt));
    this.engine.on('beforeRender', () => this.onBeforeRender());
    this.engine.on('afterRender', () => this.drawMarkers());
    this.engine.on('gridClick', (x, y, button) => this.onGridClick(x, y, button));
    this.engine.on('gridHover', (x, y) => this.hud.setMouseCoords(x, y));

    await this.engine.init(canvas, 1280, 720, ASSETS, LEVELS[this.level]);

    this.setupButtons();
    this.hud.setHealth(this.playerHealth, PLAYER_MAX_HEALTH);
    this.hud.setInventory([]);
    this.hud.say('System', 'Right-click to move. Left-click doors, chests, items and goblins to interact.');
  }

  getEngine(): GameEngine {
    return this.engine;
  }

  // ---------------------------------------------------------------- levels

  private onMapLoaded(mapData: MapJSON): void {
    this.objects.clear();
    this.path = [];
    this.pendingInteraction = null;
    this.selectedCell = null;

    const rawObjects = ((mapData as { objects?: MapObjectData[] }).objects ?? []) as MapObjectData[];
    const spawn = rawObjects.find((o) => o.type === 'PLAYER_SPAWN');
    this.setPlayerTile(spawn ? new Vector(spawn.x, spawn.y) : new Vector(1, 1));
    this.playerRenderPos.x = this.playerTile.x;
    this.playerRenderPos.y = this.playerTile.y;

    this.spawnPlayer();
    this.engine.lighting.addLight({ id: 'player', position: this.playerTile, radius: PLAYER_LIGHT_RADIUS });

    rawObjects.forEach((data, index) => {
      if (data.type !== 'PLAYER_SPAWN') this.spawnObject(data, index);
    });

    this.engine.renderer.getCamera().centerOn(this.playerRenderPos);
    this.hud.setLevel(this.level, mapData.name ?? 'Unknown');
  }

  private async goToLevel(level: number): Promise<void> {
    const url = LEVELS[level];
    if (!url) {
      this.hud.say('System', 'Congratulations! You cleared every level.');
      return;
    }
    this.transitioning = true;
    try {
      this.level = level;
      this.engine.clear();
      await this.engine.loadMap(url);
      this.hud.say('System', `Welcome to level ${level}!`);
    } finally {
      this.transitioning = false;
    }
  }

  // --------------------------------------------------------------- spawning

  private spawnPlayer(): void {
    const texture = this.engine.renderer.getTexture('hero');
    let sprite: PIXI.Sprite;
    if (texture) {
      sprite = new PIXI.Sprite(texture);
    } else {
      const g = new PIXI.Graphics().rect(0, 0, 32, 32).fill(0xff0000);
      sprite = new PIXI.Sprite(this.engine.renderer.getApp().renderer.generateTexture(g));
    }
    sprite.width = this.engine.renderer.tileSize;
    sprite.height = this.engine.renderer.tileSize;
    this.engine.renderer.getSpriteContainer().addChild(sprite);

    this.engine.addEntity({
      id: 'player',
      position: this.playerRenderPos,
      pixiSprite: sprite,
      isActive: true,
      update: () => {},
    });
  }

  private spawnObject(data: MapObjectData, index: number): void {
    const id = data.id ?? `${data.type.toLowerCase()}_${index}`;
    const object: DungeonObject = {
      id,
      data,
      kind: data.type,
      position: new Vector(data.x, data.y),
      spriteName: data.sprite,
      isActive: true,
      open: false,
      health: data.health ?? 0,
      update: () => {},
      render: () => {
        if (object.pixiSprite) {
          object.pixiSprite.visible = this.engine.fogOfWar.isExplored(object.position.x, object.position.y);
        }
      },
    };

    // Closed doors block movement and sight until opened.
    if (object.kind === 'DOOR') {
      object.originalCell = this.engine.grid.getCell(data.x, data.y)?.type ?? CellType.STONE_FLOOR;
      this.engine.grid.setCellType(data.x, data.y, CellType.CAVE_WALL);
    }

    this.engine.addEntity(object);
    this.objects.set(id, object);

    if (object.kind === 'LIGHT_SOURCE') {
      this.engine.lighting.addLight({ id: `light:${id}`, position: object.position, radius: data.radius ?? 4 });
    }
    this.engine.lighting.markDirty();
  }

  private removeObject(object: DungeonObject): void {
    this.engine.removeEntity(object.id);
    this.objects.delete(object.id);
  }

  private setTexture(object: DungeonObject, textureId: string): void {
    const texture = this.engine.renderer.getTexture(textureId);
    if (object.pixiSprite && texture) object.pixiSprite.texture = texture;
  }

  // ---------------------------------------------------------------- input

  private onGridClick(x: number, y: number, button: 'left' | 'right'): void {
    if (this.transitioning || this.playerHealth <= 0) return;
    const target = new Vector(x, y);

    if (button === 'right') {
      this.pendingInteraction = null;
      this.moveTo(target);
      return;
    }

    const object = this.objectAt(x, y);
    if (!object || object.kind === 'LIGHT_SOURCE') return;

    if (this.playerTile.manhattanDistance(object.position) <= 1) {
      this.interact(object);
      return;
    }

    // Walk next to the object, then interact on arrival.
    const approach = this.bestApproachTile(object.position);
    if (approach && this.moveTo(approach)) {
      this.pendingInteraction = object;
    } else {
      this.hud.say('System', "You can't reach that from here.");
    }
  }

  private moveTo(target: Vector): boolean {
    const newPath = this.engine.pathfinder.findPath(this.playerTile.clone(), target);
    if (newPath.length < 2) return false;
    this.path = newPath;
    this.pathIndex = 0;
    this.moveProgress = 0;
    this.selectedCell = target;
    return true;
  }

  private bestApproachTile(pos: Vector): Vector | null {
    let best: Vector | null = null;
    let bestLength = Infinity;
    for (const n of this.engine.grid.getNeighbors(pos.x, pos.y)) {
      if (!this.engine.grid.getCell(n.x, n.y)?.walkable) continue;
      if (n.equals(this.playerTile)) return n;
      const length = this.engine.pathfinder.findPath(this.playerTile.clone(), n).length;
      if (length > 1 && length < bestLength) {
        best = n;
        bestLength = length;
      }
    }
    return best;
  }

  private objectAt(x: number, y: number): DungeonObject | undefined {
    for (const object of this.objects.values()) {
      if (object.position.x === x && object.position.y === y) return object;
    }
    return undefined;
  }

  private setupButtons(): void {
    const pause = document.getElementById('pauseButton');
    pause?.addEventListener('click', () => {
      if (this.engine.isRunning) {
        this.engine.stopGameLoop();
        pause.textContent = 'Resume';
      } else {
        this.engine.startGameLoop();
        pause.textContent = 'Pause';
      }
    });
    for (const id of ['saveButton', 'loadButton', 'muteButton']) {
      document.getElementById(id)?.addEventListener('click', () => {
        this.hud.say('System', 'This feature is not part of the demo yet.');
      });
    }
  }

  // ------------------------------------------------------------ game loop

  private onUpdate(deltaTime: number): void {
    if (this.path.length < 2) return;

    const from = this.path[this.pathIndex];
    const to = this.path[this.pathIndex + 1];
    if (!to) {
      this.finishMove();
      return;
    }

    // Stop in front of anything that blocks the way.
    const blocker = this.objectAt(to.x, to.y);
    if (blocker && this.blocksMovement(blocker)) {
      this.path = [];
      this.selectedCell = null;
      this.pendingInteraction = null;
      this.interact(blocker);
      return;
    }

    this.moveProgress += this.moveSpeed * deltaTime;
    if (this.moveProgress >= 1) {
      this.moveProgress = 0;
      this.pathIndex++;
      this.setPlayerTile(to);
      this.playerRenderPos.x = to.x;
      this.playerRenderPos.y = to.y;
      this.hud.setPlayerCoords(to.x, to.y);
      this.pickUpItemsAt(to);
      if (this.pathIndex >= this.path.length - 1) this.finishMove();
    } else {
      this.playerRenderPos.x = from.x + (to.x - from.x) * this.moveProgress;
      this.playerRenderPos.y = from.y + (to.y - from.y) * this.moveProgress;
    }
  }

  private finishMove(): void {
    this.path = [];
    this.selectedCell = null;
    const target = this.pendingInteraction;
    this.pendingInteraction = null;
    if (target && this.objects.has(target.id)) this.interact(target);
  }

  private onBeforeRender(): void {
    this.engine.renderer.getCamera().centerOn(this.playerRenderPos);
  }

  private drawMarkers(): void {
    const renderer = this.engine.renderer;
    renderer.clearMarkers();
    if (this.selectedCell) renderer.drawMarker(this.selectedCell.x, this.selectedCell.y, 0x1890ff, 5);
    for (let i = this.pathIndex + 1; i < this.path.length; i++) {
      renderer.drawMarker(this.path[i].x, this.path[i].y, 0xffcc00, 3);
    }
  }

  private setPlayerTile(tile: Vector): void {
    this.playerTile.x = tile.x;
    this.playerTile.y = tile.y;
  }

  // ---------------------------------------------------------- interactions

  private blocksMovement(object: DungeonObject): boolean {
    return object.kind === 'ENEMY' || (object.kind === 'CHEST' && !object.open);
  }

  private interact(object: DungeonObject): void {
    switch (object.kind) {
      case 'DOOR':
        this.useDoor(object);
        break;
      case 'CHEST':
        this.openChest(object);
        break;
      case 'ITEM':
        this.pickUp(object);
        break;
      case 'ENEMY':
        this.fight(object);
        break;
    }
  }

  private useDoor(door: DungeonObject): void {
    if (door.open) {
      if (door.data.isLevelExit) void this.goToLevel(this.level + 1);
      return;
    }

    const keyId = door.data.keyId;
    if (keyId && !this.inventory.has(keyId)) {
      this.hud.say('System', 'The gate is locked. You need a key.');
      return;
    }

    door.open = true;
    this.setTexture(door, 'gate_open');
    this.engine.grid.setCellType(door.position.x, door.position.y, door.originalCell ?? CellType.STONE_FLOOR);
    this.engine.lighting.markDirty();

    if (door.data.isLevelExit) {
      this.hud.say('System', 'The exit opens. Click it again to descend.');
    } else {
      this.hud.say('System', keyId ? `You unlock the gate with the ${this.inventory.get(keyId)}.` : 'The gate swings open.');
    }
  }

  private openChest(chest: DungeonObject): void {
    if (chest.open) {
      this.hud.say('System', 'The chest is empty.');
      return;
    }
    chest.open = true;
    this.setTexture(chest, 'chest_open');
    const contents = chest.data.contents ?? [];
    contents.forEach((item) => this.inventory.set(item.id, item.name));
    this.refreshInventory();
    this.hud.say(
      'System',
      contents.length ? `You found: ${contents.map((c) => c.name).join(', ')}.` : 'The chest is empty.'
    );
  }

  private pickUpItemsAt(tile: Vector): void {
    const object = this.objectAt(tile.x, tile.y);
    if (object?.kind === 'ITEM') this.pickUp(object);
  }

  private pickUp(item: DungeonObject): void {
    const id = item.data.id ?? item.id;
    const name = item.data.name ?? id;
    this.inventory.set(id, name);
    this.removeObject(item);
    this.refreshInventory();
    this.hud.say('System', `Picked up ${name}.`);
  }

  private fight(enemy: DungeonObject): void {
    const hasSword = [...this.inventory.keys()].some((id) => id.includes('sword'));
    const damage = hasSword ? 50 : 20;
    enemy.health -= damage;

    if (enemy.health <= 0) {
      this.removeObject(enemy);
      this.hud.say('System', `${enemy.id} is defeated!`);
      return;
    }

    const counter = enemy.data.attack ?? 10;
    this.playerHealth = Math.max(0, this.playerHealth - counter);
    this.hud.setHealth(this.playerHealth, PLAYER_MAX_HEALTH);
    this.hud.say('System', `You hit ${enemy.id} for ${damage}. It strikes back for ${counter}.`);

    if (this.playerHealth <= 0) {
      this.hud.say('System', 'Game over. Reload the page to try again.');
      this.engine.stopGameLoop();
    }
  }

  private refreshInventory(): void {
    this.hud.setInventory([...this.inventory.values()]);
  }
}

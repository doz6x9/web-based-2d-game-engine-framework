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
  contents?: Array<{ id: string; name: string; type?: string; quantity?: number }>;
}

/** A spawned dungeon object: an engine entity plus demo game state. */
interface DungeonObject extends IEntity {
  data: MapObjectData;
  kind: string;
  open: boolean;
  health: number;
  /** Cell type under a closed door, restored when it opens. */
  originalCell?: CellType;
  /** Enemies wake up when they see the player, then chase every turn. */
  awake?: boolean;
}

/** Floating combat text, e.g. "-12" over a goblin. */
interface FloatingText {
  node: PIXI.Text;
  age: number;
}

const LEVELS: Record<number, string> = {
  1: '/maps/dungeon_adventure.json',
  2: '/maps/level2.json',
};

const PLAYER_LIGHT_RADIUS = 7;
const PLAYER_MAX_HEALTH = 100;
/** How far (in cells) a goblin can notice a lit player. */
const ENEMY_SIGHT = 7;
const POTION_HEAL = 30;

const SCORE = {
  item: 10,
  key: 25,
  chest: 50,
  door: 20,
  goblin: 100,
  boss: 500,
  levelClear: 250,
  healthBonusPerPoint: 5,
};

const rollBetween = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));

// All tiles and sprites come from one texture atlas, packed at build time by
// scripts/pack-atlas.mjs from the PNGs listed in art/atlas.json. One request
// and one GPU texture instead of one per image, so PixiJS can batch draws.
const ASSETS: AssetConfig[] = [{ id: 'atlas', path: '/atlas/sprites.json', type: 'spritesheet' }];

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
  private score = 0;
  /** Potions picked up at full health; drunk automatically when HP runs low. */
  private potions = 0;
  private turn = 0;
  private gameOver = false;
  private floatingTexts: FloatingText[] = [];

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

    // Retro look: keep pixel art crisp instead of smoothing it when scaled.
    PIXI.TextureSource.defaultOptions.scaleMode = 'nearest';

    this.engine.on('mapLoaded', (mapData) => this.onMapLoaded(mapData));
    this.engine.on('update', (dt) => this.onUpdate(dt));
    this.engine.on('beforeRender', () => this.onBeforeRender());
    this.engine.on('afterRender', () => this.drawMarkers());
    this.engine.on('gridClick', (x, y, button) => this.onGridClick(x, y, button));
    this.engine.on('gridHover', (x, y) => this.hud.setMouseCoords(x, y));

    await this.engine.init(canvas, 1280, 720, ASSETS, LEVELS[this.level], { showMouseCoordinates: true });

    this.setupButtons();
    this.hud.setHealth(this.playerHealth, PLAYER_MAX_HEALTH);
    this.hud.setScore(this.score);
    this.hud.setKeys(0);
    this.hud.setInventory([]);
    this.hud.log('Your quest begins.');
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

    const rawObjects = (mapData.objects ?? []) as MapObjectData[];
    // The engine resolves PLAYER_SPAWN and nudges it onto a walkable cell if needed.
    this.setPlayerTile(this.engine.getSpawnPoint() ?? new Vector(1, 1));
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
    this.addScore(SCORE.levelClear, this.playerTile);
    if (!url) {
      this.addScore(this.playerHealth * SCORE.healthBonusPerPoint);
      this.gameOver = true;
      this.hud.log('You escaped the dungeon!');
      this.hud.showEndScreen(true, this.score);
      return;
    }
    this.transitioning = true;
    try {
      this.level = level;
      this.clearFloatingTexts();
      this.engine.clear();
      await this.engine.loadMap(url);
      this.hud.log(`Level ${level}. The air grows colder...`);
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
      // Maps mark door cells as walls in the collision layer, so the open
      // door takes the floor type from the terrain layer instead.
      const terrain = this.engine.map?.getLayerByName('terrain')?.getData();
      object.originalCell = (terrain?.[data.y]?.[data.x] as CellType | undefined) ?? CellType.STONE_FLOOR;
      this.engine.grid.setCellType(data.x, data.y, CellType.CAVE_WALL);
    }

    this.engine.addEntity(object);
    this.objects.set(id, object);

    if (object.kind === 'LIGHT_SOURCE') {
      // Torches stay dark until their room is found, so they don't reveal it early.
      this.engine.lighting.addLight({
        id: `light:${id}`,
        position: object.position,
        radius: data.radius ?? 4,
        hiddenUntilExplored: true,
      });
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
    if (this.transitioning || this.gameOver) return;
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
      this.hud.log("You can't reach that.");
    }
  }

  private moveTo(target: Vector): boolean {
    const start = this.playerTile.clone();
    // findPath excludes the start cell, so a click on a neighbouring cell
    // returns a one-step path. Prepend the start so every step has a "from".
    const steps = this.engine.pathfinder.findPath(start, target);
    if (steps.length === 0) return false;
    this.path = [start, ...steps];
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
      if (length > 0 && length < bestLength) {
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
    // The dev tools FPS readout shows the real frame rate. Rendering is not
    // capped, so it follows the monitor's refresh rate (60, 120, 144 Hz...).
    const fpsCounter = document.getElementById('fpsCounter');
    const ticker = this.engine.renderer.getApp().ticker;
    let sinceFpsUpdate = 0;
    ticker.add(() => {
      sinceFpsUpdate += ticker.deltaMS;
      if (sinceFpsUpdate < 500 || !fpsCounter) return;
      sinceFpsUpdate = 0;
      fpsCounter.textContent = `FPS: ${Math.round(ticker.FPS)}`;
    });
    for (const id of ['saveButton', 'loadButton', 'muteButton']) {
      document.getElementById(id)?.addEventListener('click', () => {
        this.hud.log('Not in the demo yet.');
      });
    }
  }

  // ------------------------------------------------------------ game loop

  private onUpdate(deltaTime: number): void {
    this.updateFloatingTexts(deltaTime);
    if (this.gameOver || this.path.length < 2) return;

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
      this.endTurn();
      if (this.gameOver) return;
      if (this.pathIndex >= this.path.length - 1) {
        this.finishMove();
      } else if (this.enemyAdjacent()) {
        // Stop walking when a goblin closes in, like a classic roguelike.
        this.path = [];
        this.selectedCell = null;
        this.pendingInteraction = null;
        this.hud.log('A goblin blocks your way!');
      }
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
      this.hud.log('Locked. You need a key.');
      return;
    }

    door.open = true;
    this.setTexture(door, 'gate_open');

    // Reveal the room behind the door with the engine's flood fill. This runs
    // while the door cell is still solid, so the fill stays inside that room
    // and stops at its walls instead of leaking back out through the doorway.
    for (const n of this.engine.grid.getNeighbors(door.position.x, door.position.y)) {
      if (!this.engine.fogOfWar.isExplored(n.x, n.y) && this.engine.grid.getCell(n.x, n.y)?.walkable) {
        this.engine.revealRoom(n);
      }
    }

    this.engine.grid.setCellType(door.position.x, door.position.y, door.originalCell ?? CellType.STONE_FLOOR);
    this.engine.lighting.markDirty();

    this.addScore(SCORE.door, door.position);
    if (door.data.isLevelExit) {
      this.hud.log('The exit opens. Click it to descend.');
    } else {
      this.hud.log(keyId ? `Unlocked with ${this.inventory.get(keyId)}.` : 'The gate swings open.');
    }
    this.endTurn();
  }

  private openChest(chest: DungeonObject): void {
    if (chest.open) {
      this.hud.log('The chest is empty.');
      return;
    }
    chest.open = true;
    this.setTexture(chest, 'chest_open');
    this.addScore(SCORE.chest, chest.position);
    const contents = chest.data.contents ?? [];
    if (contents.length === 0) this.hud.log('The chest is empty.');
    for (const item of contents) {
      const count = Math.max(1, item.quantity ?? 1);
      for (let i = 0; i < count; i++) this.gainItem(item.id, item.name, item.type);
    }
    this.endTurn();
  }

  /** Potions heal on the spot; everything else goes into the bag. */
  private gainItem(id: string, name: string, type?: string): void {
    if ((type ?? '').toUpperCase() === 'CONSUMABLE' || id.includes('potion')) {
      this.addScore(SCORE.item);
      if (this.playerHealth < PLAYER_MAX_HEALTH) {
        this.drinkPotion(name);
      } else {
        this.potions++;
        this.refreshInventory();
        this.hud.log(`Got ${name}! Saved for later.`);
      }
      return;
    }
    this.inventory.set(id, name);
    this.refreshInventory();
    this.addScore(id.includes('key') ? SCORE.key : SCORE.item);
    this.hud.log(`Got ${name}!`);
  }

  private pickUpItemsAt(tile: Vector): void {
    const object = this.objectAt(tile.x, tile.y);
    if (object?.kind === 'ITEM') this.pickUp(object);
  }

  private pickUp(item: DungeonObject): void {
    const id = item.data.id ?? item.id;
    this.removeObject(item);
    this.gainItem(id, item.data.name ?? id, (item.data as { item_type?: string }).item_type);
  }

  private fight(enemy: DungeonObject): void {
    enemy.awake = true;
    const hasSword = [...this.inventory.keys()].some((id) => id.includes('sword'));
    const critical = Math.random() < 0.1;
    let damage = hasSword ? rollBetween(28, 38) : rollBetween(12, 18);
    if (critical) damage *= 2;
    enemy.health -= damage;
    this.floatText(enemy.position, `-${damage}`, critical ? 0xf8d030 : 0xffffff);
    this.hud.log(`${critical ? 'CRITICAL! ' : ''}You hit ${this.enemyName(enemy).toLowerCase()} for ${damage}.`);

    if (enemy.health <= 0) {
      const isBoss = (enemy.data.health ?? 0) >= 150;
      this.removeObject(enemy);
      this.addScore(isBoss ? SCORE.boss : SCORE.goblin, enemy.position);
      this.hud.log(`${this.enemyName(enemy)} is defeated!`);
    }
    this.endTurn();
  }

  // ------------------------------------------------------------ enemy turn

  /** Runs once per player action: every goblin that has seen the player acts. */
  private endTurn(): void {
    if (this.gameOver) return;
    this.turn++;
    for (const enemy of [...this.objects.values()]) {
      if (enemy.kind !== 'ENEMY' || !this.objects.has(enemy.id)) continue;
      const distance = enemy.position.manhattanDistance(this.playerTile);

      if (!enemy.awake) {
        const seesPlayer = distance <= ENEMY_SIGHT && this.engine.lighting.isLit(enemy.position.x, enemy.position.y);
        if (!seesPlayer) continue;
        enemy.awake = true;
        this.floatText(enemy.position, '!', 0xf85858);
        this.hud.log(`${this.enemyName(enemy)} spots you!`);
        continue; // waking up uses its turn
      }

      if (distance === 1) {
        this.enemyAttack(enemy);
        if (this.gameOver) return;
      } else {
        this.enemyStep(enemy);
      }
    }
  }

  private enemyAttack(enemy: DungeonObject): void {
    if (Math.random() < 0.3) {
      this.floatText(this.playerTile, 'MISS', 0xa0a0a0);
      this.hud.log(`${this.enemyName(enemy)} misses.`);
      return;
    }
    const base = enemy.data.attack ?? 10;
    const damage = rollBetween(Math.ceil(base * 0.5), base);
    this.playerHealth = Math.max(0, this.playerHealth - damage);
    this.hud.setHealth(this.playerHealth, PLAYER_MAX_HEALTH);
    this.floatText(this.playerTile, `-${damage}`, 0xf85858);
    this.hud.log(`${this.enemyName(enemy)} hits you for ${damage}.`);

    if (this.playerHealth > 0 && this.playerHealth <= 35 && this.potions > 0) {
      this.potions--;
      this.drinkPotion('health potion');
      this.refreshInventory();
    }

    if (this.playerHealth <= 0) {
      this.gameOver = true;
      this.path = [];
      this.hud.log('You have fallen...');
      this.hud.showEndScreen(false, this.score);
    }
  }

  /** Move one cell along the engine's A* path toward the player. */
  private enemyStep(enemy: DungeonObject): void {
    const next = this.engine.pathfinder.findPath(enemy.position.clone(), this.playerTile.clone())[0];
    if (!next || next.equals(this.playerTile) || this.objectAt(next.x, next.y)) return;
    enemy.position.x = next.x;
    enemy.position.y = next.y;
  }

  private enemyAdjacent(): boolean {
    for (const object of this.objects.values()) {
      if (object.kind === 'ENEMY' && object.awake && object.position.manhattanDistance(this.playerTile) === 1) return true;
    }
    return false;
  }

  private enemyName(enemy: DungeonObject): string {
    return (enemy.data.health ?? 0) >= 150 ? 'The goblin chief' : 'A goblin';
  }

  // ------------------------------------------------------- score and effects

  private addScore(points: number, at?: Vector): void {
    this.score += points;
    this.hud.setScore(this.score);
    if (at) this.floatText(at, `+${points}`, 0xf8d030, 14);
  }

  private floatText(at: Vector, text: string, color: number, offsetY = 0): void {
    const tile = this.engine.renderer.tileSize;
    const node = new PIXI.Text({
      text,
      style: {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 10,
        fill: color,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    node.anchor.set(0.5, 1);
    node.x = at.x * tile + tile / 2;
    node.y = at.y * tile - offsetY;
    this.engine.renderer.getSpriteContainer().addChild(node);
    this.floatingTexts.push({ node, age: 0 });
  }

  private updateFloatingTexts(deltaTime: number): void {
    this.floatingTexts = this.floatingTexts.filter((f) => {
      f.age += deltaTime;
      f.node.y -= deltaTime * 0.02;
      f.node.alpha = Math.max(0, 1 - f.age / 900);
      if (f.age >= 900) {
        f.node.destroy();
        return false;
      }
      return true;
    });
  }

  private clearFloatingTexts(): void {
    this.floatingTexts.forEach((f) => f.node.destroy());
    this.floatingTexts = [];
  }

  private drinkPotion(name = 'potion'): void {
    const before = this.playerHealth;
    this.playerHealth = Math.min(PLAYER_MAX_HEALTH, this.playerHealth + POTION_HEAL);
    this.hud.setHealth(this.playerHealth, PLAYER_MAX_HEALTH);
    this.floatText(this.playerTile, `+${this.playerHealth - before}`, 0x58f858);
    this.hud.log(`You drink the ${name.toLowerCase()}. +${this.playerHealth - before} HP`);
  }

  private refreshInventory(): void {
    const items = [...this.inventory.values()];
    if (this.potions > 0) items.push(`Health Potion x${this.potions}`);
    this.hud.setInventory(items);
    this.hud.setKeys([...this.inventory.keys()].filter((id) => id.includes('key')).length);
  }
}

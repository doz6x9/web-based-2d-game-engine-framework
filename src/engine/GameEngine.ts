import { Vector } from './core/Vector';
import { Grid, CellType } from './core/Grid';
import { GameMap, MapLoader } from './map/MapLayer';
import { AStarPathfinder } from './algorithms/AStar';
import { FieldOfView } from './algorithms/FieldOfView';
import { FogOfWar } from './algorithms/FogOfWar';
import { FloodFill } from './algorithms/FloodFill';
import { NPCAISystem } from './algorithms/NPCAISystem';
import { NPC, Enemy, MapObject, MapObjectType, InteractiveObject } from './core/MapObject';
import { TileRegistry } from './core/TileRegistry';
import { Renderer } from './render/Renderer';
import { MouseHandler, MouseEventType } from './interaction/MouseHandler';
import { KeyboardHandler } from './interaction/KeyboardHandler';
import { AnimationLibrary } from './render/Animation';
import { ParticleSystem, ParticlePresets } from './render/Particles';
import { SaveLoadManager, QuickSaveManager } from './system/SaveLoadManager';
import { LevelEditor } from './editor/LevelEditor';
import { DialogueLine } from './system/DialogueManager';
import { Inventory } from './core/Inventory';
import { Item, ItemType } from './core/Item';
import { UIManager } from './system/UIManager';
import * as PIXI from 'pixi.js';
import { AudioManager } from './system/AudioManager';

/**
 * Main Game Engine
 * Orchestrates all game systems
 */
export class GameEngine {
  private map: GameMap | null = null;
  private grid: Grid;
  private renderer: Renderer;
  private mouseHandler!: MouseHandler;
  private keyboardHandler: KeyboardHandler;
  private uiManager!: UIManager;
  private inventory: Inventory;
  private pathfinder: AStarPathfinder;
  private fov: FieldOfView;
  private fogOfWar!: FogOfWar;
  private floodFill: FloodFill;
  private aiSystem: NPCAISystem;
  private animationLibrary: AnimationLibrary;
  private particleSystem: ParticleSystem;
  private saveLoadManager: SaveLoadManager;
  private quickSaveManager: QuickSaveManager;
  private editor: LevelEditor;

  private currentPlayerPos: Vector = new Vector(10, 10);
  private lastFovPos: Vector = new Vector(-1, -1);
  private cachedVisibleCells: Set<string> = new Set();
  private selectedCell: Vector | null = null;
  private path: Vector[] = [];

  private isPlayerMoving: boolean = false;
  private currentPathIndex: number = 0;
  private moveProgress: number = 0;
  private playerMoveSpeed: number = 0.005;
  private targetPlayerPos: Vector = new Vector(10, 10);

  private mapObjects: Map<string, MapObject> = new Map();
  private pendingInteractionTarget: MapObject | null = null;

  private playerPixiSprite: PIXI.Sprite | null = null;

  private playerHealth: number = 100;
  private playerMaxHealth: number = 100;
  private playerAttackPower: number = 10;

  private gameTime: number = 0;
  private isRunning: boolean = false;

  private boundGameLoop = this.pixiGameLoop.bind(this);

  private currentLevel: number = 1;
  private levelMap: Map<number, { mapUrl: string; spawnPoint: Vector }> = new Map();

  private audioManager: AudioManager;

  constructor() {
    this.grid = new Grid(100, 100);
    this.renderer = new Renderer(32);
    this.keyboardHandler = new KeyboardHandler();
    this.inventory = new Inventory();
    this.pathfinder = new AStarPathfinder(this.grid);
    this.fov = new FieldOfView(this.grid);
    this.floodFill = new FloodFill(this.grid);
    this.aiSystem = new NPCAISystem(this.grid);
    this.animationLibrary = new AnimationLibrary();
    this.particleSystem = new ParticleSystem();
    this.saveLoadManager = new SaveLoadManager();
    this.quickSaveManager = new QuickSaveManager();
    this.editor = new LevelEditor();
    this.audioManager = new AudioManager();

    TileRegistry.initialize();
    this.setupLevelMap();
  }

  async init(canvas: HTMLCanvasElement, canvasWidth: number, canvasHeight: number): Promise<void> {
    await this.renderer.init(canvas, canvasWidth, canvasHeight, this.grid.getWidth(), this.grid.getHeight());

    this.mouseHandler = new MouseHandler(canvas, this.renderer.getCamera(), this.renderer.tileSize);
    this.uiManager = new UIManager(this.keyboardHandler, this.inventory);
    this.fogOfWar = new FogOfWar(this.grid.getWidth(), this.grid.getHeight(), this.fov);

    try {
      await this.renderer.loadAssets([
        { id: 'hero', path: '/assets/hero.png' },
        { id: 'potion', path: '/assets/potion.png' },
        { id: 'gate', path: '/assets/gate.png' },
        { id: 'gate_open', path: '/assets/gate_open.png' },
        { id: 'chest', path: '/assets/chest.png' },
        { id: 'chest_open', path: '/assets/chest_open.png' },
        { id: 'sword', path: '/assets/sword.png' },
        { id: 'mana_potion', path: '/assets/mana_potion.png' },
        { id: 'goblin', path: '/assets/goblin.png' },
        { id: 'key', path: '/assets/key.png' },
        { id: 'torch', path: '/assets/torch.png' },
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
        { id: 'wall_horizontal', path: '/assets/textures/caveCliff2.png' },
        { id: 'wall_vertical', path: '/assets/textures/caveCliff2.png' },
        { id: 'wall_corner_tl', path: '/assets/textures/caveCliff2.png' },
        { id: 'wall_corner_tr', path: '/assets/textures/caveCliff2.png' },
        { id: 'wall_corner_bl', path: '/assets/textures/caveCliff2.png' },
        { id: 'wall_corner_br', path: '/assets/textures/caveCliff2.png' },
        { id: 'cave_wall', path: '/assets/textures/caveCliff2.png' },
      ]);
      console.log('Visual assets loaded successfully.');
    } catch (error) {
      console.error('Failed to load visual assets:', error);
      throw error;
    }

    const playerTexture = this.renderer.getTexture('hero');
    if (playerTexture) {
      this.playerPixiSprite = new PIXI.Sprite(playerTexture);
      this.playerPixiSprite.width = this.renderer.tileSize;
      this.playerPixiSprite.height = this.renderer.tileSize;
      this.renderer.getSpriteContainer().addChild(this.playerPixiSprite);
    }

    try {
      await this.loadMap('/maps/dungeon_adventure.json');
      console.log('Map loaded successfully.');
    } catch (error) {
      console.error('Failed to load map:', error);
      throw error;
    }

    this.setupEventHandlers();
    this.setupUICallbacks();

    // Play background music
    this.audioManager.playBGM('/assets/audio/bgm.mp3', 0.1);

    this.startGameLoop();
  }

  private setupLevelMap(): void {
    this.levelMap.set(1, { mapUrl: '/maps/dungeon_adventure.json', spawnPoint: new Vector(2, 2) });
    this.levelMap.set(2, { mapUrl: '/maps/level2.json', spawnPoint: new Vector(18, 18) });
  }

  async advanceToNextLevel(): Promise<void> {
    const nextLevel = this.currentLevel + 1;
    const levelData = this.levelMap.get(nextLevel);

    if (levelData) {
      this.currentLevel = nextLevel;
      await this.loadLevel(levelData.mapUrl, levelData.spawnPoint);
      this.uiManager.startDialogue([{ speaker: 'System', text: `Welcome to Level ${this.currentLevel}!` }]);
    } else {
      this.uiManager.startDialogue([{ speaker: 'System', text: 'Congratulations! You have completed all levels!' }]);
    }
  }

  private clearMap(): void {
    const objectIds = Array.from(this.mapObjects.keys());
    for (const id of objectIds) {
      this.removeMapObject(id);
    }
    this.path = [];
    this.selectedCell = null;
    this.pendingInteractionTarget = null;
    this.isPlayerMoving = false;
    this.currentPathIndex = 0;
    this.moveProgress = 0;
    this.fogOfWar = new FogOfWar(this.grid.getWidth(), this.grid.getHeight(), this.fov);
    this.renderer.clearMapCache();
    this.map = null;
  }

  async loadLevel(mapUrl: string, spawnPoint: Vector): Promise<void> {
    this.clearMap();
    await this.loadMap(mapUrl);

    // Get the map name directly from the loaded map object
    const mapName = this.map?.getName() || 'Unknown Level';
    this.uiManager.updateLevelDisplay(this.currentLevel, mapName);
    this.render();
  }

  async loadMap(mapUrl: string): Promise<void> {
    const response = await fetch(mapUrl);
    const mapData = await response.json();
    this.map = MapLoader.parseMapJSON(mapData);

    const collisionLayer = this.map.getLayerByName('collision');
    const terrainLayer = this.map.getLayerByName('terrain');

    if (collisionLayer && terrainLayer) {
      const cData = collisionLayer.getData();
      const tData = terrainLayer.getData();
      for (let y = 0; y < cData.length; y++) {
        for (let x = 0; x < cData[y].length; x++) {
          if (cData[y][x] !== 0) {
             this.grid.setCellType(x, y, cData[y][x] as CellType);
          } else {
             this.grid.setCellType(x, y, tData[y][x] as CellType);
          }
        }
      }
    }

    if (mapData.objects && Array.isArray(mapData.objects)) {
      for (const objData of mapData.objects) {
        this.createMapObjectFromData(objData);
      }
    }

    this.fogOfWar = new FogOfWar(this.map.getWidth(), this.map.getHeight(), this.fov);
    this.renderer.getCamera().mapWidth = this.map.getWidth();
    this.renderer.getCamera().mapHeight = this.map.getHeight();
    this.lastFovPos = new Vector(-1, -1);
    this.render();
  }

  private createMapObjectFromData(data: any): void {
      const type = data.type;
      const x = data.x;
      const y = data.y;

      if (type === "SPAWN" || type === "PLAYER_SPAWN") {
          this.currentPlayerPos = new Vector(x, y);
          this.targetPlayerPos = new Vector(x, y);
          const currentLevelData = this.levelMap.get(this.currentLevel);
          if (currentLevelData) {
              currentLevelData.spawnPoint = new Vector(x, y);
          }
      } else if (type === "NPC") {
          const npc = new NPC(data.id || `npc_${x}_${y}`, new Vector(x, y), data.sprite || 'hero');
          this.addMapObject(npc);
      } else if (type === "ENEMY") {
          const enemy = new Enemy(data.id || `enemy_${x}_${y}`, new Vector(x, y), data.sprite || 'goblin');
          enemy.health = data.health || 30;
          enemy.maxHealth = data.health || 30;
          enemy.attackPower = data.attack || 5;
          this.addMapObject(enemy);
      } else if (type === "ITEM") {
          const itemTypeMap: any = {
              "CONSUMABLE": ItemType.CONSUMABLE,
              "WEAPON": ItemType.WEAPON,
              "KEY": ItemType.KEY_ITEM,
              "KEY_ITEM": ItemType.KEY_ITEM
          };
          const iType = itemTypeMap[data.item_type] || ItemType.GENERIC;
          const item = new Item(data.id || `item_${x}_${y}`, data.name || "Item", data.description || "", data.sprite || "potion", iType);
          this.addMapObject(item.toMapObject(new Vector(x, y)));
      } else if (type === "CHEST") {
          const chest = new InteractiveObject(data.id || `chest_${x}_${y}`, MapObjectType.CHEST, new Vector(x, y), data.sprite || 'chest');
          chest.setProperty('isOpen', false);
          const contents = data.contents || [new Item(`potion_${x}_${y}`, 'Health Potion', '', 'potion', ItemType.CONSUMABLE, true, 5, 1)];
          chest.setProperty('contents', contents);
          this.addMapObject(chest);
      } else if (type === "DOOR") {
          const door = new InteractiveObject(data.id || `door_${x}_${y}`, MapObjectType.DOOR, new Vector(x, y), data.sprite || 'gate');
          door.setProperty('isOpen', false);
          door.isLevelExit = !!data.isLevelExit; // Correctly set level exit
          door.teleportTargetX = data.teleportTargetX; // Read teleport target X
          door.teleportTargetY = data.teleportTargetY; // Read teleport target Y
          if (data.keyId) door.setProperty('keyId', data.keyId);
          if (data.requiredEnemyId) door.setProperty('requiredEnemyId', data.requiredEnemyId);
          this.addMapObject(door);
      } else if (type === "LIGHT" || type === "LIGHT_SOURCE") {
        const light = new MapObject(data.id || `light_${x}_${y}`, MapObjectType.LIGHT_SOURCE, new Vector(x, y), data.sprite || 'torch');
        light.radius = data.radius || 5;
        this.addMapObject(light);
      }
  }

  private setupEventHandlers(): void {
    this.mouseHandler.on(MouseEventType.LEFT_CLICK, (pos) => this.onLeftClick(pos));
    this.mouseHandler.on(MouseEventType.RIGHT_CLICK, (pos) => this.onRightClick(pos));
    this.mouseHandler.on(MouseEventType.MOVE, (pos) => this.onMouseMove(pos));
  }

  private setupUICallbacks(): void {
    this.uiManager.onPause(() => {
      this.isRunning = !this.isRunning;
      this.uiManager.setPauseButtonState(!this.isRunning);
    });

    this.uiManager.onSave(() => {
      const success = this.saveGame(0);
      const message = success ? 'Game saved successfully!' : 'Failed to save game.';
      this.uiManager.startDialogue([{ speaker: 'System', text: message }]);
    });

    this.uiManager.onLoad(() => {
      const success = this.loadGame(0);
      const message = success ? 'Game loaded successfully!' : 'No save file found.';
      this.uiManager.startDialogue([{ speaker: 'System', text: message }]);
    });

    this.uiManager.onSkipDialogue(() => {
      console.log('Skip dialogue button pressed');
    });

    this.uiManager.onMute(() => {
      const isCurrentlyMuted = this.audioManager.getMuted();
      const newMuteState = !isCurrentlyMuted;
      this.audioManager.setMute(newMuteState);
      this.uiManager.setMuteButtonState(newMuteState);
      console.log(newMuteState ? 'Audio muted' : 'Audio unmuted');
    });
  }

  private onLeftClick(pos: Vector): void {
    if (this.uiManager.isUIOpen()) return;
    this.selectedCell = pos;
    this.pendingInteractionTarget = null;
    const newPath = this.pathfinder.findPath(this.currentPlayerPos, pos);
    this.path = newPath.length > 0 ? newPath : [];
    this.isPlayerMoving = false;
    this.render();
  }

  private onRightClick(pos: Vector): void {
    if (this.uiManager.isUIOpen()) return;
    this.selectedCell = pos;
    this.pendingInteractionTarget = null;

    let clickedObject: MapObject | null = null;
    for (const object of this.mapObjects.values()) {
      if (object.position.equals(pos) && (object instanceof NPC || object.type === MapObjectType.ITEM || object.type === MapObjectType.DOOR || object.type === MapObjectType.CHEST)) {
        clickedObject = object;
        break;
      }
    }

    let moveTarget = pos;
    let pathingNeeded = true;

    if (clickedObject) {
      const neighbors = this.grid.getNeighbors(clickedObject.position.x, clickedObject.position.y);
      let targetAdjacentTile: Vector | null = null;
      for (const neighbor of neighbors) {
        const cell = this.grid.getCell(neighbor.x, neighbor.y);
        if (cell && cell.walkable) {
          targetAdjacentTile = neighbor;
          break;
        }
      }
      if (targetAdjacentTile) {
        moveTarget = targetAdjacentTile;
        this.pendingInteractionTarget = clickedObject;
      } else {
        pathingNeeded = false;
      }
    }

    if (pathingNeeded) {
        const newPath = this.pathfinder.findPath(this.currentPlayerPos, moveTarget);
        if (newPath.length > 0) {
          this.path = newPath;
          this.isPlayerMoving = true;
          this.currentPathIndex = 0;
          this.moveProgress = 0;
          this.targetPlayerPos = this.currentPlayerPos.clone();
        } else {
          this.path = [];
          this.isPlayerMoving = false;
          this.pendingInteractionTarget = null;
        }
    } else {
        this.path = [];
        this.isPlayerMoving = false;
    }
    this.render();
  }

  private onMouseMove(pos: Vector): void {
      this.renderer.updateMouseHUD(pos.x, pos.y);
  }

  private updateObjectSpriteTexture(object: MapObject): void {
    if (object.pixiSprite && object.sprite) {
      const newTexture = this.renderer.getTexture(object.sprite);
      if (newTexture) object.pixiSprite.texture = newTexture;
    }
  }

  private onInteract(targetObject?: MapObject): void {
    if (this.uiManager.isUIOpen() && !targetObject) return;
    let objectToInteract: MapObject | null = targetObject || null;

    if (!objectToInteract) {
      for (const object of this.mapObjects.values()) {
        if (object.position.manhattanDistance(this.currentPlayerPos) <= 1 && (object instanceof NPC || object.type === MapObjectType.ITEM || object.type === MapObjectType.DOOR || object.type === MapObjectType.CHEST)) {
          objectToInteract = object;
          break;
        }
      }
    }

    if (objectToInteract) {
      if (objectToInteract instanceof NPC) {
        if (objectToInteract.type === MapObjectType.ENEMY) {
          const enemy = objectToInteract as Enemy;
          let effectivePlayerAttack = this.playerAttackPower;

          // Debugging: Log inventory contents before attack
          console.log("Player Inventory before attack:", this.inventory.getAllItems());
          const weapons = this.inventory.getAllItems().filter(item => item.type === ItemType.WEAPON);
          console.log("Weapons in inventory:", weapons);

          if (weapons.length > 0) {
            effectivePlayerAttack *= 1.5; // 50% bonus damage if a weapon is in inventory
            this.uiManager.startDialogue([{ speaker: 'Player', text: `You strike with your ${weapons[0].name}, dealing ${effectivePlayerAttack} damage!` }]);
          } else {
            this.uiManager.startDialogue([{ speaker: 'Player', text: `You attack, dealing ${effectivePlayerAttack} damage!` }]);
          }

          enemy.takeDamage(effectivePlayerAttack);
          const bloodEmitterId = this.particleSystem.createEmitter(enemy.position.clone(), ParticlePresets.BLOOD);
          const bloodEmitter = this.particleSystem.getEmitter(bloodEmitterId);
          if (bloodEmitter) bloodEmitter.setLifetime(200);

          if (!enemy.isAlive()) {
            const explosionEmitterId = this.particleSystem.createEmitter(enemy.position.clone(), ParticlePresets.EXPLOSION);
            const explosionEmitter = this.particleSystem.getEmitter(explosionEmitterId);
            if (explosionEmitter) explosionEmitter.setLifetime(300);
            this.removeMapObject(enemy.id);
            this.render();
            this.uiManager.startDialogue([{ speaker: 'System', text: `${enemy.id} defeated!` }]);
          } else {
            this.uiManager.startDialogue([{ speaker: 'System', text: `${enemy.id} took ${effectivePlayerAttack} damage. Health: ${enemy.health}/${enemy.maxHealth}.` }]);

            // Enemy retaliates
            const enemyDamage = enemy.attackPower;
            this.playerHealth -= enemyDamage;
            this.uiManager.updatePlayerHealth(this.playerHealth, this.playerMaxHealth);
            this.uiManager.startDialogue([{ speaker: enemy.id, text: `You took ${enemyDamage} damage! Your health: ${this.playerHealth}/${this.playerMaxHealth}.` }]);

            if (this.playerHealth <= 0) {
              this.playerHealth = 0; // Ensure health doesn't go below 0 for display
              this.uiManager.updatePlayerHealth(this.playerHealth, this.playerMaxHealth);
              this.uiManager.startDialogue([{ speaker: 'System', text: 'Game Over! Your adventure ends here.' }]);
              this.stopGameLoop(); // Stop the game loop
            }
          }
        } else {
          const sampleDialogue: DialogueLine[] = [
            { speaker: objectToInteract.id, text: 'Hello, traveler!' },
            { speaker: 'Player', text: 'Indeed. What brings you to this place?' },
            { speaker: objectToInteract.id, text: 'Just enjoying the quiet.' },
          ];
          this.uiManager.startDialogue(sampleDialogue);
        }
      } else if (objectToInteract.type === MapObjectType.ITEM) {
        const item = new Item(
          objectToInteract.getProperty('itemId'),
          objectToInteract.getProperty('name'),
          objectToInteract.getProperty('description'),
          objectToInteract.sprite,
          objectToInteract.getProperty('type'),
          objectToInteract.getProperty('stackable'),
          objectToInteract.getProperty('maxStackSize'),
          objectToInteract.getProperty('quantity')
        );

        // Handle consumable items (potions)
        if (item.type === ItemType.CONSUMABLE) {
          const healthRestored = 20; // Example: Potion restores 20 health
          this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healthRestored);
          this.uiManager.updatePlayerHealth(this.playerHealth, this.playerMaxHealth);
          this.uiManager.startDialogue([{ speaker: 'System', text: `You used a ${item.name} and restored ${healthRestored} health!` }]);

          // Remove the item from the map and inventory after use
          this.inventory.removeItem(item.id, 1); // Assuming 1 quantity is used
          this.removeMapObject(objectToInteract.id);
          this.uiManager.updateInventoryDisplay(this.inventory);
          this.render();
          console.log(`Used item: ID=${item.id}, Name=${item.name}, Type=${item.type}. Player Health: ${this.playerHealth}`);
          return; // Exit interaction after using consumable
        }

        this.inventory.addItem(item);
        this.removeMapObject(objectToInteract.id);
        this.uiManager.updateInventoryDisplay(this.inventory);
        this.render();
        this.uiManager.startDialogue([{ speaker: 'System', text: `Picked up ${item.name}.` }]);
        // Debugging: Log item details when picked up
        console.log(`Picked up item: ID=${item.id}, Name=${item.name}, Type=${item.type}`);
      } else if (objectToInteract.type === MapObjectType.DOOR) {
        const gate = objectToInteract as InteractiveObject;
        if (!gate.getProperty('isOpen')) {
          const keyId = gate.getProperty('keyId');
          const requiredEnemyId = gate.getProperty('requiredEnemyId');
          if (keyId && !this.inventory.hasItem(keyId)) {
            this.uiManager.startDialogue([{ speaker: 'System', text: 'The gate is locked. You need a key.' }]);
          } else if (requiredEnemyId && this.mapObjects.has(requiredEnemyId)) {
            this.uiManager.startDialogue([{ speaker: 'System', text: `Defeat the ${requiredEnemyId} first!` }]);
          } else {
            if (keyId) this.inventory.removeItem(keyId);
            gate.setProperty('isOpen', true);
            gate.sprite = 'gate_open';
            this.updateObjectSpriteTexture(gate);
            this.grid.setCellType(gate.position.x, gate.position.y, CellType.GRASS);

            // Apply flood-fill visibility when room door is opened
            const roomCells = this.floodFill.fillRoom(new Vector(gate.position.x, gate.position.y));
            this.fogOfWar.markMultipleExplored(roomCells);

            if (gate.isLevelExit) {
              this.uiManager.startDialogue([{ speaker: 'System', text: `You opened the master gate!` }]).then(() => this.advanceToNextLevel());
            } else if (gate.teleportTargetX !== undefined && gate.teleportTargetY !== undefined) {
                this.currentPlayerPos.x = gate.teleportTargetX;
                this.currentPlayerPos.y = gate.teleportTargetY;
                this.targetPlayerPos = this.currentPlayerPos.clone();
                this.uiManager.startDialogue([{ speaker: 'System', text: `You stepped through the gate!` }]);
            } else {
              this.uiManager.startDialogue([{ speaker: 'System', text: `You opened the gate!` }]);
            }
            this.render();
          }
        } else {
          if (gate.isLevelExit) {
            this.uiManager.startDialogue([{ speaker: 'System', text: 'You step through the open master gate...' }]).then(() => this.advanceToNextLevel());
          } else if (gate.teleportTargetX !== undefined && gate.teleportTargetY !== undefined) {
              this.currentPlayerPos.x = gate.teleportTargetX;
              this.currentPlayerPos.y = gate.teleportTargetY;
              this.targetPlayerPos = this.currentPlayerPos.clone();
              this.uiManager.startDialogue([{ speaker: 'System', text: `You stepped through the gate!` }]);
          } else {
            this.uiManager.startDialogue([{ speaker: 'System', text: 'You step through the open gate...' }]);
          }
        }
      } else if (objectToInteract.type === MapObjectType.CHEST) {
        const chest = objectToInteract as InteractiveObject;
        if (!chest.getProperty('isOpen')) {
          chest.setProperty('isOpen', true);
          chest.sprite = 'chest_open';
          this.updateObjectSpriteTexture(chest);
          const contents: Item[] = chest.getProperty('contents');
          let dialogueText = 'You found: ';
          contents.forEach(item => {
            this.inventory.addItem(item);
            dialogueText += `${item.name} (x${item.quantity}), `;
          });
          dialogueText = dialogueText.slice(0, -2) + '.';
          this.uiManager.startDialogue([{ speaker: 'System', text: dialogueText }]);
          this.uiManager.updateInventoryDisplay(this.inventory);
          this.render();
        }
      }
    }
  }

  private render(): void {
    if (!this.map) return;
    this.renderer.getCamera().centerOn(this.targetPlayerPos);
    this.renderer.applyCameraTransform();
    this.renderer.renderMap(this.map);

    if (!this.currentPlayerPos.equals(this.lastFovPos)) {
      const lightSources: { pos: Vector, radius: number }[] = [];
      // Always add player as a light source
      lightSources.push({ pos: this.currentPlayerPos, radius: 10 });

      // Add all active light source objects
      for (const obj of this.mapObjects.values()) {
        if (obj.type === MapObjectType.LIGHT_SOURCE && obj.isActive) {
          lightSources.push({ pos: obj.position, radius: obj.radius });
        }
      }

      // Calculate combined FOV from all sources
      const combinedFOV = new Set<string>();
      for (const source of lightSources) {
        const sourceFOV = this.fov.calculateFOV(source.pos, source.radius);
        sourceFOV.forEach(cell => combinedFOV.add(cell));
      }

      this.cachedVisibleCells = combinedFOV;
      this.fogOfWar.updateFromFOV(this.cachedVisibleCells);
      this.renderer.renderFogOfWar(this.fogOfWar, this.map.getWidth(), this.map.getHeight());
      this.renderer.drawFOV(this.cachedVisibleCells, this.map.getWidth(), this.map.getHeight());
      this.lastFovPos = this.currentPlayerPos.clone();
    }

    const visibleCells = this.cachedVisibleCells;
    const cameraPos = this.renderer.getCamera().getPosition();
    const cameraWidth = this.renderer.getCamera().width / this.renderer.tileSize;
    const cameraHeight = this.renderer.getCamera().height / this.renderer.tileSize;
    if (this.playerPixiSprite) {
      this.renderer.updateSpritePosition(this.playerPixiSprite, this.targetPlayerPos.x, this.targetPlayerPos.y);
    }
    for (const object of this.mapObjects.values()) {
      if (object.pixiSprite && object.isActive) {
        const inCameraBounds = object.position.x >= cameraPos.x - 2 && object.position.x <= cameraPos.x + cameraWidth + 2 && object.position.y >= cameraPos.y - 2 && object.position.y <= cameraPos.y + cameraHeight + 2;
        if (!inCameraBounds) {
            object.pixiSprite.visible = false;
            continue;
        }
        this.renderer.updateSpritePosition(object.pixiSprite, object.position.x, object.position.y);
        object.pixiSprite.visible = this.fogOfWar.isExplored(object.position.x, object.position.y);
      }
    }
    this.renderer.clearMarkers();
    if (this.selectedCell) this.renderer.drawMarker(this.selectedCell.x, this.selectedCell.y, 0x0000ff, 5);
    for (let i = this.isPlayerMoving ? this.currentPathIndex + 1 : 0; i < this.path.length; i++) {
      const cell = this.path[i];
      const hue = (i * 15) % 360;
      const h = hue / 60;
      const xColor = Math.floor((1 - Math.abs(h % 2 - 1)) * 255);
      let r = 0, g = 0, b = 0;
      if (h < 1) { r = 255; g = xColor; b = 0; }
      else if (h < 2) { r = xColor; g = 255; b = 0; }
      else if (h < 3) { r = 0; g = 255; b = xColor; }
      else if (h < 4) { r = 0; g = xColor; b = 255; }
      else if (h < 5) { r = xColor; g = 0; b = 255; }
      else { r = 255; g = 0; b = xColor; }
      this.renderer.drawMarker(cell.x, cell.y, (r << 16) | (g << 8) | b, 3);
    }
    this.uiManager.updatePlayerHealth(this.playerHealth, this.playerMaxHealth);
    this.renderer.renderParticles(this.particleSystem.getAllParticles());
  }

  private update(deltaTime: number): void {
    if (!this.isRunning) return;
    this.gameTime += deltaTime;
    this.uiManager.updateFpsCounter(deltaTime);
    if (!this.uiManager.isUIOpen()) {
      if (this.isPlayerMoving && this.path.length > 0) {
        const startTile = this.path[this.currentPathIndex];
        const endTile = this.path[this.currentPathIndex + 1];
        if (endTile) {
          this.moveProgress += this.playerMoveSpeed * deltaTime;
          if (this.moveProgress >= 1) {
            this.currentPlayerPos = endTile.clone();
            this.targetPlayerPos = endTile.clone();
            this.currentPathIndex++;
            this.moveProgress = 0;
            if (this.currentPathIndex >= this.path.length - 1) {
              this.isPlayerMoving = false;
              this.path = [];
              this.selectedCell = null;
              if (this.pendingInteractionTarget) {
                if (this.currentPlayerPos.manhattanDistance(this.pendingInteractionTarget.position) <= 1) {
                  this.onInteract(this.pendingInteractionTarget);
                }
                this.pendingInteractionTarget = null;
              }
            }
          } else {
            this.targetPlayerPos.x = startTile.x + (endTile.x - startTile.x) * this.moveProgress;
            this.targetPlayerPos.y = startTile.y + (endTile.y - startTile.y) * this.moveProgress;
          }
        } else {
          this.isPlayerMoving = false;
          this.path = [];
          this.selectedCell = null;
          this.pendingInteractionTarget = null;
        }
      }
    }
    this.aiSystem.update(this.currentPlayerPos);
    this.particleSystem.update(deltaTime);
    this.render();
  }

  private pixiGameLoop(): void {
    if (!this.isRunning) return;
    this.update(this.renderer.getApp().ticker.deltaMS);
  }

  private startGameLoop(): void {
    this.isRunning = true;
    this.renderer.getApp().ticker.add(this.boundGameLoop);
  }

  stopGameLoop(): void {
    this.isRunning = false;
    this.renderer.getApp().ticker.remove(this.boundGameLoop);
  }

  addMapObject(object: MapObject): void {
    this.mapObjects.set(object.id, object);
    if (object.sprite) {
      const texture = this.renderer.getTexture(object.sprite);
      if (texture) {
        object.pixiSprite = new PIXI.Sprite(texture);
        object.pixiSprite.width = this.renderer.tileSize;
        object.pixiSprite.height = this.renderer.tileSize;
        this.renderer.getSpriteContainer().addChild(object.pixiSprite);
      }
    }
    if (object instanceof NPC || object instanceof Enemy) this.aiSystem.registerNPC(object);
  }

  removeMapObject(objectId: string): void {
    const object = this.mapObjects.get(objectId);
    if (object) {
      if (object.pixiSprite) {
        this.renderer.getSpriteContainer().removeChild(object.pixiSprite);
        object.pixiSprite.destroy();
        object.pixiSprite = null;
      }
      if (object instanceof NPC || object instanceof Enemy) this.aiSystem.unregisterNPC(objectId);
      this.mapObjects.delete(objectId);
    }
  }

  getMapObject(objectId: string): MapObject | undefined { return this.mapObjects.get(objectId); }
  getAllMapObjects(): MapObject[] { return Array.from(this.mapObjects.values()); }
  getInventory(): Inventory { return this.inventory; }
  getUIManager(): UIManager { return this.uiManager; }

  saveGame(slot: number): boolean {
    const gameState = SaveLoadManager.createGameState(this.currentPlayerPos, this.map?.getName() || 'Unknown', this.aiSystem.getAllNPCs(), this.getAllMapObjects(), null, this.fogOfWar.getFogMap() as any);
    return this.saveLoadManager.saveGame(slot, gameState);
  }

  loadGame(slot: number): boolean {
    const saveFile = this.saveLoadManager.loadGame(slot);
    if (!saveFile) return false;
    this.currentPlayerPos = new Vector(saveFile.gameState.playerPosition.x, saveFile.gameState.playerPosition.y);
    this.targetPlayerPos = this.currentPlayerPos.clone();
    return true;
  }

  quickSave(): boolean {
    const gameState = SaveLoadManager.createGameState(this.currentPlayerPos, this.map?.getName() || 'Unknown', this.aiSystem.getAllNPCs(), this.getAllMapObjects(), null, this.fogOfWar.getFogMap() as any);
    return this.quickSaveManager.quickSave(gameState);
  }

  quickLoad(): boolean {
    const saveFile = this.quickSaveManager.quickLoad();
    if (!saveFile) return false;
    this.currentPlayerPos = new Vector(saveFile.gameState.playerPosition.x, saveFile.gameState.playerPosition.y);
    this.targetPlayerPos = this.currentPlayerPos.clone();
    return true;
  }

  getEditor(): LevelEditor { return this.editor; }
  getAISystem(): NPCAISystem { return this.aiSystem; }
  getParticleSystem(): ParticleSystem { return this.particleSystem; }
  getAnimationLibrary(): AnimationLibrary { return this.animationLibrary; }
  getMouseHandler(): MouseHandler { return this.mouseHandler; }
  getKeyboardHandler(): KeyboardHandler { return this.keyboardHandler; }
  getRenderer(): Renderer { return this.renderer; }
  getPlayerPosition(): Vector { return this.currentPlayerPos; }
  setPlayerPosition(pos: Vector): void { this.currentPlayerPos = pos; this.targetPlayerPos = pos.clone(); }
}
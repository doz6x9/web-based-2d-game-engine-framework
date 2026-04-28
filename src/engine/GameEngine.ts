import { Vector } from './core/Vector';
import { Grid, CellType } from './core/Grid';
import { GameMap, MapLoader } from './map/MapLayer';
import { AStarPathfinder } from './algorithms/AStar';
import { FieldOfView } from './algorithms/FieldOfView';
import { FogOfWar } from './algorithms/FogOfWar';
import { NPCAISystem } from './algorithms/NPCAISystem';
import { NPC, Enemy, MapObject, MapObjectType, InteractiveObject } from './core/MapObject'; // Import InteractiveObject
import { TileRegistry } from './core/TileRegistry';
import { Renderer } from './render/Renderer';
import { MouseHandler, MouseEventType } from './interaction/MouseHandler';
import { KeyboardHandler, KeyboardEventType } from './interaction/KeyboardHandler';
import { AnimationLibrary } from './render/Animation';
import { ParticleSystem, ParticlePresets } from './render/Particles';
import { SaveLoadManager, QuickSaveManager } from './system/SaveLoadManager';
import { LevelEditor } from './editor/LevelEditor';
import { DialogueLine } from './system/DialogueManager';
import { Inventory } from './core/Inventory';
import { Item, ItemType } from './core/Item';
import { UIManager } from './system/UIManager';
import * as PIXI from 'pixi.js'; // Import PIXI for sprite type

/**
 * Main Game Engine
 * Orchestrates all game systems
 */
export class GameEngine {
  private map: GameMap | null = null;
  private grid: Grid;
  private renderer: Renderer;
  private mouseHandler!: MouseHandler; // Initialized in init()
  private keyboardHandler: KeyboardHandler;
  private uiManager!: UIManager; // Initialized in init()
  private inventory: Inventory;
  private pathfinder: AStarPathfinder;
  private fov: FieldOfView;
  private fogOfWar!: FogOfWar; // Initialized in init() or loadMap()
  private aiSystem: NPCAISystem;
  private animationLibrary: AnimationLibrary;
  private particleSystem: ParticleSystem;
  private saveLoadManager: SaveLoadManager;
  private quickSaveManager: QuickSaveManager;
  private editor: LevelEditor;

  private currentPlayerPos: Vector = new Vector(5, 5);
  private selectedCell: Vector | null = null;
  private path: Vector[] = [];

  // Player movement state
  private isPlayerMoving: boolean = false;
  private currentPathIndex: number = 0;
  private moveProgress: number = 0; // 0 to 1, progress along current path segment
  private playerMoveSpeed: number = 0.005; // tiles per millisecond (e.g., 0.005 means 200ms per tile)
  private targetPlayerPos: Vector = new Vector(5, 5); // The exact interpolated position of the player

  private mapObjects: Map<string, MapObject> = new Map();
  private pendingInteractionTarget: MapObject | null = null;

  private playerPixiSprite: PIXI.Sprite | null = null; // New: Player's PIXI.Sprite instance

  // Player stats
  private playerHealth: number = 100;
  private playerMaxHealth: number = 100;
  private playerAttackPower: number = 10;

  private gameTime: number = 0;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;
  
  // Level progression
  private currentLevel: number = 1;
  private levelMap: Map<number, { mapUrl: string; spawnPoint: Vector }> = new Map();

  constructor() {
    this.grid = new Grid(100, 100); // Default grid size, will be updated by map
    this.renderer = new Renderer(32); // Pass tileSize only
    this.keyboardHandler = new KeyboardHandler();
    this.inventory = new Inventory();
    this.pathfinder = new AStarPathfinder(this.grid);
    this.fov = new FieldOfView(this.grid);
    this.aiSystem = new NPCAISystem(this.grid);
    this.animationLibrary = new AnimationLibrary();
    this.particleSystem = new ParticleSystem();
    this.saveLoadManager = new SaveLoadManager();
    this.quickSaveManager = new QuickSaveManager();
    this.editor = new LevelEditor();

    // Initialize tile registry
    TileRegistry.initialize();
    
    // Set up level progression
    this.setupLevelMap();
  }

  /**
   * Asynchronously initializes the game engine components.
   */
  async init(canvas: HTMLCanvasElement, canvasWidth: number, canvasHeight: number): Promise<void> {
    // Initialize renderer after canvas is available
    await this.renderer.init(canvas, canvasWidth, canvasHeight, this.grid.getWidth(), this.grid.getHeight());

    // Initialize MouseHandler with camera for proper coordinate conversion
    this.mouseHandler = new MouseHandler(canvas, this.renderer.getCamera(), this.renderer.tileSize);
    this.uiManager = new UIManager(this.keyboardHandler, this.inventory);
    this.fogOfWar = new FogOfWar(this.grid.getWidth(), this.grid.getHeight(), this.fov); // Initialize FogOfWar here

    // Load visual assets BEFORE loading map or creating objects that use them
    try {
      await this.renderer.loadAssets([
        // Characters and objects
        { id: 'hero', path: '/src/assets/hero.png' },
        { id: 'potion', path: '/src/assets/potion.png' },
        { id: 'gate', path: '/src/assets/gate.png' },
        { id: 'gate_open', path: '/src/assets/gate_open.png' },
        { id: 'chest', path: '/src/assets/chest.png' },
        { id: 'chest_open', path: '/src/assets/chest_open.png' },
        { id: 'sword', path: '/src/assets/sword.png' },
        { id: 'mana_potion', path: '/src/assets/mana_potion.png' },
        { id: 'goblin', path: '/src/assets/goblin.png' },
        { id: 'key', path: '/src/assets/key.png' },
        
        // Placeholder environmental tiles (for future sprite expansion)
        // { id: 'grass_tile', path: '/src/assets/tiles/grass.png' },
        // { id: 'tall_grass_tile', path: '/src/assets/tiles/tall_grass.png' },
        // { id: 'tree_oak', path: '/src/assets/tiles/tree_oak.png' },
        // { id: 'stone_wall_tile', path: '/src/assets/tiles/stone_wall.png' },
        // { id: 'wood_wall_tile', path: '/src/assets/tiles/wood_wall.png' },
        // { id: 'shallow_water_tile', path: '/src/assets/tiles/shallow_water.png' },
        // { id: 'deep_water_tile', path: '/src/assets/tiles/deep_water.png' },
      ]);
      console.log('Visual assets loaded successfully.');
    } catch (error) {
      console.error('Failed to load visual assets:', error);
      throw error; // Propagate error
    }

    // Create player sprite once
    const playerTexture = this.renderer.getTexture('hero');
    if (playerTexture) {
      this.playerPixiSprite = new PIXI.Sprite(playerTexture);
      this.playerPixiSprite.width = this.renderer.tileSize;
      this.playerPixiSprite.height = this.renderer.tileSize;
      this.renderer.getSpriteContainer().addChild(this.playerPixiSprite);
    } else {
      console.error('Player texture "hero" not found!');
    }

    // Load the demo map
    try {
      await this.loadMap('/maps/test-map.json'); // This calls render(), which calls renderer.renderMap()
      console.log('Map loaded successfully.');
    } catch (error) {
      console.error('Failed to load map:', error);
      throw error; // Propagate error
    }

    // Initialize event handlers and start the game loop
    this.setupEventHandlers();
    this.setupUICallbacks();
    this.startGameLoop();
  }

  /**
   * Initialize demo scene (game-specific setup).
   * This allows the engine to remain agnostic to the game being played.
   */
  initializeDemoScene(): void {
    // Add a demo NPC
    const npc = new NPC('npc_01', new Vector(7, 2), 'hero');
    this.addMapObject(npc);

    // ===== ROOM 1 (Starting Room) =====
    // Add a Chest (InteractiveObject) in the starting room
    const chest = new InteractiveObject('chest_01', MapObjectType.CHEST, new Vector(8, 8), 'chest');
    chest.setProperty('isOpen', false);
    chest.setProperty('contents', [
      new Item('mana_potion_1', 'Mana Potion', 'Restores a small amount of mana.', 'mana_potion', ItemType.CONSUMABLE, true, 3, 1),
      new Item('basic_sword', 'Basic Sword', 'A simple sword.', 'sword', ItemType.WEAPON),
    ]);
    this.addMapObject(chest);

    // Add potions scattered in Room 1
    const potion1 = new Item(
      'health_potion_1',
      'Health Potion',
      'Restores a small amount of health.',
      'potion',
      ItemType.CONSUMABLE,
      true,
      5,
      1
    );
    this.addMapObject(potion1.toMapObject(new Vector(4, 5)));

    const potion2 = new Item(
      'health_potion_2',
      'Health Potion',
      'Restores a small amount of health.',
      'potion',
      ItemType.CONSUMABLE,
      true,
      5,
      1
    );
    this.addMapObject(potion2.toMapObject(new Vector(11, 10)));

    // ===== CORRIDOR 1 =====
    const sword1 = new Item(
      'iron_sword_1',
      'Iron Sword',
      'A sturdy iron blade.',
      'sword',
      ItemType.WEAPON
    );
    this.addMapObject(sword1.toMapObject(new Vector(17, 8)));

    // ===== ROOM 2 (Middle Room with Goblin) =====
    // Add an Enemy (Goblin)
    const goblin = new Enemy('goblin_01', new Vector(26, 8), 'goblin');
    goblin.health = 30;
    goblin.maxHealth = 30;
    goblin.attackPower = 5;
    this.addMapObject(goblin);

    // Add potions in Room 2
    const potion3 = new Item(
      'mana_potion_2',
      'Mana Potion',
      'Restores a small amount of mana.',
      'mana_potion',
      ItemType.CONSUMABLE,
      true,
      3,
      1
    );
    this.addMapObject(potion3.toMapObject(new Vector(24, 5)));

    const potion4 = new Item(
      'health_potion_3',
      'Health Potion',
      'Restores a small amount of health.',
      'potion',
      ItemType.CONSUMABLE,
      true,
      5,
      1
    );
    this.addMapObject(potion4.toMapObject(new Vector(29, 12)));

    // Add sword in Room 2
    const sword2 = new Item(
      'steel_sword_1',
      'Steel Sword',
      'A well-forged steel blade.',
      'sword',
      ItemType.WEAPON
    );
    this.addMapObject(sword2.toMapObject(new Vector(21, 10)));

    // ===== CORRIDOR 2 =====
    // Add a Gate Key item in corridor
    const gateKey = new Item(
      'gate_key',
      'Rusty Key',
      'A rusty key that might open something.',
      'key',
      ItemType.KEY_ITEM
    );
    this.addMapObject(gateKey.toMapObject(new Vector(35, 8)));

    // ===== ROOM 3 (Exit Room with Gate) =====
    // Add a Gate (InteractiveObject)
    const gate = new InteractiveObject('gate_01', MapObjectType.DOOR, new Vector(45, 8), 'gate');
    gate.setProperty('isOpen', false);
    gate.setProperty('keyId', 'gate_key'); // Key required to open
    gate.setProperty('requiredEnemyId', 'goblin_01'); // Goblin must be defeated to open
    this.addMapObject(gate);

    // Add potions in Room 3
    const potion5 = new Item(
      'health_potion_4',
      'Health Potion',
      'Restores a small amount of health.',
      'potion',
      ItemType.CONSUMABLE,
      true,
      5,
      1
    );
    this.addMapObject(potion5.toMapObject(new Vector(41, 6)));

    // ===== LOWER CHAMBER (Big exploration area) =====
    // Scatter items in the lower chamber for exploration
    const sword3 = new Item(
      'golden_sword_1',
      'Golden Sword',
      'A gleaming golden blade.',
      'sword',
      ItemType.WEAPON
    );
    this.addMapObject(sword3.toMapObject(new Vector(10, 28)));

    const potion6 = new Item(
      'mana_potion_3',
      'Mana Potion',
      'Restores a small amount of mana.',
      'mana_potion',
      ItemType.CONSUMABLE,
      true,
      3,
      1
    );
    this.addMapObject(potion6.toMapObject(new Vector(26, 26)));

    const potion7 = new Item(
      'health_potion_5',
      'Health Potion',
      'Restores a small amount of health.',
      'potion',
      ItemType.CONSUMABLE,
      true,
      5,
      1
    );
    this.addMapObject(potion7.toMapObject(new Vector(42, 30)));

    const sword4 = new Item(
      'diamond_sword_1',
      'Diamond Sword',
      'A precious diamond-encrusted weapon.',
      'sword',
      ItemType.WEAPON
    );
    this.addMapObject(sword4.toMapObject(new Vector(48, 25)));
  }

  /**
   * Set up level progression map
   */
  private setupLevelMap(): void {
    // Define available levels
    this.levelMap.set(1, { mapUrl: '/maps/test-map.json', spawnPoint: new Vector(5, 5) });
    // Future levels can be added here:
    // this.levelMap.set(2, { mapUrl: '/maps/level2.json', spawnPoint: new Vector(5, 5) });
    // this.levelMap.set(3, { mapUrl: '/maps/level3.json', spawnPoint: new Vector(5, 5) });
  }

  /**
   * Advance to the next level
   */
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

  /**
   * Clear current map and unload all map objects
   */
  private clearMap(): void {
    // Remove all map objects
    const objectIds = Array.from(this.mapObjects.keys());
    for (const id of objectIds) {
      this.removeMapObject(id);
    }

    // Clear path and selection
    this.path = [];
    this.selectedCell = null;
    this.pendingInteractionTarget = null;
    this.isPlayerMoving = false;
    this.currentPathIndex = 0;
    this.moveProgress = 0;

    // Reset fog of war
    this.fogOfWar = new FogOfWar(this.grid.getWidth(), this.grid.getHeight(), this.fov);

    this.map = null;
  }

  /**
   * Load a new level and setup player spawn position
   */
  async loadLevel(mapUrl: string, spawnPoint: Vector): Promise<void> {
    console.log(`Loading level: ${mapUrl}`);
    
    // Clear current map
    this.clearMap();

    // Load the new map
    await this.loadMap(mapUrl);

    // Place player at spawn point
    this.currentPlayerPos = spawnPoint.clone();
    this.targetPlayerPos = spawnPoint.clone();

    // Update UI with new level info
    const levelNames: Map<number, string> = new Map([
      [1, 'The Dungeon'],
      [2, 'The Deep Caverns'],
      [3, 'The Ancient Temple'],
    ]);
    const levelName = levelNames.get(this.currentLevel) || 'Unknown Level';
    this.uiManager.updateLevelDisplay(this.currentLevel, levelName);

    // Re-render
    this.render();

    console.log(`Level loaded successfully. Player spawned at (${spawnPoint.x}, ${spawnPoint.y})`);
  }

  /**
   * Load map from JSON
   */
  async loadMap(mapUrl: string): Promise<void> {
    const response = await fetch(mapUrl);
    const mapData = await response.json();
    this.map = MapLoader.parseMapJSON(mapData);

    // Update grid from collision layer
    const collisionLayer = this.map.getLayerByName('collision');
    if (collisionLayer) {
      const data = collisionLayer.getData();
      for (let y = 0; y < data.length; y++) {
        for (let x = 0; x < data[y].length; x++) {
          const cellType = data[y][x] === 1 ? CellType.WALL : CellType.GRASS;
          this.grid.setCellType(x, y, cellType);
        }
      }
    }

    // Update FogOfWar and Camera dimensions based on loaded map
    // Re-initialize FogOfWar with actual map dimensions
    this.fogOfWar = new FogOfWar(this.map.getWidth(), this.map.getHeight(), this.fov);
    // Update renderer's camera with actual map dimensions
    this.renderer.getCamera().mapWidth = this.map.getWidth();
    this.renderer.getCamera().mapHeight = this.map.getHeight();

    this.render();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.mouseHandler.on(MouseEventType.LEFT_CLICK, (pos) => {
      this.onLeftClick(pos);
    });

    this.mouseHandler.on(MouseEventType.RIGHT_CLICK, (pos) => {
      this.onRightClick(pos);
    });

    this.mouseHandler.on(MouseEventType.MOVE, (pos) => {
      this.onMouseMove(pos);
    });
  }

  /**
   * Setup UI button callbacks
   */
  private setupUICallbacks(): void {
    // Pause/Resume
    this.uiManager.onPause(() => {
      this.isRunning = !this.isRunning;
      this.uiManager.setPauseButtonState(!this.isRunning);
      console.log(this.isRunning ? 'Game resumed' : 'Game paused');
    });

    // Save game
    this.uiManager.onSave(() => {
      const success = this.saveGame(0); // Auto-save to slot 0
      const message = success ? 'Game saved successfully!' : 'Failed to save game.';
      console.log(message);
      this.uiManager.startDialogue([{ speaker: 'System', text: message }]);
    });

    // Load game
    this.uiManager.onLoad(() => {
      const success = this.loadGame(0); // Auto-load from slot 0
      const message = success ? 'Game loaded successfully!' : 'No save file found.';
      console.log(message);
      this.uiManager.startDialogue([{ speaker: 'System', text: message }]);
    });

    // Skip dialogue
    this.uiManager.onSkipDialogue(() => {
      console.log('Skip dialogue button pressed');
      // Dialogue skip is handled by the dialogue manager
    });
  }

  /**
   * Handle left click
   * ONLY handles: path calculation to objects + object interaction
   * Does NOT move to empty tiles
   */
  private onLeftClick(pos: Vector): void {
    if (this.uiManager.isUIOpen()) return; // Prevent interaction during UI activity

    console.log(`Left clicked: ${pos.x}, ${pos.y}`);
    this.selectedCell = pos;
    this.pendingInteractionTarget = null; // Clear any pending interaction

    // Check if an interactive object was clicked
    let clickedObject: MapObject | null = null;
    for (const object of this.mapObjects.values()) {
      if (object.position.equals(pos) && (object instanceof NPC || object.type === MapObjectType.ITEM || object.type === MapObjectType.DOOR || object.type === MapObjectType.CHEST)) {
        clickedObject = object;
        break;
      }
    }

    if (clickedObject) {
      // If an interactive object was clicked, find an adjacent walkable tile to move to
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
        const newPath = this.pathfinder.findPath(this.currentPlayerPos, targetAdjacentTile);
        if (newPath.length > 0) {
          this.path = newPath;
          this.isPlayerMoving = true;
          this.currentPathIndex = 0;
          this.moveProgress = 0;
          this.targetPlayerPos = this.currentPlayerPos.clone();
          this.pendingInteractionTarget = clickedObject; // Set pending interaction
        } else {
          console.log(`Cannot find path to interact with ${clickedObject.id}.`);
        }
      } else {
        console.log(`No walkable tile adjacent to ${clickedObject.id} for interaction.`);
      }
    } else {
      // No interactive object clicked - just select the cell for visualization
      console.log(`Left clicked empty tile: ${pos.x}, ${pos.y}`);
    }
    this.render();
  }

  /**
   * Handle right click (still for movement to any tile)
   */
  private onRightClick(pos: Vector): void {
    if (this.uiManager.isUIOpen()) return; // Prevent movement during UI activity

    console.log(`Right clicked: ${pos.x}, ${pos.y}`);
    this.pendingInteractionTarget = null; // Clear any pending interaction
    // Only start moving if a path can be found
    const newPath = this.pathfinder.findPath(this.currentPlayerPos, pos);
    if (newPath.length > 0) {
      this.path = newPath;
      this.isPlayerMoving = true;
      this.currentPathIndex = 0;
      this.moveProgress = 0;
      this.targetPlayerPos = this.currentPlayerPos.clone(); // Start from current grid position
    } else {
      this.path = [];
      this.isPlayerMoving = false;
      console.log(`Cannot move to ${pos.x}, ${pos.y}. It might be blocked or unwalkable.`);
    }
    this.render();
  }

  /**
   * Handle mouse move
   */
  private onMouseMove(_pos: Vector): void {
    // Can be used for highlighting cells
  }

  /**
   * Update a map object's PIXI sprite texture based on its sprite property
   */
  private updateObjectSpriteTexture(object: MapObject): void {
    if (object.pixiSprite && object.sprite) {
      const newTexture = this.renderer.getTexture(object.sprite);
      if (newTexture) {
        object.pixiSprite.texture = newTexture;
      } else {
        console.warn(`Texture for sprite "${object.sprite}" not found while updating object "${object.id}".`);
      }
    }
  }

  /**
   * Handle interaction (e.g., pressing 'E' or after moving to an object)
   */
  private onInteract(targetObject?: MapObject): void {
    if (this.uiManager.isUIOpen() && !targetObject) return; // Prevent new interaction if UI is active, unless explicitly targeted

    console.log('Interaction triggered!');
    let objectToInteract: MapObject | null = null;

    if (targetObject) {
      objectToInteract = targetObject;
    } else {
      // Fallback for keyboard 'E' if it were re-enabled, or for future direct interaction
      for (const object of this.mapObjects.values()) {
        if (object.position.manhattanDistance(this.currentPlayerPos) <= 1 && (object instanceof NPC || object.type === MapObjectType.ITEM || object.type === MapObjectType.DOOR || object.type === MapObjectType.CHEST)) {
          objectToInteract = object;
          break; // This break is fine as it's inside a loop
        }
      }
    }

    if (objectToInteract) {
      if (objectToInteract instanceof NPC) {
        if (objectToInteract.type === MapObjectType.ENEMY) {
          // Basic combat interaction
          console.log(`Attacking enemy: ${objectToInteract.id}!`);
          const enemy = objectToInteract as Enemy;
          const damage = this.playerAttackPower;
          enemy.takeDamage(damage);
          console.log(`${enemy.id} took ${damage} damage. Health: ${enemy.health}/${enemy.maxHealth}`);

          // Trigger blood particle effect at enemy position
          this.particleSystem.createEmitter(
            enemy.position.clone(),
            ParticlePresets.BLOOD
          );

          if (!enemy.isAlive()) {
            console.log(`${enemy.id} defeated!`);
            // Trigger additional particle effect when enemy is defeated
            this.particleSystem.createEmitter(
              enemy.position.clone(),
              ParticlePresets.EXPLOSION
            );
            this.removeMapObject(enemy.id);
            this.render();
          } else {
            this.uiManager.startDialogue([{ speaker: enemy.id, text: `You hit me! My health is ${enemy.health}.` }]);
          }
          return; // Exit after handling enemy interaction
        } else {
          // Regular NPC dialogue
          console.log(`Interacting with NPC: ${objectToInteract.id} at ${objectToInteract.position.x}, ${objectToInteract.position.y}`);

          const sampleDialogue: DialogueLine[] = [
            { speaker: objectToInteract.id, text: 'Hello, traveler! The world is full of wonders.' },
            { speaker: 'Player', text: 'Indeed. What brings you to this place?' },
            { speaker: objectToInteract.id, text: 'Just enjoying the quiet. Be careful of the walls, they are quite solid.' },
          ];

          this.uiManager.startDialogue(sampleDialogue).then(() => {
            console.log('Dialogue finished!');
            // Resume game state or trigger next event after dialogue
          });
          return; // Exit after handling NPC dialogue
        }
      } else if (objectToInteract.type === MapObjectType.ITEM) {
        console.log(`Picking up item: ${objectToInteract.getProperty('name')} at ${objectToInteract.position.x}, ${objectToInteract.position.y}`);
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
        this.inventory.addItem(item);
        this.removeMapObject(objectToInteract.id); // Remove item from map
        this.uiManager.updateInventoryDisplay(this.inventory); // Update inventory UI
        this.render(); // Re-render to show item removed
        return; // Exit after handling item pickup
      } else if (objectToInteract.type === MapObjectType.DOOR) {
        const gate = objectToInteract as InteractiveObject;
        if (!gate.getProperty('isOpen')) {
          const keyId = gate.getProperty('keyId');
          const requiredEnemyId = gate.getProperty('requiredEnemyId'); // e.g., 'goblin_01'
          
          // Check conditions for opening door
          if (!this.inventory.hasItem(keyId)) {
            this.uiManager.startDialogue([{ speaker: 'System', text: 'The gate is locked. You need a key.' }]);
          } else if (requiredEnemyId && this.mapObjects.has(requiredEnemyId)) {
            // Enemy still exists - can't open
            this.uiManager.startDialogue([{ speaker: 'System', text: `You sense a dangerous presence beyond the gate. You must defeat the ${requiredEnemyId} first!` }]);
          } else {
            // All conditions met - open the gate
            this.inventory.removeItem(keyId);
            gate.setProperty('isOpen', true);
            gate.sprite = 'gate_open'; // Change sprite property
            this.updateObjectSpriteTexture(gate); // Update PIXI texture immediately
            this.grid.setCellType(gate.position.x, gate.position.y, CellType.GRASS); // Make walkable
            this.uiManager.startDialogue([{ speaker: 'System', text: `You used the ${keyId} and opened the gate! You may now proceed to the next level.` }]);
            this.render(); // Re-render to show open gate
          }
        } else {
          // Gate is open - allow passage to next level
          this.uiManager.startDialogue([{ speaker: 'System', text: 'You step through the open gate...' }]).then(() => {
            // After dialogue, advance to next level
            this.advanceToNextLevel().catch(err => {
              console.error('Failed to advance to next level:', err);
            });
          });
        }
        return; // Exit after handling door interaction
      } else if (objectToInteract.type === MapObjectType.CHEST) {
        const chest = objectToInteract as InteractiveObject;
        if (!chest.getProperty('isOpen')) {
          chest.setProperty('isOpen', true);
          chest.sprite = 'chest_open'; // Change sprite property
          this.updateObjectSpriteTexture(chest); // Update PIXI texture immediately
          const contents: Item[] = chest.getProperty('contents');
          let dialogueText = 'You opened the chest and found: ';
          contents.forEach(item => {
            this.inventory.addItem(item);
            dialogueText += `${item.name} (x${item.quantity}), `;
          });
          dialogueText = dialogueText.slice(0, -2) + '.'; // Remove trailing comma and add period
          this.uiManager.startDialogue([{ speaker: 'System', text: dialogueText }]);
          this.uiManager.updateInventoryDisplay(this.inventory);
          this.render(); // Re-render to show open chest
        } else {
          this.uiManager.startDialogue([{ speaker: 'System', text: 'The chest is empty.' }]);
        }
        return; // Exit after handling chest interaction
      }
    } else {
      console.log('No interactive object found nearby.');
    }
  }

  /**
   * Render the game
   */
  private render(): void {
    if (!this.map) return;

    // Render map (only draws static layers once)
    this.renderer.renderMap(this.map);

    // Update FOV from current player position (based on grid position)
    const visibleCells = this.fov.calculateFOV(this.currentPlayerPos, 10);

    // Update fog of war
    this.fogOfWar.updateFromFOV(visibleCells);

    // Render fog of war
    this.renderer.renderFogOfWar(this.fogOfWar, this.map.getWidth(), this.map.getHeight());

    // Draw FOV visualization
    this.renderer.drawFOV(visibleCells, this.map.getWidth(), this.map.getHeight());

    // Update player sprite position
    if (this.playerPixiSprite) {
      this.renderer.updateSpritePosition(this.playerPixiSprite, this.targetPlayerPos.x, this.targetPlayerPos.y);
    }

    // Update all other map objects' sprite positions and visibility based on FOV
    for (const object of this.mapObjects.values()) {
      if (object.pixiSprite && object.isActive) {
        this.renderer.updateSpritePosition(object.pixiSprite, object.position.x, object.position.y);
        
        // Control sprite visibility based on FOV discovery
        // Objects are visible if their tile is explored (includes currently visible)
        const isDiscovered = this.fogOfWar.isExplored(object.position.x, object.position.y);
        object.pixiSprite.visible = isDiscovered;
      }
    }

    // Clear markers before drawing new ones
    this.renderer.clearMarkers();

    // Draw selected cell if any
    if (this.selectedCell) {
      this.renderer.drawMarker(this.selectedCell.x, this.selectedCell.y, 0x0000ff, 5);
    }

    // Draw path (excluding the current player position and the next target if moving)
    for (let i = this.isPlayerMoving ? this.currentPathIndex + 1 : 0; i < this.path.length; i++) {
      const cell = this.path[i];
      // Generate a distinct color for each step along the path using HSV-like progression
      const hue = (i * 15) % 360; // 15 degrees per step
      // Convert simple hue to RGB (assuming full saturation and value)
      const h = hue / 60;
      const xColor = Math.floor((1 - Math.abs(h % 2 - 1)) * 255);
      let r = 0, g = 0, b = 0;
      if (h < 1) { r = 255; g = xColor; b = 0; }
      else if (h < 2) { r = xColor; g = 255; b = 0; }
      else if (h < 3) { r = 0; g = 255; b = xColor; }
      else if (h < 4) { r = 0; g = xColor; b = 255; }
      else if (h < 5) { r = xColor; g = 0; b = 255; }
      else { r = 255; g = 0; b = xColor; }
      
      const color = (r << 16) | (g << 8) | b;
      
      this.renderer.drawMarker(cell.x, cell.y, color, 3);
    }

    // Update player health UI
    this.uiManager.updatePlayerHealth(this.playerHealth, this.playerMaxHealth);

    // Render particles
    const allParticles = this.particleSystem.getAllParticles();
    this.renderer.renderParticles(allParticles);

    // Center camera on player (using interpolated position for smooth camera)
    this.renderer.getCamera().centerOn(this.targetPlayerPos);
  }

  /**
   * Update game state
   */
  private update(deltaTime: number): void {
    if (!this.isRunning) return;

    this.gameTime += deltaTime;
    
    // Update FPS counter in UI
    this.uiManager.updateFpsCounter(deltaTime);

    // Only update player movement if UI is not active
    if (!this.uiManager.isUIOpen()) {
      // Handle player movement
      if (this.isPlayerMoving && this.path.length > 0) {
        const startTile = this.path[this.currentPathIndex];
        const endTile = this.path[this.currentPathIndex + 1];

        if (endTile) {
          this.moveProgress += this.playerMoveSpeed * deltaTime;

          if (this.moveProgress >= 1) {
            // Reached the next tile
            this.currentPlayerPos = endTile.clone(); // Update grid position
            this.targetPlayerPos = endTile.clone(); // Snap interpolated position to grid
            this.currentPathIndex++;
            this.moveProgress = 0;

            if (this.currentPathIndex >= this.path.length - 1) {
              // Reached the end of the path
              this.isPlayerMoving = false;
              this.path = []; // Clear path
              this.selectedCell = null; // Clear selected cell

              // After movement, check for pending interaction
              if (this.pendingInteractionTarget) {
                // Ensure player is adjacent to the target before interacting
                if (this.currentPlayerPos.manhattanDistance(this.pendingInteractionTarget.position) <= 1) {
                  this.onInteract(this.pendingInteractionTarget);
                } else {
                  console.warn('Player arrived at target but not adjacent to interaction object.');
                }
                this.pendingInteractionTarget = null; // Clear pending interaction
              }
            }
          } else {
            // Interpolate position between start and end tiles
            this.targetPlayerPos.x = startTile.x + (endTile.x - startTile.x) * this.moveProgress;
            this.targetPlayerPos.y = startTile.y + (endTile.y - startTile.y) * this.moveProgress;
          }
        } else {
          // Should not happen if path is valid, but as a safeguard
          this.isPlayerMoving = false;
          this.path = [];
          this.selectedCell = null;
          this.pendingInteractionTarget = null; // Clear pending interaction
        }
      }
    }


    // Update AI system
    this.aiSystem.update(this.currentPlayerPos);

    // Update animations
    for (const _obj of this.mapObjects.values()) {
      // Animation updates handled by individual controllers
    }

    // Update particles
    this.particleSystem.update(deltaTime);

    // Game logic updates
    this.render();
  }

  /**
   * Start game loop
   */
  private startGameLoop(): void {
    this.isRunning = true;
    this.lastFrameTime = Date.now();

    const gameLoop = () => {
      if (!this.isRunning) return;

      const currentTime = Date.now();
      const deltaTime = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      this.update(deltaTime);

      requestAnimationFrame(gameLoop);
    };

    requestAnimationFrame(gameLoop);
  }

  /**
   * Stop game loop
   */
  stopGameLoop(): void {
    this.isRunning = false;
  }

  /**
   * Add map object
   */
  addMapObject(object: MapObject): void {
    this.mapObjects.set(object.id, object);

    // Create and add PixiJS sprite for the map object
    if (object.sprite) {
      const texture = this.renderer.getTexture(object.sprite);
      if (texture) {
        object.pixiSprite = new PIXI.Sprite(texture);
        object.pixiSprite.width = this.renderer.tileSize;
        object.pixiSprite.height = this.renderer.tileSize;
        this.renderer.getSpriteContainer().addChild(object.pixiSprite);
      } else {
        console.warn(`Texture for map object "${object.id}" with sprite "${object.sprite}" not found.`);
      }
    }

    if (object instanceof NPC || object instanceof Enemy) {
      this.aiSystem.registerNPC(object);
    }
  }

  /**
   * Remove map object
   */
  removeMapObject(objectId: string): void {
    const object = this.mapObjects.get(objectId);
    if (object) {
      if (object.pixiSprite) {
        this.renderer.getSpriteContainer().removeChild(object.pixiSprite);
        object.pixiSprite.destroy(); // Destroy the PixiJS sprite to free memory
        object.pixiSprite = null;
      }
      if (object instanceof NPC || object instanceof Enemy) {
        this.aiSystem.unregisterNPC(objectId);
      }
      this.mapObjects.delete(objectId);
    }
  }

  /**
   * Get map object
   */
  getMapObject(objectId: string): MapObject | undefined {
    return this.mapObjects.get(objectId);
  }

  /**
   * Get all map objects
   */
  getAllMapObjects(): MapObject[] {
    return Array.from(this.mapObjects.values());
  }

  /**
   * Get player's inventory
   */
  getInventory(): Inventory {
    return this.inventory;
  }

  /**
   * Get UI Manager
   */
  getUIManager(): UIManager {
    return this.uiManager;
  }

  /**
   * Save game
   */
  saveGame(slot: number): boolean {
    const gameState = SaveLoadManager.createGameState(
      this.currentPlayerPos,
      this.map?.getName() || 'Unknown',
      this.aiSystem.getAllNPCs(),
      this.getAllMapObjects(),
      null,
      this.fogOfWar.getFogMap() as any
    );

    return this.saveLoadManager.saveGame(slot, gameState);
  }

  /**
   * Load game
   */
  loadGame(slot: number): boolean {
    const saveFile = this.saveLoadManager.loadGame(slot);
    if (!saveFile) return false;

    this.currentPlayerPos = new Vector(
      saveFile.gameState.playerPosition.x,
      saveFile.gameState.playerPosition.y
    );
    this.targetPlayerPos = this.currentPlayerPos.clone(); // Also update interpolated position

    return true;
  }

  /**
   * Quick save
   */
  quickSave(): boolean {
    const gameState = SaveLoadManager.createGameState(
      this.currentPlayerPos,
      this.map?.getName() || 'Unknown',
      this.aiSystem.getAllNPCs(),
      this.getAllMapObjects(),
      null,
      this.fogOfWar.getFogMap() as any
    );

    return this.quickSaveManager.quickSave(gameState);
  }

  /**
   * Quick load
   */
  quickLoad(): boolean {
    const saveFile = this.quickSaveManager.quickLoad();
    if (!saveFile) return false;

    this.currentPlayerPos = new Vector(
      saveFile.gameState.playerPosition.x,
      saveFile.gameState.playerPosition.y
    );
    this.targetPlayerPos = this.currentPlayerPos.clone(); // Also update interpolated position

    return true;
  }

  /**
   * Get editor
   */
  getEditor(): LevelEditor {
    return this.editor;
  }

  /**
   * Get AI system
   */
  getAISystem(): NPCAISystem {
    return this.aiSystem;
  }

  /**
   * Get particle system
   */
  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  /**
   * Get animation library
   */
  getAnimationLibrary(): AnimationLibrary {
    return this.animationLibrary;
  }

  /**
   * Get mouse handler for custom event binding
   */
  getMouseHandler(): MouseHandler {
    return this.mouseHandler;
  }

  /**
   * Get keyboard handler for custom event binding
   */
  getKeyboardHandler(): KeyboardHandler {
    return this.keyboardHandler;
  }

  /**
   * Get renderer
   */
  getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * Get current player position (grid-aligned)
   */
  getPlayerPosition(): Vector {
    return this.currentPlayerPos;
  }

  /**
   * Set player position (grid-aligned)
   */
  setPlayerPosition(pos: Vector): void {
    this.currentPlayerPos = pos;
    this.targetPlayerPos = pos.clone(); // Keep interpolated position in sync
  }
}
import { Vector } from './core/Vector';
import { Grid, CellType } from './core/Grid';
import { GameMap, MapLoader } from './map/MapLayer';
import { AStarPathfinder } from './algorithms/AStar';
import { FieldOfView } from './algorithms/FieldOfView';
import { FogOfWar } from './algorithms/FogOfWar';
import { NPCAISystem } from './algorithms/NPCAISystem';
import { NPC, Enemy, MapObject, MapObjectType } from './core/MapObject';
import { TileRegistry } from './core/TileRegistry';
import { Renderer } from './render/Renderer';
import { MouseHandler, MouseEventType } from './interaction/MouseHandler';
import { KeyboardHandler, KeyboardEventType } from './interaction/KeyboardHandler';
import { AnimationLibrary } from './render/Animation';
import { ParticleSystem } from './render/Particles';
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

  private gameTime: number = 0;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;

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
  }

  /**
   * Asynchronously initializes the game engine components.
   */
  async init(canvas: HTMLCanvasElement, canvasWidth: number, canvasHeight: number): Promise<void> {
    // Initialize renderer after canvas is available
    await this.renderer.init(canvas, canvasWidth, canvasHeight, this.grid.getWidth(), this.grid.getHeight());

    // Initialize MouseHandler and UIManager now that canvas and renderer are ready
    this.mouseHandler = new MouseHandler(canvas);
    this.uiManager = new UIManager(this.keyboardHandler, this.inventory);
    this.fogOfWar = new FogOfWar(this.grid.getWidth(), this.grid.getHeight(), this.fov); // Initialize FogOfWar here

    // Load visual assets BEFORE loading map or creating objects that use them
    try {
      await this.renderer.loadAssets([
        { id: 'hero', path: '/src/assets/hero.png' },
        { id: 'potion', path: '/src/assets/potion.png' }
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

    // Add a demo NPC
    const npc = new NPC('npc_01', new Vector(7, 2), 'hero'); // Reusing 'hero' sprite for now
    this.addMapObject(npc);

    // Add a demo item to the map
    const healthPotion = new Item(
      'health_potion',
      'Health Potion',
      'Restores a small amount of health.',
      'potion', // Use the 'potion' sprite ID
      ItemType.CONSUMABLE,
      true, // Stackable
      5,    // Max stack size
      1     // Initial quantity
    );
    this.addMapObject(healthPotion.toMapObject(new Vector(3, 3))); // Place at (3,3)

    this.setupEventHandlers();
    this.startGameLoop();
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
   * Handle left click
   */
  private onLeftClick(pos: Vector): void {
    if (this.uiManager.isUIOpen()) return; // Prevent interaction during UI activity

    console.log(`Left clicked: ${pos.x}, ${pos.y}`);
    this.selectedCell = pos;
    this.pendingInteractionTarget = null; // Clear any pending interaction

    // Check if an interactive object was clicked
    let clickedObject: MapObject | null = null;
    for (const object of this.mapObjects.values()) {
      if (object.position.equals(pos) && (object instanceof NPC || object.type === MapObjectType.ITEM)) {
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
      // No interactive object clicked, proceed with normal pathfinding
      this.path = this.pathfinder.findPath(this.currentPlayerPos, pos);
      this.isPlayerMoving = true; // Assume movement if path is found
      this.currentPathIndex = 0;
      this.moveProgress = 0;
      this.targetPlayerPos = this.currentPlayerPos.clone();
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
        if (object.position.manhattanDistance(this.currentPlayerPos) <= 1 && (object instanceof NPC || object.type === MapObjectType.ITEM)) {
          objectToInteract = object;
          break;
        }
      }
    }

    if (objectToInteract) {
      if (objectToInteract instanceof NPC) {
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

    // Update all other map objects' sprite positions
    for (const object of this.mapObjects.values()) {
      if (object.pixiSprite && object.isActive) {
        this.renderer.updateSpritePosition(object.pixiSprite, object.position.x, object.position.y);
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
      this.renderer.drawMarker(cell.x, cell.y, 0xffff00, 3);
    }

    // Center camera on player (using interpolated position for smooth camera)
    this.renderer.getCamera().centerOn(this.targetPlayerPos);
  }

  /**
   * Update game state
   */
  private update(deltaTime: number): void {
    if (!this.isRunning) return;

    this.gameTime += deltaTime;

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

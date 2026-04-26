import { Vector } from './core/Vector';
import { Grid, CellType } from './core/Grid';
import { GameMap, MapLoader } from './map/MapLayer';
import { AStarPathfinder } from './algorithms/AStar';
import { FieldOfView } from './algorithms/FieldOfView';
import { FogOfWar } from './algorithms/FogOfWar';
import { NPCAISystem } from './algorithms/NPCAISystem';
import { NPC, Enemy, MapObject } from './core/MapObject';
import { TileRegistry } from './core/TileRegistry';
import { Renderer } from './render/Renderer';
import { MouseHandler, MouseEventType } from './interaction/MouseHandler';
import { AnimationLibrary } from './render/Animation';
import { ParticleSystem } from './render/Particles';
import { SaveLoadManager, QuickSaveManager } from './system/SaveLoadManager';
import { LevelEditor } from './editor/LevelEditor';

/**
 * Main Game Engine
 * Orchestrates all game systems
 */
export class GameEngine {
  private map: GameMap | null = null;
  private grid: Grid;
  private renderer: Renderer;
  private mouseHandler: MouseHandler;
  private pathfinder: AStarPathfinder;
  private fov: FieldOfView;
  private fogOfWar: FogOfWar;
  private aiSystem: NPCAISystem;
  private animationLibrary: AnimationLibrary;
  private particleSystem: ParticleSystem;
  private saveLoadManager: SaveLoadManager;
  private quickSaveManager: QuickSaveManager;
  private editor: LevelEditor;

  private currentPlayerPos: Vector = new Vector(5, 5);
  private selectedCell: Vector | null = null;
  private path: Vector[] = [];
  private mapObjects: Map<string, MapObject> = new Map();
  private gameTime: number = 0;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;

  constructor(canvas: HTMLCanvasElement, canvasWidth: number, canvasHeight: number) {
    this.grid = new Grid(100, 100);
    this.renderer = new Renderer(canvas, canvasWidth, canvasHeight, 32);
    this.mouseHandler = new MouseHandler(canvas);
    this.pathfinder = new AStarPathfinder(this.grid);
    this.fov = new FieldOfView(this.grid);
    this.fogOfWar = new FogOfWar(100, 100, this.fov);
    this.aiSystem = new NPCAISystem(this.grid);
    this.animationLibrary = new AnimationLibrary();
    this.particleSystem = new ParticleSystem();
    this.saveLoadManager = new SaveLoadManager();
    this.quickSaveManager = new QuickSaveManager();
    this.editor = new LevelEditor();

    // Initialize tile registry
    TileRegistry.initialize();

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
    console.log(`Left clicked: ${pos.x}, ${pos.y}`);
    this.selectedCell = pos;

    // Find path to clicked cell
    this.path = this.pathfinder.findPath(this.currentPlayerPos, pos);
    this.render();
  }

  /**
   * Handle right click
   */
  private onRightClick(pos: Vector): void {
    console.log(`Right clicked: ${pos.x}, ${pos.y}`);
    this.currentPlayerPos = pos;
    this.path = [];
    this.render();
  }

  /**
   * Handle mouse move
   */
  private onMouseMove(_pos: Vector): void {
    // Can be used for highlighting cells
  }

  /**
   * Render the game
   */
  private render(): void {
    if (!this.map) return;

    // Render map
    this.renderer.renderMap(this.map);

    // Update FOV from current player position
    const visibleCells = this.fov.calculateFOV(this.currentPlayerPos, 10);

    // Update fog of war
    this.fogOfWar.updateFromFOV(visibleCells);

    // Render fog of war
    this.renderer.renderFogOfWar(this.fogOfWar, this.map.getWidth(), this.map.getHeight());

    // Draw FOV visualization
    this.renderer.drawFOV(visibleCells, this.map.getWidth(), this.map.getHeight());

    // Draw player position
    this.renderer.drawMarker(this.currentPlayerPos.x, this.currentPlayerPos.y, 0x00ff00, 6);

    // Draw selected cell if any
    if (this.selectedCell) {
      this.renderer.drawMarker(this.selectedCell.x, this.selectedCell.y, 0x0000ff, 5);
    }

    // Draw path
    for (const cell of this.path) {
      this.renderer.drawMarker(cell.x, cell.y, 0xffff00, 3);
    }

    // Center camera on player
    this.renderer.getCamera().centerOn(this.currentPlayerPos);
  }

  /**
   * Update game state
   */
  private update(deltaTime: number): void {
    if (!this.isRunning) return;

    this.gameTime += deltaTime;

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

    if (object instanceof NPC || object instanceof Enemy) {
      this.aiSystem.registerNPC(object);
    }
  }

  /**
   * Remove map object
   */
  removeMapObject(objectId: string): void {
    const object = this.mapObjects.get(objectId);
    if (object instanceof NPC || object instanceof Enemy) {
      this.aiSystem.unregisterNPC(objectId);
    }
    this.mapObjects.delete(objectId);
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
   * Get renderer
   */
  getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * Get current player position
   */
  getPlayerPosition(): Vector {
    return this.currentPlayerPos;
  }

  /**
   * Set player position
   */
  setPlayerPosition(pos: Vector): void {
    this.currentPlayerPos = pos;
  }
}

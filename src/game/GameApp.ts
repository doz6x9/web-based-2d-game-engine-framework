import { GameEngine, AssetConfig, IEntity } from '../engine/GameEngine';
import { Vector } from '../engine/core/Vector';
import * as PIXI from 'pixi.js'; // PIXI is needed for sprites

/**
 * Game State - Application-level game logic and state
 * This represents the "Game" layer above the "Framework" layer
 */
class GameState {
  // GameState is now minimal, holding only map configuration
  levelMap: Map<number, { mapUrl: string; spawnPoint: Vector }> = new Map();

  constructor() {
    this.setupLevelMap();
  }

  private setupLevelMap(): void {
    // Default to loading the generic test map
    this.levelMap.set(1, { mapUrl: '/maps/new-test-map.json', spawnPoint: new Vector(1, 1) });
  }
}

/**
 * Main Game Application - Orchestrates game logic using the GameEngine framework
 * This class now serves as a minimal demonstration of engine capabilities.
 */
export class GameApp {
  private engine: GameEngine;
  private gameState: GameState;

  // Player-specific state, now managed by GameApp
  private currentPlayerPos: Vector = new Vector(1, 1);
  private targetPlayerPos: Vector = new Vector(1, 1);
  private playerPixiSprite: PIXI.Sprite | null = null;
  private isPlayerMoving: boolean = false;
  private path: Vector[] = [];
  private currentPathIndex: number = 0;
  private moveProgress: number = 0;
  private playerMoveSpeed: number = 0.005;
  private selectedCell: Vector | null = null;

  // For FOV updates
  private lastFovPos: Vector = new Vector(-1, -1);
  private cachedVisibleCells: Set<string> = new Set();


  constructor() {
    this.engine = new GameEngine();
    this.gameState = new GameState();
    // Game-specific managers are removed for a blank slate
  }

  /**
   * Initialize and start the game
   */
  async start(): Promise<void> {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) {
      console.error('Canvas element not found!');
      return;
    }

    const gameWidth = 1280;
    const gameHeight = 720;

    // Define generic assets needed for the framework demo
    const assets: AssetConfig[] = [
      // Generic Textures (assuming these exist and are generic enough)
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

    try {
      // Initialize the engine framework with generic assets and the test map
      const initialMapUrl = this.gameState.levelMap.get(1)?.mapUrl;
      await this.engine.init(canvas, gameWidth, gameHeight, assets, initialMapUrl);
      console.log('Game initialized successfully.');

      // Create a generic player sprite (red square)
      const playerGraphics = new PIXI.Graphics();
      playerGraphics.rect(0, 0, this.engine.renderer.tileSize, this.engine.renderer.tileSize).fill(0xFF0000); // Red square
      this.playerPixiSprite = new PIXI.Sprite(this.engine.renderer.getApp().renderer.generateTexture(playerGraphics));
      this.engine.renderer.getSpriteContainer().addChild(this.playerPixiSprite);

      // Register player as an entity with the engine
      this.engine.addEntity({
        id: 'player',
        position: this.currentPlayerPos,
        spriteName: 'player_square', // A dummy name, as it's not loaded from assets
        pixiSprite: this.playerPixiSprite,
        isActive: true,
        update: (deltaTime: number) => this.updatePlayerMovement(deltaTime),
        render: () => this.renderPlayer()
      });


      // Setup generic engine event handlers
      this.setupEngineEventHandlers();
      this.setupInputHandlers();

      // No game-specific audio for a blank slate
      // this.engine.audioManager.playBGM('/assets/audio/bgm.mp3', 0.1);

      // No game-specific UI updates for a blank slate
      // this.startUIUpdateLoop();

    } catch (error) {
      console.error('Failed to initialize game:', error);
    }
  }

  /**
   * Setup handlers for generic engine events
   */
  private setupEngineEventHandlers(): void {
    this.engine.on('mapLoaded', (mapData: any) => this.onMapLoaded(mapData));
    this.engine.on('update', (deltaTime: number) => this.onEngineUpdate(deltaTime));
    this.engine.on('beforeRender', () => this.onEngineBeforeRender());
    this.engine.on('afterRender', () => this.onEngineAfterRender());
  }

  /**
   * Handle map loaded event from engine
   */
  private onMapLoaded(mapData: any): void {
    console.log('[GAME] Map loaded event received:', mapData.name);
    // Game logic to create entities from map data (only player spawn for now)
    if (mapData.objects && Array.isArray(mapData.objects)) {
      const spawnPoint = mapData.objects.find((obj: any) => obj.type === "PLAYER_SPAWN");
      if (spawnPoint) {
        this.currentPlayerPos.x = spawnPoint.x;
        this.currentPlayerPos.y = spawnPoint.y;
        this.targetPlayerPos = this.currentPlayerPos.clone();
        this.engine.renderer.getCamera().centerOn(this.currentPlayerPos);
      }
    }
  }

  /**
   * Removed: createGameEntityFromData - no game-specific entities from map data for a blank slate
   */

  /**
   * Game-specific input handling (player movement)
   */
  private setupInputHandlers(): void {
    this.engine.on('gridClick', (x, y, buttonType) => {
      const clickPos = new Vector(x, y);
      this.selectedCell = clickPos;

      if (buttonType === 'left') {
        const newPath = this.engine.pathfinder.findPath(this.currentPlayerPos, clickPos);
        this.path = newPath.length > 0 ? newPath : [];
        this.isPlayerMoving = false; // Reset movement to start new path
      }
      // Right-click interaction logic removed for blank slate
    });
  }

  /**
   * Removed: setupUICallbacks - no game-specific UI for a blank slate
   */

  /**
   * Game-specific update logic, called by the engine's main loop
   */
  private onEngineUpdate(deltaTime: number): void {
    // Player movement logic
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
            // No pending interaction target for blank slate
          }
        } else {
          this.targetPlayerPos.x = startTile.x + (endTile.x - startTile.x) * this.moveProgress;
          this.targetPlayerPos.y = startTile.y + (endTile.y - startTile.y) * this.moveProgress;
        }
      } else {
        this.isPlayerMoving = false;
        this.path = [];
        this.selectedCell = null;
      }
    }

    // No AI system update for blank slate
    // No UI updates for blank slate
  }

  /**
   * Game-specific logic before engine renders
   */
  private onEngineBeforeRender(): void {
    this.engine.renderer.getCamera().centerOn(this.targetPlayerPos);

    // Update FOV based on player position (player is the only light source)
    if (!this.currentPlayerPos.equals(this.lastFovPos)) {
      const lightSources: { pos: Vector, radius: number }[] = [];
      lightSources.push({ pos: this.currentPlayerPos, radius: 10 }); // Player is a light source

      const combinedFOV = new Set<string>();
      for (const source of lightSources) {
        const sourceFOV = this.engine.fov.calculateFOV(source.pos, source.radius);
        sourceFOV.forEach(cell => combinedFOV.add(cell));
      }

      this.cachedVisibleCells = combinedFOV;
      this.engine.fogOfWar.updateFromFOV(this.cachedVisibleCells);
      this.lastFovPos = this.currentPlayerPos.clone();
    }
  }

  /**
   * Game-specific logic after engine renders
   */
  private onEngineAfterRender(): void {
    // Render game-specific markers (path, selected cell)
    this.engine.renderer.clearMarkers();
    if (this.selectedCell) this.engine.renderer.drawMarker(this.selectedCell.x, this.selectedCell.y, 0x0000ff, 5);
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
      this.engine.renderer.drawMarker(cell.x, cell.y, (r << 16) | (g << 8) | b, 3);
    }
  }

  /**
   * Render player sprite (called by player entity's render method)
   */
  private renderPlayer(): void {
    if (this.playerPixiSprite) {
      this.engine.renderer.updateSpritePosition(this.playerPixiSprite, this.targetPlayerPos.x, this.targetPlayerPos.y);
      this.playerPixiSprite.visible = this.engine.fogOfWar.isExplored(this.currentPlayerPos.x, this.currentPlayerPos.y);
    }
  }

  /**
   * Update player movement (called by player entity's update method)
   */
  private updatePlayerMovement(deltaTime: number): void {
    // Player movement logic is handled in onEngineUpdate
  }



  getEngine(): GameEngine {
    return this.engine;
  }
}

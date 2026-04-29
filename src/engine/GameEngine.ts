import { Vector } from './core/Vector';
import { Grid, CellType } from './core/Grid';
import { GameMap, MapLoader } from './map/MapLayer';
import { AStarPathfinder } from './algorithms/AStar';
import { FieldOfView } from './algorithms/FieldOfView';
import { FogOfWar } from './algorithms/FogOfWar';
import { FloodFill } from './algorithms/FloodFill';
import { TileRegistry } from './core/TileRegistry';
import { Renderer } from './render/Renderer';
import { MouseHandler, MouseEventType } from './interaction/MouseHandler';
import { KeyboardHandler } from './interaction/KeyboardHandler';
import { AnimationLibrary } from './render/Animation';
import { ParticleSystem } from './render/Particles';
import * as PIXI from 'pixi.js';


/**
 * Interface for any entity managed by the engine.
 * The engine only cares about position, updating, and rendering.
 */
export interface IEntity {
  id: string;
  position: Vector;
  spriteName?: string;
  pixiSprite?: PIXI.Sprite | null;
  isActive: boolean;
  update(deltaTime: number): void;
  render?(renderer: Renderer): void;
  onInteract?(): void; // Generic interaction hook for game logic
}

/**
 * Asset configuration for engine initialization
 */
export interface AssetConfig {
  id: string;
  path: string;
}

/**
 * Simple event emitter for framework events
 */
export class EventEmitter {
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    const index = callbacks.indexOf(callback);
    if (index !== -1) callbacks.splice(index, 1);
  }

  emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    callbacks.forEach(cb => cb(...args));
  }
}

/**
 * Core Game Engine - Framework-level implementation
 * Handles rendering, core subsystems, and decoupled input events.
 * Game-specific logic is entirely delegated to the consuming application.
 */
export class GameEngine extends EventEmitter {
  public map: GameMap | null = null;
  public grid: Grid;
  public renderer: Renderer;
  public mouseHandler!: MouseHandler;
  public keyboardHandler: KeyboardHandler;
  public pathfinder: AStarPathfinder;
  public fov: FieldOfView;
  public fogOfWar!: FogOfWar; // Fog of War is a core rendering/visibility component
  public floodFill: FloodFill;
  public animationLibrary: AnimationLibrary;
  public particleSystem: ParticleSystem;

  private entities: Map<string, IEntity> = new Map();
  private gameTime: number = 0;
  public isRunning: boolean = false; // Made public for game to control
  private boundGameLoop = this.pixiGameLoop.bind(this);

  constructor() {
    super();
    this.grid = new Grid(100, 100);
    this.renderer = new Renderer(32);
    this.keyboardHandler = new KeyboardHandler();
    this.pathfinder = new AStarPathfinder(this.grid);
    this.fov = new FieldOfView(this.grid);
    this.floodFill = new FloodFill(this.grid);
    this.animationLibrary = new AnimationLibrary();
    this.particleSystem = new ParticleSystem();

    TileRegistry.initialize();
  }

  /**
   * Initialize the game engine framework
   */
  async init(
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number,
    assetsToLoad: AssetConfig[],
    initialMapUrl?: string
  ): Promise<void> {
    // Initialize renderer
    await this.renderer.init(canvas, canvasWidth, canvasHeight, this.grid.getWidth(), this.grid.getHeight());

    // Initialize handlers
    this.mouseHandler = new MouseHandler(canvas, this.renderer.getCamera(), this.renderer.tileSize);
    this.fogOfWar = new FogOfWar(this.grid.getWidth(), this.grid.getHeight(), this.fov); // FogOfWar is engine-level

    // Load provided assets
    try {
      await this.renderer.loadAssets(assetsToLoad);
      console.log(`Framework: Loaded ${assetsToLoad.length} assets successfully.`);
    } catch (error) {
      console.error('Framework: Failed to load assets:', error);
      throw error;
    }

    // Load initial map if provided
    if (initialMapUrl) {
      try {
        await this.loadMap(initialMapUrl);
        console.log('Framework: Initial map loaded successfully.');
      } catch (error) {
        console.error('Framework: Failed to load initial map:', error);
        throw error;
      }
    }

    // Setup generic event handlers for decoupled input
    this.setupInputHandlers();

    // Start the game loop
    this.startGameLoop();
  }

  /**
   * Clear the engine state (map, entities, fog)
   */
  public clear(): void {
    const entityIds = Array.from(this.entities.keys());
    for (const id of entityIds) {
      this.removeEntity(id);
    }
    this.fogOfWar = new FogOfWar(this.grid.getWidth(), this.grid.getHeight(), this.fov); // Reset FogOfWar
    this.renderer.clearMapCache();
    this.map = null;
    this.entities.clear(); // Ensure entities are cleared
  }

  /**
   * Load a map from a JSON file URL
   */
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

    this.fogOfWar = new FogOfWar(this.map.getWidth(), this.map.getHeight(), this.fov);
    this.renderer.getCamera().mapWidth = this.map.getWidth();
    this.renderer.getCamera().mapHeight = this.map.getHeight();

    // Engine exposes an event so the game can spawn logic entities from mapData
    this.emit('mapLoaded', mapData);
  }

  /**
   * Setup input handlers to emit decoupled engine events
   */
  private setupInputHandlers(): void {
    this.mouseHandler.on(MouseEventType.LEFT_CLICK, (pos: Vector) => {
      this.emit('gridClick', pos.x, pos.y, 'left');
    });

    this.mouseHandler.on(MouseEventType.RIGHT_CLICK, (pos: Vector) => {
      this.emit('gridClick', pos.x, pos.y, 'right');
    });

    this.mouseHandler.on(MouseEventType.MOVE, (pos: Vector) => {
      this.renderer.updateMouseHUD(pos.x, pos.y);
      this.emit('gridHover', pos.x, pos.y);
    });
  }

  /**
   * The core generic update loop
   */
  private update(deltaTime: number): void {
    if (!this.isRunning) return;
    this.gameTime += deltaTime;

    this.particleSystem.update(deltaTime);

    // Update all registered entities
    for (const entity of this.entities.values()) {
      if (entity.isActive) {
        entity.update(deltaTime);
      }
    }

    // Give consuming game a chance to update systems
    this.emit('update', deltaTime);

    this.render();
  }

  private render(): void {
    if (!this.map) return;

    // Give game a chance to position camera before render
    this.emit('beforeRender');

    this.renderer.applyCameraTransform();
    this.renderer.renderMap(this.map);

    // Handle Fog of War (game logic needs to update FOV separately via fov module)
    this.renderer.renderFogOfWar(this.fogOfWar, this.map.getWidth(), this.map.getHeight());

    const cameraPos = this.renderer.getCamera().getPosition();
    const cameraWidth = this.renderer.getCamera().width / this.renderer.tileSize;
    const cameraHeight = this.renderer.getCamera().height / this.renderer.tileSize;

    // Render generic entities
    for (const entity of this.entities.values()) {
      if (entity.pixiSprite && entity.isActive) {
        // Simple culling
        const inCameraBounds =
          entity.position.x >= cameraPos.x - 2 &&
          entity.position.x <= cameraPos.x + cameraWidth + 2 &&
          entity.position.y >= cameraPos.y - 2 &&
          entity.position.y <= cameraPos.y + cameraHeight + 2;

        if (!inCameraBounds) {
            entity.pixiSprite.visible = false;
            continue;
        }

        this.renderer.updateSpritePosition(entity.pixiSprite, entity.position.x, entity.position.y);
        // Entity visibility based on Fog of War is handled by the game layer
        // entity.pixiSprite.visible = this.fogOfWar.isExplored(entity.position.x, entity.position.y);
      }

      if (entity.render) {
        entity.render(this.renderer);
      }
    }

    this.renderer.renderParticles(this.particleSystem.getAllParticles());

    this.emit('afterRender', this.renderer);
  }

  private pixiGameLoop(): void {
    if (!this.isRunning) return;
    this.update(this.renderer.getApp().ticker.deltaMS);
  }

  public startGameLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.renderer.getApp().ticker.add(this.boundGameLoop);
  }

  public stopGameLoop(): void {
    this.isRunning = false;
    this.renderer.getApp().ticker.remove(this.boundGameLoop);
  }

  /**
   * Entity Management
   */
  public addEntity(entity: IEntity): void {
    this.entities.set(entity.id, entity);
    if (entity.spriteName && !entity.pixiSprite) { // Only create sprite if not already provided
      const texture = this.renderer.getTexture(entity.spriteName);
      if (texture) {
        entity.pixiSprite = new PIXI.Sprite(texture);
        entity.pixiSprite.width = this.renderer.tileSize;
        entity.pixiSprite.height = this.renderer.tileSize;
        this.renderer.getSpriteContainer().addChild(entity.pixiSprite);
      }
    }
  }

  public removeEntity(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      if (entity.pixiSprite) {
        this.renderer.getSpriteContainer().removeChild(entity.pixiSprite);
        entity.pixiSprite.destroy();
        entity.pixiSprite = null;
      }
      this.entities.delete(entityId);
    }
  }

  public getEntity(entityId: string): IEntity | undefined {
    return this.entities.get(entityId);
  }

  public getAllEntities(): IEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Clear the renderer's map cache (useful for level transitions)
   */
  public clearMapCache(): void {
    this.renderer.clearMapCache();
  }
}

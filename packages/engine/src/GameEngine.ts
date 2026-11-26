import { Vector } from './core/Vector';
import { Grid, CellType } from './core/Grid';
import { GameMap, MapLoader, type MapJSON, type MapLayerNames } from './map/MapLayer';
import { AStarPathfinder } from './algorithms/AStar';
import { FieldOfView } from './algorithms/FieldOfView';
import { FogOfWar } from './algorithms/FogOfWar';
import { FloodFill } from './algorithms/FloodFill';
import { Renderer } from './render/Renderer';
import { MouseHandler, MouseEventType } from './interaction/MouseHandler';
import { KeyboardHandler } from './interaction/KeyboardHandler';
import { AnimationLibrary } from './render/Animation';
import { ParticleSystem } from './render/Particles';
import { LightingSystem } from './systems/LightingSystem';
import * as PIXI from 'pixi.js';

export interface EngineLifecycleOptions {
  autoStart?: boolean;
  /** Draw the clicked cell's coordinates on the canvas (left and right clicks are coloured differently). */
  showMouseCoordinates?: boolean;
  /**
   * Fit the view to each map as it loads: pick the largest whole-number zoom
   * that still shows the whole map, and centre maps smaller than the view.
   * Defaults to true.
   */
  fitMapToView?: boolean;
  /**
   * Shrink the canvas to the map's size (after zoom) when the map is smaller
   * than the canvas size given to init, so there are no empty borders.
   * Defaults to false.
   */
  fitCanvasToMap?: boolean;
  /**
   * Which layers are the ground and collision layers when a map doesn't say so
   * itself (with a layer `role` or the map's `groundLayer` / `collisionLayer`).
   * Defaults to "terrain" and "collision".
   */
  layerNames?: MapLayerNames;
}

export interface EngineInitOptions extends EngineLifecycleOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  assets?: AssetConfig[];
  initialMapUrl?: string;
}

export interface EngineEventMap {
  mapLoaded: [mapData: MapJSON];
  /** The canvas or camera view changed size (e.g. fitted to a new map). */
  viewResized: [width: number, height: number];
  gridClick: [x: number, y: number, button: 'left' | 'right'];
  gridHover: [x: number, y: number];
  update: [deltaTime: number];
  beforeRender: [];
  afterRender: [renderer: Renderer];
}

export type EventCallback<Args extends unknown[] = unknown[]> = (...args: Args) => void;

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
  /**
   * 'image' (default) registers one texture under `id`.
   * 'spritesheet' loads a PixiJS spritesheet JSON and registers every frame
   * under its frame name, so one request and one GPU texture serve many sprites.
   */
  type?: 'image' | 'spritesheet';
}

/**
 * Simple event emitter for framework events
 */
export class EventEmitter<TEvents extends { [K in keyof TEvents]: unknown[] } = Record<string, unknown[]>> {
  private listeners: Map<keyof TEvents & string, Array<EventCallback<any[]>>> = new Map();

  on<K extends keyof TEvents & string>(event: K, callback: EventCallback<TEvents[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback as EventCallback<any[]>);
  }

  off<K extends keyof TEvents & string>(event: K, callback: EventCallback<TEvents[K]>): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    const index = callbacks.indexOf(callback as EventCallback<any[]>);
    if (index !== -1) callbacks.splice(index, 1);
  }

  emit<K extends keyof TEvents & string>(event: K, ...args: TEvents[K]): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    callbacks.forEach(cb => cb(...args));
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

/**
 * Core Game Engine - Framework-level implementation
 * Handles rendering, core subsystems, and decoupled input events.
 * Game-specific logic is entirely delegated to the consuming application.
 */
export class GameEngine extends EventEmitter<EngineEventMap> {
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
  /** Combines light sources into the visible set used by Fog of War. */
  public lighting: LightingSystem;

  private entities: Map<string, IEntity> = new Map();
  private spawnPoint: Vector | null = null;
  private gameTime: number = 0;
  public isRunning: boolean = false; // Made public for game to control
  private boundGameLoop = this.pixiGameLoop.bind(this);
  private lifecycleOptions: Required<EngineLifecycleOptions> = {
    autoStart: true,
    showMouseCoordinates: false,
    fitMapToView: true,
    fitCanvasToMap: false,
    layerNames: {},
  };
  /** Canvas size passed to init; the upper bound when fitting the canvas to a map. */
  private maxCanvasSize = { width: 0, height: 0 };

  constructor(options: EngineLifecycleOptions = {}) {
    super();
    this.lifecycleOptions = this.resolveLifecycleOptions(options);
    this.grid = new Grid(100, 100);
    this.renderer = new Renderer(32);
    this.keyboardHandler = new KeyboardHandler();
    this.pathfinder = new AStarPathfinder(this.grid);
    this.fov = new FieldOfView(this.grid);
    this.floodFill = new FloodFill(this.grid);
    this.animationLibrary = new AnimationLibrary();
    this.particleSystem = new ParticleSystem();
    this.lighting = new LightingSystem(this.fov);
  }

  /**
   * Initialize the game engine framework
   */
  async init(
    canvas: HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number,
    assetsToLoad: AssetConfig[],
    initialMapUrl?: string,
    options: EngineLifecycleOptions = {}
  ): Promise<void> {
    this.lifecycleOptions = this.resolveLifecycleOptions(options);
    // Initialize renderer
    await this.renderer.init(canvas, canvasWidth, canvasHeight, this.grid.getWidth(), this.grid.getHeight());
    this.maxCanvasSize = { width: canvasWidth, height: canvasHeight };

    // Initialize handlers
    // Click coordinates are drawn on the canvas by the renderer, not by a DOM overlay.
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
    if (this.lifecycleOptions.autoStart) {
      this.startGameLoop();
    }
  }

  async initWithOptions(options: EngineInitOptions): Promise<void> {
    await this.init(
      options.canvas,
      options.width,
      options.height,
      options.assets ?? [],
      options.initialMapUrl,
      options
    );
  }

  private resolveLifecycleOptions(options: EngineLifecycleOptions = {}): Required<EngineLifecycleOptions> {
    return {
      autoStart: options.autoStart ?? this.lifecycleOptions.autoStart,
      showMouseCoordinates: options.showMouseCoordinates ?? this.lifecycleOptions.showMouseCoordinates,
      fitMapToView: options.fitMapToView ?? this.lifecycleOptions.fitMapToView,
      fitCanvasToMap: options.fitCanvasToMap ?? this.lifecycleOptions.fitCanvasToMap,
      layerNames: options.layerNames ?? this.lifecycleOptions.layerNames,
    };
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
    this.lighting.clear();
    this.map = null;
    this.entities.clear(); // Ensure entities are cleared
  }

  /**
   * Load a map from a JSON file URL
   */
  async loadMap(mapUrl: string): Promise<void> {
    const response = await fetch(mapUrl);
    const mapData = await response.json();
    this.loadMapData(mapData);
  }

  /**
   * Load a map from already parsed JSON data.
   */
  loadMapData(mapData: MapJSON): void {
    this.map = MapLoader.parseMapJSON(mapData, this.lifecycleOptions.layerNames);
    // Match the grid to the map so nothing (paths, FOV, flood fill) runs off its edge
    // and no cells are left over from a previous, larger map.
    this.grid.resize(this.map.getWidth(), this.map.getHeight());

    // The ground layer sets each cell's tile; a non-zero collision value overrides it.
    const ground = this.map.getGroundLayer()?.getData();
    const collision = this.map.getCollisionLayer()?.getData();
    if (ground) {
      for (let y = 0; y < ground.length; y++) {
        for (let x = 0; x < ground[y].length; x++) {
          const blocked = collision?.[y]?.[x] ?? 0;
          this.grid.setCellType(x, y, (blocked !== 0 ? blocked : ground[y][x]) as CellType);
        }
      }
    }

    this.fogOfWar = new FogOfWar(this.map.getWidth(), this.map.getHeight(), this.fov);
    this.lighting.markDirty();
    this.spawnPoint = this.resolveSpawnPoint(mapData);
    this.fitViewToMap();

    // Engine exposes an event so the game can spawn logic entities from mapData
    this.emit('mapLoaded', mapData);
  }

  /**
   * Where the player should start on the current map: the PLAYER_SPAWN object
   * if it is on a walkable cell, otherwise the nearest walkable cell to it
   * (or to the map origin when the map has no spawn). Null before a map loads.
   */
  public getSpawnPoint(): Vector | null {
    return this.spawnPoint ? this.spawnPoint.clone() : null;
  }

  private resolveSpawnPoint(mapData: MapJSON): Vector | null {
    if (!this.map) return null;
    const objects = (mapData.objects ?? []) as Array<{ type?: unknown; x?: unknown; y?: unknown }>;
    const spawn = objects.find((o) => o && o.type === 'PLAYER_SPAWN' && typeof o.x === 'number' && typeof o.y === 'number');
    const preferred = spawn ? new Vector(spawn.x as number, spawn.y as number) : new Vector(0, 0);

    const width = this.map.getWidth();
    const height = this.map.getHeight();
    const x0 = Math.min(Math.max(0, preferred.x), width - 1);
    const y0 = Math.min(Math.max(0, preferred.y), height - 1);

    // Search outward ring by ring for the closest walkable cell.
    const maxRadius = Math.max(width, height);
    for (let r = 0; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const cell = this.grid.getCell(x0 + dx, y0 + dy);
          if (cell && cell.walkable) return new Vector(x0 + dx, y0 + dy);
        }
      }
    }
    return null;
  }

  /**
   * Size the view for the current map: zoom, centring and (optionally) the
   * canvas size. Called automatically when a map loads.
   */
  public fitViewToMap(): void {
    if (!this.map) return;
    const camera = this.renderer.getCamera();
    camera.mapWidth = this.map.getWidth();
    camera.mapHeight = this.map.getHeight();

    if (this.lifecycleOptions.fitCanvasToMap && this.maxCanvasSize.width > 0) {
      // Start from the full canvas so zoom is chosen against the largest space.
      this.renderer.resize(this.maxCanvasSize.width, this.maxCanvasSize.height);
    }
    camera.zoom = 1;
    if (this.lifecycleOptions.fitMapToView) camera.fitZoomToMap();

    if (this.lifecycleOptions.fitCanvasToMap && this.maxCanvasSize.width > 0) {
      const tile = camera.getScaledTileSize();
      this.renderer.resize(
        Math.min(this.maxCanvasSize.width, this.map.getWidth() * tile),
        Math.min(this.maxCanvasSize.height, this.map.getHeight() * tile)
      );
    }
    camera.centerOn(camera.getPosition());
    this.emit('viewResized', camera.width, camera.height);
  }

  /**
   * Reveal the room that contains `start` (every walkable cell reachable from it
   * without crossing a wall or closed door), plus the walls around it, by marking
   * it explored in Fog of War.
   * Call it when a door opens, passing the cell just beyond the door.
   * Returns the revealed cells.
   */
  public revealRoom(start: Vector, maxCells: number = 400, includeWalls: boolean = true): Set<string> {
    const cells = this.floodFill.fillRoom(start, maxCells);
    if (includeWalls) {
      // Also reveal the walls around the room so its outline shows, not just the floor.
      for (const key of Array.from(cells)) {
        const [x, y] = key.split(',').map(Number);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cell = this.grid.getCell(x + dx, y + dy);
            if (cell && !cell.walkable) cells.add(`${x + dx},${y + dy}`);
          }
        }
      }
    }
    this.fogOfWar?.markMultipleExplored(cells);
    this.lighting.markDirty();
    return cells;
  }

  /**
   * Setup input handlers to emit decoupled engine events
   */
  private setupInputHandlers(): void {
    this.mouseHandler.on(MouseEventType.LEFT_CLICK, (pos: Vector) => {
      if (this.lifecycleOptions.showMouseCoordinates) this.renderer.showClickCoordinates(pos.x, pos.y, 'left');
      this.emit('gridClick', pos.x, pos.y, 'left');
    });

    this.mouseHandler.on(MouseEventType.RIGHT_CLICK, (pos: Vector) => {
      if (this.lifecycleOptions.showMouseCoordinates) this.renderer.showClickCoordinates(pos.x, pos.y, 'right');
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

    // Lights registered on engine.lighting update Fog of War automatically.
    // Games that drive the fov module themselves can leave lighting empty.
    if (this.lighting.getLights().length > 0) {
      this.lighting.update(this.fogOfWar);
    }
    this.renderer.renderFogOfWar(this.fogOfWar, this.map.getWidth(), this.map.getHeight());

    const cameraPos = this.renderer.getCamera().getPosition();
    const cameraWidth = this.renderer.getCamera().getViewWidthInTiles();
    const cameraHeight = this.renderer.getCamera().getViewHeightInTiles();

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

  public destroy(): void {
    this.stopGameLoop();
    this.clear();
    this.mouseHandler?.destroy();
    this.keyboardHandler.destroy();
    this.particleSystem.clear();
    this.removeAllListeners();
    this.renderer.getApp().destroy(true, { children: true });
  }
}

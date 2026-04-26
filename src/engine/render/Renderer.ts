import * as PIXI from 'pixi.js';
import { Vector } from '../core/Vector';
import { GameMap, MapLayer } from '../map/MapLayer';
import { FogOfWar, FogState } from '../algorithms/FogOfWar';

/**
 * Camera for view management
 */
export class Camera {
  private position: Vector;
  private width: number;
  private height: number;
  private mapWidth: number;
  private mapHeight: number;
  private tileSize: number;

  constructor(
    width: number,
    height: number,
    mapWidth: number,
    mapHeight: number,
    tileSize: number
  ) {
    this.position = new Vector(0, 0);
    this.width = width;
    this.height = height;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.tileSize = tileSize;
  }

  /**
   * Center camera on a target
   */
  centerOn(target: Vector): void {
    let x = target.x - Math.floor((this.width / this.tileSize) / 2);
    let y = target.y - Math.floor((this.height / this.tileSize) / 2);

    // Clamp to map bounds
    x = Math.max(0, Math.min(x, this.mapWidth - this.width / this.tileSize));
    y = Math.max(0, Math.min(y, this.mapHeight - this.height / this.tileSize));

    this.position = new Vector(x, y);
  }

  /**
   * Get camera position
   */
  getPosition(): Vector {
    return this.position;
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): Vector {
    const gridX = Math.floor(this.position.x + screenX / this.tileSize);
    const gridY = Math.floor(this.position.y + screenY / this.tileSize);
    return new Vector(gridX, gridY);
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): Vector {
    const screenX = (worldX - this.position.x) * this.tileSize;
    const screenY = (worldY - this.position.y) * this.tileSize;
    return new Vector(screenX, screenY);
  }
}

/**
 * PixiJS-based renderer for the game
 */
export class Renderer {
  private app: PIXI.Application;
  private stage!: PIXI.Container; // Initialized in init()
  private camera!: Camera; // Initialized in init()
  private tileSize: number;
  private layers: Map<string, PIXI.Container> = new Map();
  private tileColors: Map<number, number> = new Map();
  private textures: Map<string, PIXI.Texture> = new Map();

  // Dedicated containers for dynamic elements
  private fogContainer!: PIXI.Container; // Initialized in init()
  private fovContainer!: PIXI.Container; // Initialized in init()
  private markerContainer!: PIXI.Container; // Initialized in init()
  private spriteContainer!: PIXI.Container; // Initialized in init()

  // Reusable Graphics objects for transient drawing
  private fogGraphics!: PIXI.Graphics;
  private fovGraphics!: PIXI.Graphics;
  private markerGraphics!: PIXI.Graphics;

  constructor(tileSize: number = 32) {
    this.tileSize = tileSize;
    this.app = new PIXI.Application();
  }

  /**
   * Asynchronously initializes the PixiJS application and renderer components.
   */
  async init(canvas: HTMLCanvasElement, width: number, height: number, mapWidth: number, mapHeight: number): Promise<void> {
    await this.app.init({ canvas, width, height });

    this.stage = this.app.stage;
    this.camera = new Camera(width, height, mapWidth, mapHeight, this.tileSize);

    // Initialize dedicated containers
    this.fogContainer = new PIXI.Container();
    this.fovContainer = new PIXI.Container();
    this.markerContainer = new PIXI.Container();
    this.spriteContainer = new PIXI.Container();

    // Initialize reusable Graphics objects and add them to their containers
    this.fogGraphics = new PIXI.Graphics();
    this.fogContainer.addChild(this.fogGraphics);

    this.fovGraphics = new PIXI.Graphics();
    this.fovContainer.addChild(this.fovGraphics);

    this.markerGraphics = new PIXI.Graphics();
    this.markerContainer.addChild(this.markerGraphics);

    // Add containers to stage in desired z-order
    this.stage.addChild(this.fogContainer);
    this.stage.addChild(this.fovContainer);
    this.stage.addChild(this.spriteContainer);
    this.stage.addChild(this.markerContainer);

    // Initialize tile colors
    this.initializeTileColors();
  }

  /**
   * Initialize tile color palette
   */
  private initializeTileColors(): void {
    this.tileColors.set(0, 0x2d5016); // Empty/Grass
    this.tileColors.set(1, 0x1a1a1a); // Wall
    this.tileColors.set(2, 0x4a7c2c); // Grass
    this.tileColors.set(3, 0x6b4423); // Swamp
    this.tileColors.set(4, 0xc4a747); // Road
    this.tileColors.set(5, 0x2980b9); // Water
  }

  /**
   * Set tile color
   */
  setTileColor(tileType: number, color: number): void {
    this.tileColors.set(tileType, color);
  }

  /**
   * Load assets (images, spritesheets, etc.)
   */
  async loadAssets(assets: { id: string; path: string }[]): Promise<void> {
    console.log('Renderer: Starting asset loading...');
    for (const asset of assets) {
      try {
        await PIXI.Assets.load(asset.path);
        const texture = PIXI.Texture.from(asset.path);
        this.textures.set(asset.id, texture);
        console.log(`Renderer: Loaded asset: ${asset.id} from ${asset.path}`);
      } catch (error) {
        console.error(`Renderer: Failed to load asset: ${asset.id} from ${asset.path}`, error);
        throw error; // Re-throw to propagate the error
      }
    }
    console.log('Renderer: All assets processed.');
  }

  /**
   * Get a loaded texture by its ID.
   */
  getTexture(spriteId: string): PIXI.Texture | undefined {
    return this.textures.get(spriteId);
  }

  /**
   * Render a map with multiple layers
   */
  renderMap(map: GameMap): void {
    // Only draw map layers if they haven't been drawn yet or map has changed
    // This prevents redrawing static map tiles every frame
    if (this.layers.size === 0 || this.layers.get('layer-0')?.children.length === 0) {
      // Clear existing layers (excluding fog, fov, markers, sprites containers)
      this.stage.removeChildren();
      this.layers.clear();

      const layers = map.getLayers();

      // Render each layer bottom-up
      for (let i = 0; i < layers.length; i++) {
        const layerContainer = new PIXI.Container();
        // Insert map layers below dynamic containers
        this.stage.addChildAt(layerContainer, i);
        this.layers.set(`layer-${i}`, layerContainer);

        this.renderLayer(layerContainer, layers[i]);
      }

      // Re-add dynamic containers to maintain z-order after map layers
      this.stage.addChild(this.fogContainer);
      this.stage.addChild(this.fovContainer);
      this.stage.addChild(this.spriteContainer);
      this.stage.addChild(this.markerContainer);
    }
  }

  /**
   * Render a single layer (called only once per layer when map loads)
   */
  private renderLayer(
    container: PIXI.Container,
    layer: MapLayer,
  ): void {
    // Clear previous layer content only if it was drawn before
    container.removeChildren();

    const data = layer.getData();

    for (let y = 0; y < data.length; y++) {
      for (let x = 0; x < data[y].length; x++) {
        const tileType = data[y][x];
        const color = this.tileColors.get(tileType) || 0x808080;

        const rect = new PIXI.Graphics();
        rect.rect(0, 0, this.tileSize, this.tileSize).fill(color);

        // Draw border
        rect.stroke({ width: 1, color: 0x000000, alpha: 0.2 });

        rect.x = x * this.tileSize;
        rect.y = y * this.tileSize;

        container.addChild(rect);
      }
    }
    console.log('Renderer: renderLayer called for ' + layer.getName());
  }

  /**
   * Render fog of war overlay
   */
  renderFogOfWar(
    fogOfWar: FogOfWar,
    mapWidth: number,
    mapHeight: number
  ): void {
    this.fogGraphics.clear(); // Clear previous drawing

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const fogState = fogOfWar.getFogState(x, y);

        if (fogState === FogState.UNKNOWN) {
          // Dark fog (unexplored)
          this.fogGraphics.rect(
            x * this.tileSize,
            y * this.tileSize,
            this.tileSize,
            this.tileSize
          ).fill({ color: 0x000000, alpha: 0.8 });
        } else if (fogState === FogState.EXPLORED) {
          // Light fog (explored but not visible)
          this.fogGraphics.rect(
            x * this.tileSize,
            y * this.tileSize,
            this.tileSize,
            this.tileSize
          ).fill({ color: 0x000000, alpha: 0.5 });
        }
      }
    }
  }

  /**
   * Draw FOV visualization
   */
  drawFOV(visibleCells: Set<string>, mapWidth: number, mapHeight: number): void {
    this.fovGraphics.clear(); // Clear previous drawing

    for (const cellKey of visibleCells) {
      const [x, y] = cellKey.split(',').map(Number);
      if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
        this.fovGraphics.rect(
          x * this.tileSize,
          y * this.tileSize,
          this.tileSize,
          this.tileSize
        ).stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
      }
    }
  }

  /**
   * Draw a marker at grid coordinates
   * This now draws into the reusable markerGraphics object.
   */
  drawMarker(x: number, y: number, color: number = 0xff0000, size: number = 8): void {
    // Note: markerGraphics is cleared once per frame in clearMarkers,
    // so this method just adds to it.
    this.markerGraphics.circle(
      x * this.tileSize + this.tileSize / 2, // Center X
      y * this.tileSize + this.tileSize / 2, // Center Y
      size
    ).fill(color);
  }

  /**
   * Clear all markers from the marker container
   * This now clears the reusable markerGraphics object.
   */
  clearMarkers(): void {
    this.markerGraphics.clear();
  }

  /**
   * This method is now responsible for updating an EXISTING sprite's position.
   * It no longer creates new sprites.
   * GameEngine will manage creating and adding sprites to spriteContainer.
   */
  updateSpritePosition(sprite: PIXI.Sprite, x: number, y: number): void {
    sprite.x = x * this.tileSize;
    sprite.y = y * this.tileSize;
  }

  /**
   * Get the sprite container for GameEngine to manage sprites.
   */
  getSpriteContainer(): PIXI.Container {
    return this.spriteContainer;
  }

  /**
   * Get camera
   */
  getCamera(): Camera {
    return this.camera;
  }

  /**
   * Get PixiJS app
   */
  getApp(): PIXI.Application {
    return this.app;
  }

  /**
   * Resize renderer
   */
  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    // Re-initialize camera with new dimensions and map dimensions
    this.camera = new Camera(
      width,
      height,
      this.camera.mapWidth, // Keep existing map dimensions
      this.camera.mapHeight, // Keep existing map dimensions
      this.tileSize
    );
  }
}
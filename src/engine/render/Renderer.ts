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
  private stage: PIXI.Container;
  private camera: Camera;
  private tileSize: number;
  private layers: Map<string, PIXI.Container> = new Map();
  private tileColors: Map<number, number> = new Map();
  private fogOverlay: PIXI.Graphics | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    tileSize: number = 32
  ) {
    this.tileSize = tileSize;
    this.app = new PIXI.Application({ canvas, width, height });
    this.stage = this.app.stage;

    this.camera = new Camera(width, height, 100, 100, tileSize);

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
   * Render a map with multiple layers
   */
  renderMap(map: GameMap): void {
    // Clear existing layers
    this.stage.removeChildren();
    this.layers.clear();

    const layers = map.getLayers();

    // Render each layer bottom-up
    for (let i = 0; i < layers.length; i++) {
      const layerContainer = new PIXI.Container();
      this.stage.addChild(layerContainer);
      this.layers.set(`layer-${i}`, layerContainer);

      this.renderLayer(layerContainer, layers[i], i === 0);
    }
  }

  /**
   * Render a single layer
   */
  private renderLayer(
    container: PIXI.Container,
    layer: MapLayer,
    _isCollisionLayer: boolean = false
  ): void {
    const data = layer.getData();

    for (let y = 0; y < data.length; y++) {
      for (let x = 0; x < data[y].length; x++) {
        const tileType = data[y][x];
        const color = this.tileColors.get(tileType) || 0x808080;

        const rect = new PIXI.Graphics();
        rect.beginFill(color);
        rect.drawRect(0, 0, this.tileSize, this.tileSize);
        rect.endFill();

        // Draw border
        rect.lineStyle(1, 0x000000, 0.2);
        rect.drawRect(0, 0, this.tileSize, this.tileSize);

        rect.x = x * this.tileSize;
        rect.y = y * this.tileSize;

        container.addChild(rect);
      }
    }
  }

  /**
   * Render fog of war overlay
   */
  renderFogOfWar(
    fogOfWar: FogOfWar,
    mapWidth: number,
    mapHeight: number
  ): void {
    if (this.fogOverlay) {
      this.stage.removeChild(this.fogOverlay);
    }

    this.fogOverlay = new PIXI.Graphics();

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const fogState = fogOfWar.getFogState(x, y);

        if (fogState === FogState.UNKNOWN) {
          // Dark fog (unexplored)
          this.fogOverlay.beginFill(0x000000, 0.8);
          this.fogOverlay.drawRect(
            x * this.tileSize,
            y * this.tileSize,
            this.tileSize,
            this.tileSize
          );
          this.fogOverlay.endFill();
        } else if (fogState === FogState.EXPLORED) {
          // Light fog (explored but not visible)
          this.fogOverlay.beginFill(0x000000, 0.5);
          this.fogOverlay.drawRect(
            x * this.tileSize,
            y * this.tileSize,
            this.tileSize,
            this.tileSize
          );
          this.fogOverlay.endFill();
        }
      }
    }

    this.stage.addChild(this.fogOverlay);
  }

  /**
   * Draw FOV visualization
   */
  drawFOV(visibleCells: Set<string>, mapWidth: number, mapHeight: number): void {
    const fovGraphics = new PIXI.Graphics();

    for (const cellKey of visibleCells) {
      const [x, y] = cellKey.split(',').map(Number);
      if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
        fovGraphics.lineStyle(2, 0xff0000, 0.5);
        fovGraphics.drawRect(
          x * this.tileSize,
          y * this.tileSize,
          this.tileSize,
          this.tileSize
        );
      }
    }

    // Remove previous FOV overlay if exists
    const existingFOV = this.stage.children.find(
      (child) => child.name === 'fov-overlay'
    );
    if (existingFOV) {
      this.stage.removeChild(existingFOV);
    }

    fovGraphics.name = 'fov-overlay';
    this.stage.addChild(fovGraphics);
  }

  /**
   * Draw a marker at grid coordinates
   */
  drawMarker(x: number, y: number, color: number = 0xff0000, size: number = 8): void {
    const circle = new PIXI.Graphics();
    circle.beginFill(color);
    circle.drawCircle(0, 0, size);
    circle.endFill();

    circle.x = x * this.tileSize + this.tileSize / 2;
    circle.y = y * this.tileSize + this.tileSize / 2;

    this.stage.addChild(circle);
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
    this.camera = new Camera(
      width,
      height,
      100,
      100,
      this.tileSize
    );
  }
}

import * as PIXI from 'pixi.js';
import { Vector } from '../core/Vector';
import { GameMap } from '../map/MapLayer';
import { FogOfWar, FogState } from '../algorithms/FogOfWar';
import { Particle } from './Particles';
import { TileRegistry } from '../core/TileRegistry';

/**
 * Camera for view management
 */
export class Camera {
  private position: Vector;
  public width: number;
  public height: number;
  public mapWidth: number;
  public mapHeight: number;
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
   * Center camera on a target grid coordinate.
   * Properly handles arbitrary grid coordinates for maps larger than canvas.
   */
  centerOn(target: Vector): void {
    let x = target.x - (this.width / this.tileSize) / 2;
    let y = target.y - (this.height / this.tileSize) / 2;

    // Clamp to map bounds
    x = Math.max(0, Math.min(x, this.mapWidth - this.width / this.tileSize));
    y = Math.max(0, Math.min(y, this.mapHeight - this.height / this.tileSize));

    this.position = new Vector(x, y);
  }

  /**
   * Get camera position (top-left corner in grid coordinates)
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
  private stage!: PIXI.Container;
  private worldContainer!: PIXI.Container;
  private hudContainer!: PIXI.Container;
  public camera!: Camera;
  public tileSize: number;
  private layers: Map<string, PIXI.Container> = new Map();
  private textures: Map<string, PIXI.Texture> = new Map();

  private fogContainer!: PIXI.Container;
  private fovContainer!: PIXI.Container;
  private markerContainer!: PIXI.Container;
  private spriteContainer!: PIXI.Container;
  private particleContainer!: PIXI.Container;

  private fogGraphics!: PIXI.Graphics;
  private fovGraphics!: PIXI.Graphics;
  private markerGraphics!: PIXI.Graphics;

  private fallbackTexture!: PIXI.Texture;

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

    this.worldContainer = new PIXI.Container();
    this.hudContainer = new PIXI.Container();

    this.fogContainer = new PIXI.Container();
    this.fovContainer = new PIXI.Container();
    this.markerContainer = new PIXI.Container();
    this.spriteContainer = new PIXI.Container();
    this.particleContainer = new PIXI.Container();

    this.fogGraphics = new PIXI.Graphics();
    this.fogContainer.addChild(this.fogGraphics);
    this.fovGraphics = new PIXI.Graphics();
    this.fovContainer.addChild(this.fovGraphics);
    this.markerGraphics = new PIXI.Graphics();
    this.markerContainer.addChild(this.markerGraphics);

    // Dynamic containers are added on top of map layers
    this.worldContainer.addChild(this.spriteContainer);
    this.worldContainer.addChild(this.particleContainer);
    this.worldContainer.addChild(this.fogContainer);
    this.worldContainer.addChild(this.fovContainer);
    this.worldContainer.addChild(this.markerContainer);

    this.stage.addChild(this.worldContainer);
    this.stage.addChild(this.hudContainer);

    const graphics = new PIXI.Graphics();
    graphics.rect(0, 0, this.tileSize, this.tileSize).fill(0xFFFFFF);
    this.fallbackTexture = this.app.renderer.generateTexture(graphics);
  }

  public updateMouseHUD(x: number, y: number): void {
      // Intentionally left empty per decoupling rules
  }

  async loadAssets(assets: { id: string; path: string }[]): Promise<void> {
    for (const asset of assets) {
      try {
        await PIXI.Assets.load(asset.path);
        const texture = PIXI.Texture.from(asset.path);
        this.textures.set(asset.id, texture);
      } catch (error) {
        console.warn(`Renderer: Failed to load asset: ${asset.id} from ${asset.path}`);
      }
    }
  }

  getTexture(spriteId: string): PIXI.Texture | undefined {
    return this.textures.get(spriteId);
  }

  clearMapCache(): void {
    for (const layer of this.layers.values()) {
        layer.destroy({ children: true });
    }
    this.layers.clear();
  }

  /**
   * Renders the map layers in strict bottom-up z-index order based on the JSON array.
   */
  renderMap(map: GameMap): void {
    const layers = map.getLayers();

    // Initialize map layer containers in strict bottom-up order
    if (this.layers.size === 0) {
      let zIndex = 0;
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.getName() === 'collision') continue;

        const layerContainer = new PIXI.Container();
        // Insert at the specific zIndex (before dynamic containers)
        this.worldContainer.addChildAt(layerContainer, zIndex++);
        this.layers.set(`layer-${i}`, layerContainer);
      }
    }

    const cameraPos = this.camera.getPosition();
    const startX = Math.max(0, Math.floor(cameraPos.x));
    const startY = Math.max(0, Math.floor(cameraPos.y));
    const endX = Math.min(map.getWidth(), Math.ceil(cameraPos.x + this.camera.width / this.tileSize) + 2);
    const endY = Math.min(map.getHeight(), Math.ceil(cameraPos.y + this.camera.height / this.tileSize) + 2);

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.getName() === 'collision') continue;

      const container = this.layers.get(`layer-${i}`);
      if (!container) continue;

      const data = layer.getData();
      let childIndex = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const tileType = data[y][x];
          // Skip empty tiles (0) unless specifically required by game logic
          if (tileType === 0) continue;

          // Purely rely on TileRegistry - no hardcoded "cave_wall" logic
          const textureId = TileRegistry.getSprite(tileType);

          let sprite: PIXI.Sprite;
          if (childIndex < container.children.length) {
            sprite = container.children[childIndex] as PIXI.Sprite;
            sprite.visible = true;
          } else {
            sprite = new PIXI.Sprite();
            container.addChild(sprite);
          }

          if (textureId && this.textures.has(textureId)) {
            sprite.texture = this.textures.get(textureId)!;
            sprite.tint = 0xFFFFFF;
          } else {
            // Fallback for missing textures/types
            const color = TileRegistry.getColor(tileType);
            sprite.texture = this.fallbackTexture;
            sprite.tint = color;
          }

          sprite.width = this.tileSize;
          sprite.height = this.tileSize;
          sprite.x = x * this.tileSize;
          sprite.y = y * this.tileSize;

          childIndex++;
        }
      }

      // Hide unused sprites from pool
      for (let j = childIndex; j < container.children.length; j++) {
        container.children[j].visible = false;
      }
    }
  }

  renderFogOfWar(fogOfWar: FogOfWar, mapWidth: number, mapHeight: number): void {
    this.fogGraphics.clear();
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const fogState = fogOfWar.getFogState(x, y);
        if (fogState === FogState.UNKNOWN) {
          this.fogGraphics.rect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize).fill({ color: 0x000000, alpha: 0.8 });
        } else if (fogState === FogState.EXPLORED) {
          this.fogGraphics.rect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize).fill({ color: 0x000000, alpha: 0.5 });
        }
      }
    }
  }

  /**
   * Draw FOV visualization with intensity based on distance
   * Useful for debugging and showing light radius
   */
  drawFOV(visibleCells: Set<string>, mapWidth: number, mapHeight: number, fov?: any): void {
    this.fovGraphics.clear();

    if (!fov) return;

    const cameraPos = this.camera.getPosition();

    for (const cellKey of visibleCells) {
      const [x, y] = cellKey.split(',').map(Number);

      // Only render cells in view
      if (x < cameraPos.x || x >= cameraPos.x + this.camera.width / this.tileSize ||
          y < cameraPos.y || y >= cameraPos.y + this.camera.height / this.tileSize) {
        continue;
      }

      const screenX = (x - cameraPos.x) * this.tileSize;
      const screenY = (y - cameraPos.y) * this.tileSize;

      // Get visibility data
      const visibility = fov.getCellVisibility(x, y);
      if (visibility) {
        // Draw with intensity-based alpha
        const alpha = visibility.intensity * 0.4; // 40% max overlay opacity
        const color = visibility.isBlocked ? 0x333333 : 0x0066FF; // Gray for shadows, blue for visible
        this.fovGraphics.rect(screenX, screenY, this.tileSize, this.tileSize).fill({ color, alpha });
      }
    }
  }

  /**
   * Draw multiple light sources with their effective radius and intensity
   */
  drawLightSources(lights: Array<{ position: any; radius: number; intensity?: number; color?: any }>): void {
    for (const light of lights) {
      const cameraPos = this.camera.getPosition();
      const screenX = (light.position.x - cameraPos.x) * this.tileSize + this.tileSize / 2;
      const screenY = (light.position.y - cameraPos.y) * this.tileSize + this.tileSize / 2;

      const intensity = light.intensity ?? 1.0;
      const color = light.color ? (light.color.r << 16) | (light.color.g << 8) | light.color.b : 0xFFFF00;

      // Draw light radius circle
      const radiusPixels = light.radius * this.tileSize;
      this.fovGraphics
        .circle(screenX, screenY, radiusPixels)
        .stroke({ color, width: 2, alpha: intensity * 0.6 });

      // Draw light source core
      this.fovGraphics.circle(screenX, screenY, 4).fill({ color, alpha: intensity });
    }
  }

  /**
   * Draw combined multiple light FOV with intensity blending
   */
  drawMultipleLightFOV(visibility: Map<string, any>): void {
    this.fovGraphics.clear();
    const cameraPos = this.camera.getPosition();

    for (const [cellKey, vis] of visibility) {
      const [x, y] = cellKey.split(',').map(Number);

      // Only render cells in view
      if (x < cameraPos.x || x >= cameraPos.x + this.camera.width / this.tileSize ||
          y < cameraPos.y || y >= cameraPos.y + this.camera.height / this.tileSize) {
        continue;
      }

      const screenX = (x - cameraPos.x) * this.tileSize;
      const screenY = (y - cameraPos.y) * this.tileSize;

      // Color based on intensity: dark blue -> bright yellow/white
      const intensity = Math.min(1, vis.intensity);
      const color = this.intensityToColor(intensity);
      const alpha = intensity * 0.5;

      this.fovGraphics.rect(screenX, screenY, this.tileSize, this.tileSize).fill({ color, alpha });
    }
  }

  /**
   * Convert intensity (0.0 - 1.0) to color gradient (blue -> yellow -> white)
   */
  private intensityToColor(intensity: number): number {
    if (intensity < 0.3) {
      // Dark blue to light blue
      const t = intensity / 0.3;
      const r = Math.floor(0 + (66 - 0) * t);
      const g = Math.floor(0 + (150 - 0) * t);
      const b = Math.floor(255);
      return (r << 16) | (g << 8) | b;
    } else if (intensity < 0.7) {
      // Light blue to yellow
      const t = (intensity - 0.3) / 0.4;
      const r = Math.floor(66 + (255 - 66) * t);
      const g = Math.floor(150 + (255 - 150) * t);
      const b = Math.floor(255 - 255 * t);
      return (r << 16) | (g << 8) | b;
    } else {
      // Yellow to white
      const t = (intensity - 0.7) / 0.3;
      const r = 255;
      const g = 255;
      const b = Math.floor(0 + (255 - 0) * t);
      return (r << 16) | (g << 8) | b;
    }
  }

  drawMarker(x: number, y: number, color: number = 0xff0000, size: number = 8): void {
    this.markerGraphics.circle(
      x * this.tileSize + this.tileSize / 2,
      y * this.tileSize + this.tileSize / 2,
      size
    ).fill(color);
  }

  clearMarkers(): void {
    this.markerGraphics.clear();
  }

  renderParticles(particles: Particle[]): void {
    this.particleContainer.removeChildren();
    for (const particle of particles) {
      const graphics = new PIXI.Graphics();
      graphics.circle(0, 0, particle.size).fill({ color: particle.color, alpha: particle.alpha });
      graphics.x = particle.position.x * this.tileSize + this.tileSize / 2;
      graphics.y = particle.position.y * this.tileSize + this.tileSize / 2;
      graphics.rotation = particle.rotation;
      this.particleContainer.addChild(graphics);
    }
  }

  updateSpritePosition(sprite: PIXI.Sprite, x: number, y: number): void {
    sprite.x = x * this.tileSize;
    sprite.y = y * this.tileSize;
  }

  getSpriteContainer(): PIXI.Container {
    return this.spriteContainer;
  }

  public createSprite(textureId: string, x: number, y: number): PIXI.Sprite {
    const texture = this.getTexture(textureId);
    if (!texture) throw new Error(`Renderer: Texture '${textureId}' not found.`);
    const sprite = new PIXI.Sprite(texture);
    this.updateSpritePosition(sprite, x, y);
    this.spriteContainer.addChild(sprite);
    return sprite;
  }

  public removeSprite(sprite: PIXI.Sprite): void {
    this.spriteContainer.removeChild(sprite);
    sprite.destroy();
  }

  getCamera(): Camera { return this.camera; }
  getApp(): PIXI.Application { return this.app; }

  applyCameraTransform(): void {
    const cameraPos = this.camera.getPosition();
    this.worldContainer.x = -cameraPos.x * this.tileSize;
    this.worldContainer.y = -cameraPos.y * this.tileSize;
  }

  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    this.camera = new Camera(width, height, this.camera.mapWidth, this.camera.mapHeight, this.tileSize);
  }
}
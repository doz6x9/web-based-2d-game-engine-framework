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
   * Center camera on a target
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
  private worldContainer!: PIXI.Container; // New: Container for all world elements
  private hudContainer!: PIXI.Container;   // New: Container for HUD (static on screen)
  public camera!: Camera; // Initialized in init()
  public tileSize: number;
  private layers: Map<string, PIXI.Container> = new Map();
  private textures: Map<string, PIXI.Texture> = new Map();

  // Dedicated containers for dynamic elements (now children of worldContainer)
  private fogContainer!: PIXI.Container;
  private fovContainer!: PIXI.Container;
  private markerContainer!: PIXI.Container;
  private spriteContainer!: PIXI.Container;
  private particleContainer!: PIXI.Container;

  // Reusable Graphics objects
  private fogGraphics!: PIXI.Graphics;
  private fovGraphics!: PIXI.Graphics;
  private markerGraphics!: PIXI.Graphics;

  // HUD elements
  // private mouseCoordsText!: PIXI.Text; // Removed

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

    this.app.ticker.maxFPS = 0;

    this.stage = this.app.stage;
    this.camera = new Camera(width, height, mapWidth, mapHeight, this.tileSize);

    // Initialize containers
    this.worldContainer = new PIXI.Container();
    this.hudContainer = new PIXI.Container();

    this.fogContainer = new PIXI.Container();
    this.fovContainer = new PIXI.Container();
    this.markerContainer = new PIXI.Container();
    this.spriteContainer = new PIXI.Container();
    this.spriteContainer.sortableChildren = true; // Enable zIndex sorting
    this.particleContainer = new PIXI.Container();

    // Graphics
    this.fogGraphics = new PIXI.Graphics();
    this.fogContainer.addChild(this.fogGraphics);
    this.fovGraphics = new PIXI.Graphics();
    this.fovContainer.addChild(this.fovGraphics);
    this.markerGraphics = new PIXI.Graphics();
    this.markerContainer.addChild(this.markerGraphics);

    // Add world elements to worldContainer
    this.worldContainer.addChild(this.spriteContainer);
    this.worldContainer.addChild(this.particleContainer);
    this.worldContainer.addChild(this.fogContainer);
    this.worldContainer.addChild(this.fovContainer);
    this.worldContainer.addChild(this.markerContainer);

    // Add containers to stage
    this.stage.addChild(this.worldContainer);
    this.stage.addChild(this.hudContainer);

    // Generate fallback texture
    const graphics = new PIXI.Graphics();
    graphics.rect(0, 0, this.tileSize, this.tileSize).fill(0xFFFFFF);
    this.fallbackTexture = this.app.renderer.generateTexture(graphics);
  }

  /**
   * Update the mouse coordinates display on the HUD
   */
  public updateMouseHUD(x: number, y: number): void {
      // This method is now empty as mouseCoordsText is removed
  }

  /**
   * Load assets
   */
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

  renderMap(map: GameMap): void {
      if (this.layers.size === 0) {
        // Clear worldContainer (except the dynamic ones we manage)
        // Actually we should manage layers within worldContainer
        let zIndex = 0;
        for (let i = 0; i < map.getLayers().length; i++) {
          const layer = map.getLayers()[i];
          if (layer.getName() === 'collision') continue;

          const layerContainer = new PIXI.Container();
          this.worldContainer.addChildAt(layerContainer, zIndex++);
          this.layers.set(`layer-${i}`, layerContainer);
        }
      }

      const cameraPos = this.camera.getPosition();
      const startX = Math.max(0, Math.floor(cameraPos.x));
      const startY = Math.max(0, Math.floor(cameraPos.y));
      const endX = Math.min(map.getWidth(), Math.ceil(cameraPos.x + this.camera.width / this.tileSize) + 2);
      const endY = Math.min(map.getHeight(), Math.ceil(cameraPos.y + this.camera.height / this.tileSize) + 2);

      const layers = map.getLayers();
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
            if (tileType === 0 && layer.getName() === 'collision') continue;

            const textureId = this.getTextureForTile(tileType, x, y, data);
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
              const color = textureId ? 0xFF00FF : TileRegistry.getColor(tileType);
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

        for (let j = childIndex; j < container.children.length; j++) {
          container.children[j].visible = false;
        }
      }
    }

  private getTextureForTile(tileType: number, x: number, y: number, data: number[][]): string | null {
    if (tileType === 1) {
      const top = y > 0 ? data[y-1][x] === 1 : false;
      const bottom = y < data.length - 1 ? data[y+1][x] === 1 : false;
      const left = x > 0 ? data[y][x-1] === 1 : false;
      const right = x < data[y].length - 1 ? data[y][x+1] === 1 : false;

      if (right && bottom && !top && !left) return 'wall_corner_tl';
      if (left && bottom && !top && !right) return 'wall_corner_tr';
      if (right && top && !bottom && !left) return 'wall_corner_bl';
      if (left && top && !bottom && !right) return 'wall_corner_br';
      if (left && right && !top && !bottom) return 'wall_horizontal';
      if (top && bottom && !left && !right) return 'wall_vertical';
      if (left || right) return 'wall_horizontal';
      if (top || bottom) return 'wall_vertical';
      return 'cave_wall';
    }
    return TileRegistry.getSprite(tileType);
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

  drawFOV(visibleCells: Set<string>, mapWidth: number, mapHeight: number): void {
    this.fovGraphics.clear();
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

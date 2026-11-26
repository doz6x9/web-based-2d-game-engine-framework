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
  /** Whole-number zoom factor. Integer steps keep pixel art crisp. */
  public zoom = 1;
  /** Screen-pixel offset used to centre a map that is smaller than the view. */
  public offsetX = 0;
  public offsetY = 0;

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
    const viewW = this.getViewWidthInTiles();
    const viewH = this.getViewHeightInTiles();
    const tile = this.getScaledTileSize();

    // A map smaller than the view is centred; a larger one scrolls with the target.
    let x: number;
    if (this.mapWidth <= viewW) {
      x = 0;
      this.offsetX = Math.floor((this.width - this.mapWidth * tile) / 2);
    } else {
      x = Math.max(0, Math.min(target.x - viewW / 2, this.mapWidth - viewW));
      this.offsetX = 0;
    }
    let y: number;
    if (this.mapHeight <= viewH) {
      y = 0;
      this.offsetY = Math.floor((this.height - this.mapHeight * tile) / 2);
    } else {
      y = Math.max(0, Math.min(target.y - viewH / 2, this.mapHeight - viewH));
      this.offsetY = 0;
    }

    this.position = new Vector(x, y);
  }

  /** Size of one map cell on screen, in pixels, after zoom. */
  getScaledTileSize(): number {
    return this.tileSize * this.zoom;
  }

  getViewWidthInTiles(): number {
    return this.width / this.getScaledTileSize();
  }

  getViewHeightInTiles(): number {
    return this.height / this.getScaledTileSize();
  }

  /**
   * Pick the largest whole-number zoom at which the whole map still fits the
   * view (never below 1), so small maps fill the screen and stay pixel-crisp.
   */
  fitZoomToMap(maxZoom = 8): number {
    const fit = Math.min(this.width / (this.mapWidth * this.tileSize), this.height / (this.mapHeight * this.tileSize));
    this.zoom = Math.max(1, Math.min(maxZoom, Math.floor(fit)));
    return this.zoom;
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
    const tile = this.getScaledTileSize();
    const gridX = Math.floor(this.position.x + (screenX - this.offsetX) / tile);
    const gridY = Math.floor(this.position.y + (screenY - this.offsetY) / tile);
    return new Vector(gridX, gridY);
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): Vector {
    const tile = this.getScaledTileSize();
    const screenX = (worldX - this.position.x) * tile + this.offsetX;
    const screenY = (worldY - this.position.y) * tile + this.offsetY;
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
  private clickLabelContainer!: PIXI.Container;
  private clickLabels: Array<{ node: PIXI.Container; createdAt: number }> = [];
  private static readonly CLICK_LABEL_MS = 1500;

  private fallbackTexture!: PIXI.Texture;
  /**
   * Colours used for Fog of War. `unknownGridColor` draws a faint grid over
   * unexplored cells so they read as "map not yet explored" rather than empty
   * space; set it to null for plain black.
   */
  public fogStyle: { unknownColor: number; unknownGridColor: number | null; exploredColor: number; exploredAlpha: number } = {
    unknownColor: 0x000000,
    unknownGridColor: null,
    exploredColor: 0x1a1a1a,
    exploredAlpha: 0.65,
  };
  private lastFog: FogOfWar | null = null;
  private lastFogKey = '';

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
    this.clickLabelContainer = new PIXI.Container();
    this.worldContainer.addChild(this.clickLabelContainer);
    this.app.ticker.add(() => this.fadeClickLabels());

    this.stage.addChild(this.worldContainer);
    this.stage.addChild(this.hudContainer);

    const graphics = new PIXI.Graphics();
    graphics.rect(0, 0, this.tileSize, this.tileSize).fill(0xFFFFFF);
    this.fallbackTexture = this.app.renderer.generateTexture(graphics);
  }

  public updateMouseHUD(x: number, y: number): void {
      // Intentionally left empty per decoupling rules
  }

  async loadAssets(assets: { id: string; path: string; type?: 'image' | 'spritesheet' }[]): Promise<void> {
    for (const asset of assets) {
      try {
        if (asset.type === 'spritesheet') {
          await this.loadSpritesheet(asset.path);
          continue;
        }
        await PIXI.Assets.load(asset.path);
        const texture = PIXI.Texture.from(asset.path);
        this.textures.set(asset.id, texture);
      } catch (error) {
        console.warn(`Renderer: Failed to load asset: ${asset.id} from ${asset.path}`);
      }
    }
  }

  /**
   * Load a PixiJS spritesheet (JSON + atlas image) and register every frame
   * as a texture under its frame name. Returns the registered frame names.
   */
  async loadSpritesheet(jsonPath: string): Promise<string[]> {
    const sheet = await PIXI.Assets.load<PIXI.Spritesheet>(jsonPath);
    const names = Object.keys(sheet.textures);
    for (const name of names) {
      this.textures.set(name, sheet.textures[name]);
    }
    return names;
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
        if (layer.getRole() === 'collision') continue;

        const layerContainer = new PIXI.Container();
        // Insert at the specific zIndex (before dynamic containers)
        this.worldContainer.addChildAt(layerContainer, zIndex++);
        this.layers.set(`layer-${i}`, layerContainer);
      }
    }

    const cameraPos = this.camera.getPosition();
    const startX = Math.max(0, Math.floor(cameraPos.x));
    const startY = Math.max(0, Math.floor(cameraPos.y));
    const endX = Math.min(map.getWidth(), Math.ceil(cameraPos.x + this.camera.getViewWidthInTiles()) + 2);
    const endY = Math.min(map.getHeight(), Math.ceil(cameraPos.y + this.camera.getViewHeightInTiles()) + 2);

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.getRole() === 'collision') continue;

      const container = this.layers.get(`layer-${i}`);
      if (!container) continue;

      const data = layer.getData();
      let childIndex = 0;
      // Tile 0 is a real tile (grass) on the ground layer, but means "empty" on overlay layers.
      const skipZeroTiles = layer.getRole() !== 'ground';

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const tileType = data[y][x];
          if (tileType === 0 && skipZeroTiles) continue;

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
    // Rebuilding the fog geometry every frame is wasted work: only redraw when it changed.
    const style = this.fogStyle;
    const key = `${fogOfWar.version}:${mapWidth}x${mapHeight}:${style.unknownColor},${style.unknownGridColor},${style.exploredColor},${style.exploredAlpha}`;
    if (fogOfWar === this.lastFog && key === this.lastFogKey) return;
    this.lastFog = fogOfWar;
    this.lastFogKey = key;
    this.fogGraphics.clear();
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const fogState = fogOfWar.getFogState(x, y);
        const { unknownColor, exploredColor, exploredAlpha, unknownGridColor } = this.fogStyle;
        if (fogState === FogState.UNKNOWN) {
          this.fogGraphics.rect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize).fill({ color: unknownColor, alpha: 1 });
          if (unknownGridColor !== null) {
            this.fogGraphics
              .rect(x * this.tileSize + 0.5, y * this.tileSize + 0.5, this.tileSize - 1, this.tileSize - 1)
              .stroke({ color: unknownGridColor, width: 1, alpha: 1 });
          }
        } else if (fogState === FogState.EXPLORED) {
          this.fogGraphics.rect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize).fill({ color: exploredColor, alpha: exploredAlpha });
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

  /**
   * Draw the clicked cell's coordinates on the canvas.
   * Left clicks are outlined in green, right clicks in orange.
   * Each label fades out after a short time.
   */
  showClickCoordinates(x: number, y: number, button: 'left' | 'right'): void {
    const color = button === 'left' ? 0x52c41a : 0xfa8c16;
    const node = new PIXI.Container();

    const outline = new PIXI.Graphics();
    outline.rect(0, 0, this.tileSize, this.tileSize).stroke({ color, width: 2 });
    node.addChild(outline);

    const text = new PIXI.Text({
      text: `${button === 'left' ? 'L' : 'R'} (${x}, ${y})`,
      style: { fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', fill: color },
    });
    const background = new PIXI.Graphics();
    background.roundRect(0, 0, text.width + 8, text.height + 4, 3).fill({ color: 0x000000, alpha: 0.75 });
    background.y = -text.height - 6;
    text.x = 4;
    text.y = background.y + 2;
    node.addChild(background, text);

    node.x = x * this.tileSize;
    node.y = y * this.tileSize;
    this.clickLabelContainer.addChild(node);
    this.clickLabels.push({ node, createdAt: performance.now() });
  }

  private fadeClickLabels(): void {
    if (this.clickLabels.length === 0) return;
    const now = performance.now();
    this.clickLabels = this.clickLabels.filter(({ node, createdAt }) => {
      const age = now - createdAt;
      if (age >= Renderer.CLICK_LABEL_MS) {
        node.destroy({ children: true });
        return false;
      }
      node.alpha = age < Renderer.CLICK_LABEL_MS * 0.6 ? 1 : 1 - (age - Renderer.CLICK_LABEL_MS * 0.6) / (Renderer.CLICK_LABEL_MS * 0.4);
      return true;
    });
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
    const tile = this.camera.getScaledTileSize();
    this.worldContainer.scale.set(this.camera.zoom);
    this.worldContainer.x = Math.round(this.camera.offsetX - cameraPos.x * tile);
    this.worldContainer.y = Math.round(this.camera.offsetY - cameraPos.y * tile);
  }

  /**
   * Resize the canvas. The camera object is kept (the mouse handler holds a
   * reference to it); only its view size changes.
   */
  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    this.camera.width = width;
    this.camera.height = height;
  }
}
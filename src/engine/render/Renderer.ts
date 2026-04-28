import * as PIXI from 'pixi.js';
import { Vector } from '../core/Vector';
import { GameMap, MapLayer } from '../map/MapLayer';
import { FogOfWar, FogState } from '../algorithms/FogOfWar';
import { Particle } from './Particles';
import { TileRegistry } from '../core/TileRegistry';

/**
 * Camera for view management
 */
export class Camera {
  private position: Vector;
  public width: number;
  private height: number;
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
  public camera!: Camera; // Initialized in init()
  public tileSize: number;
  private layers: Map<string, PIXI.Container> = new Map();
  private textures: Map<string, PIXI.Texture> = new Map();

  // Dedicated containers for dynamic elements
  private fogContainer!: PIXI.Container; // Initialized in init()
  private fovContainer!: PIXI.Container; // Initialized in init()
  private markerContainer!: PIXI.Container; // Initialized in init()
  private spriteContainer!: PIXI.Container; // Initialized in init()
  private particleContainer!: PIXI.Container; // Initialized in init()

  // Reusable Graphics objects for transient drawing
  private fogGraphics!: PIXI.Graphics;
  private fovGraphics!: PIXI.Graphics;
  private markerGraphics!: PIXI.Graphics;

  // Sprite Pooling for ultra-fast Tilemap rendering
  private tileSpritePool: PIXI.Sprite[] = [];
  private poolIndex: number = 0;
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

    // Initialize dedicated containers
    this.fogContainer = new PIXI.Container();
    this.fovContainer = new PIXI.Container();
    this.markerContainer = new PIXI.Container();
    this.spriteContainer = new PIXI.Container();
    this.particleContainer = new PIXI.Container();

    // Initialize reusable Graphics objects and add them to their containers
    this.fogGraphics = new PIXI.Graphics();
    this.fogContainer.addChild(this.fogGraphics);

    this.fovGraphics = new PIXI.Graphics();
    this.fovContainer.addChild(this.fovGraphics);

    this.markerGraphics = new PIXI.Graphics();
    this.markerContainer.addChild(this.markerGraphics);

    // Add containers to stage in desired z-order
    this.stage.addChild(this.spriteContainer);
    this.stage.addChild(this.particleContainer);
    this.stage.addChild(this.fogContainer);
    this.stage.addChild(this.fovContainer);
    this.stage.addChild(this.markerContainer);

    // Generate a simple 1x1 white texture for coloring fallbacks without using heavy PIXI.Graphics
    const graphics = new PIXI.Graphics();
    graphics.rect(0, 0, this.tileSize, this.tileSize).fill(0xFFFFFF);
    this.fallbackTexture = this.app.renderer.generateTexture(graphics);
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
        console.warn(`Renderer: Failed to load asset (it may not be uploaded yet): ${asset.id} from ${asset.path}`);
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
   * Clear map cache so it redraws on next render
   */
  clearMapCache(): void {
    for (const layer of this.layers.values()) {
        layer.destroy({ children: true });
    }
    this.layers.clear();
    // Empty the pool so we recreate sprites fresh on new map
    this.tileSpritePool = [];
  }

  /**
   * Fetches a sprite from the pre-allocated pool, expanding it if necessary.
   */
  private getSpriteFromPool(): PIXI.Sprite {
    if (this.poolIndex >= this.tileSpritePool.length) {
      const sprite = new PIXI.Sprite();
      this.tileSpritePool.push(sprite);
      return sprite;
    }
    return this.tileSpritePool[this.poolIndex++];
  }

  /**
   * Render a map with multiple layers (Now fully optimized with Camera Culling)
   */
  renderMap(map: GameMap): void {
    // 1. Ensure layer containers exist
    if (this.layers.size === 0) {
      this.stage.removeChildren();

      let zIndex = 0;
      for (let i = 0; i < map.getLayers().length; i++) {
        const layer = map.getLayers()[i];
        if (layer.getName() === 'collision') continue; // Skip rendering collision mask

        // Standard container is perfectly fast since we are applying Camera Culling.
        // It avoids the strict API limitations of ParticleContainer in newer PixiJS versions.
        const layerContainer = new PIXI.Container();
        this.stage.addChildAt(layerContainer, zIndex++);
        this.layers.set(`layer-${i}`, layerContainer);
      }

      // Re-add dynamic containers to maintain proper z-order
      this.stage.addChild(this.spriteContainer);   // Sprites above map
      this.stage.addChild(this.particleContainer); // Particles above sprites
      this.stage.addChild(this.fogContainer);      // Fog above everything (darkens unexplored/explored)
      this.stage.addChild(this.fovContainer);      // FOV indicator above fog
      this.stage.addChild(this.markerContainer);   // Markers on top of everything
    }

    // 2. Reset pool index for this frame
    this.poolIndex = 0;

    // 3. Calculate Visible Camera Bounds (Culling)
    const cameraPos = this.camera.getPosition();
    const startX = Math.max(0, Math.floor(cameraPos.x));
    const startY = Math.max(0, Math.floor(cameraPos.y));
    // Render an extra 1-2 tiles around the border to prevent popping
    const endX = Math.min(map.getWidth(), Math.ceil(cameraPos.x + this.camera.width / this.tileSize) + 2);
    const endY = Math.min(map.getHeight(), Math.ceil(cameraPos.y + this.camera.height / this.tileSize) + 2);

    // 4. Render only visible tiles
    const layers = map.getLayers();
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.getName() === 'collision') continue; // Don't render the collision layer mask

      const container = this.layers.get(`layer-${i}`);
      if (!container) continue;

      // Safely clear the container
      container.removeChildren();

      const data = layer.getData();
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const tileType = data[y][x];

          // Skip drawing empty tiles
          if (tileType === 0 && layer.getName() === 'collision') {
            continue;
          }

          const textureId = this.getTextureForTile(tileType, x, y, data);
          const sprite = this.getSpriteFromPool();

          if (textureId && this.textures.has(textureId)) {
            // Render textured sprite
            sprite.texture = this.textures.get(textureId)!;
            sprite.tint = 0xFFFFFF; // Clear tint
          } else {
            // Fallback to brightly colored placeholder (hot pink) if texture hasn't loaded properly
            // Extremely fast because it uses a 1x1 white texture colored with WebGL tint
            const color = textureId ? 0xFF00FF : TileRegistry.getColor(tileType);
            sprite.texture = this.fallbackTexture;
            sprite.tint = color;
          }

          sprite.width = this.tileSize;
          sprite.height = this.tileSize;
          sprite.x = x * this.tileSize;
          sprite.y = y * this.tileSize;

          container.addChild(sprite);
        }
      }
    }
  }

  /**
   * Determines the correct texture ID for a given tile type, including autotiling for walls.
   */
  private getTextureForTile(tileType: number, x: number, y: number, data: number[][]): string | null {
    if (tileType === 1) { // Wall autotiling (1 maps to cave_wall currently)
      const top = y > 0 ? data[y-1][x] === 1 : false;
      const bottom = y < data.length - 1 ? data[y+1][x] === 1 : false;
      const left = x > 0 ? data[y][x-1] === 1 : false;
      const right = x < data[y][x].length - 1 ? data[y][x+1] === 1 : false;

      if (right && bottom && !top && !left) return 'wall_corner_tl';
      if (left && bottom && !top && !right) return 'wall_corner_tr';
      if (right && top && !bottom && !left) return 'wall_corner_bl';
      if (left && top && !bottom && !right) return 'wall_corner_br';
      if (left && right && !top && !bottom) return 'wall_horizontal';
      if (top && bottom && !left && !right) return 'wall_vertical';

      // Defaults or edge cases
      if (left || right) return 'wall_horizontal';
      if (top || bottom) return 'wall_vertical';

      return 'cave_wall'; // fallback
    }

    return TileRegistry.getSprite(tileType);
  }

  /**
   * Render a single layer (called only once per layer when map loads)
   */
  private renderLayer(
    container: PIXI.Container,
    layer: MapLayer,
  ): void {
    // Left empty because renderMap now dynamically renders the visible tiles every frame instead of pre-rendering everything once
  }

  /**
   * Render fog of war overlay
   * Optimized to only render tiles currently within the camera bounds
   */
  renderFogOfWar(
    fogOfWar: FogOfWar,
    mapWidth: number,
    mapHeight: number
  ): void {
    this.fogGraphics.clear(); // Clear previous drawing

    // Calculate visible bounds based on camera
    const cameraPos = this.camera.getPosition();
    const startX = Math.max(0, Math.floor(cameraPos.x));
    const startY = Math.max(0, Math.floor(cameraPos.y));

    // Add 1 to ensure we cover the edges completely
    const endX = Math.min(mapWidth, Math.ceil(cameraPos.x + this.camera.width / this.tileSize) + 2);
    const endY = Math.min(mapHeight, Math.ceil(cameraPos.y + this.camera.height / this.tileSize) + 2);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
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
    // Grid drawing removed
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
   * Render particles to the screen
   */
  renderParticles(particles: Particle[]): void {
    // Clear previous particle graphics
    this.particleContainer.removeChildren();

    for (const particle of particles) {
      const graphics = new PIXI.Graphics();
      graphics
        .circle(0, 0, particle.size)
        .fill({ color: particle.color, alpha: particle.alpha });

      graphics.x = particle.position.x * this.tileSize + this.tileSize / 2;
      graphics.y = particle.position.y * this.tileSize + this.tileSize / 2;
      graphics.rotation = particle.rotation;

      this.particleContainer.addChild(graphics);
    }
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
   * Creates a PIXI.Sprite from a loaded texture and adds it to the sprite container.
   * This method handles the PIXI-specific creation and addition to the display list.
   * The GameEngine should store the returned sprite reference to update its position later.
   * @param textureId The ID of the loaded texture (as provided to loadAssets).
   * @param x World X coordinate for initial placement.
   * @param y World Y coordinate for initial placement.
   * @returns The created PIXI.Sprite.
   * @throws Error if texture with textureId is not found.
   */
  public createSprite(textureId: string, x: number, y: number): PIXI.Sprite {
    const texture = this.getTexture(textureId);
    if (!texture) {
      throw new Error(`Renderer: Texture with ID '${textureId}' not found. Did you load it?`);
    }
    const sprite = new PIXI.Sprite(texture);
    this.updateSpritePosition(sprite, x, y); // Set initial position
    this.spriteContainer.addChild(sprite);
    return sprite;
  }

  /**
   * Removes a PIXI.Sprite from the sprite container and destroys its resources.
   * @param sprite The PIXI.Sprite to remove.
   */
  public removeSprite(sprite: PIXI.Sprite): void {
    this.spriteContainer.removeChild(sprite);
    sprite.destroy(); // Clean up PIXI resources associated with the sprite
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
   * Applies the camera transform to the main stage.
   * This should be called each frame after the camera position is updated.
   */
  applyCameraTransform(): void {
    const cameraPos = this.camera.getPosition();
    // Translate the stage to simulate camera movement
    this.stage.x = -cameraPos.x * this.tileSize;
    this.stage.y = -cameraPos.y * this.tileSize;
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
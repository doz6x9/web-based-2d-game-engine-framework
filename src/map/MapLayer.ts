/**
 * What a layer is for.
 * - `ground`: the base tiles. Every cell is drawn (tile 0 is a real tile) and the
 *   tile ids set walkability and movement cost.
 * - `collision`: not drawn. A non-zero value overrides the ground tile for that cell.
 * - `overlay`: drawn on top of the ground in array order (landmarks, decorations).
 *   Tile 0 means "empty". Overlays do not change walkability.
 */
export type MapLayerRole = 'ground' | 'collision' | 'overlay';

export interface MapLayerJSON {
  name?: string;
  /** Optional. When left out, the role comes from the map's layer names (see MapJSON). */
  role?: MapLayerRole;
  data?: number[] | number[][];
}

export interface MapJSON {
  name?: string;
  width?: number;
  height?: number;
  layers?: MapLayerJSON[];
  objects?: unknown[];
  /** Name of the ground layer. Defaults to "terrain", then the first non-collision layer. */
  groundLayer?: string;
  /** Name of the collision layer. Defaults to "collision". A map may have none. */
  collisionLayer?: string;
}

/** Layer names to use when a map does not say which layer is which. */
export interface MapLayerNames {
  ground?: string;
  collision?: string;
}

/**
 * Represents a single layer in a multi-layered map
 */
export class MapLayer {
  private name: string;
  private role: MapLayerRole = 'overlay';
  private data: number[][];
  private width: number;
  private height: number;

  constructor(name: string, data: number[][]) {
    this.name = name;
    this.data = data;
    this.height = data.length;
    this.width = data.length > 0 ? data[0].length : 0;
  }

  /**
   * Get the name of the layer
   */
  getName(): string {
    return this.name;
  }

  /** What this layer is for: ground, collision or overlay. */
  getRole(): MapLayerRole {
    return this.role;
  }

  setRole(role: MapLayerRole): void {
    this.role = role;
  }

  /**
   * Get cell value at coordinates
   */
  getCell(x: number, y: number): number | undefined {
    if (y < 0 || y >= this.height || x < 0 || x >= this.width) {
      return undefined;
    }
    return this.data[y][x];
  }

  /**
   * Get all data
   */
  getData(): number[][] {
    return this.data;
  }

  /**
   * Get dimensions
   */
  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}

/**
 * Represents a complete multi-layered map
 */
export class GameMap {
  private layers: MapLayer[] = [];
  private width: number;
  private height: number;
  private name: string;

  constructor(name: string, width: number, height: number) {
    this.name = name;
    this.width = width;
    this.height = height;
  }

  /**
   * Add a layer to the map
   */
  addLayer(layer: MapLayer): void {
    if (layer.getWidth() !== this.width || layer.getHeight() !== this.height) {
      throw new Error(
        `Layer dimensions (${layer.getWidth()}x${layer.getHeight()}) do not match map dimensions (${this.width}x${this.height})`
      );
    }
    this.layers.push(layer);
  }

  /**
   * Get layer by index
   */
  getLayer(index: number): MapLayer | undefined {
    return this.layers[index];
  }

  /**
   * Get layer by name
   */
  getLayerByName(name: string): MapLayer | undefined {
    return this.layers.find((l) => l.getName() === name);
  }

  /**
   * Get all layers
   */
  getLayers(): MapLayer[] {
    return this.layers;
  }

  /** The base layer that sets walkability and cost. */
  getGroundLayer(): MapLayer | undefined {
    return this.layers.find((l) => l.getRole() === 'ground');
  }

  /** The optional collision layer, which is never drawn. */
  getCollisionLayer(): MapLayer | undefined {
    return this.layers.find((l) => l.getRole() === 'collision');
  }

  /**
   * Get map dimensions
   */
  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  /**
   * Get map name
   */
  getName(): string {
    return this.name;
  }
}

/**
 * Loads map data from JSON
 */
export class MapLoader {
  /**
   * Parse map JSON data
   */
  static readonly DEFAULT_LAYER_NAMES: Required<MapLayerNames> = { ground: 'terrain', collision: 'collision' };

  /**
   * Parses map JSON. Which layer is the ground and which is collision is decided,
   * in order, by each layer's `role`, the map's `groundLayer` / `collisionLayer`
   * fields, the `names` passed here, and finally the defaults ("terrain" and
   * "collision"). If there is still no ground layer, the first layer that isn't
   * the collision layer becomes the ground. Every other layer is an overlay.
   */
  static parseMapJSON(
    mapData: MapJSON,
    names: MapLayerNames = {}
  ): GameMap {
    const mapWidth = mapData.width || 0;
    const mapHeight = mapData.height || 0;

    const map = new GameMap(
      mapData.name || 'Unnamed Map',
      mapWidth,
      mapHeight
    );

    if (mapData.layers && Array.isArray(mapData.layers)) {
      for (const layerData of mapData.layers) {
        const layerDataValues = layerData.data ?? [];
        let formattedData: number[][];

        // Automatically convert 1D array to 2D array if necessary (e.g. from Tiled exports)
        if (layerDataValues.length > 0 && typeof layerDataValues[0] === 'number') {
          formattedData = [];
          const flatData = layerDataValues as number[];
          for (let i = 0; i < flatData.length; i += mapWidth) {
            formattedData.push(flatData.slice(i, i + mapWidth));
          }
        } else {
          formattedData = layerDataValues as number[][];
        }

        const layer = new MapLayer(
          layerData.name || 'Layer',
          formattedData
        );
        if (layerData.role) layer.setRole(layerData.role);
        map.addLayer(layer);
      }
    }

    MapLoader.assignLayerRoles(map, mapData, names);
    return map;
  }

  private static assignLayerRoles(map: GameMap, mapData: MapJSON, names: MapLayerNames): void {
    const layers = map.getLayers();
    const explicit = (mapData.layers ?? []).map((l) => l.role);
    const groundName = mapData.groundLayer ?? names.ground ?? MapLoader.DEFAULT_LAYER_NAMES.ground;
    const collisionName = mapData.collisionLayer ?? names.collision ?? MapLoader.DEFAULT_LAYER_NAMES.collision;

    if (!explicit.includes('collision')) {
      const c = layers.findIndex((l, i) => !explicit[i] && l.getName() === collisionName);
      if (c >= 0) layers[c].setRole('collision');
    }
    if (!explicit.includes('ground')) {
      let g = layers.findIndex((l, i) => !explicit[i] && l.getName() === groundName && l.getRole() !== 'collision');
      if (g < 0) g = layers.findIndex((l) => l.getRole() !== 'collision');
      if (g >= 0) layers[g].setRole('ground');
    }
  }

  /**
   * Create collision layer from terrain layer
   */
  static createCollisionLayer(
    terrainLayer: MapLayer,
    walkableTypes: Set<number> = new Set([0, 2, 4])
  ): MapLayer {
    const data: number[][] = [];
    for (let y = 0; y < terrainLayer.getHeight(); y++) {
      const row: number[] = [];
      for (let x = 0; x < terrainLayer.getWidth(); x++) {
        const cellValue = terrainLayer.getCell(x, y) || 0;
        row.push(walkableTypes.has(cellValue) ? 0 : 1);
      }
      data.push(row);
    }
    return new MapLayer('collision', data);
  }
}

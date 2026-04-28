/**
 * Represents a single layer in a multi-layered map
 */
export class MapLayer {
  private name: string;
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
  static parseMapJSON(
    mapData: any
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
        let formattedData = layerData.data;

        // Automatically convert 1D array to 2D array if necessary (e.g. from Tiled exports)
        if (formattedData && formattedData.length > 0 && typeof formattedData[0] === 'number') {
          const new2D = [];
          for (let i = 0; i < formattedData.length; i += mapWidth) {
            new2D.push(formattedData.slice(i, i + mapWidth));
          }
          formattedData = new2D;
        }

        const layer = new MapLayer(
          layerData.name || 'Layer',
          formattedData
        );
        map.addLayer(layer);
      }
    }

    return map;
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

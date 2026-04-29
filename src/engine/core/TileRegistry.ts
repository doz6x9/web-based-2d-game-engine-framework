/**
 * Tile Registry Configuration
 * Defines all available terrain types with their properties
 * Used by pathfinding, rendering, and collision detection
 */

export interface TileDefinition {
  cost: number; // Movement cost for pathfinding
  walkable: boolean; // Can entities walk on this tile
  sprite: string; // Sprite asset ID
  name: string; // Human-readable name
  color: number; // Fallback color if sprite unavailable
}

export enum TileType {
  GRASS = 0,
  CAVE_WALL = 1,
  WATER = 2,
  SAND = 3,
  PATH = 4,
  STONE_FLOOR = 5,
  DEEP_WATER = 6,
  SNOW = 7,
  CAVE_FLOOR = 8,
  WOOD_FLOOR = 9,
  SWAMP = 10,
  FOREST = 11,
}

export class TileRegistry {
  private static tiles: Map<number, TileDefinition> = new Map();

  /**
   * Initialize default tile definitions mapping integers to textures
   */
  static initialize(): void {
    this.registerTile(TileType.GRASS, {
      cost: 1,
      walkable: true,
      sprite: 'grass',
      name: 'Grass',
      color: 0x4a7c2c,
    });

    this.registerTile(TileType.CAVE_WALL, {
      cost: 0,
      walkable: false,
      sprite: 'cave_wall',
      name: 'Cave Wall',
      color: 0x1a1a1a,
    });

    this.registerTile(TileType.WATER, {
      cost: 0,
      walkable: false,
      sprite: 'water',
      name: 'Water',
      color: 0x2980b9,
    });

    this.registerTile(TileType.SAND, {
      cost: 1.5,
      walkable: true,
      sprite: 'sand',
      name: 'Sand',
      color: 0xe8d4a8,
    });

    this.registerTile(TileType.PATH, {
      cost: 0.5,
      walkable: true,
      sprite: 'path',
      name: 'Path',
      color: 0xc4a747,
    });

    this.registerTile(TileType.STONE_FLOOR, {
      cost: 1,
      walkable: true,
      sprite: 'stone_floor',
      name: 'Stone Floor',
      color: 0x696969,
    });

    this.registerTile(TileType.DEEP_WATER, {
      cost: 0,
      walkable: false,
      sprite: 'deep_water',
      name: 'Deep Water',
      color: 0x1d4a7d,
    });

    this.registerTile(TileType.SNOW, {
      cost: 1.5,
      walkable: true,
      sprite: 'snow',
      name: 'Snow',
      color: 0xffffff,
    });

    this.registerTile(TileType.CAVE_FLOOR, {
      cost: 1.2,
      walkable: true,
      sprite: 'cave_floor',
      name: 'Cave Floor',
      color: 0x4d4d4d,
    });

    this.registerTile(TileType.WOOD_FLOOR, {
      cost: 1,
      walkable: true,
      sprite: 'wood_floor',
      name: 'Wood Floor',
      color: 0x8b4513,
    });

    this.registerTile(TileType.SWAMP, {
      cost: 3,
      walkable: true,
      sprite: 'swamp',
      name: 'Swamp',
      color: 0x6b4423,
    });

    this.registerTile(TileType.FOREST, {
      cost: 0,
      walkable: false,
      sprite: 'forest',
      name: 'Forest',
      color: 0x2d5016,
    });
  }

  /**
   * Register a custom tile definition
   */
  static registerTile(id: number, definition: TileDefinition): void {
    this.tiles.set(id, definition);
  }

  /**
   * Get tile definition by ID
   */
  static getTile(id: number): TileDefinition | undefined {
    return this.tiles.get(id);
  }

  /**
   * Get all registered tiles
   */
  static getAllTiles(): Map<number, TileDefinition> {
    return this.tiles;
  }

  /**
   * Check if tile exists
   */
  static hasTile(id: number): boolean {
    return this.tiles.has(id);
  }

  /**
   * Get cost for a tile type
   */
  static getCost(id: number): number {
    const tile = this.tiles.get(id);
    return tile ? tile.cost : Infinity;
  }

  /**
   * Check if tile is walkable
   */
  static isWalkable(id: number): boolean {
    const tile = this.tiles.get(id);
    return tile ? tile.walkable : false;
  }

  /**
   * Get color for a tile type
   */
  static getColor(id: number): number {
    const tile = this.tiles.get(id);
    return tile ? tile.color : 0x808080;
  }

  /**
   * Get sprite for a tile type
   */
  static getSprite(id: number): string | null {
    const tile = this.tiles.get(id);
    return tile ? tile.sprite : null;
  }
}

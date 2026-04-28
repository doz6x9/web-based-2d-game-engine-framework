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

export class TileRegistry {
  private static tiles: Map<number, TileDefinition> = new Map();

  /**
   * Initialize default tile definitions mapping integers to textures
   */
  static initialize(): void {
    this.registerTile(0, {
      cost: 1,
      walkable: true,
      sprite: 'grass',
      name: 'Grass',
      color: 0x4a7c2c,
    });

    this.registerTile(1, {
      cost: 0,
      walkable: false,
      sprite: 'cave_wall',
      name: 'Cave Wall',
      color: 0x1a1a1a,
    });

    this.registerTile(2, {
      cost: 0,
      walkable: false,
      sprite: 'water',
      name: 'Water',
      color: 0x2980b9,
    });

    this.registerTile(3, {
      cost: 1.5,
      walkable: true,
      sprite: 'sand',
      name: 'Sand',
      color: 0xe8d4a8,
    });

    this.registerTile(4, {
      cost: 0.5,
      walkable: true,
      sprite: 'path',
      name: 'Path',
      color: 0xc4a747,
    });

    this.registerTile(5, {
      cost: 1,
      walkable: true,
      sprite: 'stone_floor',
      name: 'Stone Floor',
      color: 0x696969,
    });

    this.registerTile(6, {
      cost: 0,
      walkable: false,
      sprite: 'deep_water',
      name: 'Deep Water',
      color: 0x1d4a7d,
    });

    this.registerTile(7, {
      cost: 1.5,
      walkable: true,
      sprite: 'snow',
      name: 'Snow',
      color: 0xffffff,
    });

    this.registerTile(8, {
      cost: 1.2,
      walkable: true,
      sprite: 'cave_floor',
      name: 'Cave Floor',
      color: 0x4d4d4d,
    });

    this.registerTile(9, {
      cost: 1,
      walkable: true,
      sprite: 'wood_floor',
      name: 'Wood Floor',
      color: 0x8b4513,
    });

    this.registerTile(10, {
      cost: 3,
      walkable: true,
      sprite: 'swamp',
      name: 'Swamp',
      color: 0x6b4423,
    });

    this.registerTile(11, {
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

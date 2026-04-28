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
  private static tiles: Map<string, TileDefinition> = new Map();

  /**
   * Initialize default tile definitions
   */
  static initialize(): void {
    this.registerTile('grass', {
      cost: 1,
      walkable: true,
      sprite: 'grass_tile',
      name: 'Grass',
      color: 0x4a7c2c,
    });

    this.registerTile('road', {
      cost: 0.5,
      walkable: true,
      sprite: 'road_tile',
      name: 'Road',
      color: 0xc4a747,
    });

    this.registerTile('swamp', {
      cost: 3,
      walkable: true,
      sprite: 'swamp_mud',
      name: 'Swamp',
      color: 0x6b4423,
    });

    this.registerTile('water', {
      cost: 0,
      walkable: false,
      sprite: 'water_blue',
      name: 'Water',
      color: 0x2980b9,
    });

    this.registerTile('wall', {
      cost: 0,
      walkable: false,
      sprite: 'stone_wall',
      name: 'Wall',
      color: 0x1a1a1a,
    });

    this.registerTile('tree', {
      cost: 0,
      walkable: false,
      sprite: 'tree_oak',
      name: 'Tree',
      color: 0x2d5016,
    });

    this.registerTile('sand', {
      cost: 1.5,
      walkable: true,
      sprite: 'sand_tile',
      name: 'Sand',
      color: 0xe8d4a8,
    });

    this.registerTile('lava', {
      cost: 0,
      walkable: false,
      sprite: 'lava_flow',
      name: 'Lava',
      color: 0xff4500,
    });

    this.registerTile('ice', {
      cost: 0.7,
      walkable: true,
      sprite: 'ice_tile',
      name: 'Ice',
      color: 0xb0e0e6,
    });

    this.registerTile('mud', {
      cost: 2,
      walkable: true,
      sprite: 'mud_tile',
      name: 'Mud',
      color: 0x8b7355,
    });

    // New environmental tiles
    this.registerTile('tall_grass', {
      cost: 1.5,
      walkable: true,
      sprite: 'tall_grass_tile',
      name: 'Tall Grass',
      color: 0x2d5a1a,
    });

    this.registerTile('shallow_water', {
      cost: 2,
      walkable: true,
      sprite: 'shallow_water_tile',
      name: 'Shallow Water',
      color: 0x4a90e2,
    });

    this.registerTile('deep_water', {
      cost: 0,
      walkable: false,
      sprite: 'deep_water_tile',
      name: 'Deep Water',
      color: 0x1d4a7d,
    });

    this.registerTile('stone_wall', {
      cost: 0,
      walkable: false,
      sprite: 'stone_wall_tile',
      name: 'Stone Wall',
      color: 0x696969,
    });

    this.registerTile('wood_wall', {
      cost: 0,
      walkable: false,
      sprite: 'wood_wall_tile',
      name: 'Wood Wall',
      color: 0x8b4513,
    });
  }

  /**
   * Register a custom tile definition
   */
  static registerTile(id: string, definition: TileDefinition): void {
    this.tiles.set(id, definition);
  }

  /**
   * Get tile definition by ID
   */
  static getTile(id: string): TileDefinition | undefined {
    return this.tiles.get(id);
  }

  /**
   * Get all registered tiles
   */
  static getAllTiles(): Map<string, TileDefinition> {
    return this.tiles;
  }

  /**
   * Check if tile exists
   */
  static hasTile(id: string): boolean {
    return this.tiles.has(id);
  }

  /**
   * Get cost for a tile type
   */
  static getCost(id: string): number {
    const tile = this.tiles.get(id);
    return tile ? tile.cost : Infinity;
  }

  /**
   * Check if tile is walkable
   */
  static isWalkable(id: string): boolean {
    const tile = this.tiles.get(id);
    return tile ? tile.walkable : false;
  }

  /**
   * Get color for a tile type
   */
  static getColor(id: string): number {
    const tile = this.tiles.get(id);
    return tile ? tile.color : 0x808080;
  }
}

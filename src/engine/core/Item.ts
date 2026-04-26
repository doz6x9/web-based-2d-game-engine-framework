import { MapObject, MapObjectType } from './MapObject';
import { Vector } from './Vector';

export enum ItemType {
  GENERIC = 'generic',
  CONSUMABLE = 'consumable',
  EQUIPMENT = 'equipment',
  KEY_ITEM = 'key_item',
  WEAPON = 'weapon', // Added WEAPON item type
}

/**
 * Represents an item in the game world or inventory.
 */
export class Item {
  id: string;
  name: string;
  description: string;
  sprite: string;
  type: ItemType;
  stackable: boolean;
  maxStackSize: number;
  quantity: number;

  constructor(
    id: string,
    name: string,
    description: string,
    sprite: string,
    type: ItemType = ItemType.GENERIC,
    stackable: boolean = false,
    maxStackSize: number = 1,
    quantity: number = 1
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.sprite = sprite;
    this.type = type;
    this.stackable = stackable;
    this.maxStackSize = maxStackSize;
    this.quantity = quantity;
  }

  /**
   * Use the item. (Placeholder for future logic)
   */
  use(): boolean {
    console.log(`Using ${this.name}`);
    // Implement specific item effects here
    return true; // Return true if item was successfully used
  }

  /**
   * Create a MapObject representation of this item for placement in the world.
   */
  toMapObject(position: Vector): MapObject {
    const itemObject = new MapObject(
      `item_${this.id}_${position.x}_${position.y}`, // Unique ID for world object
      MapObjectType.ITEM,
      position,
      this.sprite
    );
    itemObject.setProperty('itemId', this.id); // Store original item ID
    itemObject.setProperty('name', this.name);
    itemObject.setProperty('description', this.description);
    itemObject.setProperty('type', this.type);
    itemObject.setProperty('stackable', this.stackable);
    itemObject.setProperty('maxStackSize', this.maxStackSize);
    itemObject.setProperty('quantity', this.quantity);
    return itemObject;
  }
}

import { Item } from './Item';

/**
 * Manages a collection of items for a player or entity.
 */
export class Inventory {
  private items: Map<string, Item> = new Map(); // Key: item.id, Value: Item instance

  constructor() {}

  /**
   * Add an item to the inventory.
   * If the item is stackable and already exists, its quantity is updated.
   * @param newItem The item to add.
   * @returns True if the item was added/quantity updated, false otherwise (e.g., inventory full, though not implemented here).
   */
  addItem(newItem: Item): boolean {
    if (newItem.stackable) {
      const existingItem = this.items.get(newItem.id);
      if (existingItem) {
        const newQuantity = existingItem.quantity + newItem.quantity;
        existingItem.quantity = Math.min(newQuantity, existingItem.maxStackSize);
        console.log(`Added ${newItem.quantity}x ${newItem.name}. Total: ${existingItem.quantity}`);
        return true;
      }
    }
    // If not stackable, or no existing item, add as a new entry
    this.items.set(newItem.id, newItem);
    console.log(`Added ${newItem.name} to inventory.`);
    return true;
  }

  /**
   * Remove an item from the inventory.
   * @param itemId The ID of the item to remove.
   * @param quantity The amount to remove. Defaults to 1.
   * @returns The removed item (or a partial item if quantity was reduced), or null if not found/not enough quantity.
   */
  removeItem(itemId: string, quantity: number = 1): Item | null {
    const existingItem = this.items.get(itemId);
    if (existingItem) {
      if (existingItem.quantity > quantity) {
        existingItem.quantity -= quantity;
        console.log(`Removed ${quantity}x ${existingItem.name}. Remaining: ${existingItem.quantity}`);

        // Return a new Item instance instead of a spread object
        return new Item(
          existingItem.id,
          existingItem.name,
          existingItem.description,
          existingItem.sprite,
          existingItem.type,
          existingItem.stackable,
          existingItem.maxStackSize,
          quantity
        );
      } else {
        this.items.delete(itemId);
        console.log(`Removed all ${existingItem.name} from inventory.`);
        return existingItem; // Return the whole item
      }
    }
    console.warn(`Item "${itemId}" not found in inventory.`);
    return null;
  }

  /**
   * Get an item from the inventory by its ID.
   * @param itemId The ID of the item.
   * @returns The item, or undefined if not found.
   */
  getItem(itemId: string): Item | undefined {
    return this.items.get(itemId);
  }

  /**
   * Check if the inventory contains a specific item (and optionally a minimum quantity).
   * @param itemId The ID of the item.
   * @param quantity The minimum quantity to check for. Defaults to 1.
   * @returns True if the item is present with at least the specified quantity, false otherwise.
   */
  hasItem(itemId: string, quantity: number = 1): boolean {
    const item = this.items.get(itemId);
    return item !== undefined && item.quantity >= quantity;
  }

  /**
   * Get all items in the inventory.
   * @returns An array of all items.
   */
  getAllItems(): Item[] {
    return Array.from(this.items.values());
  }

  /**
   * Get the number of unique item types in the inventory.
   */
  get size(): number {
    return this.items.size;
  }

  /**
   * Clear the entire inventory.
   */
  clear(): void {
    this.items.clear();
    console.log('Inventory cleared.');
  }
}
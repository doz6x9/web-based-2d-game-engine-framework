import { Item, ItemType } from '../core/Item';
import { GameEngine } from '../GameEngine';

export class PlayerManager {
  public health: number = 100;
  public maxHealth: number = 100;
  public baseAttackPower: number = 10;
  public equippedWeapon: Item | null = null;

  constructor(private engine: GameEngine) {}

  // Automatically calculates damage based on equipment
  get effectiveAttackPower(): number {
    return this.equippedWeapon ? this.baseAttackPower * 1.5 : this.baseAttackPower;
  }

  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.engine.getUIManager().updatePlayerHealth(this.health, this.maxHealth);
    return this.health <= 0; // Returns true if player died
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.engine.getUIManager().updatePlayerHealth(this.health, this.maxHealth);
  }

  equip(item: Item): void {
    this.equippedWeapon = item;
    this.engine.getUIManager().setEquippedWeaponId(item.id);
  }

  // Centralized item usage logic
  useItem(itemId: string): void {
    const item = this.engine.getInventory().getItem(itemId);
    if (!item) return;

    const ui = this.engine.getUIManager();
    const isConsumable = item.type === ItemType.CONSUMABLE || item.type === ('consumable' as ItemType);
    const isWeapon = item.type === ItemType.WEAPON || item.type === ('weapon' as ItemType);

    if (isConsumable) {
      const healthRestored = 20;
      this.heal(healthRestored);
      ui.startDialogue([{ speaker: 'System', text: `You consumed ${item.name} and restored ${healthRestored} health.` }]);
      this.engine.getInventory().removeItem(itemId, 1);
    } else if (isWeapon) {
      this.equip(item);
      ui.startDialogue([{ speaker: 'System', text: `You equipped the ${item.name}.` }]);
    } else {
      ui.startDialogue([{ speaker: 'System', text: `You examine the ${item.name}.` }]);
    }

    ui.updateInventoryDisplay(this.engine.getInventory());
  }
}
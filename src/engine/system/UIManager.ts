import { KeyboardHandler, KeyboardEventType } from '../interaction/KeyboardHandler';
import { DialogueManager, DialogueLine } from './DialogueManager';
import { Inventory } from '../core/Inventory';
import { Item } from '../core/Item';

export class UIManager {
  private dialogueManager: DialogueManager;
  private keyboardHandler: KeyboardHandler; // Still needed for DialogueManager constructor, but not for inventory toggle
  private inventory: Inventory;

  private inventoryPanel: HTMLElement | null;
  private inventoryList: HTMLElement | null;
  private inventoryButton: HTMLElement | null; // New: Inventory button

  private isInventoryOpen: boolean = false;

  constructor(keyboardHandler: KeyboardHandler, inventory: Inventory) {
    this.keyboardHandler = keyboardHandler;
    this.inventory = inventory;
    this.dialogueManager = new DialogueManager(keyboardHandler); // DialogueManager still uses keyboardHandler for its constructor

    this.inventoryPanel = document.getElementById('inventoryPanel');
    this.inventoryList = document.getElementById('inventoryList');
    this.inventoryButton = document.getElementById('inventoryButton'); // Get inventory button

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Removed keyboard 'I' listener for inventory toggle
    // this.keyboardHandler.on(KeyboardEventType.KEY_DOWN, (code: string) => {
    //   if (code === 'KeyI') {
    //     if (this.isDialogueActive()) return;
    //     this.toggleInventory();
    //   }
    // });

    // Add click listener for the inventory button
    if (this.inventoryButton) {
      this.inventoryButton.addEventListener('click', () => {
        if (this.isDialogueActive()) return; // Don't open inventory during dialogue
        this.toggleInventory();
      });
    }
  }

  // --- Dialogue Management ---
  startDialogue(dialogue: DialogueLine[]): Promise<unknown> {
    return this.dialogueManager.startDialogue(dialogue);
  }

  isDialogueActive(): boolean {
    return this.dialogueManager.isDialogueActive();
  }

  // --- Inventory Management ---
  toggleInventory(): void {
    if (this.inventoryPanel) {
      this.isInventoryOpen = !this.isInventoryOpen;
      this.inventoryPanel.style.display = this.isInventoryOpen ? 'block' : 'none';
      if (this.isInventoryOpen) {
        this.updateInventoryDisplay(this.inventory); // Update display when opening
        console.log('Inventory opened.');
      } else {
        console.log('Inventory closed.');
      }
    }
  }

  updateInventoryDisplay(inventory: Inventory): void {
    if (this.inventoryList) {
      this.inventoryList.innerHTML = ''; // Clear current list

      const items = inventory.getAllItems();
      if (items.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Inventory is empty.';
        this.inventoryList.appendChild(li);
      } else {
        items.forEach(item => {
          const li = document.createElement('li');
          li.style.marginBottom = '5px';
          li.style.padding = '5px';
          li.style.border = '1px solid #555';
          li.style.backgroundColor = '#222';
          li.textContent = `${item.name} (x${item.quantity}) - ${item.description}`;
          this.inventoryList!.appendChild(li);
        });
      }
    }
  }

  isInventoryOpen(): boolean {
    return this.isInventoryOpen;
  }

  // --- General UI State ---
  isUIOpen(): boolean {
    return this.isDialogueActive() || this.isInventoryOpen;
  }

  /**
   * Clean up event listeners.
   */
  destroy(): void {
    this.dialogueManager.destroy(); // Clean up dialogue manager listeners
    if (this.inventoryButton) {
      this.inventoryButton.removeEventListener('click', this.toggleInventory.bind(this));
    }
  }
}

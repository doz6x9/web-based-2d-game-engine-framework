import { KeyboardHandler } from '../interaction/KeyboardHandler';
import { DialogueManager, DialogueLine } from './DialogueManager';
import { Inventory } from '../core/Inventory';

export class UIManager {
  private dialogueManager: DialogueManager;
  private inventory: Inventory;

  private inventoryPanel: HTMLElement | null;
  private inventoryList: HTMLElement | null;
  private inventoryButton: HTMLElement | null;
  private playerHealthElement: HTMLElement | null;

  // HUD elements
  private fpsCounter: HTMLElement | null;
  private levelDisplay: HTMLElement | null;
  private pauseButton: HTMLElement | null;
  private saveButton: HTMLElement | null;
  private loadButton: HTMLElement | null;
  private skipDialogueButton: HTMLElement | null;
  private muteButton: HTMLElement | null; // ADDED: Mute button reference

  // FIXED: Renamed to _isInventoryOpen to avoid colliding with the method name
  private _isInventoryOpen: boolean = false;

  // Callback functions for HUD buttons
  private onPauseCallback: (() => void) | null = null;
  private onSaveCallback: (() => void) | null = null;
  private onLoadCallback: (() => void) | null = null;
  private onSkipDialogueCallback: (() => void) | null = null;
  private onMuteCallback: (() => void) | null = null; // ADDED: Mute callback

  // FPS tracking
  private frameCount: number = 0;
  private lastFpsUpdateTime: number = Date.now();
  private currentFps: number = 0;

  constructor(keyboardHandler: KeyboardHandler, inventory: Inventory) {
    this.inventory = inventory;
    this.dialogueManager = new DialogueManager(keyboardHandler);

    this.inventoryPanel = document.getElementById('inventoryPanel');
    this.inventoryList = document.getElementById('inventoryList');
    this.inventoryButton = document.getElementById('inventoryButton');
    this.playerHealthElement = document.getElementById('playerHealth');

    // Initialize HUD elements
    this.fpsCounter = document.getElementById('fpsCounter');
    this.levelDisplay = document.getElementById('levelDisplay');
    this.pauseButton = document.getElementById('pauseButton');
    this.saveButton = document.getElementById('saveButton');
    this.loadButton = document.getElementById('loadButton');
    this.skipDialogueButton = document.getElementById('skipDialogueButton');
    this.muteButton = document.getElementById('muteButton'); // ADDED: Hook up the HTML element

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Inventory button
    if (this.inventoryButton) {
      this.inventoryButton.addEventListener('click', () => {
        if (this.isDialogueActive()) return;
        this.toggleInventory();
      });
    }

    // HUD Buttons
    if (this.pauseButton) {
      this.pauseButton.addEventListener('click', () => {
        if (this.onPauseCallback) this.onPauseCallback();
      });
    }

    if (this.saveButton) {
      this.saveButton.addEventListener('click', () => {
        if (this.onSaveCallback) this.onSaveCallback();
      });
    }

    if (this.loadButton) {
      this.loadButton.addEventListener('click', () => {
        if (this.onLoadCallback) this.onLoadCallback();
      });
    }

    if (this.skipDialogueButton) {
      this.skipDialogueButton.addEventListener('click', () => {
        if (this.onSkipDialogueCallback) this.onSkipDialogueCallback();
        // Also try to skip dialogue via the dialogue manager
        this.dialogueManager.skip();
      });
    }

    // ADDED: Mute button click handler
    if (this.muteButton) {
      this.muteButton.addEventListener('click', () => {
        if (this.onMuteCallback) this.onMuteCallback();
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
      this._isInventoryOpen = !this._isInventoryOpen; // FIXED: Using new variable name
      this.inventoryPanel.style.display = this._isInventoryOpen ? 'block' : 'none';
      if (this._isInventoryOpen) {
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
    return this._isInventoryOpen; // FIXED: Using new variable name
  }

  /**
   * Update the player's health display.
   */
  updatePlayerHealth(currentHealth: number, maxHealth: number): void {
    if (this.playerHealthElement) {
      this.playerHealthElement.textContent = `${currentHealth}/${maxHealth}`;
    }
  }

  /**
   * Update FPS counter display
   * Call this every frame from the game loop
   */
  updateFpsCounter(deltaTime: number): void {
    this.frameCount++;
    const currentTime = Date.now();
    const elapsed = currentTime - this.lastFpsUpdateTime;

    if (elapsed >= 1000) { // Update FPS every second
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      if (this.fpsCounter) {
        this.fpsCounter.textContent = `FPS: ${this.currentFps}`;
      }
      this.frameCount = 0;
      this.lastFpsUpdateTime = currentTime;
    }
  }

  /**
   * Update level display
   */
  updateLevelDisplay(levelNumber: number, levelName: string): void {
    if (this.levelDisplay) {
      this.levelDisplay.textContent = `Level ${levelNumber}: ${levelName}`;
    }
  }

  /**
   * Register pause button callback
   */
  onPause(callback: () => void): void {
    this.onPauseCallback = callback;
  }

  /**
   * Register save button callback
   */
  onSave(callback: () => void): void {
    this.onSaveCallback = callback;
  }

  /**
   * Register load button callback
   */
  onLoad(callback: () => void): void {
    this.onLoadCallback = callback;
  }

  /**
   * Register skip dialogue button callback
   */
  onSkipDialogue(callback: () => void): void {
    this.onSkipDialogueCallback = callback;
  }

  /**
   * Register mute button callback
   */
  onMute(callback: () => void): void {
    this.onMuteCallback = callback;
  }

  /**
   * Update pause button state
   */
  setPauseButtonState(isPaused: boolean): void {
    if (this.pauseButton) {
      this.pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
      this.pauseButton.style.backgroundColor = isPaused ? '#51cf66' : '#ff6b6b';
    }
  }

  /**
   * Update mute button visually
   */
  setMuteButtonState(isMuted: boolean): void {
    if (this.muteButton) {
      this.muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
      this.muteButton.style.backgroundColor = isMuted ? '#ff6b6b' : '#51cf66';
    }
  }

  // --- General UI State ---
  isUIOpen(): boolean {
    return this.isDialogueActive() || this.isInventoryOpen(); // FIXED: added () to call the method
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
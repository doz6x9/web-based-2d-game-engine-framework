/**
 * Thin wrapper around the HUD elements declared in index.html.
 * Everything here is demo code: the engine itself has no DOM UI.
 */
export class Hud {
  private dialogueBox = document.getElementById('dialogueBox');
  private dialogueSpeaker = document.getElementById('dialogueSpeaker');
  private dialogueText = document.getElementById('dialogueText');
  private levelDisplay = document.getElementById('levelDisplay');
  private playerHealth = document.getElementById('playerHealth');
  private playerCoords = document.getElementById('playerCoords');
  private mouseCoords = document.getElementById('mouseCoords');
  private inventoryList = document.getElementById('inventoryList');
  private inventoryPanel = document.getElementById('inventoryPanel');
  private queue: Array<{ speaker: string; text: string }> = [];

  constructor() {
    this.dialogueBox?.addEventListener('click', () => this.next());
    document.getElementById('skipDialogueButton')?.addEventListener('click', () => {
      this.queue = [];
      this.next();
    });
    document.getElementById('inventoryButton')?.addEventListener('click', () => {
      if (!this.inventoryPanel) return;
      const open = this.inventoryPanel.style.display === 'block';
      this.inventoryPanel.style.display = open ? 'none' : 'block';
    });
  }

  say(speaker: string, text: string): void {
    this.queue.push({ speaker, text });
    if (this.dialogueBox?.style.display !== 'block') this.next();
  }

  private next(): void {
    const line = this.queue.shift();
    if (!this.dialogueBox) return;
    if (!line) {
      this.dialogueBox.style.display = 'none';
      return;
    }
    if (this.dialogueSpeaker) this.dialogueSpeaker.textContent = line.speaker;
    if (this.dialogueText) this.dialogueText.textContent = line.text;
    this.dialogueBox.style.display = 'block';
  }

  setLevel(level: number, name: string): void {
    if (!this.levelDisplay) return;
    // Some map names already start with "Level N:", so don't repeat it.
    this.levelDisplay.textContent = /^level\s*\d+/i.test(name) ? name : `Level ${level}: ${name}`;
  }

  setHealth(current: number, max: number): void {
    if (this.playerHealth) this.playerHealth.textContent = `${current}/${max}`;
  }

  setPlayerCoords(x: number, y: number): void {
    if (this.playerCoords) this.playerCoords.textContent = `${x}, ${y}`;
  }

  setMouseCoords(x: number, y: number): void {
    if (this.mouseCoords) this.mouseCoords.textContent = `${x}, ${y}`;
  }

  setInventory(items: string[]): void {
    if (!this.inventoryList) return;
    this.inventoryList.innerHTML = '';
    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'inventory-item';
      li.textContent = 'Empty';
      this.inventoryList.appendChild(li);
      return;
    }
    for (const name of items) {
      const li = document.createElement('li');
      li.className = 'inventory-item';
      li.textContent = name;
      this.inventoryList.appendChild(li);
    }
  }
}

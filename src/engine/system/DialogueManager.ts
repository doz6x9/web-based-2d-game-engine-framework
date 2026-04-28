import { KeyboardHandler, KeyboardEventType } from '../interaction/KeyboardHandler';

export interface DialogueLine {
  speaker: string;
  text: string;
}

export class DialogueManager {
  private dialogueBox: HTMLElement | null;
  private dialogueSpeaker: HTMLElement | null;
  private dialogueText: HTMLElement | null;
  // private keyboardHandler: KeyboardHandler; // No longer needed for dialogue progression

  private currentDialogue: DialogueLine[] = [];
  private currentLineIndex: number = 0;
  private isActive: boolean = false;
  private resolveDialoguePromise: ((value: unknown) => void) | null = null;

  // KeyboardHandler is still passed but not used for dialogue progression directly
  constructor(keyboardHandler: KeyboardHandler) {
    this.dialogueBox = document.getElementById('dialogueBox');
    this.dialogueSpeaker = document.getElementById('dialogueSpeaker');
    this.dialogueText = document.getElementById('dialogueText');
    // this.keyboardHandler = keyboardHandler; // No longer storing keyboardHandler

    // Removed keyboard listener for dialogue progression
    // this.keyboardHandler.on(KeyboardEventType.KEY_DOWN, this.handleKeyDown.bind(this));

    // Add click listener to dialogue box for progression
    if (this.dialogueBox) {
      this.dialogueBox.addEventListener('click', this.handleClick.bind(this));
    }
  }

  /**
   * Start a new dialogue sequence.
   * @param dialogue An array of DialogueLine objects.
   * @returns A Promise that resolves when the dialogue is finished.
   */
  startDialogue(dialogue: DialogueLine[]): Promise<unknown> {
    if (this.isActive) {
      console.warn('Dialogue already active. Cannot start new dialogue.');
      return Promise.resolve();
    }

    this.currentDialogue = dialogue;
    this.currentLineIndex = 0;
    this.isActive = true;
    this.showDialogueBox();
    this.displayCurrentLine();

    return new Promise((resolve) => {
      this.resolveDialoguePromise = resolve;
    });
  }

  /**
   * Advance to the next line of dialogue or end the dialogue.
   */
  private advanceDialogue(): void {
    if (!this.isActive) return;

    this.currentLineIndex++;
    if (this.currentLineIndex < this.currentDialogue.length) {
      this.displayCurrentLine();
    } else {
      this.endDialogue();
    }
  }

  /**
   * Display the current line of dialogue in the HTML elements.
   */
  private displayCurrentLine(): void {
    if (this.dialogueSpeaker && this.dialogueText && this.currentDialogue[this.currentLineIndex]) {
      const line = this.currentDialogue[this.currentLineIndex];
      this.dialogueSpeaker.textContent = line.speaker;
      this.dialogueText.textContent = line.text;
    }
  }

  /**
   * Show the dialogue box.
   */
  private showDialogueBox(): void {
    if (this.dialogueBox) {
      this.dialogueBox.style.display = 'block';
    }
  }

  /**
   * Hide the dialogue box.
   */
  private hideDialogueBox(): void {
    if (this.dialogueBox) {
      this.dialogueBox.style.display = 'none';
    }
  }

  /**
   * End the current dialogue sequence.
   */
  private endDialogue(): void {
    this.isActive = false;
    this.currentDialogue = [];
    this.currentLineIndex = 0;
    this.hideDialogueBox();
    if (this.resolveDialoguePromise) {
      this.resolveDialoguePromise(true);
      this.resolveDialoguePromise = null;
    }
  }

  /**
   * Handle click event for dialogue progression.
   */
  private handleClick(): void {
    if (this.isActive) {
      this.advanceDialogue();
    }
  }

  /**
   * Check if dialogue is currently active.
   */
  isDialogueActive(): boolean {
    return this.isActive;
  }

  /**
   * Skip the entire dialogue sequence.
   */
  skip(): void {
    if (this.isActive) {
      this.endDialogue();
    }
  }

  /**
   * Clean up event listeners.
   */
  destroy(): void {
    if (this.dialogueBox) {
      this.dialogueBox.removeEventListener('click', this.handleClick.bind(this));
    }
    // if (this.keyboardHandler) {
    //   this.keyboardHandler.off(KeyboardEventType.KEY_DOWN, this.handleKeyDown.bind(this));
    // }
  }
}

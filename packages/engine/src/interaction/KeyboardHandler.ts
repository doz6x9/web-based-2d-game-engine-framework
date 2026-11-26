/** Keyboard events a {@link KeyboardHandler} can report. */
export enum KeyboardEventType {
  KEY_DOWN = 'keydown',
  KEY_UP = 'keyup',
}

/** Called with the `KeyboardEvent.code` of the key (for example `"KeyW"` or `"ArrowUp"`). */
export type KeyboardCallback = (code: string) => void;

/**
 * Tracks pressed keys and forwards key events to listeners.
 * It listens on `window` from construction until {@link KeyboardHandler.destroy} is called.
 */
export class KeyboardHandler {
  private listeners: Map<KeyboardEventType, Set<KeyboardCallback>> = new Map();
  private pressedKeys: Set<string> = new Set();
  private readonly boundKeyDown = this.onKeyDown.bind(this);
  private readonly boundKeyUp = this.onKeyUp.bind(this);

  constructor() {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  /**
   * Register an event listener for a keyboard event type.
   */
  on(eventType: KeyboardEventType, callback: KeyboardCallback): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  /**
   * Remove an event listener.
   */
  off(eventType: KeyboardEventType, callback: KeyboardCallback): void {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType)!.delete(callback);
    }
  }

  /**
   * Handle keydown event.
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (!this.pressedKeys.has(event.code)) {
      this.pressedKeys.add(event.code);
      this.emit(KeyboardEventType.KEY_DOWN, event.code);
    }
  }

  /**
   * Handle keyup event.
   */
  private onKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
    this.emit(KeyboardEventType.KEY_UP, event.code);
  }

  /**
   * Emit a keyboard event to all registered listeners.
   */
  private emit(eventType: KeyboardEventType, code: string): void {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType)!.forEach((callback) => callback(code));
    }
  }

  /**
   * Check if a specific key is currently pressed.
   */
  isKeyPressed(keyCode: string): boolean {
    return this.pressedKeys.has(keyCode);
  }

  /**
   * Clean up event listeners.
   */
  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    this.listeners.clear();
    this.pressedKeys.clear();
  }
}

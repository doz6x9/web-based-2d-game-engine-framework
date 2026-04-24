import { Vector } from '../core/Vector';

/**
 * Mouse event types
 */
export enum MouseEventType {
  LEFT_CLICK = 'left',
  RIGHT_CLICK = 'right',
  MOVE = 'move',
}

/**
 * Mouse interaction handler
 */
export class MouseHandler {
  private canvas: HTMLCanvasElement;
  private mousePosition: Vector = new Vector(0, 0);
  private callbacks: Map<MouseEventType, Array<(pos: Vector) => void>> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('click', (e) => {
      const pos = this.getMouseGridPosition(e);
      if (e.button === 0) {
        this.triggerEvent(MouseEventType.LEFT_CLICK, pos);
      } else if (e.button === 2) {
        this.triggerEvent(MouseEventType.RIGHT_CLICK, pos);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const pos = this.getMouseGridPosition(e);
      this.mousePosition = pos;
      this.triggerEvent(MouseEventType.MOVE, pos);
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  /**
   * Get mouse position in grid coordinates
   */
  private getMouseGridPosition(event: MouseEvent): Vector {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const tileSize = 32; // Should match renderer
    const gridX = Math.floor(x / tileSize);
    const gridY = Math.floor(y / tileSize);

    return new Vector(gridX, gridY);
  }

  /**
   * Register event callback
   */
  on(
    eventType: MouseEventType,
    callback: (pos: Vector) => void
  ): void {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, []);
    }
    this.callbacks.get(eventType)!.push(callback);
  }

  /**
   * Trigger event
   */
  private triggerEvent(eventType: MouseEventType, pos: Vector): void {
    const callbacks = this.callbacks.get(eventType);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(pos);
      }
    }
  }

  /**
   * Get current mouse position
   */
  getMousePosition(): Vector {
    return this.mousePosition;
  }
}

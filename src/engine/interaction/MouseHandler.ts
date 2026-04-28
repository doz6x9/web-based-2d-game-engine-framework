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
 * Interface for camera coordinate conversion
 */
export interface ICamera {
  width: number;
  height: number;
  screenToWorld(screenX: number, screenY: number): Vector;
}

/**
 * Mouse interaction handler
 */
export class MouseHandler {
  private canvas: HTMLCanvasElement;
  private camera: ICamera | null = null;
  private tileSize: number = 32;
  private mousePosition: Vector = new Vector(0, 0);
  private callbacks: Map<MouseEventType, Array<(pos: Vector) => void>> = new Map();

  constructor(canvas: HTMLCanvasElement, camera?: ICamera, tileSize?: number) {
    this.canvas = canvas;
    this.camera = camera || null;
    if (tileSize) this.tileSize = tileSize;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Use mousedown instead of click to reliably capture right-clicks
    this.canvas.addEventListener('mousedown', (e) => {
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
      e.preventDefault(); // Prevent the browser's default context menu
    });
  }

  /**
   * Get mouse position in grid coordinates
   * Accounts for camera offset if camera is provided
   */
  private getMouseGridPosition(event: MouseEvent): Vector {
    const rect = this.canvas.getBoundingClientRect();

    // Calculate the scale factor in case the canvas is resized by CSS
    let scaleX = 1;
    let scaleY = 1;

    if (this.camera) {
      scaleX = this.camera.width / rect.width;
      scaleY = this.camera.height / rect.height;
    } else {
      scaleX = this.canvas.width / rect.width;
      scaleY = this.canvas.height / rect.height;
    }

    // Apply the scale to the mouse position
    const screenX = (event.clientX - rect.left) * scaleX;
    const screenY = (event.clientY - rect.top) * scaleY;

    // If camera is available, use it for proper world-space conversion
    if (this.camera) {
      return this.camera.screenToWorld(screenX, screenY);
    }

    // Fallback to simple screen-to-grid conversion (no camera offset)
    const gridX = Math.floor(screenX / this.tileSize);
    const gridY = Math.floor(screenY / this.tileSize);

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

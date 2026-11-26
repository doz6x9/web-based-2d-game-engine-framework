import { Vector } from './Vector';
import * as PIXI from 'pixi.js';

/**
 * Generic Map object types for the engine
 * Removed game-specific types like ENEMY or TRAP
 */
export enum MapObjectType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
  INTERACTIVE = 'interactive',
  LIGHT_SOURCE = 'light',
  TRIGGER = 'trigger',
}

/**
 * Generic Entity class for all map objects
 * Developers can extend this class in their own game layer
 */
export class MapObject {
  id: string;
  type: MapObjectType;
  position: Vector;
  sprite: string;

  // Framework-level properties
  isActive: boolean = true;
  pixiSprite: PIXI.Sprite | null = null;
  radius: number = 0; // Generic range property for FOV/Interaction/Triggers

  /**
   * Generic metadata storage
   * This replaces hardcoded properties like health, patrolPath, etc.
   */
  private properties: Map<string, any> = new Map();

  constructor(
    id: string,
    type: MapObjectType,
    position: Vector,
    sprite: string
  ) {
    this.id = id;
    this.type = type;
    this.position = position;
    this.sprite = sprite;
  }

  /**
   * Lifecycle method: Called by the GameEngine every frame
   */
  update(deltaTime: number): void {
    // Framework-level update logic (e.g., sprite synchronization)
    if (this.pixiSprite) {
      this.pixiSprite.x = this.position.x;
      this.pixiSprite.y = this.position.y;
    }
  }

  /**
   * Set generic object property
   */
  setProperty(key: string, value: any): void {
    this.properties.set(key, value);
  }

  /**
   * Get generic object property
   */
  getProperty(key: string): any {
    return this.properties.get(key);
  }

  /**
   * Generic move method
   */
  moveTo(newPosition: Vector): void {
    this.position = newPosition;
  }

  /**
   * Agnostic serialization
   */
  toJSON(): any {
    return {
      id: this.id,
      type: this.type,
      position: { x: this.position.x, y: this.position.y },
      sprite: this.sprite,
      radius: this.radius,
      properties: Object.fromEntries(this.properties),
    };
  }
}
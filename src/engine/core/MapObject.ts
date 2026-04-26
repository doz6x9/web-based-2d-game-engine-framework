import { Vector } from './Vector';

/**
 * Map object types
 */
export enum MapObjectType {
  PLAYER = 'player',
  NPC = 'npc',
  ENEMY = 'enemy',
  DOOR = 'door',
  CHEST = 'chest',
  LIGHT_SOURCE = 'light',
  TRAP = 'trap',
  TELEPORT = 'teleport',
}

/**
 * Base class for all map objects
 */
export class MapObject {
  id: string;
  type: MapObjectType;
  position: Vector;
  state: string = 'idle';
  properties: Map<string, any> = new Map();
  sprite: string;
  isActive: boolean = true;

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
   * Set object property
   */
  setProperty(key: string, value: any): void {
    this.properties.set(key, value);
  }

  /**
   * Get object property
   */
  getProperty(key: string): any {
    return this.properties.get(key);
  }

  /**
   * Update object state
   */
  setState(newState: string): void {
    this.state = newState;
  }

  /**
   * Move object to new position
   */
  moveTo(newPosition: Vector): void {
    this.position = newPosition;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): any {
    return {
      id: this.id,
      type: this.type,
      position: { x: this.position.x, y: this.position.y },
      state: this.state,
      sprite: this.sprite,
      properties: Object.fromEntries(this.properties),
    };
  }
}

/**
 * NPC class for non-player characters
 */
export class NPC extends MapObject {
  targetPosition: Vector | null = null;
  patrolPath: Vector[] = [];
  currentPatrolIndex: number = 0;
  behavior: 'patrol' | 'chase' | 'idle' = 'patrol';
  speed: number = 1;
  visionRange: number = 10;

  constructor(id: string, position: Vector, sprite: string) {
    super(id, MapObjectType.NPC, position, sprite);
  }

  /**
   * Set patrol path
   */
  setPatrolPath(path: Vector[]): void {
    this.patrolPath = path;
    this.currentPatrolIndex = 0;
  }

  /**
   * Set chase target
   */
  setTarget(target: Vector): void {
    this.targetPosition = target;
    this.behavior = 'chase';
  }

  /**
   * Return to patrol
   */
  returnToPatrol(): void {
    this.targetPosition = null;
    this.behavior = 'patrol';
  }

  /**
   * Get next waypoint in patrol
   */
  getNextPatrolPoint(): Vector | null {
    if (this.patrolPath.length === 0) return null;
    const waypoint = this.patrolPath[this.currentPatrolIndex];
    this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPath.length;
    return waypoint;
  }

  /**
   * Check if target is in vision range
   */
  canSeeTarget(target: Vector): boolean {
    return this.position.euclideanDistance(target) <= this.visionRange;
  }
}

/**
 * Enemy class for hostile entities
 */
export class Enemy extends NPC {
  health: number = 100;
  maxHealth: number = 100;
  attackRange: number = 1;
  attackPower: number = 10;

  constructor(id: string, position: Vector, sprite: string) {
    super(id, position, sprite);
    this.type = MapObjectType.ENEMY;
  }

  /**
   * Take damage
   */
  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  /**
   * Check if alive
   */
  isAlive(): boolean {
    return this.health > 0;
  }

  /**
   * Check if in attack range
   */
  isInAttackRange(target: Vector): boolean {
    return this.position.manhattanDistance(target) <= this.attackRange;
  }
}

/**
 * Interactive object class
 */
export class InteractiveObject extends MapObject {
  isInteractable: boolean = true;
  interactionText: string = 'Interact';

  constructor(
    id: string,
    type: MapObjectType,
    position: Vector,
    sprite: string
  ) {
    super(id, type, position, sprite);
  }

  /**
   * Handle interaction
   */
  interact(): boolean {
    if (!this.isInteractable) return false;

    switch (this.type) {
      case MapObjectType.DOOR:
        this.state = this.state === 'open' ? 'closed' : 'open';
        return true;

      case MapObjectType.CHEST:
        this.state = this.state === 'open' ? 'closed' : 'open';
        return true;

      case MapObjectType.TELEPORT:
        return true;

      default:
        return false;
    }
  }
}

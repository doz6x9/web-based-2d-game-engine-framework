import { Vector } from '../core/Vector';
import { AStarPathfinder } from './AStar';
import { Grid } from '../core/Grid';
import { NPC, Enemy } from '../core/MapObject';

/**
 * NPC AI System
 * Manages NPC behavior, pathfinding, and decision making
 */
export class NPCAISystem {
  private npcs: Map<string, NPC | Enemy> = new Map();
  private pathfinder: AStarPathfinder;
  private updateCounter: number = 0;
  private updateInterval: number = 2; // Update every 2 frames

  constructor(grid: Grid) {
    this.pathfinder = new AStarPathfinder(grid);
  }

  /**
   * Register NPC
   */
  registerNPC(npc: NPC | Enemy): void {
    this.npcs.set(npc.id, npc);
  }

  /**
   * Unregister NPC
   */
  unregisterNPC(npcId: string): void {
    this.npcs.delete(npcId);
  }

  /**
   * Get NPC by ID
   */
  getNPC(npcId: string): NPC | Enemy | undefined {
    return this.npcs.get(npcId);
  }

  /**
   * Get all NPCs
   */
  getAllNPCs(): (NPC | Enemy)[] {
    return Array.from(this.npcs.values());
  }

  /**
   * Update all NPCs
   */
  update(playerPosition: Vector): void {
    this.updateCounter++;

    for (const npc of this.npcs.values()) {
      if (!npc.isActive) continue;

      // Update behavior based on conditions
      this.updateNPCBehavior(npc, playerPosition);

      // Only update movement every N frames for performance
      if (this.updateCounter % this.updateInterval === 0) {
        this.updateNPCMovement(npc);
      }

      // Update enemy state
      if (npc instanceof Enemy) {
        this.updateEnemyState(npc, playerPosition);
      }
    }

    if (this.updateCounter > 100) {
      this.updateCounter = 0;
    }
  }

  /**
   * Update NPC behavior
   */
  private updateNPCBehavior(npc: NPC, playerPosition: Vector): void {
    if (npc.behavior === 'patrol') {
      // Check if player is in vision range
      if (npc.canSeeTarget(playerPosition)) {
        npc.setTarget(playerPosition);
      }
    } else if (npc.behavior === 'chase') {
      // Check if lost sight of target
      if (npc.targetPosition) {
        const distance = npc.position.euclideanDistance(npc.targetPosition);
        if (distance > npc.visionRange * 1.5) {
          npc.returnToPatrol();
        }
      }
    }
  }

  /**
   * Update NPC movement
   */
  private updateNPCMovement(npc: NPC): void {
    let target: Vector | null = null;

    if (npc.behavior === 'chase' && npc.targetPosition) {
      target = npc.targetPosition;
    } else if (npc.behavior === 'patrol') {
      target = npc.getNextPatrolPoint();
    }

    if (!target) return;

    // Find path to target
    const path = this.pathfinder.findPath(npc.position, target);

    if (path.length > 0) {
      // Move to next waypoint
      const nextPos = path[Math.min(npc.speed, path.length - 1)];
      npc.moveTo(nextPos);
    }
  }

  /**
   * Update enemy-specific state
   */
  private updateEnemyState(enemy: Enemy, playerPosition: Vector): void {
    if (!enemy.isAlive()) {
      enemy.setState('dead');
      enemy.isActive = false;
      return;
    }

    if (enemy.behavior === 'chase' && enemy.targetPosition) {
      // Check if in attack range
      if (enemy.isInAttackRange(enemy.targetPosition)) {
        enemy.setState('attacking');
      } else {
        enemy.setState('chasing');
      }
    } else {
      enemy.setState('patrolling');
    }
  }

  /**
   * Get enemies in range
   */
  getEnemiesInRange(position: Vector, range: number): Enemy[] {
    return Array.from(this.npcs.values())
      .filter((npc) => npc instanceof Enemy)
      .filter((npc) => position.euclideanDistance(npc.position) <= range) as Enemy[];
  }

  /**
   * Get NPCs in range
   */
  getNPCsInRange(position: Vector, range: number): NPC[] {
    return Array.from(this.npcs.values()).filter(
      (npc) => position.euclideanDistance(npc.position) <= range
    );
  }

  /**
   * Find nearest NPC
   */
  findNearestNPC(position: Vector): NPC | null {
    let nearest: NPC | null = null;
    let minDistance = Infinity;

    for (const npc of this.npcs.values()) {
      const distance = position.euclideanDistance(npc.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = npc;
      }
    }

    return nearest;
  }

  /**
   * Create AI from JSON data
   */
  static createFromJSON(
    data: any,
    grid: Grid
  ): NPCAISystem {
    const system = new NPCAISystem(grid);

    if (data.npcs) {
      for (const npcData of data.npcs) {
        const npc = new NPC(
          npcData.id,
          new Vector(npcData.position.x, npcData.position.y),
          npcData.sprite
        );

        if (npcData.patrolPath) {
          npc.setPatrolPath(
            npcData.patrolPath.map((p: any) => new Vector(p.x, p.y))
          );
        }

        if (npcData.visionRange) {
          npc.visionRange = npcData.visionRange;
        }

        system.registerNPC(npc);
      }
    }

    return system;
  }
}

import { GameEngine } from '../GameEngine';
import { Vector } from '../core/Vector';
import { MapObject, MapObjectType, InteractiveObject, NPC, Enemy } from '../core/MapObject';
import { Item, ItemType } from '../core/Item';
import { DialogueLine } from './DialogueManager';
import { CellType } from '../core/Grid';
import { ParticlePresets } from '../render/Particles';
import { PlayerManager } from './PlayerManager';

export class InteractionManager {
  constructor(
    private engine: GameEngine,
    private player: PlayerManager,
    private onLevelComplete: () => void // Callback to alert GameApp
  ) {}

  public handleInteract(targetObject: MapObject | null): void {
    if (this.engine.getUIManager().isUIOpen() && !targetObject) return;

    const objectToInteract = targetObject || this.getNearbyInteractable();
    if (!objectToInteract) return;

    if (objectToInteract instanceof NPC) {
        if (objectToInteract.type === MapObjectType.ENEMY) {
            this.handleEnemyCombat(objectToInteract as Enemy);
        } else {
            this.handleNPCConversation(objectToInteract);
        }
    } else {
        switch (objectToInteract.type) {
            case MapObjectType.ITEM: this.handleItemPickup(objectToInteract); break;
            case MapObjectType.DOOR: this.handleDoorInteraction(objectToInteract as InteractiveObject); break;
            case MapObjectType.CHEST: this.handleChestInteraction(objectToInteract as InteractiveObject); break;
        }
    }
  }

  private getNearbyInteractable(): MapObject | null {
    const playerPos = this.engine.getPlayerPosition();
    for (const object of this.engine.getAllMapObjects()) {
      const isCloseEnough = object.position.manhattanDistance(playerPos) <= 1;
      const isInteractable = object instanceof NPC || [MapObjectType.ITEM, MapObjectType.DOOR, MapObjectType.CHEST].includes(object.type);
      if (isCloseEnough && isInteractable) return object;
    }
    return null;
  }

  private handleEnemyCombat(enemy: Enemy): void {
    const ui = this.engine.getUIManager();
    const particles = this.engine.getParticleSystem();
    const attackPower = this.player.effectiveAttackPower;

    const weaponName = this.player.equippedWeapon ? `your ${this.player.equippedWeapon.name}` : 'your bare hands';
    ui.startDialogue([{ speaker: 'Player', text: `You strike with ${weaponName}, dealing ${attackPower} damage!` }]);

    enemy.takeDamage(attackPower);
    particles.getEmitter(particles.createEmitter(enemy.position.clone(), ParticlePresets.BLOOD))?.setLifetime(200);

    if (!enemy.isAlive()) {
      particles.getEmitter(particles.createEmitter(enemy.position.clone(), ParticlePresets.EXPLOSION))?.setLifetime(300);
      this.engine.removeMapObject(enemy.id);
      ui.startDialogue([{ speaker: 'System', text: `${enemy.id} defeated!` }]);
    } else {
      ui.startDialogue([{ speaker: 'System', text: `${enemy.id} took ${attackPower} damage. Health: ${enemy.health}/${enemy.maxHealth}.` }]);

      // Enemy counter-attack
      ui.startDialogue([{ speaker: enemy.id, text: `You took ${enemy.attackPower} damage!` }]);
      const isDead = this.player.takeDamage(enemy.attackPower);

      if (isDead) {
        ui.startDialogue([{ speaker: 'System', text: 'Game Over! Your adventure ends here.' }]);
        this.engine.stopGameLoop();
      }
    }
  }

  private handleNPCConversation(npc: NPC): void {
    this.engine.getUIManager().startDialogue([
      { speaker: npc.id, text: 'Hello, traveler!' },
      { speaker: 'Player', text: 'Indeed. What brings you to this place?' },
      { speaker: npc.id, text: 'Just enjoying the quiet.' },
    ]);
  }

  private handleItemPickup(mapObject: MapObject): void {
    const rawType = mapObject.getProperty('item_type') || mapObject.getProperty('itemType') || mapObject.getProperty('type') || ItemType.GENERIC;

    const item = new Item(
      (mapObject.getProperty('itemId') || mapObject.id) as string,
      (mapObject.getProperty('name') || mapObject.id) as string,
      (mapObject.getProperty('description') || '') as string,
      mapObject.sprite,
      rawType.toString().toLowerCase() as ItemType,
      (mapObject.getProperty('stackable') || false) as boolean,
      (mapObject.getProperty('maxStackSize') || 1) as number,
      (mapObject.getProperty('quantity') || 1) as number
    );

    this.engine.getInventory().addItem(item);
    this.engine.removeMapObject(mapObject.id);

    // Auto-equip/consume check logic
    if (item.type === ItemType.WEAPON || item.type === ('weapon' as ItemType)) {
      this.player.equip(item);
      this.engine.getUIManager().startDialogue([{ speaker: 'System', text: `You automatically equipped the ${item.name}.` }]);
    } else if (item.type === ItemType.CONSUMABLE || item.type === ('consumable' as ItemType)) {
      this.player.useItem(item.id);
    } else {
      this.engine.getUIManager().startDialogue([{ speaker: 'System', text: `Picked up ${item.name}.` }]);
    }

    this.engine.getUIManager().updateInventoryDisplay(this.engine.getInventory());
  }

  private handleDoorInteraction(gate: InteractiveObject): void {
    const ui = this.engine.getUIManager();

    if (gate.getProperty('isOpen')) {
        this.processDoorPassage(gate, 'You step through the open gate...');
        return;
    }

    const keyId = gate.getProperty('keyId') as string;
    const reqEnemyId = gate.getProperty('requiredEnemyId') as string;

    if (keyId && !this.engine.getInventory().hasItem(keyId)) return void ui.startDialogue([{ speaker: 'System', text: 'Locked. You need a key.' }]);
    if (reqEnemyId && this.engine.getAllMapObjects().some(obj => obj.id === reqEnemyId)) return void ui.startDialogue([{ speaker: 'System', text: `Defeat the ${reqEnemyId} first!` }]);

    if (keyId) this.engine.getInventory().removeItem(keyId);

    gate.setProperty('isOpen', true);
    gate.sprite = 'gate_open';
    if (gate.pixiSprite) {
        const tex = this.engine.getRenderer().getTexture('gate_open');
        if (tex) gate.pixiSprite.texture = tex;
    }

    this.engine.getGrid().setCellType(gate.position.x, gate.position.y, CellType.STONE_FLOOR);
    this.processDoorPassage(gate, 'You opened the gate!');
  }

  private processDoorPassage(gate: InteractiveObject, defaultMessage: string): void {
    const isExit = gate.getProperty('isLevelExit') || gate.isLevelExit;
    if (isExit) {
        this.engine.getUIManager().startDialogue([{ speaker: 'System', text: 'You step through the master gate...' }]).then(() => this.onLevelComplete());
    } else if (gate.getProperty('teleportTargetX') !== undefined) {
        this.engine.setPlayerPosition(new Vector(gate.getProperty('teleportTargetX') as number, gate.getProperty('teleportTargetY') as number));
        this.engine.getUIManager().startDialogue([{ speaker: 'System', text: `You stepped through the gate!` }]);
    } else {
        this.engine.getUIManager().startDialogue([{ speaker: 'System', text: defaultMessage }]);
    }
  }

  private handleChestInteraction(chest: InteractiveObject): void {
    if (chest.getProperty('isOpen')) return;

    chest.setProperty('isOpen', true);
    chest.sprite = 'chest_open';
    if (chest.pixiSprite) {
        const tex = this.engine.getRenderer().getTexture('chest_open');
        if (tex) chest.pixiSprite.texture = tex;
    }

    const contents: any[] = chest.getProperty('contents') || [];
    if (contents.length === 0) {
        return void this.engine.getUIManager().startDialogue([{ speaker: 'System', text: 'You opened the chest. It is empty.' }]);
    }

    let dialogue = 'You opened the chest. ';
    contents.forEach(rawItem => {
      const item = new Item(rawItem.id, rawItem.name || rawItem.id, '', rawItem.sprite || 'sword', rawItem.type || ItemType.GENERIC, false, 1, rawItem.quantity || 1);
      this.engine.getInventory().addItem(item);
      dialogue += `Found ${item.name}. `;
    });

    this.engine.getUIManager().startDialogue([{ speaker: 'System', text: dialogue.trim() }]);
    this.engine.getUIManager().updateInventoryDisplay(this.engine.getInventory());
  }
}
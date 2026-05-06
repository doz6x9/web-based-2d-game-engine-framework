import { GameEngine } from './engine/GameEngine';
import { Vector } from './engine/core/Vector';
import { PlayerManager } from './engine/system/PlayerManager';
import { InteractionManager } from './engine/system/InteractionManager';

export class GameApp {
  private engine: GameEngine;
  private player: PlayerManager;
  private interaction: InteractionManager;

  private levelMap: Map<number, { mapUrl: string; spawnPoint: Vector }> = new Map();
  private currentLevel: number = 1;

  constructor() {
    this.engine = new GameEngine();
    this.player = new PlayerManager(this.engine);
    this.interaction = new InteractionManager(this.engine, this.player, () => this.advanceToNextLevel());

    this.setupLevelMap();
    this.engine.setInteractionHandler((target) => this.interaction.handleInteract(target));
  }

  async init(canvas: HTMLCanvasElement, gameWidth: number, gameHeight: number): Promise<void> {
    await this.engine.init(canvas, gameWidth, gameHeight);

    // EXACT ASSET LIST PRESERVED HERE
    await this.engine.getRenderer().loadAssets([
      { id: 'hero', path: '/assets/hero.png' },
      { id: 'potion', path: '/assets/potion.png' },
      { id: 'gate', path: '/assets/gate.png' },
      { id: 'gate_open', path: '/assets/gate_open.png' },
      { id: 'chest', path: '/assets/chest.png' },
      { id: 'chest_open', path: '/assets/chest_open.png' },
      { id: 'sword', path: '/assets/sword.png' },
      { id: 'mana_potion', path: '/assets/mana_potion.png' },
      { id: 'goblin', path: '/assets/goblin.png' },
      { id: 'key', path: '/assets/key.png' },
      { id: 'torch', path: '/assets/torch.png' },
      { id: 'grass', path: '/assets/textures/grass.png' },
      { id: 'swamp', path: '/assets/textures/mud.png' },
      { id: 'path', path: '/assets/textures/path.png' },
      { id: 'forest', path: '/assets/textures/trees.png' },
      { id: 'water', path: '/assets/textures/water.png' },
      { id: 'tall_grass', path: '/assets/textures/junglegrass.png' },
      { id: 'stone_floor', path: '/assets/textures/stone%20tile.png' },
      { id: 'wood_floor', path: '/assets/textures/wood%20tile.png' },
      { id: 'deep_water', path: '/assets/textures/deepocean.png' },
      { id: 'snow', path: '/assets/textures/snow.png' },
      { id: 'cave_floor', path: '/assets/textures/cave%20gravel.png' },
      { id: 'sand', path: '/assets/textures/sand.png' },
      { id: 'wall_horizontal', path: '/assets/textures/caveCliff2.png' },
      { id: 'wall_vertical', path: '/assets/textures/caveCliff2.png' },
      { id: 'wall_corner_tl', path: '/assets/textures/caveCliff2.png' },
      { id: 'wall_corner_tr', path: '/assets/textures/caveCliff2.png' },
      { id: 'wall_corner_bl', path: '/assets/textures/caveCliff2.png' },
      { id: 'wall_corner_br', path: '/assets/textures/caveCliff2.png' },
      { id: 'cave_wall', path: '/assets/textures/caveCliff2.png' },
    ]);

    this.engine.setPlayerSprite('hero');
    await this.loadLevel(this.currentLevel);
    this.engine.getAudioManager().playBGM('/assets/audio/bgm.mp3', 0.1);
    this.setupUICallbacks();
  }

  private setupLevelMap(): void {
    this.levelMap.set(1, { mapUrl: '/maps/dungeon_adventure.json', spawnPoint: new Vector(2, 2) });
    this.levelMap.set(2, { mapUrl: '/maps/level2.json', spawnPoint: new Vector(18, 18) });
  }

  async loadLevel(level: number): Promise<void> {
    const levelData = this.levelMap.get(level);
    if (!levelData) return;

    this.currentLevel = level;
    await this.engine.loadLevel(levelData.mapUrl, levelData.spawnPoint);

    // Setup light sources
    this.engine.getAllMapObjects().forEach(obj => {
      obj.setProperty('hasLightSource', obj.sprite === 'torch' || obj.getProperty('itemId') === 'torch');
    });

    const mapName = this.engine.getMap()?.getName() || 'Unknown Level';
    this.engine.getUIManager().updateLevelDisplay(this.currentLevel, mapName);
  }

  async advanceToNextLevel(): Promise<void> {
    const nextLevel = this.currentLevel + 1;
    if (this.levelMap.has(nextLevel)) {
      await this.loadLevel(nextLevel);
      this.engine.getUIManager().startDialogue([{ speaker: 'System', text: `Welcome to Level ${this.currentLevel}!` }]);
    } else {
      this.engine.getUIManager().startDialogue([{ speaker: 'System', text: 'Congratulations! You completed all levels!' }]);
    }
  }

  private setupUICallbacks(): void {
    const ui = this.engine.getUIManager();
    const audio = this.engine.getAudioManager();

    ui.onPause(() => {
      const isRunning = !this.engine.getRunning();
      this.engine.setRunning(isRunning);
      ui.setPauseButtonState(!isRunning);
    });

    ui.onSave(() => {
      const success = this.engine.saveGame(0);
      ui.startDialogue([{ speaker: 'System', text: success ? 'Game saved!' : 'Save failed.' }]);
    });

    ui.onLoad(() => {
      const success = this.engine.loadGame(0);
      ui.startDialogue([{ speaker: 'System', text: success ? 'Game loaded!' : 'No save found.' }]);
    });

    ui.onMute(() => {
      const newMuteState = !audio.getMuted();
      audio.setMute(newMuteState);
      ui.setMuteButtonState(newMuteState);
    });

    // Route UI item usage directly to the PlayerManager
    ui.onUseItem((itemId: string) => this.player.useItem(itemId));
  }

  getEngine(): GameEngine {
    return this.engine;
  }
}
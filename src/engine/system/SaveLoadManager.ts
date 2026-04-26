import { Vector } from '../core/Vector';
import { NPC, Enemy, MapObject } from '../core/MapObject';

/**
 * Game state for saving
 */
export interface GameState {
  playerPosition: Vector;
  playerHealth?: number;
  mapName: string;
  npcs: any[];
  enemies: any[];
  objects: any[];
  fogOfWarState: any;
  exploredCells: string[];
  timestamp: number;
  version: string;
}

/**
 * Save game file format
 */
export interface SaveFile {
  version: string;
  timestamp: number;
  gameState: GameState;
  metadata: {
    playtime: number;
    difficultyLevel: string;
    playerName: string;
  };
}

/**
 * Save/Load Manager
 */
export class SaveLoadManager {
  private static readonly SAVE_PREFIX = 'gamengine_save_';
  private static readonly VERSION = '1.0';
  private maxSaves: number = 10;

  /**
   * Save game state
   */
  saveGame(
    slot: number,
    gameState: GameState,
    playerName: string = 'Player',
    difficultyLevel: string = 'Normal',
    playtime: number = 0
  ): boolean {
    try {
      const saveFile: SaveFile = {
        version: SaveLoadManager.VERSION,
        timestamp: Date.now(),
        gameState,
        metadata: {
          playerName,
          difficultyLevel,
          playtime,
        },
      };

      const key = `${SaveLoadManager.SAVE_PREFIX}${slot}`;
      const data = JSON.stringify(saveFile);

      // Try localStorage first
      try {
        localStorage.setItem(key, data);
        return true;
      } catch (e) {
        console.warn('LocalStorage full, using in-memory storage');
        return false;
      }
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  }

  /**
   * Load game state
   */
  loadGame(slot: number): SaveFile | null {
    try {
      const key = `${SaveLoadManager.SAVE_PREFIX}${slot}`;
      const data = localStorage.getItem(key);

      if (!data) {
        console.warn(`No save file found in slot ${slot}`);
        return null;
      }

      const saveFile: SaveFile = JSON.parse(data);

      // Validate version
      if (saveFile.version !== SaveLoadManager.VERSION) {
        console.warn('Save file version mismatch');
      }

      return saveFile;
    } catch (error) {
      console.error('Failed to load game:', error);
      return null;
    }
  }

  /**
   * Delete save file
   */
  deleteSave(slot: number): boolean {
    try {
      const key = `${SaveLoadManager.SAVE_PREFIX}${slot}`;
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to delete save:', error);
      return false;
    }
  }

  /**
   * Get all save files
   */
  getAllSaves(): Map<number, SaveFile> {
    const saves = new Map<number, SaveFile>();

    for (let i = 0; i < this.maxSaves; i++) {
      const save = this.loadGame(i);
      if (save) {
        saves.set(i, save);
      }
    }

    return saves;
  }

  /**
   * Export save to JSON string
   */
  exportSave(slot: number): string | null {
    const saveFile = this.loadGame(slot);
    if (!saveFile) return null;

    return JSON.stringify(saveFile, null, 2);
  }

  /**
   * Import save from JSON string
   */
  importSave(slot: number, jsonData: string): boolean {
    try {
      const saveFile: SaveFile = JSON.parse(jsonData);
      const key = `${SaveLoadManager.SAVE_PREFIX}${slot}`;
      localStorage.setItem(key, JSON.stringify(saveFile));
      return true;
    } catch (error) {
      console.error('Failed to import save:', error);
      return false;
    }
  }

  /**
   * Create game state from current game
   */
  static createGameState(
    playerPosition: Vector,
    mapName: string,
    npcs: (NPC | Enemy)[],
    objects: MapObject[],
    fogOfWarState: any,
    exploredCells: Set<string>
  ): GameState {
    return {
      playerPosition,
      mapName,
      npcs: npcs.map((npc) => npc.toJSON()),
      enemies: npcs
        .filter((npc) => npc instanceof Enemy)
        .map((enemy) => (enemy as Enemy).toJSON()),
      objects: objects.map((obj) => obj.toJSON()),
      fogOfWarState,
      exploredCells: Array.from(exploredCells),
      timestamp: Date.now(),
      version: SaveLoadManager.VERSION,
    };
  }

  /**
   * Auto-save game (called periodically)
   */
  autoSave(
    slot: number,
    gameState: GameState,
    playerName: string = 'Player'
  ): boolean {
    return this.saveGame(slot, gameState, playerName, 'Normal', 0);
  }

  /**
   * Check if save slot exists
   */
  hasSave(slot: number): boolean {
    const key = `${SaveLoadManager.SAVE_PREFIX}${slot}`;
    return localStorage.getItem(key) !== null;
  }

  /**
   * Get save metadata
   */
  getSaveMetadata(slot: number): any | null {
    const saveFile = this.loadGame(slot);
    if (!saveFile) return null;

    return {
      slot,
      timestamp: new Date(saveFile.timestamp).toLocaleString(),
      playerName: saveFile.metadata.playerName,
      difficulty: saveFile.metadata.difficultyLevel,
      playtime: saveFile.metadata.playtime,
      mapName: saveFile.gameState.mapName,
    };
  }
}

/**
 * Quick save system
 */
export class QuickSaveManager extends SaveLoadManager {
  private static readonly QUICKSAVE_SLOT = 999;
  private static readonly AUTOSAVE_SLOT = 998;

  /**
   * Make quick save
   */
  quickSave(gameState: GameState, playerName: string = 'Player'): boolean {
    return this.saveGame(QuickSaveManager.QUICKSAVE_SLOT, gameState, playerName);
  }

  /**
   * Load quick save
   */
  quickLoad(): SaveFile | null {
    return this.loadGame(QuickSaveManager.QUICKSAVE_SLOT);
  }

  /**
   * Has quick save
   */
  hasQuickSave(): boolean {
    return this.hasSave(QuickSaveManager.QUICKSAVE_SLOT);
  }

  /**
   * Auto save
   */
  createAutoSave(gameState: GameState, playerName: string = 'Player'): boolean {
    return this.saveGame(QuickSaveManager.AUTOSAVE_SLOT, gameState, playerName);
  }

  /**
   * Load auto save
   */
  loadAutoSave(): SaveFile | null {
    return this.loadGame(QuickSaveManager.AUTOSAVE_SLOT);
  }

  /**
   * Has auto save
   */
  hasAutoSave(): boolean {
    return this.hasSave(QuickSaveManager.AUTOSAVE_SLOT);
  }
}

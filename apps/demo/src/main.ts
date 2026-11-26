import './styles/main.scss';
import { GameApp } from './game/GameApp';

/**
 * Application initialization
 */
async function initializeGame(): Promise<void> {
  const game = new GameApp();
  try {
    await game.start();
    console.log('[APP] Game started successfully');
    // Make game accessible from console for debugging
    (window as any).game = game;
  } catch (error) {
    console.error('[APP] Game initialization failed:', error);
  }
}

// Start the game when the page loads
window.addEventListener('load', initializeGame);

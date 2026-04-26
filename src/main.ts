import './styles/main.scss';
import { GameEngine } from './engine/GameEngine';

// Initialize the game engine
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const engine = new GameEngine(canvas, 1280, 720);

// Load the demo map
engine.loadMap('/maps/test-map.json').catch((error) => {
  console.error('Failed to load map:', error);
});

// Update UI with player position
setInterval(() => {
  const playerPos = engine.getPlayerPosition();
  document.getElementById('playerCoords')!.textContent = `${playerPos.x}, ${playerPos.y}`;
}, 100);

// Update UI with mouse position
const mouseHandler = engine.getMouseHandler();
mouseHandler.on(
  'move' as any,
  (pos) => {
    document.getElementById('mouseCoords')!.textContent = `${pos.x}, ${pos.y}`;
  }
);

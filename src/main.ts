import { GameEngine } from './engine/GameEngine';
import { Vector } from './engine/core/Vector';
import { AStarPathfinder } from './engine/algorithms/AStar';
import { FieldOfView } from './engine/algorithms/FieldOfView';
import { FogOfWar } from './engine/algorithms/FogOfWar';

// 1. Grab the HTML canvas and start the Engine
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const engine = new GameEngine(canvas, 800, 600);

// Set up state variables
let playerPosition = new Vector(1, 1); // Start at top-left corner
let pathfinder: AStarPathfinder;
let fov: FieldOfView;
let fog: FogOfWar;

async function bootstrapGame() {
    // 2. Load the Map we just created
    await engine.loadMap('/maps/demo-level.json');
    engine.setPlayerPosition(playerPosition);

    // 3. Initialize Algorithms using the loaded map grid
    const grid = engine.getGrid();
    pathfinder = new AStarPathfinder(grid);
    fov = new FieldOfView(grid);
    fog = new FogOfWar(grid.width, grid.height, fov);

    // 4. Do an initial vision check
    updateVision();
}

bootstrapGame();



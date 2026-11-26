import { Grid, CellType } from '../src/core/Grid';

const SYMBOLS: Record<string, CellType> = {
  '.': CellType.GRASS,
  '#': CellType.CAVE_WALL,
  '~': CellType.SWAMP,
  '=': CellType.PATH,
  'w': CellType.WATER,
  's': CellType.STONE_FLOOR,
};

/** Builds a grid from rows of symbols: . grass, # wall, ~ swamp, = path, w water, s stone. */
export function gridFrom(rows: string[]): Grid {
  const grid = new Grid(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const type = SYMBOLS[ch];
      if (type === undefined) throw new Error(`Unknown map symbol "${ch}"`);
      grid.setCellType(x, y, type);
    });
  });
  return grid;
}

/** Sum of the cost of entering each cell on the path (the start cell is free). */
export function pathCost(grid: Grid, path: { x: number; y: number }[]): number {
  return path.reduce((sum, p) => sum + grid.getCell(p.x, p.y)!.cost, 0);
}

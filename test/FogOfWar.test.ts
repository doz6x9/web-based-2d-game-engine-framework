import { describe, it, expect } from 'vitest';
import { FieldOfView } from '../src/algorithms/FieldOfView';
import { FogOfWar, FogState } from '../src/algorithms/FogOfWar';
import { gridFrom } from './helpers';

const makeFog = () => new FogOfWar(5, 5, new FieldOfView(gridFrom(Array(5).fill('.....'))));

describe('FogOfWar', () => {
  it('starts with every cell unknown', () => {
    const fog = makeFog();
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) expect(fog.getFogState(x, y)).toBe(FogState.UNKNOWN);
  });

  it('marks what is in view as visible and remembers it as explored', () => {
    const fog = makeFog();
    fog.updateFromFOV(new Set(['1,1', '2,1']));
    expect(fog.getFogState(1, 1)).toBe(FogState.VISIBLE);
    expect(fog.isExplored(2, 1)).toBe(true);

    fog.updateFromFOV(new Set(['3,3']));
    expect(fog.getFogState(1, 1)).toBe(FogState.EXPLORED);
    expect(fog.getFogState(2, 1)).toBe(FogState.EXPLORED);
    expect(fog.getFogState(3, 3)).toBe(FogState.VISIBLE);
    expect(fog.getFogState(4, 4)).toBe(FogState.UNKNOWN);
  });

  it('marks cells explored without making them visible', () => {
    const fog = makeFog();
    fog.markMultipleExplored(new Set(['0,0', '0,1']));
    expect(fog.getFogState(0, 0)).toBe(FogState.EXPLORED);
    expect(fog.isVisible(0, 0)).toBe(false);
  });

  it('does not downgrade a visible cell when it is also marked explored', () => {
    const fog = makeFog();
    fog.updateFromFOV(new Set(['2,2']));
    fog.markMultipleExplored(new Set(['2,2']));
    expect(fog.getFogState(2, 2)).toBe(FogState.VISIBLE);
  });

  it('bumps its version on every change so the renderer knows to redraw', () => {
    const fog = makeFog();
    const v0 = fog.version;
    fog.updateFromFOV(new Set(['1,1']));
    fog.markMultipleExplored(new Set(['2,2']));
    fog.reset();
    expect(fog.version).toBe(v0 + 3);
  });

  it('forgets everything on reset', () => {
    const fog = makeFog();
    fog.updateFromFOV(new Set(['1,1']));
    fog.reset();
    expect(fog.getFogState(1, 1)).toBe(FogState.UNKNOWN);
    expect(fog.isExplored(1, 1)).toBe(false);
  });
});

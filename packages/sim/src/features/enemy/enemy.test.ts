import { describe, expect, it } from 'vitest';
import { clubYard } from '../../content/levels/clubYard';
import type { Blow } from '../../core/blow';
import { Sim } from '../../core/sim';
import { features } from '..';
import { getStickMan } from '../player/view';
import { clubEnemyDef } from './clubEnemy/defs';
import { ENEMY } from './defs';
import { strikeEnemiesWith } from './index';
import { getEnemies } from './view';

describe('striking at the enemies', () => {
  it('tears the enemy a blow touches, and says so', () => {
    const sim = createSimInYard();
    expect(getEnemies(sim)[0]!.torn).toBeNull();
    expect(strikeEnemiesWith(sim, makeBlowEndingAt(POST.x - clubEnemyDef.width / 2))).toBe(true);
    expect(getEnemies(sim)[0]!.torn).toEqual({ action: 'tearing', progress: 0 });
  });

  it('does nothing with a blow that stops short of it, passes over it or passes under it', () => {
    const sim = createSimInYard();
    const top = clubEnemyDef.floatHeight + clubEnemyDef.height;
    const misses: Blow[] = [
      makeBlowEndingAt(POST.x - clubEnemyDef.width / 2 - 0.2),
      { ...makeBlowEndingAt(POST.x), start: { x: POST.x - 2, y: -top - 0.2 } },
      { ...makeBlowEndingAt(POST.x), start: { x: POST.x - 2, y: 0 } },
    ].map((blow) => ({ ...blow, end: { x: blow.end.x, y: blow.start.y } }));
    for (const blow of misses) {
      expect(strikeEnemiesWith(sim, blow)).toBe(false);
    }
    expect(getEnemies(sim)[0]!.torn).toBeNull();
  });

  it('does not strike twice: a torn enemy is not struck again, and goes on from where it was', () => {
    const sim = createSimInYard();
    const blow = makeBlowEndingAt(POST.x);
    strikeEnemiesWith(sim, blow);
    for (let tick = 0; tick < 10; tick += 1) {
      sim.step();
    }
    const torn = getEnemies(sim)[0]!.torn;
    expect(strikeEnemiesWith(sim, blow)).toBe(false);
    expect(getEnemies(sim)[0]!.torn).toEqual(torn);
  });

  it('tears for as long as its def says, lies for as long, leaves for as long, each a little further every tick, standing where it was struck, and then is no longer among the enemies', () => {
    const sim = createSimInYard();
    strikeEnemiesWith(sim, makeBlowEndingAt(POST.x));
    const parts = [
      ['tearing', ENEMY.tearSeconds],
      ['lying', ENEMY.lieSeconds],
      ['leaving', ENEMY.leaveSeconds],
    ] as const;
    for (const [action, seconds] of parts) {
      const ticks = Math.round(seconds / sim.dt);
      // The tick it was struck on is the first of the tearing.
      for (let tick = action === 'tearing' ? 1 : 0; tick < ticks; tick += 1) {
        sim.step();
        expect(getEnemies(sim)[0]).toMatchObject({
          position: { x: POST.x },
          action: 'waiting',
          torn: { action, progress: tick / ticks },
        });
      }
    }
    sim.step();
    expect(getEnemies(sim)).toEqual([]);
    expect(strikeEnemiesWith(sim, makeBlowEndingAt(POST.x))).toBe(false);
  });

  it('leaves nothing behind however many are torn: the state holds no enemy once each has left the sheet', () => {
    const sim = createSimInYard();
    strikeEnemiesWith(sim, makeBlowEndingAt(POST.x));
    const seconds = ENEMY.tearSeconds + ENEMY.lieSeconds + ENEMY.leaveSeconds;
    for (let tick = 0; tick < Math.round(seconds / sim.dt); tick += 1) {
      sim.step();
    }
    expect(sim.takeSnapshot().slices.enemies).toEqual([]);
  });

  it('is not solid and does not look for the stick man from the tick it is torn', () => {
    const sim = createSimInYard();
    sim.step([{ type: 'player/walk', direction: 1 }]);
    while (getEnemies(sim)[0]!.action !== 'approaching') {
      sim.step();
    }
    const struckX = getEnemies(sim)[0]!.position.x;
    strikeEnemiesWith(sim, makeBlowEndingAt(struckX));
    while (getStickMan(sim).feet.x < struckX + clubEnemyDef.width) {
      sim.step();
      expect(getStickMan(sim).action).toBe('walking');
      expect(getEnemies(sim)[0]?.position.x ?? struckX).toBe(struckX);
    }
  });

  it('keeps only plain numbers and ids in the state of a torn enemy', () => {
    const sim = createSimInYard();
    strikeEnemiesWith(sim, makeBlowEndingAt(POST.x));
    sim.step();
    const snapshot = sim.takeSnapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

// ---- Helpers ----

const POST = clubYard.enemies![0]!.position;

function createSimInYard(): Sim {
  return new Sim({ features, start: { seed: 1, level: clubYard.id } });
}

/** A thin, level blow at the height of the middle of the enemy's body, from the left to `x`. */
function makeBlowEndingAt(x: number): Blow {
  const y = -clubEnemyDef.floatHeight - clubEnemyDef.height / 2;
  return { start: { x: x - 2, y }, end: { x, y }, thickness: 0, direction: 1 };
}

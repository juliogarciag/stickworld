import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { SPEAR_ITEM_ID } from '../inventory/defs';
import { getSelectedItem } from '../inventory/held';
import { SPEAR } from './defs';
import { getSpearLine, getThrustProgress, type SpearAction } from './index';

/** The spear in the stick man's hand as a view needs it. How it is held is the view's business. */
export interface SpearView {
  /**
   * `ready` to be thrust, `thrusting` while its point goes out, which is the only time it hurts,
   * or `recovering` while the stick man draws it back and cannot thrust again.
   */
  readonly action: SpearAction;
  /** How far along a thrust or a recovery it is, from 0 to 1. 0 while it is ready. */
  readonly progress: number;
  /** Which way it points: the way the thrust goes, or the way the stick man faces. */
  readonly direction: 1 | -1;
  /**
   * Where it is in a thrust, as the sim tests it, in metres: level, from `butt` to `tip`,
   * `thickness` across. Only what is in front of the stick man's middle strikes. While it is
   * ready, where a thrust would begin: a view holds it some other way until then.
   */
  readonly butt: Point;
  readonly tip: Point;
  readonly thickness: number;
}

/**
 * The spear the stick man has in its hand, or undefined while it holds something else or nothing.
 */
export function getSpear(handle: SimHandle): SpearView | undefined {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  if (getSelectedItem(handle) !== SPEAR_ITEM_ID) {
    return undefined;
  }
  const { action, progress } = getThrustProgress(handle);
  const { butt, tip, direction } = getSpearLine(handle);
  return { action, progress, direction, butt, tip, thickness: SPEAR.thickness };
}

import Phaser from 'phaser';
import { getFrameSeconds } from '../loop/frameSeconds';

/**
 * Calls `draw` once a frame for `scene`, after every scene has updated and
 * before anything is rendered, with the seconds the frame counts for.
 *
 * Phaser updates its scenes from the top one down and renders them from the
 * bottom one up. A scene drawn over the level's would so update before the
 * level scene has advanced the sim, and show the frame before: on the frame a
 * level changes, the sheet that is turned away would not be there yet. What
 * such a scene shows is therefore worked out here and not in its `update`.
 */
export function runEveryFrameAfterTheLevel(scene: Phaser.Scene, draw: (seconds: number) => void): void {
  const runAfterEveryUpdate = (_time: number, deltaMs: number): void => {
    if (scene.sys.isActive()) draw(getFrameSeconds(deltaMs));
  };
  scene.game.events.on(Phaser.Core.Events.POST_STEP, runAfterEveryUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.game.events.off(Phaser.Core.Events.POST_STEP, runAfterEveryUpdate));
}

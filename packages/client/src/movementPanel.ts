import { MOVEMENT_PRESETS, MOVEMENT_TUNING_LIMITS, getMovementTuning, type MovementPresetName, type MovementTuning, type SimHandle } from '@stickworld/sim';
import GUI from 'lil-gui';
import type { GameLoop } from './loop/GameLoop';

/**
 * Dev builds only: a small panel in the top left corner to try other ways for him to move while the game runs (ADR
 * 0006). A preset sets every knob at once; each knob then changes one number. What the panel shows is sent to the sim
 * as `'player/tuneMovement'`, which keeps it in its state: the panel decides nothing, and it sends it again whenever the
 * sim has other numbers (the game started over, or `loadLevel` made a new sim). What was chosen, and whether the panel
 * was open, are kept in this browser's storage for the next reload.
 */
export function showMovementPanel(loop: GameLoop): void {
  const kept = readKeptChoice();
  const chosen: Choice = kept ?? { preset: 'current', tuning: { ...MOVEMENT_PRESETS.current }, isOpen: false };
  // The sim and tick the last send waits for: until that tick has run, the sim has not heard it, and sending again would pile up.
  let lastSent: { sim: SimHandle; tick: number } | undefined;
  const send = (): void => {
    loop.queueCommand({ type: 'player/tuneMovement', tuning: { ...chosen.tuning } });
    lastSent = { sim: loop.sim, tick: loop.sim.tick };
    keep(chosen);
  };

  const panel = new GUI({ title: 'Movement (dev)', width: 280 });
  panel.domElement.style.left = '0';
  panel.domElement.style.right = 'auto';
  // The game's keys are read from the window: pressed in the panel, they are the panel's and do not move him. A key let
  // go of in the panel still reaches the game, so that a key held for the game before is not held for ever.
  panel.domElement.addEventListener('keydown', (event) => event.stopPropagation());
  // Once a change is made the keys are the game's again: a jump pressed right after choosing a preset is a jump.
  const giveKeysBack = (): void => {
    if (document.activeElement instanceof HTMLElement && panel.domElement.contains(document.activeElement)) document.activeElement.blur();
  };
  // A clicked button (the panel's title, a button in it) would keep the keys otherwise: space would click it again.
  panel.domElement.addEventListener('click', (event) => {
    if (event.target instanceof HTMLButtonElement || (event.target instanceof HTMLElement && event.target.closest('button'))) giveKeysBack();
  });

  const presetNames = Object.keys(MOVEMENT_PRESETS) as MovementPresetName[];
  const usePreset = (name: MovementPresetName): void => {
    Object.assign(chosen.tuning, MOVEMENT_PRESETS[name]);
    for (const knob of panel.controllersRecursive()) knob.updateDisplay();
    send();
    giveKeysBack();
  };
  panel
    .add(chosen, 'preset', Object.fromEntries(presetNames.map((name) => [PRESET_LABELS[name], name])))
    .name('preset')
    .onChange(usePreset);
  for (const [name, { label, step }] of Object.entries(KNOBS) as [keyof MovementTuning, Knob][]) {
    const { min, max } = MOVEMENT_TUNING_LIMITS[name];
    panel.add(chosen.tuning, name, min, max, step).name(label).onChange(send).onFinishChange(giveKeysBack);
  }
  // Choosing the preset already shown changes nothing in a dropdown: this puts its numbers back after knobs moved them.
  panel.add({ reset: () => usePreset(chosen.preset) }, 'reset').name('back to the preset');
  const copyTuningNumbers = (): void => {
    navigator.clipboard?.writeText(JSON.stringify(chosen.tuning, null, 2)).catch(() => console.warn('The numbers could not be copied: the clipboard refused.'));
  };
  panel.add({ copy: copyTuningNumbers }, 'copy').name('copy the numbers as JSON');

  if (!chosen.isOpen) panel.close();
  panel.onOpenClose(() => {
    // lil-gui 0.21 has no public way to ask whether it is open; `_closed` is what its own docs use.
    chosen.isOpen = !panel._closed;
    keep(chosen);
  });

  if (kept) send();
  // The sim forgets the tuning when the game starts over, and a sim from `loadLevel` never had it.
  window.setInterval(() => {
    const isLastRequestPending = lastSent !== undefined && lastSent.sim === loop.sim && lastSent.tick === loop.sim.tick;
    if (!isLastRequestPending && !isSameTuning(getMovementTuning(loop.sim), chosen.tuning)) send();
  }, RESEND_EVERY_MS);
}

// ---- Helpers ----

interface Choice {
  preset: MovementPresetName;
  tuning: { -readonly [Name in keyof MovementTuning]: number };
  isOpen: boolean;
}

interface Knob {
  readonly label: string;
  readonly step: number;
}

// A new name when what `current` plays changes (#35, the 2 m jump): a choice kept under the old name could hold the old
// jump's numbers under `current`, and would keep playing them as if they were the game's own.
const STORAGE_KEY = 'stickworld.movementPanel.2';
const RESEND_EVERY_MS = 250;

const PRESET_LABELS: Record<MovementPresetName, string> = { current: 'current (2 m jump)', smallJump: 'small jump (the old one)', ninetiesPlatformer: '90s platformer' };

/** The knobs in the order the panel shows them, with what each is called there. */
const KNOBS: Record<keyof MovementTuning, Knob> = {
  jumpHeight: { label: 'jump height (m)', step: 0.05 },
  riseGravity: { label: 'rise gravity (m/s²)', step: 1 },
  fallGravity: { label: 'fall gravity (m/s²)', step: 1 },
  letGoCut: { label: 'letting go cuts (0–1)', step: 0.05 },
  walkSpeed: { label: 'walk speed (m/s)', step: 0.1 },
  airSteering: { label: 'air steering (m/s²)', step: 1 },
  airBraking: { label: 'air braking (m/s²)', step: 1 },
  fastestFall: { label: 'fastest fall (m/s)', step: 0.5 },
  jumpHeightCarrying: { label: 'jump carrying (m)', step: 0.05 },
};

function isSameTuning(one: MovementTuning, other: MovementTuning): boolean {
  return (Object.keys(MOVEMENT_TUNING_LIMITS) as (keyof MovementTuning)[]).every((name) => one[name] === other[name]);
}

/**
 * What was chosen before this reload, or undefined when nothing usable was kept. Storage is outside input: anything
 * that is not a known preset, or a number within a knob's limits, is replaced with what the preset says.
 */
function readKeptChoice(): Choice | undefined {
  let text: string | null;
  try {
    text = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
  return readChoiceIn(text);
}

/** The choice `text` holds, as `readKeptChoice` reads it, or undefined when it holds none. */
function readChoiceIn(text: string | null): Choice | undefined {
  let stored: unknown;
  try {
    stored = JSON.parse(text ?? 'null');
  } catch {
    return undefined;
  }
  if (typeof stored !== 'object' || stored === null) return undefined;
  const { preset, tuning, isOpen } = stored as { preset?: unknown; tuning?: unknown; isOpen?: unknown };
  const presetName: MovementPresetName = typeof preset === 'string' && Object.hasOwn(MOVEMENT_PRESETS, preset) ? (preset as MovementPresetName) : 'current';
  const keptTuning = typeof tuning === 'object' && tuning !== null ? (tuning as Record<string, unknown>) : {};
  const chosenTuning = { ...MOVEMENT_PRESETS[presetName] } as Choice['tuning'];
  for (const name of Object.keys(MOVEMENT_TUNING_LIMITS) as (keyof MovementTuning)[]) {
    const value = Object.hasOwn(keptTuning, name) ? keptTuning[name] : undefined;
    const { min, max } = MOVEMENT_TUNING_LIMITS[name];
    if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) chosenTuning[name] = value;
  }
  return { preset: presetName, tuning: chosenTuning, isOpen: isOpen === true };
}

function keep(choice: Choice): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // Storage may be full or blocked: the panel still works, it is only not kept for the next reload.
  }
}

export const __testing__ = { readChoiceIn };

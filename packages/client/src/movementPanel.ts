import { MOVEMENT_PRESETS, MOVEMENT_TUNING_LIMITS, movementTuningOf, type MovementPresetName, type MovementTuning } from '@stickworld/sim';
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
  const kept = keptChoice();
  const chosen: Choice = kept ?? { preset: 'current', tuning: { ...MOVEMENT_PRESETS.current }, open: false };
  const send = (): void => {
    loop.queueCommand({ type: 'player/tuneMovement', tuning: { ...chosen.tuning } });
    keep(chosen);
  };

  const panel = new GUI({ title: 'Movement (dev)', width: 280 });
  panel.domElement.style.left = '0';
  panel.domElement.style.right = 'auto';
  // The game's keys are read from the window: typed into the panel, they are the panel's and do not move him.
  for (const type of ['keydown', 'keyup'] as const) panel.domElement.addEventListener(type, (event) => event.stopPropagation());
  // Once a change is made the keys are the game's again: a jump pressed right after choosing a preset is a jump.
  const giveTheKeysBack = (): void => {
    if (document.activeElement instanceof HTMLElement && panel.domElement.contains(document.activeElement)) document.activeElement.blur();
  };

  const presetNames = Object.keys(MOVEMENT_PRESETS) as MovementPresetName[];
  panel
    .add(chosen, 'preset', Object.fromEntries(presetNames.map((name) => [PRESET_LABELS[name], name])))
    .name('preset')
    .onChange((name: MovementPresetName) => {
      Object.assign(chosen.tuning, MOVEMENT_PRESETS[name]);
      for (const knob of panel.controllersRecursive()) knob.updateDisplay();
      send();
      giveTheKeysBack();
    });
  for (const [name, { label, step }] of Object.entries(KNOBS) as [keyof MovementTuning, Knob][]) {
    const { least, most } = MOVEMENT_TUNING_LIMITS[name];
    panel.add(chosen.tuning, name, least, most, step).name(label).onChange(send).onFinishChange(giveTheKeysBack);
  }
  panel.add({ copy: () => void navigator.clipboard?.writeText(JSON.stringify(chosen.tuning, null, 2)) }, 'copy').name('copy the numbers as JSON');

  if (!chosen.open) panel.close();
  panel.onOpenClose(() => {
    chosen.open = !panel._closed;
    keep(chosen);
  });

  if (kept) send();
  // The sim forgets the tuning when the game starts over, and a sim from `loadLevel` never had it.
  window.setInterval(() => {
    if (!sameTuning(movementTuningOf(loop.sim), chosen.tuning)) send();
  }, RESEND_EVERY_MS);
}

// ---- Helpers ----

interface Choice {
  preset: MovementPresetName;
  tuning: { -readonly [Name in keyof MovementTuning]: number };
  open: boolean;
}

interface Knob {
  readonly label: string;
  readonly step: number;
}

const STORAGE_KEY = 'stickworld.movementPanel';
const RESEND_EVERY_MS = 250;

const PRESET_LABELS: Record<MovementPresetName, string> = { current: 'current', ninetiesPlatformer: '90s platformer' };

/** The knobs in the order the panel shows them, with what each is called there. */
const KNOBS: Record<keyof MovementTuning, Knob> = {
  jumpHeight: { label: 'jump height (m)', step: 0.05 },
  riseGravity: { label: 'rise gravity (m/s²)', step: 1 },
  fallGravity: { label: 'fall gravity (m/s²)', step: 1 },
  letGoCut: { label: 'letting go cuts (0–1)', step: 0.05 },
  walkSpeed: { label: 'walk speed (m/s)', step: 0.1 },
  airSteering: { label: 'air steering (m/s²)', step: 1 },
  airBraking: { label: 'air braking (m/s²)', step: 1 },
  mostFallSpeed: { label: 'fastest fall (m/s)', step: 0.5 },
  jumpHeightCarrying: { label: 'jump carrying (m)', step: 0.05 },
};

function sameTuning(one: MovementTuning, other: MovementTuning): boolean {
  return (Object.keys(MOVEMENT_TUNING_LIMITS) as (keyof MovementTuning)[]).every((name) => one[name] === other[name]);
}

/**
 * What was chosen before this reload, or undefined when nothing usable was kept. Storage is outside input: anything
 * that is not a known preset, or a number within a knob's limits, is replaced with what the preset says.
 */
function keptChoice(): Choice | undefined {
  let stored: unknown;
  try {
    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return undefined;
  }
  if (typeof stored !== 'object' || stored === null) return undefined;
  const { preset, tuning, open } = stored as { preset?: unknown; tuning?: unknown; open?: unknown };
  const presetName: MovementPresetName = typeof preset === 'string' && Object.hasOwn(MOVEMENT_PRESETS, preset) ? (preset as MovementPresetName) : 'current';
  const keptTuning = typeof tuning === 'object' && tuning !== null ? (tuning as Record<string, unknown>) : {};
  const chosenTuning = { ...MOVEMENT_PRESETS[presetName] } as Choice['tuning'];
  for (const name of Object.keys(MOVEMENT_TUNING_LIMITS) as (keyof MovementTuning)[]) {
    const value = Object.hasOwn(keptTuning, name) ? keptTuning[name] : undefined;
    const { least, most } = MOVEMENT_TUNING_LIMITS[name];
    if (typeof value === 'number' && Number.isFinite(value) && value >= least && value <= most) chosenTuning[name] = value;
  }
  return { preset: presetName, tuning: chosenTuning, open: open === true };
}

function keep(choice: Choice): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // Storage may be full or blocked: the panel still works, it is only not kept for the next reload.
  }
}

# Ticket 27: Phaser's audio off

Proof of running the change once (a Small ticket). Frozen when the PR merges.

`measure.mjs` loads two production builds (`main` at 6bc00d1, and this branch) in Chromium, 9 times each in a browser just started and once more in the same browser, and reports when the first frame was drawn, how long the main thread was blocked before it, how many audio contexts the page made and how long making them took.

What it found (median of 9 loads; single loads vary by more than the effect, about 0.2 s, on a machine busy with other sessions):

- In a browser just started, the first frame is 233 ms sooner (2239 ms to 2006 ms). Making the audio context took 450 ms there.
- Again in the same browser there is no gain (1884 ms to 1971 ms, which is noise): only the first audio context a browser makes is slow, the next took 1.9 ms.
- Audio contexts made: 1 on every load before, 0 on every load after, a key press and a click included.

| Proof | What it shows |
|---|---|
| `proof/measure.txt` | The run: medians, then every load as JSON on the `REPORT` line |
| `proof/pnpm-check.txt` | `pnpm check` passing on the branch |

To run it again: build each commit with `pnpm build`, copy `packages/client/dist` somewhere for each, then in this folder `pnpm install --ignore-workspace --frozen-lockfile && npx playwright install chromium && node measure.mjs before=<dist of main> after=<dist of this branch>`.

# Verification template

The starting point for a ticket's `verifications/<ticket>/` folder, and the only folder under `verifications/` that is kept working. Every other folder is the proof of one ticket, frozen when its PR merged: do not run, repair, read or copy from them.

## Start a ticket's folder

From the repo root, in the ticket's worktree:

```bash
cp -R verifications/_template verifications/<ticketNumber>-<ticketKebabTitle>
```

If the template was run in place before, the copy carries its `proof/` and `node_modules/`: delete both from the copy.

Then, in the copy:

1. Rename `solo.mjs` after what it proves (`01-walks-to-the-flag.mjs`, ...), add more scripts beside it if the ticket needs them, and list them in `run.sh`.
2. Change the port at the top of each script to one no other session uses. It must differ from the dev server you leave running for the human, because a pinned port refuses to start twice.
3. Replace the example checks with what the ticket promises, from the point of view of the player. Derive expected numbers from `window.__game` (level, defs, camera, pixelsPerMetre), never from constants typed into the script.
4. Replace this README with the ticket's own: what is verified, how to run it, and a table of script, what it proves, and proof file.

Run it from anywhere; the first run installs Playwright in the folder:

```bash
bash verifications/<ticketNumber>-<ticketKebabTitle>/run.sh
```

Each script prints `PASS`/`FAIL` lines, exits non-zero on failure and writes into `proof/`: the JSON report, the screenshots, and the console output as `proof/<script>.txt`. Commit `proof/` with the ticket. A change in how something looks needs before and after screenshots; a change in how something moves, a short screen recording (Playwright's `recordVideo` option on `browser.newContext`).

Content search skips every ticket folder, yours included (the root `.ignore`). To search yours, name it as the path: `rg <pattern> verifications/<ticket>/`.

## What is here

| File | What it gives you |
|---|---|
| `solo.mjs` | Starts `PORT=<n> pnpm dev`, opens Chromium, reads the sim through `window.__game`, checks it runs with real time and restarts a level, writes a screenshot and a report |
| `lib.mjs` | `start` (a server that stops with the script, printing without colours), `waitForPort`, `waitFor`, `getLastLines`, `check`, `summarize`, `writeProof`, and the `ROOT` and `PROOF` paths |
| `run.sh` | Installs on first run, runs the scripts in order, keeps their console output as proof |

## What the template relies on

A ticket that changes any of these updates the template in the same PR, and runs it once to show it still passes (`bash verifications/_template/run.sh`; the `proof/` and `node_modules/` it leaves here are gitignored):

- `PORT=<n> pnpm dev` pins the client's port and prints `localhost:<n>/` when ready.
- `window.__game`: `sim.tick`, `sim.dt`, `level.id`, `hash()` and `loadLevel(n)`, which plays level `n` again from tick 0.

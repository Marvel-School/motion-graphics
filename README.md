# motion-graphics

A Claude skill that makes motion graphics for Premiere Pro. The user describes a clip; Claude asks what it needs, shows a stills sheet, then a preview, then renders a ProRes `.mov` he drags onto his timeline. Transparent clips are ProRes 4444 with alpha; full-frame clips are ProRes 422 HQ.

Clips are HTML pages. `scripts/render.mjs` opens one in headless Chromium, seeks it to every frame and pipes the frames into ffmpeg, so the output is exact, not a screen recording.

## How the user gets updates

He uploads a small bootstrap skill once (`bootstrap/SKILL.md`, packaged with the repo URL filled in). Every conversation it clones the `stable` branch of this repo and follows `SKILL-BODY.md`. Moving `stable` updates him; he does nothing.

```bash
bash scripts/package-bootstrap.sh <owner>/<repo>   # out/motion-graphics.zip, upload once in Customize > Skills
bash scripts/promote.sh                            # from main: tests + starter checks, then main -> stable
```

`promote.sh` pushes nothing if a test or a starter check fails. To roll back, point `stable` at the last good commit: `git push -f origin <sha>:stable`.

## Layout

| Path | What |
|---|---|
| `SKILL-BODY.md` | The flow Claude follows: intake, build, two check-ins, final, lessons |
| `craft.md` | The clip contract and the rules learned from clips that went wrong |
| `brand-kit.md` | Setting up a new client's kit; reached only when a client has none |
| `templates/` | Seven starter clips: lower-third, title-card, logo-sting, kinetic-text, callout, glitch-hit, wipe-transition |
| `lib/mg.js` | Injected into every clip: `MG.clip`, easing, springs, seeded random |
| `scripts/` | render, check, apply-brand, font, colors, setup, promote, package-bootstrap |
| `brands/example/` | A neutral kit for testing the starters. Client kits live in his Claude Project, never here |

## Development

```bash
bash scripts/setup.sh          # Playwright + Chromium; needs ffmpeg with prores_ks
npm test                       # node:test, renders real clips through ffmpeg
bash scripts/check-starters.sh # every starter, landscape and portrait, with the example kit
```

## Lessons

When a job goes wrong in a way `craft.md` doesn't cover, Claude writes a line to `lessons.md` in his Project. Read those now and then and turn the useful ones into `craft.md` rules.

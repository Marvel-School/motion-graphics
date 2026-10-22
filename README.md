# motion-graphics

A Claude skill that makes motion graphics for Premiere Pro. The user describes a clip; Claude asks what it needs, shows a stills sheet, then a preview, then renders a ProRes `.mov` he drags onto his timeline. Transparent clips are ProRes 4444 with alpha; full-frame clips are ProRes 422 HQ.

Clips are HTML pages. `scripts/render.mjs` opens one in headless Chromium, seeks it to every frame and pipes the frames into ffmpeg, so the output is exact, not a screen recording.

## Install (Claude Code)

The user pastes one prompt into Claude Code once; Claude Code does the rest. The brand kit line is an example: use the client's own kit, or leave step 4 out and let the skill set one up on the first job.

On a Mac:

```
Install the motion-graphics skill for me. I'm on a Mac and don't use the terminal, so run every command yourself. Only stop if you need my password or a click from me.

1. Check for git, Node.js 20 or newer, and ffmpeg with ProRes support (`ffmpeg -hide_banner -encoders` must list prores_ks). Install what's missing with Homebrew. If Homebrew itself is missing, give me the one command to paste into Terminal and wait for me.
2. Download bootstrap/SKILL.md from https://github.com/Marvel-School/motion-graphics (branch stable). Replace __REPO_URL__ with https://github.com/Marvel-School/motion-graphics. Save the result as ~/.claude/skills/motion-graphics/SKILL.md.
3. Run the commands in step 1 of that file once. It must print "ready".
4. Save this brand kit as ~/motion-graphics/brands/brand-productowner.json:
   {"name":"productowner.nl","colors":{"bg":"#041443","fg":"#FFFFFF","primary":"#336699","accent":"#ED7D31","light":"#518FC4"},"fonts":[{"role":"display","family":"Bebas Neue","weights":[400]},{"role":"body","family":"Poppins","weights":[400,600]}],"logo":null,"rules":["informal je/jij","rounded corners on shapes"]}
5. Tell me in one line that it's installed, and that I start a job in a new conversation, for example: "lower third for Jan de Vries, product owner, productowner.nl, landscape".
```

On Windows, the same prompt with two changes: say "I'm on Windows", and replace step 1 with:

```
1. Check for git, Node.js 20 or newer, and ffmpeg with ProRes support (`ffmpeg -hide_banner -encoders` must list prores_ks). Install what's missing with winget: OpenJS.NodeJS.LTS for Node, Gyan.FFmpeg for ffmpeg. If something you installed isn't found afterwards, tell me to restart Claude Code and continue from here when I'm back.
```

The Claude app path (the ZIP below) still works but is frozen: not tested or extended.

## How the user gets updates

He installs a small bootstrap skill once (`bootstrap/SKILL.md` with the repo URL filled in): uploaded as a ZIP in the Claude app, or saved as `~/.claude/skills/motion-graphics/SKILL.md` for Claude Code (Mac or Windows). Every conversation it clones the `stable` branch of this repo and follows `SKILL-BODY.md`. Moving `stable` updates him; he does nothing.

```bash
bash scripts/package-bootstrap.sh <owner>/<repo>   # out/motion-graphics.zip, upload once in Customize > Skills
bash scripts/promote.sh                            # from main: tests + starter checks, then main -> stable
```

`promote.sh` pushes nothing if a test or a starter check fails. `stable` refuses force pushes, so a rollback is a revert: `git revert <sha>` on a branch, merge it into `main`, then `promote.sh`.

## Layout

| Path | What |
|---|---|
| `SKILL-BODY.md` | The flow Claude follows: intake, build, two check-ins, final, lessons |
| `craft.md` | The clip contract and the rules learned from clips that went wrong |
| `brand-kit.md` | Setting up a new client's kit; reached only when a client has none |
| `templates/` | Seven starter clips: lower-third, title-card, logo-sting, kinetic-text, callout, glitch-hit, wipe-transition |
| `lib/mg.js` | Injected into every clip: `MG.clip`, easing, springs, seeded random |
| `scripts/` | render, check, apply-brand, font, colors, save-template, setup, promote, package-bootstrap |
| `brands/example/` | A neutral kit for testing the starters. Client kits live with him (his Claude Project, or `~/motion-graphics/brands/` for Claude Code), never here |

## Development

```bash
bash scripts/setup.sh          # Playwright + Chromium; needs ffmpeg with prores_ks
npm test                       # node:test, renders real clips through ffmpeg
bash scripts/check-starters.sh # every starter, landscape and portrait, with the example kit
```

## Lessons

When a job goes wrong in a way `craft.md` doesn't cover, Claude writes a line to `lessons.md` in his Project (or `~/motion-graphics/` for Claude Code) and, where you can't read that, asks him to forward it. Read those now and then and turn the useful ones into `craft.md` rules.

Every finished job also adds a line to `~/motion-graphics/jobs.log` (date, client, type, minutes, messages, renders, Premiere issues). It is read with him at the week-4 review in `docs/plans/2026-10-22-daily-use.md`.

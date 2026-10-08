# Craft

Rules for writing clips. Each one came from a clip that went wrong. Follow them unless the user asks otherwise; if one turns out wrong, add the case to LOG.md and propose a change.

## The clip contract

- One folder per clip: `clip.html`, plus `fonts/` and `assets/` written by the scripts.
- `MG.clip({ width, height, fps, duration, alpha }, defaults)` runs once at the end of `<body>`. It returns `DATA`: the defaults, overridden by a batch row. Every piece of text the user might change goes in `defaults`.
- `window.seek = t => { ... }` sets the whole frame from `t` in seconds. It never adds to state from the last call. The renderer calls it in any order.
- Plain CSS `@keyframes` animations are seeked too. Use them for simple moves; use `seek` for anything that depends on measured sizes or data.
- Random looks: `MG.rand('seed' + frameIndex)`, never `Math.random()`. `check.mjs` fails a clip that renders differently twice.
- Measure text and panels inside `seek`, not at script start. Fonts load after the script runs, so early measurements use the fallback font. A clip that measured early held "Jan de" instead of "Jan de Vries" for six seconds.
- An element measured in `seek` gets `width: max-content`. Otherwise its width follows the mask from the previous frame and the clip is not deterministic.
- Very large type (over about 25vmin): animate its size through `font-size` on an inner element inside a box fixed at the fitted size, not through `transform: scale()`. Chromium drew scaled giant text differently between runs, and the determinism check failed 2 to 3 times in 4.
- Sizes in `vmin`, `vw`, `vh`. The viewport is the clip size, so one clip serves landscape and portrait. Rearrange for portrait with `@media (orientation: portrait)`.
- Colors and fonts only through the brand variables: `--bg --fg --primary --accent --font-display --font-body`. Extra kit colors arrive as `--<name>`. `MG.logo()` is the logo path, or `''` when the kit has none.
- Text meant to run off frame gets `data-bleed`. Everything else stays inside title-safe (5% in from each edge).

## Motion

- Spend the clip on one move: the thing the eye should follow. Everything else follows it 0.1 to 0.3 s later, smaller and quieter.
- Reveal with masks, wipes and position. Fading everything in is the default that reads as template work; keep opacity for small secondary details.
- Mass needs a spring: `MG.spring(t, t0, from, to, { stiffness, damping })`. Big type: stiffness 9 to 12, damping 0.6 to 0.8. Small UI: stiffness 14 to 18, damping 0.5 to 0.7. Snaps without overshoot: `ease.outExpo`.
- Exits mirror the entrance, faster (about 60% of the entrance time), last element in leaves first.
- Text holds fully readable for at least 1.5 s, plus 0.3 s per word beyond three.
- Time in seconds, never in frames. The same clip must work at 25 and 29.97.
- Banned defaults: a centered title on a gradient; glows; generic particle bursts; a bounce on everything; every element entering the same way at the same speed.

## Frame

- Lower thirds sit left, bottom, inside title-safe: about 7.5vw in, 13vh up. In portrait, keep them above the bottom 20%, where Reels and TikTok put their own UI.
- Text on a brand color needs contrast you can read on a phone. When the kit's `fg` doesn't read on `primary`, use `bg` instead and say so.
- Transparent clips leave `html` and `body` without a background. Full-frame clips set `body { background: var(--bg) }`.

## Delivery for Premiere

- Transparent clips go on a track above the footage (V2 and up).
- Overlay transitions are fully opaque at their cut frame. Name the file with `_cut-at-f<frame>` and tell the user to put the playhead on the cut, then place the clip so that frame lands on it.
- Frame rate and size match his sequence. When unsure, ask; a mismatch makes Premiere drop or double frames.

## Review

- Run the scripts one at a time. Two `apply-brand` runs at once both try to install the same font package and break it.
- Run `check.mjs` before every render. It catches: renders that differ twice, text outside title-safe, text cut off by a mask, fonts falling back, and alpha or background that contradict the clip's settings.
- Look at the stills sheet yourself before showing it. The check measures text, not taste: an ugly clip passes.

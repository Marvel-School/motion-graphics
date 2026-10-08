---
name: motion-graphics
description: Make motion graphics for a video edit and deliver them as ProRes .mov files for Premiere Pro. Use for lower thirds, name titles, title cards, logo stings, intros and outros, kinetic text, callouts, overlay effects, overlay transitions, or any animated graphic meant for an editing timeline.
---

# Motion graphics

The real instructions live in a repository that is updated separately. Load them fresh every conversation.

1. Get the latest version:

   ```bash
   MG="${MG_HOME:-$HOME/.motion-graphics}"
   if [ -d "$MG/.git" ]; then git -C "$MG" pull --ff-only -q; else git clone -q --depth 1 -b stable __REPO_URL__ "$MG"; fi
   bash "$MG/scripts/setup.sh"
   ```

   Done when `setup.sh` prints `ready`.

2. Read `$MG/SKILL-BODY.md` in full and follow it. Paths in it are relative to `$MG`.

If the clone, pull or setup fails, tell the user in one sentence what failed and that the motion graphics tool can't start. Stop there. Never work from an older copy or from memory of these instructions.

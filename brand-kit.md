# Setting up a brand kit

Reached from intake when a client has no `brand-<slug>.json` in his files (see "Where you run" in `SKILL-BODY.md`). A kit is set up once per client and reused for every clip after.

## 1. Gather

Ask in one round for whatever he can give:

- The logo: SVG best, otherwise a PNG with a transparent background.
- Brand colors, if he knows them. If not, a screenshot of their website or a slide in their house style.
- Font names, or the font files (.otf, .ttf, .woff2) if the brand uses a paid or custom font.
- Any rules: tone (je/jij or u), words to avoid, shapes (rounded or sharp).

## 2. Colors

Sample, don't guess: `node $MG/scripts/colors.mjs <logo-or-screenshot>` lists the exact colors, most-used first. Assign four roles:

- `bg`: the background of full-frame clips and of text panels. Usually the brand's darkest color.
- `fg`: text on `bg`. It must be easy to read on `bg`.
- `primary`: the main brand color, used for blocks and strips.
- `accent`: a second color used sparingly, for one bar, one rule, one ring.

Extra brand colors go in as more keys; clips reach them as `--<name>`.

## 3. Fonts

- A Google Fonts family: name it in `fonts` with the weights you need; the scripts fetch it.
- A file he uploaded: add `"file": "font-<slug>-<weight>.otf"` and save the file to his files under that name.
- A paid font with no file: pick the closest Google Fonts family and tell him which one stands in, in one line.

Roles: `display` for headlines and names, `body` for everything smaller. One family for both is fine.

## 4. Write and confirm

His files sit side by side, so every file of the kit carries the slug in its name:

```json
{
  "name": "productowner.nl",
  "colors": { "bg": "#041443", "fg": "#FFFFFF", "primary": "#336699", "accent": "#ED7D31" },
  "fonts": [
    { "role": "display", "family": "Bebas Neue", "weights": [400] },
    { "role": "body", "family": "Poppins", "weights": [400, 600] }
  ],
  "logo": "logo-productowner.svg",
  "rules": ["informal je/jij", "rounded corners"]
}
```

Build the lower-third starter with the kit and send its stills sheet: "This is how your brand will look." Adjust until he approves.

Save `brand-<slug>.json`, the logo and any font files to his files. In the Claude app, if you can't write to the Project, send him the files and ask him to add them to the Project's files, in one line.

Done when the kit's files are in his files and he approved the sample sheet. Then go back to intake.

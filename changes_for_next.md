# changes_for_next.md

Change list from Elias's review of the tabbed dashboard (2026-11-15, after the first browser look).
Nothing here is built yet. This file is meant to survive several sessions: work top to bottom,
tick items off, and move finished ones to ROADMAP.md at the end of each work block.

Overall verdict from the owner: "otherwise, really good!" Keep the tab structure, the LIMIAR look,
the provenance chips, and the plan logic in `src/lib/`. The items below are additions and fixes.

Conventions for references: `file` > symbol (component, function, or CSS class). Line numbers are
left out on purpose because the files will keep moving.

Status key: [ ] todo, [~] in progress, [x] done / decided, [?] needs a decision from Elias.
All five open questions from the first draft are now answered; see section 8.

---

## 0. Rules that apply to every item (AGENTS.md)

- Build the feature end to end. Caveats are labels, not blockers (Delivery mode).
- AI may turn text into inputs. AI may NOT invent numbers or evidence. Anything the AI fills in must be
  visible, editable, and passed through `normalizeSpec` (`src/ui/spec.js`) before the plan runs. Hard rule 1.
- Hard rule 8: no linear interpolation between 0 g and 1 g. Gravity sliders must show the trained span
  and the 0 g / 1 g reference points, never imply a smooth physical curve between them.
- Hard rule 4: the AI-parsing feature is SI use. Add it to the SI-use declaration in `submission/` and
  put a visible "read by AI" label on anything it filled in.
- Everything user-facing is English.

---

## 1. Planner tab (`src/tabs/Planner.jsx`)

### 1.1 [ ] "Describe it in words" box that fills the experiment form
What the owner asked: a small text window between the hero text and the "Your experiment" card. The
person writes the experiment in plain language, an AI turns it into structured conditions (an export),
the form fills in, and the five result cards below update by themselves.

Where it goes: inside `Planner` > `<div className="hero">`, after `<p className="lede">`, before
`<div className="cols">`. New component `src/ui/DescribeBox.jsx` (shared with the Estimator, see 2.1).

Behaviour:
- One textarea with 2-3 clickable example prompts, a submit button, and a busy state (reuse the `spin` class).
- The AI returns a JSON spec in the exact shape of `defaultSpec()` in `src/lib/plan.js`:
  `material_class`, `thickness_mm`, `o2_pct`, `pressure_kPa`, `gravity_g`, `flow_cms`, `question`.
  Material keys must come from `MATERIALS` / `MAT`, question keys from `QUESTIONS` / `Q`.
- Apply with `setRaw((s) => ({ ...s, ...parsed }))`. The existing `useMemo` chain in `src/App.jsx`
  (`norm` > `planned`) already recomputes the plan, so the cards update with no extra wiring.
- Fields the text did not mention stay unchanged and are listed as "not stated, kept at X". Never guess.
- Show a "What I understood" strip under the box: one chip per field that changed (old value > new value),
  an "assumptions" line, and an Undo button. This is what makes the feature trustworthy.
- Units: accept psi, atm, kPa, mmHg; convert with `PSI_TO_KPA` from `src/lib/psi.js`. Accept "Moon",
  "Mars", "ISS", "spacesuit" and map them to the presets already in `presetsOf` / `REG`.
- Also offer "Download the spec (JSON)" next to it, since the owner called it "an export".

Backend:
- New `api/parse.js` next to `api/chat.js` (same 405 / 503 handling when `GEMINI_API_KEY` is missing),
  plus a `parseSpec()` helper in `api/_gemini.js` that asks Gemini for JSON only, with a response schema.
  Validate on the server and again on the client. Drop any key not in the schema.
- Client wrapper `parseSpecText()` in `src/lib/assistant.js`, next to `askAssistant`.
- No-AI fallback (important for the demo and for rate limits): a deterministic regex parser in
  `src/lib/nlspec.js` that handles "30% oxygen", "70 kPa" / "10.2 psi", "0 g" / "Moon", "thin PMMA film".
  Used when the API errors or no key is set, with a label "parsed by rules, no AI".

Acceptance: typing "thin acrylic film in a lunar habitat at 10.2 psi and 30% oxygen, will the flame
spread?" fills material, thickness hint, 70.3 kPa, 30 %, 0.165 g, question = flame spread, and the five
parts below change without another click.

### 1.2 [x] Sliders under each numeric field (DECIDED, see section 6.2 for the shared component)
Owner: under the label and number field of gravity, pressure and the rest, add a small slider that runs
across a preset range, with a little graphic on the track. The person can still type any value by hand,
including values beyond the slider's range. Same pattern in the Planner, the Estimator Scenario card and
the Workbench Scenario node. Goal is ergonomics: easier to see, easier to read, easier to adjust.

- Put the slider directly BELOW each `NumField` in the "Your experiment" card, aligned to the field width,
  for: Oxygen, Pressure, Gravity, Thickness, Airflow. Slider ranges (the "set value" span), all overridable by typing:
  Oxygen 0-100 % (step 0.5; tick marks at 21 and 30 for air and the lunar-habitat target), Pressure 20-110 kPa
  (ticks at 56.5, 70.3, 101.3; psi shown in the existing hint), Gravity 0-1 g (detents at 0, 0.165, 0.378, 1,
  labelled Micro / Moon / Mars / Earth), Thickness 0.05-50 mm on a log scale, Airflow 0-100 cm/s on a log-ish scale.
- Small graphics on the track (this is the "little graphics" the owner asked for): tick marks at the named
  reference values with 1-2 letter icons or labels, a shaded band for where measured sources exist
  (from `plan.coverage.rows`), a filled portion up to the thumb, and a thumb that turns the ember colour
  when the value is outside the band. Gravity track gets small Moon / Mars glyphs at the detents.
- When the typed value is outside the slider range, the thumb pins to the nearest end and shows a small
  "beyond range" arrow; the number field keeps the real value. Typing never gets clamped by the slider.
- Component: new `src/ui/SliderField.jsx` that wraps `NumField` (`src/ui/bits.jsx`) so typing still works
  and the slider and the number stay in sync. Keep empty-while-typing behaviour (see `normalizeSpec`).
- Optional but valuable: draw the "measured sources cover this range" band on the track, using
  `plan.coverage.rows` (`r.hits`) so the person sees where data exists before they pick a value.
  This is the same idea as `src/canvas/DomainBar.jsx`; reuse its look.
- Keyboard: arrow keys step, Shift+arrow steps 10x; thumb is at least 20 px for touch; `aria-valuetext`
  includes the unit.

### 1.3 [~] Readability, spacing and negative space (Planner)
Seen in the screenshots:
- The hero leaves the whole right half empty (`.hero`, `.display`, `.lede`). Fill it: a compact live
  summary tile row or a small "last plan" strip (verdict, #measured sources, #gaps) that updates with the
  form, or move the DescribeBox there. Do not just widen the text.
- Preset pills are cut off with an ellipsis ("Challenge lunar habitat b...", "Early Artemis lunar habit...")
  in the `presets.map(...)` block (`p.label.slice(0, 25)`). Use a 2-line card/list per preset or a short
  `p.short` label plus a tooltip. Do not truncate names.
- Two blocks are both called "Gravity" (the pill row `lbl` and the `NumField label="Gravity"`). Rename the
  numeric one to "Gravity (g)" or merge pills and slider into one control.
- The form column is long and the five parts are very tall. Tighten `.card` padding and `.row` spacing in
  `src/styles/dash.css`; show the first two prior-art rows expanded and the rest behind a "show more".
- Part 3 "Proposed experiment" is a long `dl.kv` of bullet lists. Give each row an icon and group Vary / Hold /
  Measure as three columns on wide screens.
- Raise the minimum size of the mono eyebrow labels (`.lbl`, `.eyebrow`, "WHY THIS RANK") and the contrast of
  `.note`. They are small and low-contrast at the screenshot zoom.
- Replace text glyphs in `AxisChip` (`src/ui/bits.jsx`: the check / tilde / X marks) with real icons.
- Add a small sticky "jump to part 1-5" index so a long plan is navigable.

---

## 2. Estimator tab (`src/tabs/Estimator.jsx`)

### 2.1 [ ] "Describe a scenario" box that fills the Scenario card
Owner: same idea as the Planner, a header between the text and the cards. The person describes a scenario
to an AI, and the Scenario card on the side updates.

Where: inside `Estimator` > `<div className="hero">`, after `<p className="lede">`, before `<div className="cols">`.
Reuse `src/ui/DescribeBox.jsx` with a different target schema.

Target schema = the `x` state in `Estimator`: `material`, `thickness_mm`, `o2_pct`, `pressure_kPa`,
`gravity_g`, plus the variant select if it was named. Material values must come from
`model.categorical_features.material` (currently ACRYPLEN, Filter paper). If the text names another
material, set the closest and say so in the "What I understood" strip. Apply with `setX((s) => ({ ...s, ...parsed }))`.

Same trust rules as 1.1: changed-field chips with old > new, assumptions line, Undo, rule-based fallback.
Same `api/parse.js` endpoint with a `target: 'estimator' | 'planner'` field.

### 2.2 [ ] Animated flame on the "Estimated outcome" card
Owner: a small looping flame on the right side of the "Flame spreads" card. Continuous in the value, with
different looks for spreading, extinguishing and no flame.

Where: the first `<div className="card">` inside `ok && (...)` in `Estimator`, next to `verdict-big`
(`z >= 0 ? 'Flame spreads' : 'Flame extinguishes'`). Make the card a flex row: text on the left, flame on the right.

Component: new `src/ui/FlameLoop.jsx` (inline SVG + CSS keyframes in `src/styles/dash.css`). Props: `z`
(the log-odds already computed there), `outside` (boolean, from `outside.length`).
- Map z continuously (reuse the `loPct` clamp idea, z in about -6..+6) to flame height, width, flicker speed
  and colour. Strongly positive z: tall, fast, bright yellow-orange. Near 0: short, unsteady, slow.
  Negative z: shrinking, cooler colour, a gradual fade, little smoke wisp. Very negative: no flame, just a
  dim ember and a wisp.
- Three named states for the design pass, driven by one number: `spreading`, `dying`, `none`.
- Use the existing palette tokens (heat / plasma / ember). Ember red is for alerts only (FEATURES.md), so
  keep the flame orange/yellow and use red only for the "outside training range" outline.
- When `outside` is true, keep the flame but add the dashed outline and a tiny "extrapolation" tag, so the
  animation never looks more certain than the label.
- Honour `prefers-reduced-motion` (static flame, no loop). Pure CSS/SVG, no new dependency.
- Optional: reuse the same component, smaller, per rung in Planner part 4 (`sp.rungs.map`, class `rung`).

### 2.3 [x] Sliders in the Scenario card (DECIDED)
- Under each field in the `NUMERIC.map(...)` NumFields, add `SliderField` (see 1.2 and 6.2). The slider range is a
  sensible preset span for that variable, and the trained span from `model.numeric_features[k].min/max` is drawn
  as a shaded band on the track, so the existing "trained 0.0833 to 0.375" text hint becomes visual. A value
  outside the band turns the thumb ember and keeps the `chip bad` wording. Typing still overrides the slider.
- Gravity: track covers the trained span with detents at the `GRAVITIES` presets; keep the existing message
  about 0 g and 1 g being reference data (`G_MIN`, `G_MAX`), not interpolated.

### 2.4 [ ] Visual fix on the outcome card
In the screenshot the "log-odds +5.39 · extinguish ← 0 → spread" line has a solid red/brown highlight box
behind the text. It reads like a rendering bug. Check the `note num` styles and the `outside` colour rules
in `src/styles/dash.css` and the inline `style` on the card in `Estimator.jsx`; make it plain text or a
deliberate chip.

### 2.5 [ ] Share the scenario between tabs
`Estimator` keeps its scenario in local `useState` while `Planner` keeps `raw` in `App.jsx`. Consider lifting
one shared scenario so a described scenario carries into Planner, Evidence and the Workbench. Not required
for the first pass; decide after 1.1 and 2.1 are working.

---

## 3. Evidence tab (`src/tabs/Evidence.jsx`)

### 3.1 [ ] Fix the "scroll down, scroll up" problem with the data table
Owner's description: you have to go back down and then up on the data table to see what something means;
if someone scrolls all the way down they will not know what is happening; use an approach like the Estimator.

Decision (Q2): this is an ergonomics issue, not a bug. Controls and the chart are at the top, the data table
is far below, so choosing a filter or clicking a point changes something that is off-screen and nothing tells
the person. The fix below stands: everything that affects what you see must be visible at the same time.

Proposed fix, following the Estimator's layout (`.cols` with a `.sticky` aside):
- Move the controls into a sticky left card: provenance filter (`filter` state), MARGIN-Limit toggle
  (`showFit`), Export CSV, and the "Selected point" card. They stay in view while the person scrolls the table.
- Right column = chart on top, data table directly under it (not a separate full-width card far below).
  Make the table a scroll container with a fixed height and a sticky header, so chart and table fit on one screen.
- Two-way linking: hovering or clicking a row highlights the point on the chart, and clicking a point scrolls
  the table to its row and highlights it (`selected` already exists; add a `ref` per row and
  `scrollIntoView({ block: 'nearest' })`). Add hover state too.
- Add a result count under the filter ("27 of 39 points shown") so filtering has visible feedback.
- A tiny "What this chart shows" line under the legend, in plain language.

### 3.2 [ ] Chart fixes seen in the screenshot
- The right-hand "no data" label is clipped ("no date"). In the SVG, `<text x={sx(dMax) + 6} ...>` runs past
  the plot edge. Anchor it with `textAnchor="end"` at `W - M.r - 6`.
- The "Selected point" provenance chip ("ESTIMATED FROM FIGURE") overflows the card edge. Fix `Prov`
  (`src/ui/bits.jsx`) wrapping or the `dd` width in `.kv`.
- The legend (`.maplegend`) mixes colour swatches, shape keys and the fit line in one wrapped row. Split into
  two groups (outcome colours; symbols and line) with icons for the shapes.
- Sliders here too: optional "flow speed window" and "O2 window" range sliders that filter the table and the
  chart together (nice to have).

---

## 4. Workbench tab (`src/tabs/Workbench.jsx`, `src/canvas/*`, `src/graph/*`)

Owner: "extremely confusing and will need to be updated." Nothing was specified beyond that, so this section is
a diagnosis plus a proposal. Several parts need a decision (Q3).

### 4.1 [ ] What is confusing in the current screenshot
- Nothing says what the tab is for. There is no title, no one-line explanation, no "start here".
  The Palette (`src/canvas/Palette.jsx`) shows "Recipes" with two disabled "soon" entries
  (`build: null` for `gaps` and `compare` in `src/graph/recipes.js`) and a node list with no description.
- Terminology is unexplained: "Scenario", "MARGIN-Spread", "Domain check", "Nearest evidence", ports and wires.
- Layout: the recipe places nodes by hand (`moonRecipe` positions), so wires cross, and the large MARGIN-Spread
  node dominates. The Nearest evidence table is clipped on the right (the last column, "D", is cut off).
- The Inspector (`src/canvas/Inspector.jsx`) opens as "Select a node or a wire" with a long provenance key,
  but the person has not yet selected anything and does not know why they would.
- Ring/symbol keys in the chart node are tiny and the chart node is hard to read at canvas zoom.
- Mixed visual language: the canvas uses `src/canvas.css` styles while the other tabs use `src/styles/dash.css`.

### 4.2 [x] Direction decided: B, trimmed for today (Q3)
The owner also asked for the same sliders in the Workbench, so the tab stays. Do the minimal B first:
intro banner, node captions, auto-layout, sliders on the Scenario node, clipped-table fix. The "open from the
Estimator" idea (A) is a later add-on. Do not hide the tab.

Options considered:
A. "How this estimate was computed": reframe the tab as a read-mostly explanation graph. Opening it from the
   Estimator (button "See how this was computed") loads the current scenario into the graph with the steps
   labelled 1-4 and a short caption under each node. Editing stays possible but is secondary.
B. Keep it as an open workbench but add proper onboarding: intro banner, a guided first-run tour (3-4 steps),
   a legend for ports and provenance, tooltips on each palette node, and a visible "Reset to recipe".
C. Hide the tab for the submission and ship A or B after the deadline.

Whatever is chosen, these are worth doing:
- Rename the tab to something that says what it does (for example "How it works" or "Model graph").
- Build an auto-layout (left to right: Scenario > Model > Checks > Output) instead of hand positions in
  `recipes.js`, and fit the view on load (`fitView`).
- Fix the clipped Nearest evidence table: constrain node width in `src/canvas/NodeShell.jsx` and let the table
  scroll or collapse columns.
- Short plain-language caption on every node (what goes in, what comes out) in `src/canvas/nodes.jsx`.
- Sliders on the Scenario node: the node uses a different input, `src/canvas/NumField.jsx` (props `value`,
  `onCommit`, `label`, `unit`), not `NumField` from `src/ui/bits.jsx`. Build `SliderField` so it takes either
  (`value`, `onChange`) and add the same slider row under each field in the Scenario node (gravity, oxygen,
  pressure, thickness). Keep the `nodrag nowheel` classes on the slider input so dragging the thumb does not
  drag the node or zoom the canvas. The trained-range band can reuse the `DomainBar` look (`.dbar-band`,
  `.dbar-mark`), and the same slider could replace the separate bars in the MARGIN-Spread node later.
- Finish or remove the two "soon" recipes. If kept, `gaps` can reuse the coverage logic from `src/lib/plan.js`
  and `compare` can reuse `src/lib/rank.js`.
- Align the node styling with `dash.css` tokens so the canvas does not feel like a different app.
- Re-check that provenance inheritance still works after any change (`node web/scripts/check_graph.mjs`).

---

## 5. Cross-cutting readability, icons and spacing

Owner: "improve overall readability, icons, spacing... not a fan of all the negative space."

- [x] Add an icon set. `lucide-react` is the obvious choice (check `package.json`; it may not be installed), or
      a small inline set in `src/ui/icons.jsx` to avoid a dependency. Use icons for: tab labels in the header
      nav (`TABS` in `src/App.jsx`), part headers (`Part` in Planner), provenance (`Prov`), axis chips, buttons
      (Reset, Export, Ask Limiar), and callouts (good / warn / bad).
- [~] Spacing audit in `src/styles/dash.css`: page max-width and side padding (`.page`, `.page.wide`), hero
      height, card padding, gaps in `.cols` and `.stack`. Goal: denser, with the main content nearer the top
      of the screen on a 1080p display.
- [~] Use the empty hero space on every tab (Planner, Evidence, Estimator all have a large title plus a narrow
      paragraph and a blank right side). Put a live "at a glance" panel there.
- [~] Type scale: raise the smallest sizes, check contrast of `.note`, `.lbl`, `.eyebrow`, `.chip` against the
      dark background.
- [ ] Responsive pass for narrow screens (`.cols` collapse, sticky aside should not stick on mobile).
- [ ] One consistent empty/loading/error state component (`.empty`, `.boot`, the assistant error callouts).

---

## 6. Shared building blocks to create first

These unlock several items above, so build them before the tab-specific work.

1. `src/ui/icons.jsx` (or lucide-react).
2. `src/ui/SliderField.jsx`: the slider-under-the-field control used in all three places (Planner, Estimator,
   Workbench Scenario node). Props: `label`, `unit`, `value`, `onChange`, `min`, `max`, `step`, optional `scale`
   ('linear' | 'log'), `ticks` [{value, label, icon}], `band` {min, max, label}, `hint`. It renders the existing
   number field on top (typing is never clamped) and the slider with its graphics underneath. One shared
   stylesheet block in `src/styles/dash.css`; the canvas imports the same classes.
3. `src/ui/DescribeBox.jsx` + `src/lib/nlspec.js` (rule-based fallback) + `parseSpecText()` in `src/lib/assistant.js`
   + `api/parse.js` and `parseSpec()` in `api/_gemini.js`.
4. `src/ui/FlameLoop.jsx` + keyframes in `src/styles/dash.css`.
5. A spacing / type-scale pass in `src/styles/dash.css` (tokens first, then components).

## 7. Suggested session order

1. Session A: building blocks 1-2 and the spacing / type pass (section 5), so every tab benefits.
2. Session B: Describe box end to end (6.3) in the Planner (1.1), then reuse it in the Estimator (2.1).
3. Session C: Estimator polish (2.2 flame, 2.3 sliders, 2.4 fix).
4. Session D: Evidence layout (3.1, 3.2) and Planner polish (1.2, 1.3).
5. Session E: Workbench (section 4) once Q3 is answered.
6. After each session: run `npm run build`, `node web/scripts/check_plan.mjs`, `node web/scripts/check_graph.mjs`,
   look at every changed tab in `npm run dev`, then update ROADMAP.md.

Checks to add when building: a script test for `nlspec.js` (a few sentences in, expected spec out), and a case
where the AI returns an unknown material or an out-of-range value (must be clamped or rejected by
`normalizeSpec`, with a visible message).

## 8. Decisions on the open questions (answered 2026-11-15, owner delegated them)

- Q1 Sliders: DECIDED. A small slider sits directly under each numeric field (gravity, pressure, oxygen,
  thickness, airflow) running across a preset range, with small graphics on the track (reference ticks and
  icons, covered/trained band, filled portion, thumb that turns ember outside the band). The typed value always
  wins and can go beyond the slider. Applies to the Planner form, the Estimator Scenario card and the Workbench
  Scenario node. See 1.2, 2.3, 4.2 and 6.2.
- Q2 Evidence scrolling: DECIDED. It is an ergonomics issue (controls and the table are far apart), not a
  functional bug. Keep the sticky-controls layout plus chart and table together with two-way linking (3.1).
- Q3 Workbench: DECIDED. Keep the tab (the owner wants sliders there too) and do the trimmed B today: intro
  banner, node captions, auto-layout, sliders on the Scenario node, fix the clipped Nearest evidence table.
  Option A (open from the Estimator) comes later. Do not hide it.
- Q4 Flame colour: DECIDED. Orange/yellow in every state. No flame = dim ember and a wisp, not red. Uncertainty
  is shown by the dashed outline and the "extrapolation" tag only; red stays reserved for alerts.
- Q5 Describe box: DECIDED. Use the same Gemini key (`GEMINI_API_KEY`), keep the rule-based fallback in
  `src/lib/nlspec.js`, and list the feature in the SI-use declaration in `submission/`.

General note from the owner: none of this is about new science. It is about making the interface more
ergonomic and easier to see and read. When in doubt, choose the option that shows more at once, with less
scrolling and fewer blank areas.

## 9. Session log

### Session A (2026-11-15): building blocks 1-2 + spacing/type pass. Build and Node checks pass; NOT yet looked at in a browser.
Done:
- `src/ui/icons.jsx`: inline icon set (no dependency) + `TAB_ICON`. Used in the tab nav, Ask Limiar, `AxisChip` (real icons instead of text glyphs), Reset, Download, hero tiles, Vary/Hold/Measure.
- `src/ui/SliderField.jsx`: `SliderTrack` (the slider only) and `SliderField` (number on top + slider). Typed value is never clamped; ticks are clickable;
  shaded band; filled part; thumb turns ember outside the band; "beyond" flag when the value is past the slider span; arrow keys step, Shift or PageUp/Down = 10x;
  `aria-valuetext` carries the unit; log scale for thickness and airflow. `SLIDE` holds the per-variable spans and reference ticks; `coverBands(kb, axis)` builds the
  measured-data band from `kb.boxes`.
- Planner: sliders for thickness, oxygen, pressure, gravity, airflow (bands = measured-source ranges); gravity pills removed (ticks Micro/Moon/Mars/Earth replace them);
  presets are 2-column cards with the O2/kPa/g line instead of truncated pills; hero has a live "at a glance" row (prior art, gaps, regime, model estimate);
  sticky jump index to parts 1-5; prior art shows 2 rows + "show more"; Vary/Hold/Measure in three columns.
- Estimator Scenario card: sliders with the trained range as the band; gravity pills removed.
- Workbench Scenario node: canvas `NumField` + `SliderTrack`, `nodrag nowheel` kept on the input and ticks.
- `dash.css` bottom block "Session A": denser page/card/stack spacing, smallest type sizes raised one step, slider/preset/tile/jump/trio styles.
Checks run: `npm run build` ok (74 modules); `check_plan.mjs` all PASS; `check_graph.mjs` all PASS.
Not done / next:
- Open `npm run dev` and look at Planner, Estimator and the Workbench Scenario node (slider alignment of thumb vs fill, tick label collisions at 372 px, mobile).
- 2.4 red highlight behind the log-odds line is still unexplained (no rule in dash.css produces it; check `src/styles.css` if it is still imported).
- Hero "at a glance" for Evidence and Estimator, empty/loading state component, responsive pass: still open.
- Next session: B (describe box).

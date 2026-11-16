# changes_for_next.md

Change list from Elias's review of the tabbed dashboard (2026-11-15, after the first browser look).
Status (updated 2026-11-15, evening): most of this list is now built. Sections 1.2, 2.3, 2.5, 3 (Evidence), 4 (Workbench), 5 (icons, density), the describe box
(1.1, 2.1) and all of section 10 except the hexagon-in-browser check are done; see the session log in section 9 for what was
built and what was NOT looked at in a browser. Session D (2026-11-15, night) built 2.2 (flame, not yet seen in a browser) and mitigated 2.4 (cause unconfirmed). Still open: responsive and empty-state items in section 5. This file is meant to survive several sessions: work top to bottom,
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

### 1.1 [x] "Describe it in words" box that fills the experiment form (built in Session B)
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
Status after Sessions A and C-UI: done = preset cards (no truncation), "Gravity" duplicate removed (pills replaced by slider ticks), hero at-a-glance tiles,
prior art with "show more", Vary / Hold / Measure in three columns, icons in `AxisChip`, jump index, larger mono labels and sentence case (10.8).
Not measured yet: contrast of `.note` against the background, and the mobile layout. Original notes below.
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

### 2.1 [x] "Describe a scenario" box that fills the Scenario card (built in Session B)
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

### 2.2 [x] Animated flame on the "Estimated outcome" card (built in Session D; NOT yet seen in a browser)
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

### 2.4 [~] Visual fix on the outcome card (mitigated in Session D; cause NOT confirmed)
In the screenshot the "log-odds +5.39 · extinguish ← 0 → spread" line has a solid red/brown highlight box
behind the text. It reads like a rendering bug. Check the `note num` styles and the `outside` colour rules
in `src/styles/dash.css` and the inline `style` on the card in `Estimator.jsx`; make it plain text or a
deliberate chip.

### 2.5 [x] Share the scenario between tabs
`App.jsx` owns one Planner-shaped scenario. Planner, Estimator and the Workbench Scenario node stay synchronized;
Evidence shows a distinct, explicitly non-measurement marker when the scenario has an in-range airflow and oxygen
value. Estimator/Workbench map unsupported Planner material classes to a model material as a proxy and label it.
Estimator-only edits preserve Planner's airflow and question.

---

## 3. Evidence tab (`src/tabs/Evidence.jsx`)

### 3.1 [x] Fix the "scroll down, scroll up" problem with the data table
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

### 3.2 [x] Chart fixes seen in the screenshot
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
- Rename the tab to something that says what it does (for example "Node Workspace" or "Model graph").
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

### 4.3 [x] Workbench onboarding and layout
- Replaced the full-width introduction with a first-click help modal to give the canvas its vertical space; node captions explain each step.
- The starter recipe is laid out left-to-right by node family and the canvas fits the layout on load.
- Fixed the Nearest evidence table to wrap within the node; removed unfinished "soon" recipes and added an explicit reset action.
- Renamed the tab to "Node Workspace" and aligned the canvas palette with the dashboard tokens.
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

### Session B (2026-11-15): describe box end to end + hover pass. Build and Node checks pass; NOT yet checked against real Gemini.
Done:
- `api/parse.js`, dev twin in `vite.config.js` (`devApi` serves /api/chat and /api/parse), `parseSpecText()` in `src/lib/assistant.js` (Gemini, then rules fallback, validated twice).
- `src/lib/specpatch.js` (`plannerPatch`, `estimatorPatch`, field meta), `src/ui/DescribeBox.jsx` (examples, chips old > new, kept, assumptions, Undo, JSON export, AI/rules label). Wired into Planner and Estimator hero.
- `dash.css` blocks "Session B" (describe box, hover flair, affordances) and "Session B2" (thinner sliders, page max-width 1760).
- Scripts: `check_specpatch.mjs` (9 PASS), `check_nlspec.mjs`, `check_plan.mjs`, `check_graph.mjs` all pass.
Seen by the owner in the browser (screenshots 2026-11-15 19:30): sliders felt too heavy (thumb), band is liked and must stay; page had large empty side margins; persona toggle does nothing.
Still open from this session: 2.4 cause not confirmed (styles.css is orphaned; suspect `::selection` orange or an inspect-element check), SI-use declaration in `submission/`, ROADMAP.md entry.

### Session C-AI (2026-11-15, night): explanation-level pop-up (10.10) + Assistant tab (10.11). Build and Node checks pass; NOT yet looked at in a browser, NOT yet tried against real Gemini.
Done:
- `src/lib/level.js`: Neutral / Student / Professor / Engineer, saved in localStorage (`limiar.level`, try/catch), module store read with `useSyncExternalStore`.
  This replaces the `useAILevel()` hook idea in 10.10. `App.jsx` exposes `needLevel()` (a promise: resolves at once if a level is saved, otherwise opens the modal; null = cancelled, Esc cancels) and `openLevel()`.
- `src/ui/LevelModal.jsx`, the pop-up. The header Student / Professor / Engineer toggle is gone. Every AI action awaits `needLevel()` first: the drawer, the Assistant tab and "Write the brief with the assistant". The describe box does not ask (it only reads fields).
- `src/tabs/Chat.jsx` (tab `ai`, label "Assistant"): chat list (new, rename, delete with inline Yes / No), starter questions, "Level: X" chip, limits 30 chats and 40 messages with a visible note, saved in `limiar.chats`. Errors are shown once and never stored.
  `src/lib/chats.js` holds storage. `src/ui/ChatMessage.jsx` is shared with the drawer (every model message shows the "AI-written" chip). Three new icons: plus, trash, edit.
- `public/data/project_brief.json`, loaded by `App.jsx` and sent as `project_brief` inside the context. Server rules 8 (Neutral) and 10 (brief facts are cited as "(project brief)"; say "not covered" otherwise) are in `api/_gemini.js`. Server default persona is now Neutral in `api/chat.js`, `api/_gemini.js` and `vite.config.js` (it was Student).
- Brief sources: written from PROJECT.md and AGENTS.md, not from README / FEATURES / source_discrepancies as 10.11 said. Every number was re-checked against PROJECT.md tonight (hard rule 1); three wording fixes were made (see below).
- Not done from 10.11: the "Continue in the Ask tab" button in the drawer (marked optional there); on narrow screens the chat list stacks above the conversation (max 180 px, scrolls) instead of becoming a drawer.
Resolved with Elias: the 32/6 split was selected post-hoc, though a fixed seed (20261114) makes it reproducible; outcome balance was not used to choose it. PROJECT.md and ROADMAP.md now state both facts.
Other brief fixes: the FIRE-X line no longer says the project is "not about a chatbot" (we now ship one); the PSI line no longer says no numeric conditions were extracted (2,945 AI-extracted fields exist, 0 reviewed; the tool just does not use them yet).

### Session C-UI (2026-11-15, night): quick fixes 10.1 to 10.9. Build and Node checks pass; NOT yet looked at in a browser.
Done:
- 10.2 `src/ui/DecimalInput.jsx`: type=text, inputMode=decimal, always a dot, a typed comma becomes a dot at once, letters ignored, never clamped, empty-while-typing kept, resyncs when the slider / preset / describe box changes the value. Used by `SliderField` and `NumField` (bits.jsx). `src/canvas/NumField.jsx` was already text-based and dot-formatted, so it is unchanged.
- 10.3 `tickModes()` in `SliderField.jsx`: measures the tick row (ResizeObserver) and gives each tick a mode: full label, icon only, or a dot. Priority: `pri` on the tick, else icon, named, plain number. Pressure: 10.2 psi and 1 atm win over Suit and 8.2 psi. Gravity: Moon wins over Micro, which falls back to its icon. The rail mark and the click target always stay; the tooltip carries the full text.
- 10.4 no change, as decided.
- 10.5 coverage table (`tbl cov`): 22 px right padding on the numeric column.
- 10.6 `.sticky`: `max-height: calc(100vh - 84px)` with its own thin scrollbar; off below 1000 px. It applies to every `.sticky` aside, so check that the Estimator Scenario card really uses that class.
- 10.7 hero: bigger title (up to 62 px), lede 16.5 px, more padding in the describe box and tiles, 40 px under the hero. Tiles not moved.
- 10.8 sentence case in the sans font for labels, kv terms, table heads, `summary`, axis chips and all chips except provenance (verified / estimated / unreviewed) and kind chips marked `prov` (dataset, measured). Part eyebrows and the "MATCH" caption stay mono uppercase.
- 10.9 units inside number boxes: 12.5 px sans at about 70 % white, box widened to 128 px.
- 10.1 `AxisHex` in `bits.jsx`: six vertices in fixed order (fuel, O2, pressure, gravity, flow, outcome), filled / half / hollow / dashed, tooltip lists the statuses, axes not in use are left out. Used in the Planner `PriorRow` (the only place a match block exists). Plan B (six dots in a row) was not needed yet; decide after looking at it at 30 px.
- Follow-up after browser measurement: moved the range input's hit area up 10 px so the thumb center aligns with the 4 px rail center in the shared slider.
Checks run: `npm run build` ok (83 modules); `check_plan.mjs` all PASS; `check_graph.mjs` all PASS.
NOT checked in a browser: hexagon legibility, tick modes at 372 px and in the Workbench node, the scrolling form card (and its hover shadows near the edge), the chip casing on every tab, hero size on a 1080p screen, mobile.
Environment: `npm` and `node` were added to the super-shell whitelist as safe (the owner's standing rule). REMOVE both at the end of the project (see ROADMAP).
Still open after this session: 2.2 flame, 2.4 red band, 2.5, section 3 Evidence, section 4 Workbench, responsive pass and empty / loading state (section 5). The SI-use declaration is now drafted in `submission/SI_declaration.md`; its checklist for Elias is at the bottom of that file.

### Session D (2026-11-15, night): text repair + flame (2.2) + log-odds line (2.4). Build, `check_plan.mjs` and `check_graph.mjs` pass; NOT looked at in a browser.
Repair (another AI had left contradictory texts; there is no git repository, so this was found by reading, not by diff):
- The 32/6 split was described three ways. Now one version everywhere: chosen post-hoc, reproducible with a fixed seed (20261114), outcome balance not used.
  Fixed: `ROADMAP.md` (a line that said it was "not after seeing the data", and a pending item that was already resolved), `web/FEATURES.md` (F6), the user-facing
  brief `public/data/project_brief.json` (it pointed at "PROJECT.md"), and two labels the person sees in the app: `src/model.js` ("Fixed-seed split, chosen post-hoc")
  and `src/graph/defs.js` ("post-hoc 32/6 split (fixed seed)"). `PROJECT.md`, `data/README_takahashi2026.md`, `research/RESULTS.md` and `research/explicacao_projeto.html` were already correct.
- Removed a stray fragment ("holdouts.") in the ROADMAP log (21:59 entry).
Built:
- 2.2 `src/ui/FlameLoop.jsx` + the "Flame" block at the end of `dash.css`. One number (`z`) drives three named states: spreading (z >= 0.75), dying (-3.5 < z < 0.75, short and
  unsteady near 0, with a smoke wisp), none (z <= -3.5: dim ember and a wisp). Orange / yellow in every state. `outside` keeps the flame and adds a dashed red outline and an
  "extrapolation" tag. `prefers-reduced-motion` gives a static flame. The outcome card is now a row: text left, flame right (wraps on narrow screens). Not added: the small flame per rung in Planner part 4 (optional).
- 2.4 No CSS rule produces a coloured box behind that line. The only candidate is `::selection` (orange at 35 %, which looks like a brown-red box on the dark background). It is now lavender,
  and the log-odds line is a plain `.logodds` text with the number in bold. If the red box is still there in the browser, inspect the element: the cause is something else.
Revision after the owner's first look (2026-11-15, night): the candle-shaped SVG flame was replaced by a microgravity-style ball of flame (`FlameLoop.jsx` is now a canvas particle system:
particles drift outward in all directions, additive blending, a wide soft halo that fills the container). The "Flame spreading / dying out" caption is gone (the state stays in `aria-label`);
the "extrapolation" tag and dashed outline stay. The old SVG keyframes were removed from `dash.css`. Build passes; not seen in a browser.
Not verified: how the flame looks and moves (shape, sizes at 132 px, wisp), the dashed outline, the card layout at narrow widths, and whether the red box is gone.
Still open: 2.5, Workbench (section 4), responsive pass and a shared empty / loading state (section 5).

### Session E (2026-11-15): Evidence tab (3.1, 3.2)
Done:
- Added the Evidence-specific layout styles: the control cards stay beside the chart on desktop, while the aside becomes normal-flow on narrow screens.
- The data table has its own bounded scroll area, sticky header, and horizontal overflow rather than clipping columns. Row hover/selection is visible and keyboard focus is outlined.
- Kept the existing chart/table cross-highlighting and chart-to-row scrolling; added wrapping constraints so the selected-point provenance chip stays inside its card.
- Styled the outcome and symbol/line legends as separate groups. The chart already anchors the right-hand “no data” label inside the SVG and has a plain-language caption.
- Updated the section 3 status in this file. No optional range sliders were added.
- Browser check: desktop aside is sticky; table is 340 px tall with a sticky header; filtering shows 5 of 39 verified points and restores all 39; chart selection scrolls to the matching row; the provenance chip stays inside its card.
- At 390 px, the aside is static and the page has no horizontal overflow; only the table scrolls horizontally. Remaining responsive checks across other tabs stay open for section 5.
Checks run: `npm run build` passed (84 modules).

### Session F (2026-11-15): shared scenario (2.5)
Done:
- Lifted scenario state to `App.jsx`; the Planner remains the source shape, including its optional airflow and question.
- Estimator reads and writes the shared material, thickness, oxygen, pressure and gravity. Estimator-only edits preserve the Planner-only fields; describing an unsupported material retains that class and labels the model's proxy.
- Workbench imports the shared values into its Scenario node and sends node edits back. Unsupported materials are visibly identified as proxies.
- Evidence overlays the shared oxygen/airflow as a separate plus marker, only when both values fit the displayed axes. It is labelled as a coordinate reference, not a measurement or prediction; the data and fit remain unchanged.
- The shared initial scenario follows the Planner's existing default, so Estimator now opens with those same values instead of its former separate defaults.
Checks: `node scripts/check_scenario.mjs`, `node scripts/check_plan.mjs`, `node scripts/check_graph.mjs` and production build passed. Browser check confirmed Planner → Estimator (including the shared initial defaults), Estimator → Evidence (marker at 22% O₂ / 10 cm/s), Planner → Workbench (Scenario node at 22%), and a Workbench edit back to Planner (20% O₂, with airflow preserved).

### Session G (2026-11-15): Workbench onboarding and LIMIAR branding
- Replaced the space-consuming intro banner with a first-click help modal; node captions, reset-to-recipe action, left-to-right family layout, and wrapped Nearest evidence columns remain; removed unfinished recipe placeholders.
- Renamed the tab to "Node Workspace" and replaced the old challenge title in the app header, browser title/favicon, and assistant identity with the supplied LIMIAR marks.
- Recolored the remaining canvas-specific blue accents to the dashboard's lavender/orange design tokens.
- Confirmed `api/chat` and `api/parse` read `GEMINI_API_KEY` server-side. No Vercel deployment was triggered: this workspace has no linked project or Vercel CLI; the variable is configured for Production in Vercel.
- Build and browser review: pending.

---

## 10. Review after the first look at the describe box (owner answers, 2026-11-15)

Context: the audience is scientists. Owner answered each point; decisions below are final unless marked [?].

### 10.1 [x] Match score + six-axis glyph (replaces old point 1; built, check legibility at 30 px in the browser)
- DECIDED: keep "NN% MATCH" as is. It is clearly a match, not a probability. Do not rename it.
- Add a small hexagon glyph next to the percentage: new `AxisHex` in `src/ui/bits.jsx` (inline SVG, ~28 px). One vertex per axis (Fuel, O2, Pressure, Gravity, Flow, Outcome; same order as the chips). Vertex dot: filled = inside, half = near, hollow = outside, dashed = not stated. Reuse the status colours of `.ax`. Tooltip lists the six statuses. If the plan has fewer than 6 axes (no flow requested), draw only the vertices in use. If it reads oddly at small size, fall back to six small dots in a row (designer's call).
- Used in `PriorRow` (Planner) and anywhere else a `match` block appears.

### 10.2 [x] Number inputs: always a dot (point 2)
The fields show `0,125`, `70,3` (browser locale on `type=number`) while the rest of the page uses dots. In `NumField` / `SliderField` number box: `type=text`, `inputMode=decimal`, always render with a dot, accept a comma when typing and convert it. Typing is still never clamped; keep the empty-while-typing behaviour. Also applies to `src/canvas/NumField.jsx`.

### 10.3 [x] Slider tick labels must not collide (point 3)
Seen: "8.2 psi" vs "10.2 psi", "Micro" vs "Moon", "0.125" under the thumb. In `SliderTrack` (`src/ui/SliderField.jsx`): measure tick x positions; hide the label (keep the tick and its click target) when it is closer than ~44 px to the previous visible label; priority to named references over plain numbers. The current value lives in the number box, not under the thumb.

### 10.4 [x] Gravity slider keeps the filled bar (point 4, DECIDED: no change)
Owner: part of the product is being able to see which experiments do not work. Keep the fill and the whole range selectable. Hard rule 8 stays enforced in the wording ("Micro and Earth are measured reference points; nothing between them is interpolated") and in the model, not by hiding the slider.

### 10.5 [x] Coverage table header collision (point 5)
Planner part 2: "YOUR VALUE" runs into "MEASURED SOURCES INSIDE". Add right padding to `.tbl th.num` / `td.num` in that table (about 18 px) so the next header starts clear of it.

### 10.6 [x] "Your experiment" card taller than the screen (point 6)
`.sticky` aside in the Planner: `max-height: calc(100vh - 84px); overflow-y: auto;` with a thin scrollbar, so Airflow and Question are reachable while the right column scrolls. Same for the Estimator Scenario card.

### 10.7 [x] Bigger hero, more air under it (point 7, replaces my earlier hero idea)
Do NOT rearrange the tiles. Only: make the hero larger (title size, lede width, more padding around the describe box and tiles) and add clear space between the hero and the dashboard (the `.cols` grid), about 32-40 px. Keep the tiles where they are.

### 10.8 [x] Less shouting in chips and labels (point 8)
Keep UPPERCASE mono only for provenance chips (verified, estimated, unreviewed, measured, dataset). Everything else ("WHY THIS RANK", "SHOW 3 MORE...", "PSI INVESTIGATIONS...", "START FROM", axis chips, kv labels) goes to sentence case in the sans font at 12-13 px. Edit `.eyebrow`, `.lbl`, `.field > span`, `details.why > summary`, `.kv dt`, `.tbl th` in `dash.css`; part eyebrows ("01 / PRIOR ART") may stay mono.

### 10.9 [x] Unit text inside the number box (point 9)
`.sf-num i` (mm, %, kPa, g) is tiny and faint. Raise to 12.5 px and `--text` at about 70 % so it reads as part of the value.

### 10.10 [x] Explanation level becomes a first-use pop-up (replaces the header toggle)
Owner: remove the Student / Professor / Engineer switch from the header (it did nothing visible). Instead:
- The first time the person triggers any AI action (Ask Limiar, the AI tab, "Write the brief with the assistant", the describe box in AI mode), show a modal BEFORE the call: short text "The assistant can explain things at your level. Pick one; you can change it any time."
- Four options: Neutral (new, default wording of the system prompt, no persona), Student, Professor, Engineer. One line under each saying what changes.
- Saved in `localStorage` (key `limiar.level`, wrapped in try/catch; works on Vercel, it is not an artifact). Change later from a small "Level: Professor" chip in the assistant header and the AI tab.
- `persona` in `src/App.jsx` becomes this value (`Neutral` added to the list in `_gemini.js` SYSTEM rule 8: Neutral = plain, balanced, no extra analogy). The describe box parser ignores it (it only reads fields).
- The deterministic brief (`localBrief`) is unchanged for now.
- Do the pop-up as a reusable `useAILevel()` hook + `LevelModal.jsx`; the modal resolves a promise so the original action continues after the choice.

### 10.11 [x] New "AI" tab: a full chatbot (built; the drawer's "Continue in the Ask tab" button is not)
Owner: a tab for the AI, for general explanations about the project and so on. Creating and deleting chats is enough.
- New tab `ai` (icon `chat`, label "Ask" or "Assistant") in `TABS` and `TAB_ICON`. Component `src/tabs/Chat.jsx`.
- Layout: left column = list of chats (New chat button, title, delete with an inline confirm), right = the conversation (reuse the message rendering and citation chips from `src/ui/Assistant.jsx`; extract shared pieces rather than copy). Mobile: list collapses into a drawer.
- Storage: chats persist in `localStorage` (`limiar.chats`, array of `{id, title, created, messages}`), title = first user message cut to ~40 chars, editable. Cap at 30 chats and 40 messages each; show a note when trimming. All try/catch.
- Context sent to Gemini: (a) the current plan context from `planContext()` when a plan exists, plus (b) a small, fixed project brief file `web/public/data/project_brief.json` written ONLY from PROJECT.md / README.md / FEATURES.md / source_discrepancies (scope, data sources and licences, models and their held-out numbers, the honest limits). Every number in it must trace to those files (hard rule 1). The existing `/api/chat` accepts this as `context`; raise the 24000-char clip only if needed.
- Rules stay as in `_gemini.js` SYSTEM: only CONTEXT, cite ids, "no data" when silent, no safety advice. Add rule: if asked something about the project that the brief does not cover, say it is not covered.
- Suggested starter questions: what is this project, what data it uses, what MARGIN-Spread can and cannot say, what the gaps map shows.
- The floating "Ask Limiar" drawer stays as the quick, in-context helper; it shares the level choice (10.10) and may offer "Continue in the Ask tab" to move the thread into a saved chat.
- SI declaration (`submission/`): add the chatbot and the level setting to the SI-use list (hard rule 4); label AI messages as AI-written.

### 10.12 Suggested order for the next sessions (status: steps 1 and 2 are built, see Session C-UI and C-AI in section 9)
1. Quick CSS/UI fixes: 10.2, 10.3, 10.5, 10.6, 10.7, 10.8, 10.9, then 10.1 (hexagon).
2. 10.10 (level modal) then 10.11 (AI tab), since the tab depends on the level.
3. Then the old plan: Session C (flame, 2.4), D (Evidence, Planner polish), E (Workbench).

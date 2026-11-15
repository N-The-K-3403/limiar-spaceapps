# Flame in Freefall - website spec (v2: canvas-first)

All user-facing text is English. This file is the single source of truth for what the site does and how it looks.
Working name of our estimator: **MARGIN** (placeholder; rename freely).

## One sentence
A node canvas where you describe an experiment you want to run and get, from real evidence and our own models, a cited answer to five questions: has this been done, what is missing, what should we run to close the gap, what do we expect, and where did every number come from. Every wire shows where its numbers came from.

## Decisions (Elias, 2026-11-15)
1. **The canvas is home.** Every feature is a node or a panel around the canvas; there is no tab layout.
2. **Wires compute.** Each node is a pure function; the graph is re-evaluated in topological order on every change.
3. **Three starter recipes** open the site (below); the user never lands on an empty board.
4. **The assistant exists twice:** a fixed chat panel and an Assistant node that pins an explanation on the board.
5. **The front door is the Experiment Planner (F14).** "I want to run this experiment under these conditions" is the headline workflow; everything else (explorer, ranking, comparison, gaps, charts) is a node the planner wires for you, and that you can also wire by hand. Nothing in this document is optional or cut for time.

## Layout (Figma / ComfyUI / FigJam logic)
- **Left - Library.** The knowledge graph as a draggable palette: investigations, datasets, papers, models, presets. Click an item to see its source; drag it onto the canvas to create a node.
- **Center - Canvas.** Dot grid, pan/zoom, nodes with typed ports, wires with a traveling pulse while data flows. Double-click a node to open it in focus mode (full-size Estimator, Evidence chart, table).
- **Right - Inspector + Assistant.** Properties of the selected node, its provenance, its sources, and the Gemini chat. The chat always receives the current selection (and the wired inputs) as context.
- **Top bar.** Recipe picker, Models, Sources/Method, Export, share link. Models and Sources open as drawers over the canvas.
- **Narrow screens.** The same recipe renders as a vertical list of cards (no canvas).

## Architecture
1. **Knowledge layer** - `data/graph.json`: nodes (investigations, materials, conditions, papers, models, data points) and edges, each with source and provenance (`verified` | `estimated from figure` | `AI-extracted, unreviewed`). Feeds the Library and the assistant's retrieval.
2. **Compute layer** - the graph evaluator plus the models (weights loaded from JSON in the browser, deterministic).
3. **Assistant (Gemini)** - explains and navigates. Receives structured node outputs and retrieved graph evidence; answers cite node IDs; never produces numbers of its own; says "no data" when evidence is missing. The API key lives in a Vercel serverless function (`web/api/chat`), never in the page.
4. **Trust layer** - model cards, provenance on every value and wire, domain checks, CSV/BibTeX export.

## Node families and typed ports
Ports are typed and colored; only compatible ports connect (so wiring teaches the workflow).

| Family | Nodes | Takes | Gives |
|---|---|---|---|
| Source | PSI investigation, SoFIE points, Takahashi cases, Paper | - | Evidence set |
| Scenario | Atmosphere + gravity + material + thickness (presets: Moon, Mars, ISS cabin, lunar-base candidate, spacesuit) | - | Scenario |
| Model | MARGIN-Spread (Takahashi), MARGIN-Limit (SoFIE-GEL) | Scenario (+ Evidence set) | Estimate + domain |
| Check | Domain check, Nearest evidence, Prior art, Rank for habitat, Coverage and gaps | Scenario / Estimate / Evidence set | Verdict, evidence rows, prior-art matches, ranking, gaps |
| Planner | Experiment Planner (the five-part brief), Next experiment | Experiment spec (+ Scenario) | Brief: prior art, gaps, proposed experiment, prediction, citations |
| Output | Evidence chart, Table, Next-test suggestion, Export | Evidence set / Estimate / gaps | Chart, file |
| Compare | 2-3 investigations side by side | Evidence sets | Comparison table |
| Assistant | Gemini explainer | any wire as context | Cited text card |

**Provenance on wires.** A wire inherits the weakest provenance among its inputs (verified > estimated from figure > unreviewed) and is drawn accordingly. No legend needed to read it.

## Features (mapped to nodes/panels)
- **F1 Investigation explorer** - Library + Source nodes: objective, fuel (shape, size), O2, pressure, flow, what varied, sensors; filters by fuel, O2, pressure, gravity, investigation. Unreviewed PSI fields carry the unreviewed style (0 of 2945 reviewed so far).
- **F2 Transparent relevance ranking** - Check node "Rank for habitat" (spacecraft, station, lunar base, rover, Mars surface): rule-based score with adjustable weights and a visible breakdown.
- **F3 Comparison** - Compare node; differences highlighted (e.g. FLEX vs CFI-G vs BASS-II).
- **F4 Knowledge graph** - the Library, plus a "show neighbors" action that expands a node's sourced edges onto the canvas.
- **F5 Evidence chart** - Output node: real points with provenance markers, shaded no-data bands, model curve once exported; click a point to inspect source, condition, confidence.
- **F6 Estimator (MARGIN)** - Model nodes. Always returns an estimate, with explicit output type: *class + uncalibrated score* (Spread) or *value with band* (Limit).
  - **Domain bar per input:** a mini range bar showing the trained span with a marker for the current value. Inside the span (boundary included) = no warning; outside = ember marker, dashed muted result, and a line naming the variable ("O2 30% > trained 15-21%").
  - Fixed line on every Spread result: "Estimate from a small retrospective model on figure-derived labels. Held-out cases: 12/17, 9/12, 5/6." The 5/6 is a 6-case split of three flights selected with a fixed seed, outcome balance not used; everything is retrospective. Counts are computed from the JSON files, never typed.
  - Gravity limited to 0.05-0.6 g; 0 g and 1 g appear as measured reference data, never as interpolated estimates (physics is non-monotonic).
- **F7 Assistant** - chat panel plus Assistant node (see decision 4); suggested prompts under the box.
- **F8 Coverage and gaps** - Check node: conditions covered vs missing (e.g. no public test with O2 >= 30% near 70 kPa; the 17 FLEX tests with O2 >= 0.30 are all above 10.2 psi).
- **F9 Next-test suggestion** - Output node, where we have a basis: SoFIE-GEL, repeat the low vs high preheating (q_c) contrast at about 1.1-1.6 cm/s, with reasoning and uncertainty.
- **F10 Model cards + maturity** - Models drawer; badge *verified* / *estimated-retrospective* / *exploratory* / *unreviewed*.
- **F11 Export and cite** - CSV of any table, BibTeX for sources, a share link that restores the canvas.
- **F12 Method / About** - method, limits, negative results (including failed model variants), licenses (Takahashi 2026 CC BY; T'ien 2025 CC BY-NC-ND), references, SI-use declaration.
- **F13 Earth applications** - short text in About: fine-water-mist extinguishers, smoke detection, firefighter gear; no model.
- **F14 Experiment Planner (headline)** - the user states an experiment as a spec: fuel/material and thickness, O2, pressure, gravity or gravity regime, flow, geometry, and the question (ignition, spread, extinction limit, detection, suppression). One node (plus its wired sub-nodes) returns five parts, each cited to graph node IDs:
  1. **Has this been done?** Prior art: investigations, papers and data points whose conditions overlap the spec, with an explicit match score per axis (fuel, O2, pressure, gravity, flow, outcome measured) and what is different. Empty result is shown as "no match", never filled in.
  2. **What are the gaps?** The axes of the spec not covered by any evidence (e.g. no public test with O2 >= 30% near 70 kPa; no partial-gravity data in PSI itself), drawn on the coverage map, with provenance of what does exist.
  3. **What experiment would close the gap?** A concrete proposal (conditions, what to vary, what to hold, which measurement, which platform class) with reasoning and uncertainty; where we have a quantitative basis (SoFIE-GEL q_c contrast at about 1.1-1.6 cm/s) it is stated as such, elsewhere it is labeled a rule-based suggestion.
  4. **What do we predict for it?** MARGIN-Spread and/or MARGIN-Limit run on the proposed conditions: class + uncalibrated score, domain bars, extrapolation status, nearest real cases, retained accuracy line.
  5. **All of it through the LLM.** The assistant writes the brief from the structured outputs of 1-4 only (it receives node outputs and graph evidence, cites IDs, never invents numbers, says "no data" when evidence is missing). The structured parts are shown next to the prose, so each sentence can be checked against its node.
  Entry points: the Planner form, the recipe "Plan an experiment", free text in the chat (the assistant fills the spec and asks before running), and "Plan from this gap" on any Coverage node.

## Starter recipes
0. **Plan an experiment** (front door) - Experiment spec -> Prior art, Coverage and gaps, Next experiment, MARGIN-Spread / MARGIN-Limit on the proposed conditions -> Planner brief (assistant) -> Export. Opens prefilled with the lunar-base case (30% O2, 10.2 psi, thin solid fuel, 1/6 g).
1. **Moon estimate** - Scenario (Moon, 30% O2, 10.2 psi, ACRYPLEN thin acrylic film; the model was not trained on PMMA) -> MARGIN-Spread, Domain check and Nearest evidence (all fed by the scenario) -> Evidence chart (fed by Nearest evidence), with the Assistant wired to the estimate later. Opens outside the trained domain on purpose (O2 30% vs trained 15-21%): the first thing the board shows is where the evidence ends. Shows the headline workflow in 30 seconds.
2. **Where are the gaps?** - SoFIE points + Takahashi cases (+ PSI catalog, unreviewed) -> Coverage and gaps (against the challenge's lunar-habitat target) -> Next-test suggestion -> Export.
3. **Compare investigations** - two PSI investigations -> Comparison -> Assistant summary. PSI fields are unreviewed, so this recipe is labeled accordingly.

## Look and feel: plasma and ember
Meaning, not decoration. Microgravity flames are blue spheres; Earth flames are orange teardrops.
- **Orange to yellow = heat and data** (measured points, estimates, model output). **Deep plasma blue = structure** (wires, ports, selection, grid, the 0 g regime). **Ember red = alert only** (outside the trained domain, errors). Warm near-black background.
- Palette to tune on screen: background `#07080b`; node/panel `#0e1015` with a `#1d2129` 1 px border; heat `#ff7a1a` / `#ffb02e` / `#ffe08a`; plasma `#1c3dff` / `#3b6bff` / `#7aa2ff`; ember `#ff3b30`; text `#e9e6df`, secondary `#8c8f98`. Blue is for lines/icons/accents, not long text (contrast).
- **Provenance by shape, not color:** verified = solid bright core with glow; estimated from figure = hollow orange ring; unreviewed = dashed and dim. Wires follow the same three styles.
- Dot-grid canvas (small circles at intersections, brighter near the cursor); thin curved wires with gradient and a traveling pulse; nodes are matte dark panels with a thin header in the family color; numbers in mono, text in clean sans.
- **Glow only where it carries meaning:** the selected node, the model output and the active port. One incandescent element per region.
- Honors `prefers-reduced-motion`; glow via box-shadow/SVG filters on few elements; provenance never relies on color alone.
- Not allowed: fake 3D flame, vanity counters, sparkline trends, background particles.

## Not in v1
Chamber/flame simulation, rocket/propellant fire safety (out of PSI scope), any LLM-generated number, republishing paper figures.

## Build order (everything is in scope)
1. [done] Canvas shell in the new look: dot grid, Scenario / MARGIN-Spread / Domain check / Nearest evidence / Evidence chart nodes, evaluator, wires with pulse, Inspector, recipe 1.
2. Single `graph.json` (investigations, papers, data points, cases, gaps, next test; provenance on every node and edge) and the Library fed by it.
3. Source, Prior art, Rank for habitat, Coverage and gaps, Next experiment, Compare nodes; recipes 2 and 3.
4. Experiment spec + Planner (F14) wiring the above, recipe 0.
5. Assistant: `api/chat`, fixed panel, Assistant node, context from selection and wires, brief generation from structured outputs.
6. MARGIN-Limit export + fitted curve in the Evidence chart; focus mode (Estimator, Evidence); Models / Sources / About drawers; CSV, BibTeX, share link; list view for narrow screens; visual fixes.

## Open items
- Single `graph.json` (merge dashboard graph, COMPILADO.md, CSVs).
- Serverless function for Gemini (key in a Vercel env var).
- Prior-art matching must be rule-based and inspectable (per-axis match, no embeddings-only black box); PSI fields stay labeled unreviewed.
- Human review of PSI fields and the 4 uncertain Fig. 7 labels.
- Final name for the estimator.

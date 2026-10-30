---
name: render-network-topology
description: Create or revise offline network topology diagrams with SST icons, semantic connections, mixed compositions, light/dark themes, browser layout editing, editable HTML save, and SVG/PNG/JSON export. Use for enterprise network, infrastructure, ring, data-center, and network-path diagrams or converting descriptions and sketches into topology models.
metadata:
  version: "2.0.0"
---

# Network Topology

Use [references/topology-design-standard.md](references/topology-design-standard.md) as the bundled v1.0 design baseline, subject to the user's explicit instructions. It supersedes older visual guidance in this skill. Preserve connectivity, object identity, and known facts before optimizing appearance. Use the latest bundled SST catalog and font resources; do not recreate approved symbols by hand.

## Choose the output path

- **V2 design output:** use `scripts/v2/scene.js` primitives and the V2 model described in [references/topology-v2-design.md](references/topology-v2-design.md). Build the bundled sample workbench with `node <skill-path>/tools/build_topology_v2_design.js --output <task-outputs>/Topology_V2_Design`. Its coordinates are curated; browser layout editing is available; general automatic layout and adding/removing topology objects are still pending. Never pass V2 JSON to the legacy Python renderer.
- **Existing legacy models / editable legacy HTML:** keep `scripts/render_topology.py` and [references/topology-model.md](references/topology-model.md) for compatibility. Its layout editor can move objects, routes, and labels; it does not implement all v1.0 layout and routing requirements. Audit the result against the current standard and report specific gaps.

Deliver files in the active task's `outputs/` directory. Do not modify the installed skill to generate a diagram.

## Workflow

1. Inspect the description, model, sketches, and current icon assets. Preserve stable IDs when revising a diagram. Treat ambiguous intersections as unknown connectivity, and clarify only if the ambiguity changes the actual graph.
2. For a new diagram, fill the [Topology Brief](references/topology-brief.md) with known facts and recommended choices. Reuse an already confirmed brief for revisions; the user's instruction to regenerate approved samples authorizes that work without another approval round.
3. Select a main reading path and local compositions. Eight families can combine by region: hierarchy, hub-spoke, dual center, ring, grid, nesting, swimlane, and unconnected capability panorama. Draw boundaries only for actual geography, sites, security, network, management, or capability scope. Ordinary layers use headings, alignment, and whitespace.
4. Preserve separate semantic dimensions: physical = solid, logical tunnel = dashed, management = dotted, business flow = directional color over its existing base path. Use neutral base connections. Main/standby, RPL, and failure are explicit roles or state markers; they do not turn physical lines into dashed tunnels. Keep true independent edges and aggregate member IDs/attributes traceable.
5. Position devices, names, badges, and region titles before routing. Names are outside and below circles, at least 13px, at most two lines; use unique display names and retain full names. Allocate ports around the local hierarchy axis: one centered, two mirrored, three center plus a pair, four two pairs. When a 6 o'clock line conflicts with a name, keep the line and move that name to a clear lower-side position consistently.
6. Use rounded orthogonal paths by default, at most two bends. Standard/compact corner radii are 12/8px and parallel spacing 12/8px. A user's explicit straight/curve style must remain that style. Preserve manual controls and locked positions; show concrete conflicts when a hard rule cannot be met. Do not silently add a third bend or hide lines under labels.
7. For rings, use shared `ringPositions` with near-equal arc lengths and exact `geometry: ring` arcs clipped to device circumferences. Keep a real closed cycle visually continuous; preserve RPL and built-but-failed segments with explicit state markings. Never invent a missing edge. External branches use outward radial sectors; interior targets use inward sectors, separately from the two ring ports. Ring labels stay horizontal and below by default. Rotate or mirror only within actual location/port/direction constraints.
8. Read [Topology Taste Audit](references/topology-taste-audit.md) before final positioning and [Diagram Design Alignment](references/diagram-design-alignment.md) for connector review. Keep explanatory notes in shared quiet theme-aware boxes, with 1px neutral border and 4px radius, occupying real whitespace. Line labels sit beside a clearly attributable segment, never covering it.
9. Render and inspect actual light/dark SVG and PNG, plus the offline HTML controls and saved JSON. Check references, semantic legends, member mappings, circumference endpoints, badge/glyph fit, name/title/note collisions, bends, independent overlaps, crossings, and ring closure. Check text/essential graphics against 4.5:1/3:1 contrast references on their real backgrounds. Mark failed hard constraints as a draft requiring repair, with exact IDs and options; do not claim acceptance.

## V2 layout editing

Open the generated HTML and click **编辑**. Drag devices, device names, regions, junctions, annotations and line labels; nested areas carry their descendants. Select a line to drag circumference anchors, an orthogonal corridor or cubic control points, or explicitly change its geometry. Business overlays edit the referenced base route. Ring segments retain the common ellipse: member dragging follows that ellipse without changing neighbor order; move/resize the whole ring using its handles. Respect locked objects and members.

**轻量吸附** is on by default. Device endpoints weakly snap to eight 45-degree circumference ports only within 5 CSS screen pixels, with an 8px release range to prevent jitter; retain continuous free angles elsewhere. Moving objects can align to device bounds/centers, region edges/centers/quarters and ring axes/key points. When dragging a device, use only the circle center/radius as its alignment bounds, independent of label size, metadata or label offset. Give peer circle center-to-center alignment priority over matching edges and region/canvas guides within the same 5px acquisition range; an already held weaker guide must yield to that center alignment. Keep hysteresis among equally strong targets. Ring members snap only to valid points on the same ellipse without crossing neighbors or violating clearance. Hold Alt to bypass magnets, or uncheck the toggle; Shift uses 1px grid steps and Alt+Shift permits fine free adjustment. Keyboard nudges remain explicit and are not magnetized. Show quiet temporary guides and selected-device port dots only in edit mode. Keep guides/latches out of model data and static SVG/PNG; never infer new links from proximity.

Edits are stored separately in each view. Preserve object IDs, connectivity, deployment/status semantics and aggregate members. Use **撤销 / 重做** or Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z; arrow keys nudge a selection and Shift uses 1px steps. **检查布局** reports collisions/crossings and labels unresolved output **编辑待修**; it is a bounded layout check, not a general automatic router or a certification of the complete standard.

**保存 HTML** produces a self-contained editable workbook containing all current scenes and views; reopening starts in view mode. **保存模型** saves the current full V2 scene and its views; **导入模型** reopens a validated V2 JSON, with existing IDs replaced and new IDs added to the workbook. JSON import is data only and uses bundled assets. Check the actual exported bytes and reopen HTML/JSON/SVG/PNG before claiming persistence. The browser's native save step is separate from producing a valid file. This editor changes layout, not the actual graph structure.

## Current icon rules

`assets/sst-icon-system.json` is the shared SST v4 catalog used by Node and Python. It contains 12 approved SST categories, HA/Stack/Cluster/MLAG symbol paths, and layout parameters. Use neutral symbols for uncovered types; the full 80-class library is not complete.

Normal circles are 84px / compact 64px, with 2.4px borders. Untagged visible ink is centered at about 61.8% of diameter. With a deployment pill, ink is 41.5px / compact 26px and moves to y=-14; the pill is inside the lower circle, bottom inset 5px, height 28px / compact 26px. Use `sst-tag-metrics.json` to center the symbol and text as a group. Deployment and runtime status remain independent; tags never create peers or links.

Embed unmodified IBM Plex Sans Regular/SemiBold and the bundled OFL license in offline HTML/SVG. Preserve the Source Han Sans SC / Microsoft YaHei Chinese fallback. Do not install fonts or request remote font services for rendering.

## Legacy command

```powershell
python <skill-path>/scripts/render_topology.py model.json --output outputs/topology.html
```

The legacy Python path uses the standard library. Keep viewer mode initially active; enter `Edit` explicitly. HTML/JSON downloads preserve the model; verify SVG/PNG export content separately from the browser's system save step.

## Resources

- `references/topology-design-standard.md`: complete approved v1.0 standard and 47 confirmed decisions.
- `references/topology-v2-design.md`: implemented specimen model, token use, and current boundaries.
- `references/icon-catalog.md`: canonical device types and icon selection.
- `assets/sst-icon-system.json`, `sst-device-icons.svg`, `sst-tag-metrics.json`, `fonts/`: shared current symbol, tag, and font sources.

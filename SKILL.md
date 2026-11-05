---
name: render-network-topology
description: Create or revise offline network topology diagrams with bundled vector icons, six icon palettes, semantic connections, mixed compositions, light/dark themes, browser layout editing, editable HTML save, and SVG/PNG/JSON export. Use for network, infrastructure, ring, data-center, and network-path diagrams or converting descriptions and sketches into topology models.
---

# Render Network Topology

Create an accurate topology as a self-contained editable HTML file. Use the bundled assets and [design standard](references/topology-design-standard.md); user requirements take precedence over its visual defaults. The skill is independent of a particular company, vendor, agent, or workspace.

## Workflow

1. Read the supplied description, sketch, model, or existing diagram. Record known objects, actual connections, containment, status, audience and output destination. Use the [brief](references/topology-brief.md) for complex work. Ask only for missing information that changes the topology; distinguish assumptions from facts.
2. Choose a composition that expresses the relationships: layered, hub/spoke, dual-center, ring, grid, nested regions, swimlanes or unconnected capabilities. Combine them where appropriate. A region or unconnected illustration need not acquire edges. Preserve stable IDs and member mappings across views.
3. For new work, use the V2 model and renderer below. Read [V2 format and editing](references/topology-v2-design.md), then adapt a bundled specimen or `examples/v2-minimal.json`. Set coordinates deliberately; the renderer is not a general automatic layout engine. Keep names, annotations and edges clear of glyphs and deployment pills.
4. Preserve connection meaning separately from appearance. Physical, logical, management, role, failure and uncertainty are separate fields. Pipes retain real member IDs and endpoints. Business overlays reference `base_edge`; packet animation, width or color never imply measured traffic or CoS values without evidence.
5. Prefer rounded orthogonal routes, balanced fan-out and symmetric ports where the actual graph allows them. Honor explicit straight or curved routes. Use a shared ellipse and exact circumference clipping for a ring; do not invent a missing connection to close it. Keep external branches separate from ring ports.
6. Select a palette from `assets/icon-palettes.json`: `ocean` (default), `forest`, `violet`, `copper`, `graphite`, `categories`. `scene.icon_palette` is the whole-diagram default; `node.icon_palette` overrides one device. Omit the node field to inherit. Palette changes affect icons and discs, while connection/status semantics retain their own colors. Both themes have matching variants. See [icon catalog](references/icon-catalog.md).
7. Build, inspect and revise the actual output. Use the [taste audit](references/topology-taste-audit.md) and [connector guidance](references/diagram-design-alignment.md). Inspect light/dark SVG/PNG, labels, exact endpoints, ring closure and the HTML controls. Reopen saved HTML/JSON and verify actual export bytes before claiming persistence. Report unresolved conflicts explicitly.

## Portable commands

Run from this skill folder; Node uses only built-in modules. No package installation, network, font service or external skill is required.

```sh
# Build the full specimen workbook and standalone SVGs.
node tools/build_topology_v2_design.js --output outputs/topology-samples
# Render your own full V2 JSON as an editable offline workbook.
node tools/build_topology_v2_design.js --model examples/v2-minimal.json --output outputs/my-topology
```

Deliver `index.html` from the chosen output folder. Keep the full JSON when an editable source is requested. HTML contains assets, fonts and data; standalone SVG/PNG show a static view.

## Browser layout editing

Start in view mode; click **编辑** for editing. Move devices and names, nested regions, annotations, junctions, ring centers/sizes, line labels, circumference anchors, orthogonal corridors and cubic controls. Ring members follow the same ellipse and retain neighbor order. Locked objects stay locked. Business overlays follow their base route. This edits layout, not graph membership.

Light snapping is enabled by default: 5 CSS pixels to acquire, 8 to release. Endpoints have eight compass ports; regions and rings have centers, axes and key points. Device alignment uses the circle, independent of bottom labels. Peer circle centers take priority over weaker guides. Alt bypasses magnets; Shift gives 1px steps. Temporary guides never enter exports or model data.

Whole-diagram palette is in the main toolbar; selected-device palette is in the edit toolbar. Palette edits support undo/redo and persist through HTML/JSON save and import. Layout and node palette overrides belong to the current view; the whole-diagram default is shared across views. Undo history is per scene. JSON import is validated data only, using bundled resources.

**保存 HTML** keeps the whole workbook editable and reopens in view mode. **保存模型** keeps the full current scene and all views. **导入模型** replaces an existing scene with the same ID or adds a new one. **检查布局** is a bounded check; it does not certify all design rules or perform general rerouting.

## Legacy model

For existing Python-model JSON, read [legacy format](references/topology-model.md):

```sh
python scripts/render_topology.py examples/network-topology.json --output outputs/legacy.html
```

Python 3.10+ and its standard library suffice. `canvas.icon_set` is `detailed` (default) or `neutral`; `canvas.icon_palette` uses the same six palette IDs. Legacy editing and global palette selection remain available, but the Python model does not provide the V2 composition/ring engine or node palette overrides. Do not interchange the two schemas silently.

## Resources and distribution

- `assets/topology-icons.svg`, `icon-system.json`, `tag-metrics.json`: 12 detailed roles, four deployment tags, measured ink/tag metrics; other roles use bundled outline symbols.
- `scripts/v2/`: render, edit and snapping logic; `tools/`: portable sample builder and verification commands.
- Fonts: unmodified IBM Plex Sans with its SIL OFL 1.1 notice in `assets/fonts/`.
- Skill distribution follows [LICENSE](LICENSE), including the prohibition on paid distribution of modified skill software. Preserve third-party notices. The license permits commercial topology deliverables; do not add visible attribution to a user's drawing unless required by its other assets.

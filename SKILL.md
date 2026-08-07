---
name: render-network-topology
description: Create or update professional, flat-style network topology diagrams as self-contained offline HTML files. Use for requests to draw network topology, network architecture, infrastructure diagrams, data-center layouts, network path diagrams, or to convert text descriptions, hand-drawn sketches, screenshots, or existing topology HTML into an editable topology diagram with device icons, grouped areas, connection styles, themes, status highlighting, a visual taste audit, and a confirmed topology brief.
---

# Network Topology HTML

Turn the supplied description or sketch into a confirmed Topology Brief and normalized Topology Model, then render it with `scripts/render_topology.py`. Deliver the generated HTML in the active task's `outputs/` directory.

## Workflow

1. Inspect text, images, and any existing topology HTML. Extract devices, labels, groups, links, link direction, and explicit visual emphasis. For a sketch, treat line crossings and unclear endpoints as ambiguous; ask only when the ambiguity changes connectivity.
2. For a new diagram or structural re-draw, present a prefilled Topology Brief using [references/topology-brief.md](references/topology-brief.md), then wait for the user's confirmation before rendering. Mark supplied choices as confirmed and inferred choices as recommendations. Confirm the grouping and hierarchy, light or dark theme, canvas size or aspect ratio, link routing, visual emphasis or status, language and label abbreviations, compact endpoints, and visual profile. Use these defaults when the user has not specified them: light theme, Azure-inspired restrained enterprise visual direction, 16:9 canvas, axis-aligned links, and static effects. Do not render the final HTML until the brief is confirmed. For a narrowly scoped edit to an existing HTML, preserve the confirmed brief and ask again only when a major parameter changes.
3. Run the `Topology Taste Audit` in [references/topology-taste-audit.md](references/topology-taste-audit.md) after the brief and before positioning nodes. Declare the design read and use the enterprise preset unless the user requests otherwise: `DESIGN_VARIANCE 3`, `MOTION_INTENSITY 1`, `VISUAL_DENSITY 5`. Apply only the audit rules that improve a professional topology. Do not import landing-page patterns, photos, glassmorphism, decorative gradients, or marketing motion.
4. Build a Topology Model using [references/topology-model.md](references/topology-model.md). Keep existing IDs unchanged when modifying an existing diagram. Default to `canvas.layout: "enterprise"`, ordered groups, and optional device `rank` values; use `manual` only to preserve explicit node positions. Use edge `role` values such as `primary`, `redundant`, `heartbeat`, or `management` when they clarify HA and operational paths.
5. Use the Azure-inspired enterprise visual baseline: neutral built-in device types, thin mono-line icons, restrained blue emphasis, and generous grouped zones. Do not download or bundle vendor logos. Prefer `straight` links between aligned peers, use `orthogonal` only when a bend is necessary, reserve `curved` for explicit user preference or unavoidable parallel paths, and use `wireless` for radio links. Do not use animated paths.
6. For editable output, keep viewer mode as the default. Enable editing only through the `Edit` toolbar action. Use 24px snapping, keep node/group/edge IDs stable, and save edits into `canvas.layout: "manual"`, node/group coordinates, `edges[].waypoints`, `edges[].label_offset`, `edges[].source_anchor`, and `edges[].target_anchor`.
   On first entry to edit mode, materialize the SVG-rendered enterprise group bounds into `groups[].x/y/width/height` and remove transient `_layout_box` data; do not mutate an untouched viewer model.
   In edit mode, render transparent interaction targets above the route geometry: use an approximately 18px stroke hit area for edges and a small radius expansion for node hit circles. Keep these targets visually transparent, show a `pointer` cursor and restrained blue/thicker hover state for edges, and show a `move` cursor for nodes. The hit targets must follow every node and route update so selection and dragging remain aligned at any zoom or pan level. Selected edge endpoints expose eight evenly spaced anchor sockets at 45-degree intervals; clicks choose a socket immediately and drags snap to the nearest socket.
7. Render the file:

```powershell
python "<path-to-render-network-topology>/scripts/render_topology.py" model.json --output outputs/network-topology.html
```

Resolve `<path-to-render-network-topology>` to this skill's installed folder. The renderer has no third-party Python dependencies and locates its bundled SVG asset relative to the script, so the skill folder can be copied to another compatible agent unchanged.

8. Open the result in a browser when available. Run the delivery checks in the Taste Audit: all labels are readable, zones have balanced proportions, nodes and labels use standard baselines, HA paths are distinguishable, links do not unnecessarily cross devices, the canvas is not blank, the light/dark toggle works, the Edit action can be entered and exited without accidental panning, updated HTML/JSON exports preserve the model, and the finished file makes no network requests. Refine coordinates or group bounds and render again.

## Visual Rules

- Keep the presentation flat, restrained, and professional. Use the built-in light or dark theme; do not add gradients, decorative backgrounds, or animated paths.
- In enterprise layout, keep zones on a left-to-right hierarchy with 24px-grid alignment. Use proportional zone boundaries and at least 48px of breathing room between devices and zone borders; expand zones rather than compressing cards, labels, or links. Keep a clear visual reading order from ingress through security, network, service, and data/storage layers.
- Use the built-in circular icon frame as the default device treatment. Use the renderer's standardized regular and compact internal icon/label coordinates without per-node offsets. Keep labels inside the circle, slightly above its lower edge, and use two lines for long labels without truncating continuous text. Use `compact: true` only for repeated endpoints or folded sections, and shorten dense labels to clear English abbreviations where appropriate.
- Prefer axis-aligned routes. Reposition nodes and zones to make primary links directly horizontal or vertical; use one orthogonal bend only when a route genuinely changes row or column. Do not use diagonal links.
- Use `highlight` for focus, `warning`, `alert` or `failure` for issues, and `standby` for secondary or redundant components. The renderer uses only static width, color, and dash changes. Treat legacy `flow` values as inert compatibility data.
- Use one restrained primary accent across the diagram. Reserve amber for WAN or warnings, red for failure, and cold gray dashes for standby or redundant paths. Do not use color merely as decoration.
- Align HA peers on a shared row or column. Keep heartbeat links short and visually secondary. Route primary and redundant paths in separate parallel lanes or with distinct static line patterns so crossings never carry the HA meaning by themselves.
- Use `wireless` links for Wi-Fi or radio connections. They render as a static dotted arc and a source-side wave marker, never as a solid link.
- Preserve the embedded `#topology-model` JSON in all generated HTML. Modify the model and regenerate rather than editing the rendered SVG by hand.
- Editable files expose only layout-level editing by default: move nodes and groups, adjust orthogonal/curved route waypoints, move edge labels, and click or drag the endpoint sockets to choose one of eight 45-degree connection sides. Structural add/remove operations require a separate confirmed model change.
- Keep the editor dependency-free and offline. Use static line treatments and preserve the embedded `prefers-reduced-motion` behavior for any future non-essential editor transition.
- When a browser cannot write the source file directly, use the generated `HTML` download as the portable save path and `JSON` download for agent-to-agent handoff. Do not claim that a local file was overwritten unless the user explicitly granted a file-system save permission.

## Resources

- `scripts/render_topology.py`: deterministic, dependency-free Topology Model to HTML renderer.
- `assets/device-icons.svg`: built-in neutral network, security, application, storage, cloud, data-center, and endpoint icons; open it directly to browse the visual icon gallery. The renderer reads only its SVG definitions.
- `references/icon-catalog.md`: canonical device type IDs and selection guidance. Read it when choosing a device type beyond the general categories.
- `references/topology-model.md`: model fields, statuses, and a complete example.
- `references/topology-taste-audit.md`: visual-profile preset, spatial rhythm, semantic color, HA lane, and delivery-audit rules.

# Diagram Design Alignment

The project's [v1.0 topology standard](topology-design-standard.md) has priority. Borrow diagram-design's clarity, spacing, and consistent connections while preserving actual network semantics.

- Establish a main reading path; allow each real scope to use an appropriate local direction and composition.
- Remove decorative frames and redundant objects. Keep every displayed node, edge, boundary and note attributable to a fact or explicitly marked concept.
- Preserve meaningful status and category colors, with neutral base connections. Business emphasis is directional and shares an existing base path.
- Keep typography roles consistent with the embedded IBM Plex Sans and Chinese fallback. Use the reviewed type scale and at least 13px for device names.
- Use flat surfaces and quiet explanatory frames. Labels occupy real whitespace and cannot mask away an actual collision.
- Device names stay outside circles; lower-side relocation is for actual six o'clock routing conflicts, not arbitrary decoration.

## Connector preflight

1. Each endpoint attaches to the intended device circumference or a clearly identified overview region boundary.
2. Port order follows target order and the local hierarchy axis. Multiple wires keep distinct visible attachment points.
3. Default rounded orthogonal routes have at most two turns and use 12/8px radius limits. Preserve a specifically selected line or curve. Necessary diagonal paths are allowed.
4. Physical solid, logical dashed, and management dotted paths retain their meaning. Main/standby states have labels and independent path identities, not an assumed dash convention.
5. Ring arcs share a continuous skeleton with circumference clipping and near-equal arc-length members. Give non-ring branches separate inward/outward sectors and preserve ring continuity at crossings.
6. Minimize crossings after satisfying hard constraints; optimize symmetry afterward. A risky crossing uses a consistent short non-connection gap on the non-ring route, without creating a third bend.
7. Use explicit junctions only for true shared connection points. Independent physical fanout remains independent edges.

Retain detail/audience/destination choices and the confirmed facts. No generic node-budget rule overrides the actual graph; compare compact and split views when density requires a decision.

# Topology Taste Audit

Use this after the confirmed Topology Brief and before rendering. It adapts only the relevant discipline from frontend taste review to professional topology diagrams.

## Enterprise Preset

Declare: `Enterprise topology for technical operators and stakeholders, with an orderly Azure-inspired visual language.`

| Dial | Default | Meaning |
| --- | --- | --- |
| `DESIGN_VARIANCE` | 3 | Structured symmetry; only deliberate asymmetry for true hierarchy. |
| `MOTION_INTENSITY` | 1 | Static paths and static status treatment. |
| `VISUAL_DENSITY` | 5 | Detailed enough for operations, with protected whitespace. |

## Audit Rules

- Establish a single reading order: ingress, security, core network, services, data/storage, endpoints. Use an alternate order only when the actual architecture requires it.
- Use the 24px grid. Keep zone title, node center, icon, label, and link-label baselines consistent. Expand a zone before reducing icon, label, or link readability.
- Keep at least 48px from a regular node to a zone boundary. Separate adjacent zones by at least 48px. Use a minimum 64px lane between a primary route and a redundant or HA route.
- Use circles for device frames, restrained square-corner or small-radius zones, and one thin-line icon style. Do not add cards, shadows, glows, gradients, decorative grids, or background textures.
- Use cold neutral surfaces and one restrained Azure-blue accent. Use amber only for WAN/warnings, red only for failure, and gray dashes only for standby or redundancy. Preserve the same semantic hierarchy in light and dark themes.
- Use direct horizontal or vertical primary links first. Use one orthogonal bend only to change row or column. Never introduce diagonal links. Do not route a link through a node or use a crossing to imply HA.
- Place HA peers in aligned pairs. Use `role: "heartbeat"` for a short dashed link between peers. Use `role: "redundant"` plus `status: "standby"` for a secondary route. Keep the primary and redundant routes in distinct lanes.
- Fit labels in one or two standardized lines inside the device circle. Prefer concise technical abbreviations. Do not manually offset an individual icon or label.

## Delivery Check

- Verify the diagram at desktop and narrow-screen viewer widths.
- Check each zone for balanced proportion and visible breathing room.
- Check node/label baselines, icon scale, line weights, and all high-importance labels.
- Check that HA, storage, WAN, warning, and failure semantics are distinguishable without relying on animation.
- Check light and dark themes for contrast and equal visual hierarchy.
- Confirm no external requests, gradients, decorative animation, blank canvas, device overlap, or unnecessary link crossing.

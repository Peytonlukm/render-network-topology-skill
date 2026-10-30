# Topology Taste Audit

Read the approved [v1.0 standard](topology-design-standard.md) for authoritative rules. This checklist replaces the prior left-to-right, circle-internal-label, and standby-dash defaults.

## Before drawing

- Identify the reader's task and a main reading path. Combine local hierarchy, ring, grid, nested, or unconnected layouts as the facts require.
- Establish real sites and administrative/security/network scopes. Use whitespace and headings for ordinary layers; do not create decorative boundary frames.
- Preserve topology facts, known endpoint identity, aggregate members, and uncertainty. Unknown links do not appear as confirmed connections.
- Keep SST categories, deployment modes, operational states, and business colors as separate dimensions.

## Visual and routing checks

- Normal SST circles: 84/64px diameter, 2.4px border. Untagged ink: 61.8%, centered. Tagged ink: 41.5/26px, center y=-14. Bottom pills: 28/26px, inset 5px, measured symbol/text centering.
- Names: outside/below, horizontal, at least 13px, maximum two lines. A unique short display name retains its full name. Six o'clock conflicts move the name to the clear lower side, retaining its obstacle box.
- Main reading direction can differ locally. Allocate distinct ports about each local axis, in target order, using symmetric pairs where possible. Move unlocked devices before inventing circuitous symmetry.
- Neutral physical solid lines, logical dashed lines, management dotted lines. Independent main/standby edges keep individual IDs, styles, labels, endpoints, and failure corridors. Never encode standby merely as dashes.
- Rounded orthogonal paths by default, at most two bends, radii 12/8px. Explicit straight paths stay straight. Necessary diagonals and curves are permitted. No route crosses a device, name, region title, or note box.
- Ordinary parallel spacing 12/8px. Different failure paths use distinct corridors. Explicit junctions imply connection; unmarked crossings do not.
- Business overlays share their base path and preserve a visible neutral foundation and arrow. Default to one selected business; use multi-color bands only for explicit comparison with a legend.
- All ring segments share one skeleton and exact outer-circle attachment, with near-equal arc-length spacing. Ring names stay below unless a documented real conflict requires the confirmed exception. RPL/failure markings preserve the built ring's geometry; business flows must not traverse a failed segment.
- Explanatory text uses quiet 1px/4px note frames. Line labels stay beside their longest clear attributable segment, not over a stroke.

## Delivery

Inspect actual HTML, SVG, and PNG in light/dark themes, at source and reduced size, plus a 390px viewer. Check glyph/tag fit, fonts and OFL embedding, title/description metadata, token minima, semantics/legends, aggregate mappings, collisions, bends, crossings and ring continuity. Text and essential graphics use 4.5:1 / 3:1 contrast references on real backgrounds. Offline output makes no network requests.

A fixed visual specimen is not proof of general automatic layout. Unresolved hard constraints require an explicit repair draft and object-specific conflict list. For dense diagrams, compare overview/detail and a compact single page with the user; compact circles/names do not fall below 64/13px.

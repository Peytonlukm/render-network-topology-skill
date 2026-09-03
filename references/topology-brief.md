# Topology Brief

Present this compact brief after inspecting the supplied description and assets, before generating a new topology or performing a structural re-draw. Fill in each field with either **Confirmed** (explicitly supplied) or **Recommended** (inferred). Ask the user to confirm or revise the brief. Do not produce the final HTML until confirmation.

```markdown
## Topology Brief

- Scope and hierarchy: [groups, devices, primary paths]
- Labels: [Chinese / English / abbreviations]
- Theme: [light / dark]
- Canvas: [16:9, custom dimensions, or responsive target]
- Node treatment: [circular built-in icons; standard / compact endpoints]
- Link routing: [straight axis-aligned / orthogonal / curved / wireless]
- Emphasis: [normal / highlight / warning / failure / standby paths]
- Visual direction: [restrained Azure-inspired enterprise style, or user direction]
- Visual profile: [design variance / motion intensity / visual density; enterprise default is 3 / 1 / 5]
- Design dials: [detail: faithful / balanced / simplified; audience: engineer / mixed / executive; destination: viewer / doc-wide / slide-16x9 / print]
- Interaction: [viewer only / editable layout with node, group, route, and label handles]

Please confirm these choices, or list the changes before I render the HTML.
```

Recommend the following baseline when no preference is supplied:

| Parameter | Recommended value |
| --- | --- |
| Theme | Light |
| Canvas | 16:9 with responsive viewer |
| Zones | 24px grid, generous breathing room, balanced boundaries |
| Nodes | Circular thin-line icons, standardized internal icon and label positions |
| Labels | English technology typeface when appropriate; short labels; wrap long labels in the circle |
| Links | Direct horizontal or vertical straight lines first; one orthogonal bend only when needed |
| Wireless | Static dotted arc with a wave marker; never a solid line |
| Effects | Static color, width, and dash changes only; no animation or decorative gradients |
| Visual profile | Enterprise order: variance 3, motion 1, density 5 |
| Design dials | Faithful detail, mixed audience, viewer destination |
| Interaction | Editable layout enabled by default; viewer mode remains the initial state |

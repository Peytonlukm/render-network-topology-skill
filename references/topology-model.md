# Topology Model

Use JSON with `title`, `canvas`, `groups`, `nodes`, and `edges`. The renderer accepts unknown optional fields and keeps them in the embedded model.

## Core Fields

| Field | Required | Purpose |
| --- | --- | --- |
| `title` | no | Diagram title and export filename base. |
| `canvas.width`, `canvas.height` | no | Logical drawing area; default is 1440 x 900. |
| `canvas.theme` | no | Initial `light` or `dark` theme. The HTML toolbar can switch it. |
| `canvas.layout` | no | `enterprise` is the default: arrange ordered zones left to right with generous spacing. Use `manual` only to preserve explicit node positions. |
| `canvas.direction`, `canvas.grid` | no | Enterprise direction is `lr`; grid defaults to 24. |
| `canvas.edge_style` | no | Optional global `straight`, `orthogonal`, `curved`, or `wireless` override for all links. |
| `canvas.visual_profile` | no | Optional confirmed visual direction such as `enterprise-orderly`; preserved in the embedded model for future redraws. |
| `canvas.editable`, `canvas.snap` | no | Enable the embedded first-stage editor and define its grid size. Defaults to editable output with the model grid. |
| `groups[]` | no | Named visual areas; use `id`, `label`, optional `order`, and manual-only `x`, `y`, `width`, `height`, `padding`. Enterprise rendering may resolve temporary bounds internally; an editable export materializes them as manual coordinates. |
| `nodes[]` | yes | Devices with stable `id`, `label`, `type`, optional `group`, `rank`, `order`, `status`, `compact`, `locked`, `vendor`, and manual-only `x`, `y`. `compact: true` uses a smaller circular icon and label for dense sections. |
| `edges[]` | yes | Links with stable `id`, `source`, `target`, optional `label`, `style`, `direction`, `status`, `role`, `locked`, `waypoints`, `label_offset`, `source_anchor`, and `target_anchor`. `waypoints` preserve editable orthogonal/curved routes; anchors are `top`, `right`, `bottom`, or `left` connection sides. `flow` is retained but renders statically. |

Use canonical device type IDs from [icon-catalog.md](icon-catalog.md). Keep the legacy generic types such as `switch`, `firewall`, `wireless`, `server`, `storage`, and `endpoint` when the role is not known.

Use statuses: `normal`, `highlight`, `warning`, `alert`, `failure`, or `standby`. Use link styles: `straight`, `orthogonal`, `curved`, or `wireless`. A link touching a wireless device defaults to `wireless` unless an explicit style is supplied; this produces a static dotted arc with a wireless-wave marker.

## Example

```json
{
  "title": "总部与云端网络拓扑",
  "canvas": { "width": 1440, "height": 900, "theme": "light", "layout": "enterprise", "direction": "lr", "grid": 24, "snap": 24, "editable": true, "visual_profile": "enterprise-orderly" },
  "groups": [
    { "id": "internet", "label": "公网与云服务", "order": 0 },
    { "id": "hq", "label": "总部数据中心", "order": 1 },
    { "id": "users", "label": "办公终端", "order": 2 }
  ],
  "nodes": [
    { "id": "wan", "label": "Internet", "type": "internet", "group": "internet", "rank": 0 },
    { "id": "fw", "label": "边界防火墙", "type": "firewall", "group": "hq", "rank": 1, "status": "highlight" },
    { "id": "core", "label": "核心交换机", "type": "switch", "group": "hq", "rank": 2 },
    { "id": "app", "label": "应用服务器", "type": "server", "group": "hq", "rank": 3 },
    { "id": "db", "label": "数据库", "type": "database", "group": "hq", "rank": 3, "status": "standby" },
    { "id": "pc", "label": "办公终端", "type": "pc", "group": "users", "rank": 4 }
  ],
  "edges": [
    { "id": "wan-fw", "source": "wan", "target": "fw", "label": "ISP", "style": "straight", "direction": true, "status": "highlight" },
    { "id": "fw-core", "source": "fw", "target": "core", "style": "orthogonal" },
    { "id": "core-app", "source": "core", "target": "app", "label": "HTTPS", "style": "curved" },
    { "id": "core-db", "source": "core", "target": "db", "label": "SQL", "style": "orthogonal", "status": "standby", "role": "redundant" },
    { "id": "core-pc", "source": "core", "target": "pc", "style": "straight" }
  ]
}
```

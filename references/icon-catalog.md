# Icons and palettes

Use the most specific role supported by the supplied facts. The bundled symbols are a generic visual family, not vendor product logos. No role implies a particular manufacturer.

## Detailed family

`assets/icon-system.json` maps 12 roles to semantic categories: `router`, `core-switch`, `firewall`, `zero-trust-gateway`, `server`, `virtual-machine`, `virtual-switch`, `storage`, `cloud`, `rack`, `ups`, `laptop`. The matching symbols are in `topology-icons.svg`. Other roles use the bundled outline family in `device-icons.svg`; do not invent a product identity to select an icon.

Ordinary circles are 84px in diameter, compact circles 64px, with 2.4px borders. Untagged visible ink is about 61.8% of diameter. A lower deployment pill reserves a separate slot: glyph ink is 41.5px / compact 26px, y=-14; pill inset 5px, height 28px / compact 26px. `tag-metrics.json` contains measured symbol and font bounds.

Deployment modes `ha`, `stack`, `cluster`, `mlag` are independent of runtime status. A tag does not invent peer devices or links. Names stay outside the circle below, with a deliberate offset where needed. Embed unmodified IBM Plex Sans and preserve the bundled OFL notice; use a local Chinese fallback.

## Six palettes

`assets/icon-palettes.json` is the single source for both renderers. Each palette has light and dark ink, accent, muted, disc and border values.

| ID | Name | Use |
| --- | --- | --- |
| `ocean` | 海洋蓝 | Default clear blue family |
| `forest` | 青绿 | Green and teal family |
| `violet` | 紫罗兰 | Purple family |
| `copper` | 暖铜 | Warm brown and copper family |
| `graphite` | 石墨灰 | Restrained neutral family |
| `categories` | 分类多彩 | Different accents for role categories |

V2: set `scene.icon_palette`; optionally set `node.icon_palette`. Missing node values inherit the scene default. A node override inside a materialized view belongs to that view. The whole-scene default is shared across views. An explicit `node.accent` remains an intentional custom accent; the rest of that icon still follows its palette. Do not recolor links, status markers or business semantics when switching icon palettes.

Legacy Python: set `canvas.icon_set` to `detailed` or `neutral`, and `canvas.icon_palette` to a palette ID. Palette selection is global. Older unrecognized detailed-family names normalize to `detailed`; use canonical names in newly saved models.

A new palette must provide both themes. Verify meaningful ink and accent against the actual disc, deployment text against its pill, and label contrast against the page. Muted fills are secondary detail and must not be the only cue for identity or status.

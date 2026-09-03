# Diagram Design Alignment

`render-network-topology` borrows the most useful editorial disciplines from
the `diagram-design` skill while keeping network topology semantics primary.
This reference is read together with `topology-taste-audit.md` before a new
diagram is rendered.

## What is adopted

- **One reading order.** Arrange ingress, security, core, services,
  data/storage, and endpoints on a consistent left-to-right or top-to-bottom
  axis. Use deliberate hierarchy instead of automatic-looking symmetry.
- **Delete before decorating.** Keep every node and edge only when it carries
  a network fact. Collapse repeated leaf endpoints when the requested detail
  level permits it, and split very dense topologies into an overview plus
  zone-level detail diagrams.
- **Focal signal.** Reserve the blue highlight treatment for one or two focal
  devices or paths. Operational statuses still use amber, red, and standby
  gray when they convey a real warning, failure, or redundancy state.
- **Editorial spacing.** Use a fixed grid, protected outer margins, generous
  zone padding, and a stable node/icon/label baseline. Expand a region before
  shrinking labels or icons.
- **Quiet surfaces.** Use a clean paper-like canvas, hairline boundaries,
  small-radius zones, one thin-line icon family, and no gradients, shadows,
  decorative grids, or animated paths.
- **Semantic typography.** Device names use the sans technical display stack;
  zone and link annotations use a compact mono stack. Mono is reserved for
  protocols, labels, and other technical metadata rather than all text.
- **Accessible SVG.** Every output contains a non-empty `<title>` and `<desc>`
  referenced by `aria-labelledby`, so the visual has a useful text fallback.

## Network-specific adaptations

- The three-zone limit from general architecture diagrams is not enforced.
  Network diagrams may use four to six trust or operational zones when each
  zone has a distinct boundary and the spacing remains breathable.
- Status colors are semantic, not editorial decoration. A topology can have
  several warnings or standby links when that is true of the infrastructure;
  the one-to-two focal rule applies to optional `highlight` emphasis.
- A faithful topology may exceed the general architecture node budget when
  the user explicitly asks for every device. Above 24 nodes, prefer an
  overview/detail pair, or record the deliberate exception in the brief.
- Wireless links remain a dotted arc with a radio marker. They do not inherit
  the rounded orthogonal route grammar used by wired links.

## Connector preflight

Before delivery, verify the following for every wired route:

1. Horizontal or vertical links stay straight; off-axis routes use rounded
   right-angle bends with no diagonal shortcuts.
2. A link label sits on an opaque mask with visible breathing room from the
   stroke, and labels do not overlap nodes or other labels.
3. Parallel primary, redundant, and heartbeat paths occupy separate lanes;
   crossings do not carry HA meaning by themselves.
4. Multiple links entering one node fan out to distinct anchor sockets when
   practical. Use the eight 45-degree editable sockets for manual refinement.
5. A crossing that cannot be removed is bridged on the less important route;
   never stack two strokes on the same path.

## Four brief dials

Record these in the confirmed Topology Brief when they materially affect the
result:

| Dial | Values | Default |
| --- | --- | --- |
| Visual profile | `enterprise-orderly`, `enterprise-orderly-plus`, `editorial-quiet`, `compact-ops` | `enterprise-orderly-plus` |
| Detail | `faithful`, `balanced`, `simplified` | `faithful` for topology |
| Audience | `engineer`, `mixed`, `executive` | `mixed` |
| Destination | `viewer`, `doc-wide`, `slide-16x9`, `print` | `viewer` |

These dials guide extraction and layout; they never override explicit device,
connectivity, or theme requirements.

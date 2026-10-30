# Device Icon Catalog

Use the approved SST v4 symbols for covered roles and neutral role icons as fallback; do not substitute vendor logos. Prefer the most specific known role; retain generic legacy types when the source does not establish a role. The approved design standard takes precedence over older examples.

| Category | Canonical types |
| --- | --- |
| Network | `internet`, `router`, `switch`, `core-switch`, `distribution-switch`, `access-switch`, `fiber`, `ont`, `cellular-gateway`, `wireless`, `wireless-controller`, `wireless-ap`, `sd-wan`, `branch-site` |
| Security and delivery | `firewall`, `waf`, `ids-ips`, `ddos-protection`, `load-balancer`, `api-gateway`, `proxy`, `vpn-gateway`, `secure-web-gateway`, `zero-trust-gateway` |
| Compute and platforms | `server`, `web-server`, `app-server`, `virtual-machine`, `container`, `kubernetes`, `database`, `cache`, `message-queue`, `search`, `dns`, `dhcp`, `directory-service`, `bastion-host`, `monitoring`, `siem`, `backup`, `disaster-recovery` |
| Storage | `storage`, `nas`, `san`, `object-storage`, `tape-library` |
| Cloud and facilities | `cloud`, `cloud-region`, `availability-zone`, `vpc`, `subnet`, `cloud-gateway`, `data-center`, `rack`, `ups` |
| Endpoints and edge | `pc`, `laptop`, `mobile`, `thin-client`, `printer`, `ip-phone`, `camera`, `iot-device`, `industrial-gateway`, `endpoint` |

## Current SST v4 catalog

Set `canvas.icon_set` to `"sst"` for the SST flat two-tone family. The initial review batch covers `router`, `core-switch`, `firewall`, `zero-trust-gateway`, `server`, `virtual-machine`, `virtual-switch`, `storage`, `cloud`, `rack`, `ups`, and `laptop`. Other device types use the neutral family until the batch is approved and expanded.

`virtual-switch` is a new canonical role at rank 2; neutral mode uses the ordinary switch symbol for compatibility. Its layered SST symbol belongs to the compute/virtualization color family. Existing role names do not change. Do not infer that all 80 planned SST symbols are already implemented.

The shared `assets/sst-icon-system.json` defines the 12 approved categories and four deployment modes (`ha`, `stack`, `cluster`, `mlag`). Node and Python read the same symbol paths. The v4 deployment pill sits inside the lower disc, inset 5px; use the bundled ink metrics and IBM Plex Sans fonts, not approximated text centering. Deployment and runtime status are separate fields and can coexist. A deployment tag does not invent member devices or links.

Use `wireless` / `wireless-ap` for a wireless device role and `cellular-gateway` for a 4G or 5G appliance. Choose connection semantics from the actual link; device type does not change physical links into management dotted lines. Legacy radio-wave effects are compatibility behavior, not the V2 semantic default. Use `compact: true` for repeated endpoint devices, retaining at least 64px circles and 13px names.

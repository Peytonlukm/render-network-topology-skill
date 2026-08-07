# Device Icon Catalog

Use neutral role icons, never vendor logos. Prefer the most specific known role; retain generic legacy types when the source does not establish a role.

| Category | Canonical types |
| --- | --- |
| Network | `internet`, `router`, `switch`, `core-switch`, `distribution-switch`, `access-switch`, `fiber`, `ont`, `cellular-gateway`, `wireless`, `wireless-controller`, `wireless-ap`, `sd-wan`, `branch-site` |
| Security and delivery | `firewall`, `waf`, `ids-ips`, `ddos-protection`, `load-balancer`, `api-gateway`, `proxy`, `vpn-gateway`, `secure-web-gateway`, `zero-trust-gateway` |
| Compute and platforms | `server`, `web-server`, `app-server`, `virtual-machine`, `container`, `kubernetes`, `database`, `cache`, `message-queue`, `search`, `dns`, `dhcp`, `directory-service`, `bastion-host`, `monitoring`, `siem`, `backup`, `disaster-recovery` |
| Storage | `storage`, `nas`, `san`, `object-storage`, `tape-library` |
| Cloud and facilities | `cloud`, `cloud-region`, `availability-zone`, `vpc`, `subnet`, `cloud-gateway`, `data-center`, `rack`, `ups` |
| Endpoints and edge | `pc`, `laptop`, `mobile`, `thin-client`, `printer`, `ip-phone`, `camera`, `iot-device`, `industrial-gateway`, `endpoint` |

Use `wireless` or `wireless-ap` only for a radio link that should render as a static dotted arc with a wave marker. Use `cellular-gateway` for a 4G or 5G appliance and choose its link style explicitly. Use `compact: true` for repeated endpoint devices, not for high-level infrastructure or security nodes.

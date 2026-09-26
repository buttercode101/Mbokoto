# Mbokoto

Mbokoto is the production workspace for the SENTINEL safety platform.

## Product surfaces

- **SENTINEL** — discreet safety triggering and trusted-contact response.
- **TRACE** — early missing-person response, last-known reconstruction and preservation requests.
- **BLACKBOX** — survivor-controlled local incident memory, evidence buffering and controlled export.

## Core principles

- Local-first operation.
- Explicit, pre-authorised sharing.
- No open CCTV access.
- Original evidence remains the source of truth.
- AI does not determine guilt, danger or identity.
- Demonstration data is isolated from real setup.
- Emergency deletion is available on-device.

## Development

```bash
npm install
npm run dev
```

The application serves on port 8080.

## Verification

Run:

```bash
npm test
npm run typecheck
npm run lint
```

See `RELEASE-VERIFICATION.md` for the verified release audit.

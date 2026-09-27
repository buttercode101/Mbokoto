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


CI is configured to run typecheck, lint, production build, and a high-severity production dependency audit on every main push and pull request.


The repository build path is independently maintained from the original preview workspace.


## Release boundary

Mbokoto is currently a local-first browser application. The repository contains Vercel deployment configuration, but no public deployment is currently exposed from this repository. A deployment must be verified against the current main commit before this project is represented as publicly released.

The browser stores protocol state locally. Local storage is not a hardware-backed vault; an attacker with browser-profile or JavaScript execution access can bypass application-level controls. The application therefore does not claim device-compromise resistance.

# Mbokoto

Mbokoto is the production workspace for the SENTINEL safety platform.

## Product surfaces

- **SENTINEL** — discreet safety triggering and trusted-contact response.
- **TRACE** — early missing-person response, last-known reconstruction and preservation requests.
- **BLACKBOX** — survivor-controlled local incident memory, evidence buffering and controlled export.

## Implemented protocol core

The current mainline application is a local-first protocol client with three connected surfaces:

- **SENTINEL:** creates a safety event and a persisted delivery envelope; network availability does not by itself mean the alert was delivered. The user can explicitly hand the envelope to the device share mechanism.
- **TRACE:** creates preservation requests and keeps them in `preservation-requested` until a real acknowledgement exists. The app does not claim node acknowledgement merely because a request was created.
- **BLACKBOX:** captures files into an encrypted IndexedDB evidence store, records a content fingerprint and custody entry, and can create a controlled export manifest without transferring original evidence bytes.

The protocol distinguishes local creation, queued state and explicit handoff from recipient acknowledgement. A share-sheet handoff is therefore not represented as verified delivery.

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

Protocol state is encrypted before persistence using a PIN-derived XChaCha20-Poly1305 vault. Local storage is still not a hardware-backed vault: an attacker with active JavaScript execution or control of the browser/device can bypass application-level controls. The four-digit PIN is therefore application-level protection, not device-compromise resistance.

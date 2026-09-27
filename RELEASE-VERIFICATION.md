# SENTINEL Release Verification

## Verified repository controls

- TypeScript strict checking runs in CI.
- ESLint runs in CI.
- Vite production build runs in CI.
- Production Vercel configuration installs dev dependencies required to build the Vite application.
- Security headers are configured at the deployment boundary.
- PIN-derived keys use a unique per-vault salt and PBKDF2-HMAC-SHA-256 with 600,000 iterations.
- Persisted protocol state is authenticated-encrypted with XChaCha20-Poly1305; local storage contains ciphertext and vault metadata, not the plaintext protocol state.
- A real and safe-mode PIN use separate salts and authenticated probes; the safe-mode path never decrypts the real payload.
- Local identifiers use cryptographically strong randomness where the platform provides Web Crypto.
- Evidence fingerprints use SHA-256 rather than the previous non-cryptographic 32-bit hash.
- A hydrated configured device starts locked; sensitive surfaces are not rendered before local state hydration completes.
- A safe-mode PIN enters a neutral decoy surface rather than exposing SENTINEL, TRACE or BLACKBOX state.
- Emergency deletion removes the persisted local store instead of writing a deletion tombstone back into the same store.
- PII inputs disable browser autocomplete where appropriate.
- The product does not claim that a local event was remotely delivered unless a real relay exists.

## Security boundary

SENTINEL is a local-first browser application. Browser local storage is not a hardware-backed secure enclave and must not be treated as protection against malware, browser extensions, or an attacker with active JavaScript access to the page or browser profile. Encryption materially reduces plaintext disclosure from storage inspection, but the four-digit PIN still has a finite 10,000-value search space; this is application-level protection, not device-compromise resistance.

The current browser implementation also does not provide a real cellular relay, wearable integration, mesh network, CCTV integration, or trusted-contact network service. Those paths remain explicitly local/demo behavior until an actual transport and service boundary exists.

## Emergency deletion

Emergency deletion removes the application persistence key and clears in-memory protocol state. Browser caches, screenshots, backups, OS-level storage, browser history, and data copied outside the application are outside the browser's deletion authority.

## South African emergency references

The UI's emergency-resource references are informational and should be verified against current official sources before a production release in a particular jurisdiction.

## Release gate

A public deployment is not considered verified solely because the repository CI is green. The deployed URL must be checked against the current main commit, at mobile/tablet/desktop widths, including lock/unlock, demo isolation, emergency deletion, and unknown-route recovery.

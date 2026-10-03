# giftmarshal-web

Gift Marshal Pots: all-or-nothing group gifts on PayPal (sandbox), and the first slice of the Gift Marshal web app. Built for the PayPal AI Hackathon (Devpost, closes 2026-11-12).

**Two promises, both easy to break silently:**
1. **No duplicate gifts.** Claiming is atomic (`claimLocks/{wishlistId}_{itemId}` read with `transaction.get`).
2. **The surprise holds.** The recipient (a pot's `hiddenFromUid`) never learns that a pot exists, or who gave what, until the reveal.

## Layout
| Path | What |
|---|---|
| `web/` | Next.js (App Router) on Firebase App Hosting |
| `firebase/functions/` | functions codebase **`web`**: everything new. This is what eventually deploys to production |
| `firebase/core-port/` | functions codebase **`core-port`**: ports of `onEventCreated` and `onClaimWritten`. **Emulators only, never deployed.** Production runs the originals under the same names |
| `firebase/firestore.rules` | The security model as tested on the emulators. Ported blocks are marked; `CHANGED` blocks say why. **Never deployed from here**: production's rules include these blocks and are deployed from the production backend repo |
| `firebase/firebase.json` | The **deployable** config: functions codebase `web` only. `firebase deploy --project prod --only functions:web` |
| `firebase/firebase.emulators.json` | The **emulator** config: rules plus both codebases. The test suites use it via `--config`. Any deploy with it is refused by `refuse-deploy.mjs` |
| `firebase/rules-tests/`, `firebase/integration-tests/` | Emulator suites |
| `spikes/paypal/` | Throwaway PayPal sandbox spikes and `FINDINGS.md`. Nothing imports them |

## Firestore rules: three lessons from production
1. A `list` is not filtered document by document. The query's own constraints must imply the rule.
2. Reading an absent key is an evaluation error, not `false`. Guard single-document reads with `resource.data.keys().hasAll([...])`.
3. In a `list` rule you cannot `get()`/`exists()` a path built from document data. Paths from `match` wildcards are fine.

Run `cd firebase/rules-tests && npm test` before every rules deploy.

## Conventions
- Import `FieldValue`, `Timestamp` and `FieldPath` from `firebase-admin/firestore`, never `admin.firestore.*`.
- Money is integer **cents** in **USD**. No floats in business logic.
- All writes go through Cloud Functions callables. No business logic in Next.js server actions or route handlers.
- Next.js: app screens are client components with Firestore listeners. Server rendering is only for share and landing pages. The Admin SDK is server-only, and share pages expose generic fields only (never the gift).
- Every PayPal call carries a deterministic `PayPal-Request-Id`.
- AI calls run only in Cloud Functions. Every output is schema-validated and has a fallback.
- No third-party trademarks in UI, demo data, images or video (Devpost rule).
- TypeScript 7 no longer loads `@types/node` by default, so every Node tsconfig sets `"types": ["node"]`.
- Design docs live in a private repo. Don't add documents here that describe unpatched production issues.

## Running things
```bash
cd firebase/core-port && npm test            # unit tests, core-port codebase
cd firebase/functions && npm test            # unit tests, web codebase
cd firebase/rules-tests && npm test          # security rules (starts the Firestore emulator)
cd firebase/integration-tests && npm test    # triggers + callables against the emulator suite
cd web && npm test && npm run build          # web unit tests and production build
```
The emulator suites each start their own emulators. Stop any long-running `firebase emulators:start` first.

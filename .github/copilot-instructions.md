# hook-transpiler Copilot Instructions

## Project Overview
Rust WASM transpiler for JSX/TSX → compatible module format for Relay hooks.
Handles React JSX, TypeScript, dynamic/static imports, and special module rewriting.

## Architecture

### Key Components
1. **Import Rewriting** - Converts static imports to global references, dynamic imports to `__hook_import()`
2. **JSX Transformation** - React auto-transform with JSX runtime handling
3. **Module Conversion** - Optional CommonJS output for older environments
4. **WASM Bindings** - Feature-gated WASM API exposed via `transpile_jsx()`

### Build System
- Cargo crate: `name = "relay-hook-transpiler"` (CRITICAL - not "hook-transpiler")
- Features: `wasm` (required for browser use)
- Build script: `build-and-deploy.sh` chains wasm-pack → copy to relay-clients

## Implementation Details

### Import Rewriting (`StaticImportRewriter`)
Maps special modules to globalThis:
```
'react' → globalThis.__hook_react
'react/jsx-runtime' → globalThis.__hook_jsx_runtime
'@clevertree/file-renderer' → globalThis.__hook_file_renderer
'@clevertree/helpers' → globalThis.__hook_helpers
'@clevertree/meta' → globalThis.__relay_meta
```

All other imports pass through unchanged.

### Dynamic Import Rewriting (`ImportRewriter`)
Converts:
```javascript
await import('./module.jsx')  →  await __hook_import('./module.jsx')
```

### Process Order (CRITICAL)
1. Parse source
2. Resolve TypeScript/JSX scope
3. Strip TypeScript (if .ts/.tsx)
4. Apply React transform (if JSX detected)
5. **Rewrite static imports** (AFTER React transform to catch jsx-runtime)
6. Rewrite dynamic imports
7. Apply CommonJS conversion (if requested)
8. Post-process regex fixes for edge cases

## Testing
Tests in `src/lib.rs`:
- `rewrites_static_special_imports()` - Verifies global rewriting
- `rewrites_dynamic_import()` - Checks `__hook_import` conversion
- `transpiles_to_commonjs_exports()` - CommonJS output format
- Fixture tests - Real hook files if present

Run: `cargo test`

## WASM Build Gotchas

**WRONG:** `wasm-pack build --release` (produces 365-byte stub)
**RIGHT:** `wasm-pack build --release --features wasm` (produces 4.4+ MB)

### Build Output
Expected files in `pkg/`:
- `relay_hook_transpiler.js` - Bundled loader
- `relay_hook_transpiler_bg.wasm` - Binary
- `relay_hook_transpiler_bg.wasm.d.ts` - Type definitions
- `relay_hook_transpiler.d.ts` - TypeScript interface

### Deploy
After build, copy to relay-clients:
```bash
cp pkg/*.{js,wasm,wasm.d.ts,d.ts,json} \
  /home/ari/dev/relay-clients/packages/web/src/wasm/
```

## TranspileOptions API
```rust
pub struct TranspileOptions {
    pub filename: Option<String>,      // E.g. "hook.jsx"
    pub react_dev: bool,               // Enable React dev runtime
    pub to_commonjs: bool,             // Output CommonJS instead of ESM
    pub pragma: Option<String>,        // Custom JSX pragma (rarely used)
    pub pragma_frag: Option<String>,   // Custom fragment pragma
}
```

## Common Errors

### "0 && module.exports = ..." in CommonJS output
Expected behavior. Post-process regex wraps in parens:
```
0 && module.exports = X  →  0 && (module.exports = X)
```

### Import not rewritten to global
1. Check spelling matches exactly (case-sensitive)
2. Verify it's in the hardcoded list in `StaticImportRewriter`
3. Confirm React transform ran before rewrite (order matters!)

### JSX not transformed
Check `filename` ends in `.jsx`/`.tsx` or source contains `<` character

## Development Workflow

### After Changes
1. Update tests if logic changed
2. Run `cargo test` to validate
3. If modifying WASM: `bash build-and-deploy.sh`
4. Test in relay-clients/web: `npm run dev`

### Key Files
- `src/lib.rs` - Main implementation
- `Cargo.toml` - Dependencies (serde, swc_core, wasm_bindgen)
- `build-and-deploy.sh` - Build & deploy script

## Build & Test Playbook (per repo)

### hook-transpiler (this repo)
- Rebuild WASM first: `bash build-and-deploy.sh` (uses `wasm-pack build --release --target web --features wasm`; copies outputs into relay-clients).
- Rust unit tests: `cargo test`.
- JS self-check: `npm test` (runs `npm run build` → `node --test dist/selfCheck.test.js`).
- Web e2e (Cypress):
  1) `cd tests/web && npm install` (once).
  2) `npm run build` to refresh bundle.
  3) Start dev server `npm run start` in **one terminal and leave it running**.
  4) In another terminal run `npm run test:e2e` or `npm run cypress:open`.
  5) Do **not** stop the dev server between steps 3 and 4; Cypress needs it alive.

### themed-styler
- Rebuild WASM before any client build: `cd /home/ari/dev/themed-styler && npm install && npm run build` (calls `wasm-pack build --release --target web --features wasm` and populates `wasm/`).
- Publish prep: `npm run build` already covers `build:wasm`; use `npm run build` prior to `npm publish` or local `npm pack`.

### relay-client-web
- Prereqs: rebuild native deps first (`npm --prefix /home/ari/dev/hook-transpiler run build` and `npm --prefix /home/ari/dev/themed-styler run build`) so local packages have fresh dist/wasm.
- Install deps: `npm install` in `/home/ari/dev/relay-client-web`.
- Dev server: `npm run dev` (esbuild serve).
- Build: `npm run build`.
- Unit tests: `npm test` (Node test runner over `src/tests/**/*.test.ts`).
- Serve built assets with relay-server: `npm run serve:relay` (runs build then serves via compiled relay-server binary on 8080).

### relay (monorepo root)
- Repo root: `/home/ari/dev/relay`.
- Web dev: `npm run web:dev` or `npm run web:dev:full` (full script).
- Web build: `npm run web:build` (or `web:build:debug`).
- Server dev: `npm run dev:server` (cargo run). Release server build: `npm run build:server`.
- Tests: `npm test` (workspace `cargo test`). Playwright e2e: `npm run test:e2e` (ensure server + static assets built if scenario requires).

### relay-client-android
- Before Gradle: refresh transpiler/native bits: `npm --prefix /home/ari/dev/hook-transpiler run build` and ensure JNI/JSI sources are up to date; Gradle will compile native libs.
- Build debug APK: `cd /home/ari/dev/relay-client-android/android && ./gradlew clean assembleDebug`.
- Install to device/emulator: `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- Logs: `adb logcat | grep -E "HermesManager|NativeRenderer|RelayJSI"`.


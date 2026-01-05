# act Copilot Instructions

## Project Overview
Minimal React-like runtime for Android and Web/DOM environments.
Core logic is platform-agnostic, with specialized renderers for different environments.

## Architecture

### Key Components
1. **Core Hooks Engine** - Implementation of `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useReducer`, `useContext`.
2. **Virtual DOM & Reconciler** - Platform-agnostic diffing and update logic.
3. **DOM Renderer (`act/dom`)** - Web-specific renderer using standard DOM APIs.
4. **Android Renderer (`act/android`)** - Native-specific renderer using the `jscbridge` to communicate with Android views.

## Implementation Details

### Platform Entry Points
- `src/index.dom.js` - Entry point for Web/DOM.
- `src/index.android.js` - Entry point for Android Native.

### Component Parity
Provides `Android/iOS Native` component parity (aliased to `act/android`) to allow sharing code between Web and Native.

## Build & Test

### Build
```bash
npm run build
```

### Test
```bash
npm test
```
Runs tests for both DOM and Android environments using Node.js built-in test runner.

## Development Workflow

### Adding a New Hook
1. Implement hook logic in `src/core.js`.
2. Ensure it follows the rules of hooks (stable call order).
3. Add tests in `tests/` to verify behavior in both environments.

### Modifying Renderers
- DOM changes: `src/renderer-dom.js`
- Android changes: `src/renderer-android.js`

## Key Files
- `src/core.js` - Main hooks and reconciliation logic.
- `src/renderer-dom.js` - DOM-specific rendering implementation.
- `src/renderer-android.js` - Android-specific rendering implementation.
- `index.d.ts` - Core type definitions.
- `dom.d.ts` - DOM-specific type definitions.

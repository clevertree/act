# @clevertree/act

Minimal React-like runtime for Android and Web/DOM environments.

## Features

- **Hooks**: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useReducer`, `useContext`.
- **Platform Agnostic**: Core logic is separated from rendering.
- **Lightweight**: Zero dependencies.
- **Multi-platform**: Built-in renderers for Android (via bridge) and Web (via DOM).
- **Parity**: Supports basic `ReactDOM` and `Android/iOS Native` APIs.

## Exports

- **act/dom**: Web/DOM renderer and helpers.
- **act/android**: Android renderer and Android/iOS Native parity layer.

This package is ESM-only and targets modern environments.

## Installation

```bash
npm install @clevertree/act
```

Requires Node.js >= 18 for the built-in test runner and ESM support.

## Usage

### Web Environment (act/dom)

```javascript
import { createRoot } from '@clevertree/act/dom';

const root = createRoot(document.getElementById('root'));

function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="container">
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

root.render(<App />);
```

### Android Environment (act/android)

In an Android environment using QuickJS and a bridge, `@clevertree/act/android` automatically initializes and registers itself to `globalThis.Act` and `globalThis.React`. It also provides `Android/iOS Native` component parity (supporting transitions to Android/iOS Native).

```javascript
import { View, Text, StyleSheet } from 'android-ios-native'; // Aliased to act/android or Android/iOS Native parity

const styles = StyleSheet.create({
  container: { padding: 20 }
});

function App() {
  const [text, setText] = useState('Hello');
  return (
    <View style={styles.container} onClick={() => setText('Clicked!')}>
      <Text text={text} />
    </View>
  );
}

Act.render(App);
```

## Try Locally

Build and run tests:

```bash
npm run build
npm test
```

Pack a tarball to verify publish contents:

```bash
npm pack
```

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

## License

MIT

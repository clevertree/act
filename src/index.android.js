import { createAct } from './core.js';
import { createAndroidRenderer } from './renderer-android.js';

const renderer = createAndroidRenderer();
const Act = createAct(renderer);

// Android/iOS Native-like components
export const View = (props) => Act.createElement('view', props);
export const Text = (props) => Act.createElement('text', props);
export const Image = (props) => Act.createElement('image', props);
export const ScrollView = (props) => Act.createElement('scroll', props);
export const StyleSheet = Act.StyleSheet;

export const AppRegistry = {
    registerComponent: (name, factory) => {
        const Component = factory();
        Act.render(Component);
    }
};

// Auto-register to globalThis for compatibility with existing Android usage
const g = typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : this);
if (g) {
    g.Act = Act;
    g.React = Act;
    
    // Android/iOS Native parity
    g.ReactNative = {
        View,
        Text,
        Image,
        ScrollView,
        StyleSheet,
        AppRegistry
    };

    // Provide default JSX runtime
    g.__hook_jsx_runtime = {
        jsx: Act.createElement,
        jsxs: Act.createElement,
        Fragment: Act.Fragment
    };
    
    // Also provide them directly for transpiled code that might look for them
    g.__jsx = Act.createElement;
    g.__jsxs = Act.createElement;
    g.__Fragment = Act.Fragment;
}

export default Act;
export { Act };

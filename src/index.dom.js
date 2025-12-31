import { createAct } from './core.js';
import { createDomRenderer } from './renderer-dom.js';

export function createDomAct(container) {
    const renderer = createDomRenderer(container);
    return createAct(renderer);
}

export function createRoot(container) {
    const act = createDomAct(container);
    return {
        render: (element) => act.render(() => element),
        unmount: () => act.unmount()
    };
}

export function render(element, container) {
    const root = createRoot(container);
    root.render(element);
    return root;
}

// Create a React-compatible API surface using a default renderer
const defaultRenderer = createDomRenderer(null);
const defaultAct = createAct(defaultRenderer);

// Export all hooks and utilities as named exports for React compatibility
export const {
    createElement,
    useState,
    useEffect,
    useLayoutEffect,
    useRef,
    useMemo,
    useCallback,
    useReducer,
    createContext,
    useContext,
    Fragment,
    Suspense,
    lazy,
    memo,
    forwardRef
} = defaultAct;

const Act = {
    render,
    createRoot,
    createAct: createDomAct,
    createCore: createAct,
    // Include React-compatible exports
    createElement,
    useState,
    useEffect,
    useLayoutEffect,
    useRef,
    useMemo,
    useCallback,
    useReducer,
    createContext,
    useContext,
    Fragment,
    Suspense,
    lazy,
    memo,
    forwardRef
};

export default Act;
export { Act };

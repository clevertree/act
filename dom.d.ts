// Type definitions for @clevertree/act/dom
// Web DOM-specific exports

export interface Act {
    createElement(type: any, props?: any, ...children: any[]): any;
    render(component: any, props?: any): void;
    unmount(): void;
    useState<T>(initialValue: T | (() => T)): [T, (next: T | ((curr: T) => T)) => void];
    useEffect(effect: () => (void | (() => void)), deps?: any[]): void;
    useLayoutEffect(effect: () => (void | (() => void)), deps?: any[]): void;
    useRef<T>(initialValue: T): { current: T };
    useMemo<T>(factory: () => T, deps?: any[]): T;
    useCallback<T extends (...args: any[]) => any>(fn: T, deps?: any[]): T;
    useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S, init?: (arg: S) => S): [S, (action: A) => void];
    createContext<T>(defaultValue: T): { Provider: (props: { value: T; children?: any }) => any; _currentValue: T };
    useContext<T>(context: { _currentValue: T }): T;
    Fragment: any;
    Suspense(props: { fallback?: any; children?: any }): any;
    lazy<T>(loader: () => Promise<{ default: T } | T>): T;
    memo<T>(comp: T): T;
    forwardRef<T>(comp: T): T;
}

export function createDomAct(container: any): Act;
export function createRoot(container: any): { render(element: any): void; unmount(): void };
export function render(element: any, container: any): { render(element: any): void; unmount(): void };

// Named exports for hooks
export const createElement: Act['createElement'];
export const useState: Act['useState'];
export const useEffect: Act['useEffect'];
export const useLayoutEffect: Act['useLayoutEffect'];
export const useRef: Act['useRef'];
export const useMemo: Act['useMemo'];
export const useCallback: Act['useCallback'];
export const useReducer: Act['useReducer'];
export const createContext: Act['createContext'];
export const useContext: Act['useContext'];
export const Fragment: any;
export const Suspense: (props: { fallback?: any; children?: any }) => any;
export const lazy: <T>(loader: () => Promise<{ default: T } | T>) => T;
export const memo: <T>(comp: T) => T;
export const forwardRef: <T>(comp: T) => T;

declare const ActDom: Act;
export default ActDom;
export { ActDom as Act };

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

export function createAct(renderer: any): Act;
export function createAndroidRenderer(): any;
export function createWebRenderer(container: any): any;

export function createWebAct(container: any): Act;

declare const Act: Act;
export default Act;
export { Act as React };

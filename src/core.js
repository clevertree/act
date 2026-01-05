export function createAct(renderer) {
    let tagCounter = 1;
    let rootComponent = null;
    let rootProps = {};
    let renderQueued = false;
    let isRendering = false;
    let componentState = {};
    let hookCursor = {};
    let pendingEffects = [];
    let pendingLayoutEffects = [];
    let currentPath = "root";
    let suspenseStack = [];

    // Fiber-like reconciliation state
    let nextUnitOfWork = null;
    let wipRoot = null;
    let currentRoot = null;
    let deletions = [];

    const SUSPENSE_TYPE = typeof Symbol !== 'undefined' ? Symbol.for('act.suspense') : '__act_suspense__';
    const FRAGMENT_TYPE = typeof Symbol !== 'undefined' ? Symbol.for('act.fragment') : '__act_fragment__';

    function log(level, message) {
        try {
            const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
            const logger = (g.console && g.console[level]) ? g.console[level] : null;
            if (logger) {
                logger(`[act] ${message}`);
            }
            if (level === 'error' && typeof g.__log === 'function') {
                g.__log('error', `[act] ${message}`);
            }
        } catch (e) { }
    }

    function emitError(message) {
        log('error', message);
    }

    function flattenChildren(args) {
        const out = [];
        for (let i = 2; i < args.length; i++) {
            const child = args[i];
            if (Array.isArray(child)) {
                out.push(...child);
            } else if (child !== undefined && child !== null && child !== false) {
                out.push(child);
            }
        }
        return out;
    }

    function createElement(type, props, ...childrenArgs) {
        const children = flattenChildren([type, props, ...childrenArgs]);
        const p = props || {};
        if (children.length > 0) {
            p.children = children.length === 1 ? children[0] : children;
        }
        return { type, props: p, children };
    }

    function resetTags() {
        tagCounter = 1;
    }

    function nextTag() {
        return tagCounter++;
    }

    function makePath(parent, key) {
        return parent ? parent + '.' + key : String(key);
    }

    function resetHookCursor(path) {
        hookCursor[path] = 0;
    }

    function nextHookIndex(path) {
        const idx = hookCursor[path] !== undefined ? hookCursor[path] : 0;
        hookCursor[path] = idx + 1;
        return idx;
    }

    function getHookSlot(path, index) {
        let state = componentState[path];
        if (!state) {
            state = { hooks: [] };
            componentState[path] = state;
        }
        if (!state.hooks[index]) {
            state.hooks[index] = {};
        }
        return state.hooks[index];
    }

    function shallowDepsChanged(prev, next) {
        if (!prev || !next) return true;
        if (prev.length !== next.length) return true;
        for (let i = 0; i < prev.length; i++) {
            if (prev[i] !== next[i]) return true;
        }
        return false;
    }

    function shallowEqual(objA, objB) {
        if (objA === objB) return true;
        if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) return false;
        const keysA = Object.keys(objA);
        const keysB = Object.keys(objB);
        if (keysA.length !== keysB.length) return false;
        for (let i = 0; i < keysA.length; i++) {
            if (!Object.prototype.hasOwnProperty.call(objB, keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
                return false;
            }
        }
        return true;
    }

    function scheduleRender() {
        if (!rootComponent) return;
        if (renderQueued) return;
        renderQueued = true;

        // Use requestAnimationFrame if available, otherwise setTimeout
        const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
        if (typeof g.requestAnimationFrame === 'function') {
            g.requestAnimationFrame(renderNow);
        } else {
            setTimeout(renderNow, 0);
        }
    }

    function workLoop(deadline) {
        let shouldYield = false;
        while (nextUnitOfWork && !shouldYield) {
            nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
            shouldYield = deadline.timeRemaining() < 1;
        }

        if (!nextUnitOfWork && wipRoot) {
            commitRoot();
        }

        if (nextUnitOfWork) {
            const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
            const ric = g.requestIdleCallback || (cb => {
                const start = Date.now();
                return setTimeout(() => {
                    cb({
                        didTimeout: false,
                        timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
                    });
                }, 1);
            });
            ric(workLoop);
        }
    }

    function performUnitOfWork(fiber) {
        try {
            const isFunctionComponent = typeof fiber.type === 'function';
            if (isFunctionComponent) {
                updateFunctionComponent(fiber);
            } else if (fiber.type === SUSPENSE_TYPE) {
                updateSuspenseComponent(fiber);
            } else {
                updateHostComponent(fiber);
            }
        } catch (e) {
            if (e && typeof e.then === 'function') {
                let suspenseFiber = fiber;
                while (suspenseFiber && suspenseFiber.type !== SUSPENSE_TYPE) {
                    suspenseFiber = suspenseFiber.parent;
                }
                if (suspenseFiber && !suspenseFiber.didThrow) {
                    suspenseFiber.didThrow = true;

                    e.then(() => {
                        scheduleRender();
                    }, () => {
                        scheduleRender();
                    });

                    // Return the suspense fiber so the work loop restarts it
                    return suspenseFiber;
                }
            }

            // Error Boundary support
            let boundary = fiber.parent;
            while (boundary) {
                if (boundary.props && typeof boundary.props.componentDidCatch === 'function') {
                    if (!boundary.hasError) {
                        boundary.hasError = true;
                        boundary.error = e;
                        boundary.props.componentDidCatch(e, {
                            componentStack: boundary.path || 'unknown'
                        });
                        // Restart from boundary to render fallback if any
                        return boundary;
                    }
                }
                boundary = boundary.parent;
            }

            throw e;
        }

        if (fiber.child) {
            return fiber.child;
        }
        let nextFiber = fiber;
        while (nextFiber) {
            if (nextFiber.sibling) {
                return nextFiber.sibling;
            }
            nextFiber = nextFiber.parent;
        }
        return null;
    }

    function updateFunctionComponent(fiber) {
        const path = fiber.path || 'root';
        resetHookCursor(path);
        const prevPath = currentPath;
        currentPath = path;

        let children;
        if (fiber.hasError) {
            // If we have an error and a fallback prop, use it
            if (fiber.props && fiber.props.fallback) {
                const fallbackResult = typeof fiber.props.fallback === 'function'
                    ? fiber.props.fallback(fiber.error)
                    : fiber.props.fallback;
                children = Array.isArray(fallbackResult) ? fallbackResult : [fallbackResult];
            } else {
                children = [];
            }
        } else {
            try {
                const result = fiber.type(fiber.props);
                children = Array.isArray(result) ? result : [result];
            } catch (e) {
                currentPath = prevPath; // Restore path before throwing
                if (e && typeof e.then === 'function') {
                    throw e;
                } else {
                    // This will be caught by performUnitOfWork's catch block
                    throw e;
                }
            } finally {
                if (currentPath === path) {
                    currentPath = prevPath;
                }
            }
        }

        reconcileChildren(fiber, children);
    }

    function updateSuspenseComponent(fiber) {
        let children;
        if (fiber.didThrow) {
            const fallback = fiber.props.fallback;
            children = (fallback !== undefined && fallback !== null) ? (Array.isArray(fallback) ? fallback : [fallback]) : [];
            fiber.showingFallback = true;
        } else {
            const rawChildren = fiber.props.children;
            children = (rawChildren !== undefined && rawChildren !== null) ? (Array.isArray(rawChildren) ? rawChildren : [rawChildren]) : [];
            fiber.showingFallback = false;
        }

        const prevPath = currentPath;
        currentPath = makePath(fiber.path, 's');
        reconcileChildren(fiber, children);
        currentPath = prevPath;
    }

    function updateHostComponent(fiber) {
        if (fiber.hasError && fiber.props && fiber.props.fallback) {
            const fallbackResult = typeof fiber.props.fallback === 'function'
                ? fiber.props.fallback(fiber.error)
                : fiber.props.fallback;
            const children = Array.isArray(fallbackResult) ? fallbackResult : [fallbackResult];
            reconcileChildren(fiber, children);
            return;
        }

        if (!fiber.dom && renderer.createInstance && typeof fiber.type === 'string') {
            fiber.dom = renderer.createInstance(fiber.type, fiber.props || {}, {
                nextTag,
                log
            });
        }
        let children = (fiber.props && fiber.props.children !== undefined && fiber.props.children !== null) ? fiber.props.children : [];
        if (!Array.isArray(children)) {
            children = [children];
        }
        // Flatten children to handle arrays from .map()
        const flatChildren = [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (Array.isArray(child)) {
                flatChildren.push(...child);
            } else {
                flatChildren.push(child);
            }
        }
        reconcileChildren(fiber, flatChildren);
    }

    function reconcileChildren(wipFiber, elements) {
        let index = 0;
        let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
        let prevSibling = null;

        // Flatten elements to handle arrays from .map() or nested arrays
        let flatElements = [];
        if (Array.isArray(elements)) {
            for (let i = 0; i < elements.length; i++) {
                const item = elements[i];
                if (Array.isArray(item)) {
                    flatElements.push(...item);
                } else {
                    flatElements.push(item);
                }
            }
        } else if (elements !== undefined && elements !== null && elements !== false) {
            flatElements = [elements];
        }

        while (index < flatElements.length || oldFiber != null) {
            let element = flatElements[index];
            let newFiber = null;

            // Normalize element
            const isText = typeof element === 'string' || typeof element === 'number';
            if (isText) {
                element = {
                    type: "TEXT_ELEMENT",
                    props: {
                        nodeValue: String(element),
                        children: []
                    }
                };
            }

            const sameType = oldFiber && element && element.type == oldFiber.type;

            if (sameType) {
                // Remove from deletions if it was added in this render pass (e.g. by a previous reconciliation of the same fiber that failed)
                for (let d = 0; d < deletions.length; d++) {
                    if (deletions[d] === oldFiber) {
                        deletions.splice(d, 1);
                        break;
                    }
                }
                newFiber = {
                    type: oldFiber.type,
                    props: element.props,
                    dom: oldFiber.dom,
                    parent: wipFiber,
                    alternate: oldFiber,
                    effectTag: "UPDATE",
                    path: makePath(wipFiber.path, index)
                };
            } else {
                if (element) {
                    newFiber = {
                        type: element.type,
                        props: element.props,
                        dom: null,
                        parent: wipFiber,
                        alternate: null,
                        effectTag: "PLACEMENT",
                        path: makePath(wipFiber.path, index)
                    };
                }
                if (oldFiber) {
                    // Avoid double-adding to deletions
                    let alreadyInDeletions = false;
                    for (let d = 0; d < deletions.length; d++) {
                        if (deletions[d] === oldFiber) {
                            alreadyInDeletions = true;
                            break;
                        }
                    }
                    if (!alreadyInDeletions) {
                        oldFiber.effectTag = "DELETION";
                        deletions.push(oldFiber);
                    }
                }
            }

            if (oldFiber) {
                oldFiber = oldFiber.sibling;
            }

            if (index === 0) {
                wipFiber.child = newFiber;
            } else if (newFiber) {
                prevSibling.sibling = newFiber;
            }

            if (newFiber) {
                prevSibling = newFiber;
            }
            index++;
        }
    }

    function commitRoot() {
        deletions.forEach(commitWork);
        commitWork(wipRoot);
        currentRoot = wipRoot;
        wipRoot = null;

        flushLayoutEffects();
        flushEffects();
    }

    function commitWork(fiber) {
        if (!fiber) return;

        let domParentFiber = fiber.parent;
        while (domParentFiber && !domParentFiber.dom) {
            domParentFiber = domParentFiber.parent;
        }
        const domParent = domParentFiber ? domParentFiber.dom : renderer.container;

        if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
            if (renderer.appendChild) {
                renderer.appendChild(domParent, fiber.dom);
            }
        } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
            if (renderer.commitUpdate) {
                renderer.commitUpdate(fiber.dom, fiber.alternate ? fiber.alternate.props : {}, fiber.props);
            }
        } else if (fiber.effectTag === "DELETION") {
            commitDeletion(fiber, domParent);
            return; // Stop recursion for deleted fiber
        }

        commitWork(fiber.child);
        commitWork(fiber.sibling);
    }

    function commitDeletion(fiber, domParent) {
        if (!fiber) return;
        if (fiber.dom) {
            if (renderer.removeChild) {
                try {
                    renderer.removeChild(domParent, fiber.dom);
                } catch (e) {
                    // Only log if it's not a "not a child" error which we expect in some edge cases for now
                    if (e.message.indexOf('not a child') === -1) {
                        log('error', `removeChild failed: ${e.message}`);
                    }
                }
            }
        } else {
            let child = fiber.child;
            while (child) {
                commitDeletion(child, domParent);
                child = child.sibling;
            }
        }
    }

    function flushWork() {
        if (renderQueued) {
            renderNow();
        }
    }

    function pushSuspense(fallback) {
        suspenseStack.push(fallback);
    }

    function popSuspense() {
        if (suspenseStack.length > 0) {
            suspenseStack.pop();
        }
    }

    function currentSuspenseFallback() {
        return suspenseStack.length > 0 ? suspenseStack[suspenseStack.length - 1] : null;
    }

    function memo(fn, compare) {
        return {
            type: 'memo',
            fn,
            compare: compare || shallowEqual
        };
    }

    function renderComponent(fn, props, path) {
        let componentFn = fn;
        let isMemo = false;
        let compare = null;

        if (fn && typeof fn === 'object' && fn.type === 'memo') {
            componentFn = fn.fn;
            isMemo = true;
            compare = fn.compare;
        }

        if (typeof componentFn !== 'function') return fn;

        // Reset state if component type changed at this path
        let state = componentState[path];
        if (state && state.type !== componentFn) {
            state = { hooks: [], type: componentFn };
            componentState[path] = state;
        } else if (!state) {
            state = { hooks: [], type: componentFn };
            componentState[path] = state;
        }

        // Memoization check
        if (isMemo && state.prevProps && compare(state.prevProps, props)) {
            if (state.prevVNode) {
                return state.prevVNode;
            }
        }

        state.prevProps = props;

        resetHookCursor(path);
        const prevPath = currentPath;
        currentPath = path;
        try {
            const vnode = componentFn(props || {});
            state.prevVNode = vnode;
            currentPath = prevPath;
            return vnode;
        } catch (e) {
            currentPath = prevPath;
            // If it's a promise, let it bubble up to performUnitOfWork
            if (e && typeof e.then === 'function') {
                throw e;
            }
            emitError(`renderComponent failed at ${path}: ${e.message || String(e)}`);
            throw e;
        }
    }

    function flushEffects() {
        const effects = [...pendingEffects];
        pendingEffects.length = 0;
        for (const item of effects) {
            if (!item || !item.hook || typeof item.effect !== 'function') continue;
            if (typeof item.hook.cleanup === 'function') {
                try {
                    item.hook.cleanup();
                } catch (e) {
                    log('error', `effect cleanup failed: ${e.message}`);
                }
            }
            try {
                const nextCleanup = item.effect();
                if (typeof nextCleanup === 'function') {
                    item.hook.cleanup = nextCleanup;
                } else {
                    item.hook.cleanup = null;
                }
                item.hook.deps = item.deps;
            } catch (e) {
                log('error', `effect error: ${e.message}`);
            }
        }
    }

    function flushLayoutEffects() {
        const effects = [...pendingLayoutEffects];
        pendingLayoutEffects.length = 0;
        for (const item of effects) {
            if (!item || !item.hook || typeof item.effect !== 'function') continue;
            if (typeof item.hook.layoutCleanup === 'function') {
                try {
                    item.hook.layoutCleanup();
                } catch (e) {
                    log('error', `layout effect cleanup failed: ${e.message}`);
                }
            }
            try {
                const nextCleanup = item.effect();
                if (typeof nextCleanup === 'function') {
                    item.hook.layoutCleanup = nextCleanup;
                } else {
                    item.hook.layoutCleanup = null;
                }
                item.hook.deps = item.deps;
            } catch (e) {
                log('error', `layout effect error: ${e.message}`);
            }
        }
    }

    function renderNow() {
        renderQueued = false;
        if (isRendering) return;
        if (!rootComponent) return;
        isRendering = true;

        try {
            let children;
            if (rootComponent && typeof rootComponent === 'object' && rootComponent.type) {
                children = [rootComponent];
            } else {
                children = [createElement(rootComponent, rootProps)];
            }

            wipRoot = {
                dom: currentRoot ? currentRoot.dom : (renderer.container || null),
                props: {
                    children
                },
                alternate: currentRoot,
                path: 'root'
            };
            nextUnitOfWork = wipRoot;
            deletions = [];

            // For now, we'll run the loop synchronously to maintain compatibility with existing tests
            // In a future update, we can make this truly interruptible
            while (nextUnitOfWork) {
                nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
            }

            if (wipRoot) {
                commitRoot();
            }
        } catch (e) {
            if (e && typeof e.then === 'function') {
                // This should have been caught in performUnitOfWork, but just in case
                e.then(scheduleRender, scheduleRender);
            } else {
                log('error', `renderNow failed: ${e.message || String(e)}`);
            }
        } finally {
            isRendering = false;
        }
    }

    function useState(initialValue) {
        const path = currentPath;
        const idx = nextHookIndex(path);
        const hook = getHookSlot(path, idx);
        if (!('value' in hook)) {
            hook.value = (typeof initialValue === 'function') ? initialValue() : initialValue;
        }
        const setter = next => {
            const nextValue = (typeof next === 'function') ? next(hook.value) : next;
            hook.value = nextValue;
            scheduleRender();
        };
        return [hook.value, setter];
    }

    function useReducer(reducer, initialArg, init) {
        const initialState = (init !== undefined) ? init(initialArg) : initialArg;
        const [state, setState] = useState(initialState);
        const dispatch = action => {
            setState(currentState => reducer(currentState, action));
        };
        return [state, dispatch];
    }

    function useEffect(effect, deps) {
        const path = currentPath;
        const idx = nextHookIndex(path);
        const hook = getHookSlot(path, idx);
        const shouldRun = shallowDepsChanged(hook.deps, deps);
        if (shouldRun) {
            pendingEffects.push({ hook, effect, deps });
        }
    }

    function useLayoutEffect(effect, deps) {
        const path = currentPath;
        const idx = nextHookIndex(path);
        const hook = getHookSlot(path, idx);
        const shouldRun = shallowDepsChanged(hook.deps, deps);
        if (shouldRun) {
            pendingLayoutEffects.push({ hook, effect, deps });
        }
    }

    function useRef(initialValue) {
        const path = currentPath;
        const idx = nextHookIndex(path);
        const hook = getHookSlot(path, idx);
        if (!('ref' in hook)) {
            hook.ref = { current: initialValue };
        }
        return hook.ref;
    }

    function useMemo(factory, deps) {
        const path = currentPath;
        const idx = nextHookIndex(path);
        const hook = getHookSlot(path, idx);
        if (!('value' in hook) || shallowDepsChanged(hook.deps, deps)) {
            hook.value = factory();
            hook.deps = deps;
        }
        return hook.value;
    }

    function useCallback(fn, deps) {
        return useMemo(() => fn, deps);
    }

    function useImperativeHandle(ref, createHandle, deps) {
        useEffect(() => {
            if (ref) {
                const handle = createHandle();
                if (typeof ref === 'function') {
                    ref(handle);
                } else if (ref && typeof ref === 'object' && 'current' in ref) {
                    ref.current = handle;
                }
            }
        }, deps);
    }

    function lazy(loader) {
        let resolved = null;
        let loading = null;
        let failed = null;

        return function LazyComponent(props) {
            if (resolved) {
                return createElement(resolved, props);
            }
            if (failed) {
                throw failed;
            }
            if (!loading) {
                loading = Promise.resolve(loader()).then(mod => {
                    resolved = mod && mod.default ? mod.default : mod;
                    loading = null;
                    scheduleRender();
                }).catch(err => {
                    failed = err || new Error('lazy loader failed');
                    loading = null;
                    scheduleRender();
                });
            }
            throw loading;
        };
    }

    function Suspense(props) {
        // Return a virtual node with special type marker
        // Renderer will check for this type and handle fallback
        let children = props && props.children;
        if (Array.isArray(children) && children.length === 1) {
            children = children[0];
        }
        return {
            type: SUSPENSE_TYPE,
            props: { fallback: props && props.fallback, children },
            children: []
        };
    }

    function createContext(defaultValue) {
        const context = {
            _currentValue: defaultValue,
            Provider: props => {
                if ('value' in props) {
                    context._currentValue = props.value;
                }
                return props.children;
            }
        };
        return context;
    }

    function useContext(context) {
        return context._currentValue;
    }

    function render(element, container) {
        if (container) {
            // React-style render(element, container)
            rootComponent = element;
            rootProps = {};
            if (renderer && !renderer.container) {
                renderer.container = container;
            }
        } else {
            // Legacy Act-style render(Component, props)
            rootComponent = element;
            rootProps = {};
        }
        scheduleRender();
        // Flush immediately for the initial render to maintain backward compatibility with tests
        flushWork();
    }

    function unmount() {
        for (const path in componentState) {
            const state = componentState[path];
            if (state && state.hooks) {
                for (const hook of state.hooks) {
                    if (hook && typeof hook.cleanup === 'function') {
                        try {
                            hook.cleanup();
                        } catch (e) {
                            log('error', `hook cleanup failed: ${e.message}`);
                        }
                    }
                }
            }
        }
        if (renderer.clear) renderer.clear();
        rootComponent = null;
        rootProps = {};
        currentRoot = null;
        wipRoot = null;
        nextUnitOfWork = null;
        deletions = [];
        resetTags();
        componentState = {};
        hookCursor = {};
        suspenseStack = [];
    }

    const StyleSheet = {
        create: styles => styles
    };

    return {
        createElement,
        render,
        unmount,
        useState,
        useEffect,
        useLayoutEffect,
        useRef,
        useMemo,
        useCallback,
        useImperativeHandle: (ref, create, deps) => {
            if (ref) {
                ref.current = create();
            }
        },
        useReducer,
        createContext,
        useContext,
        Fragment: FRAGMENT_TYPE,
        Suspense,
        lazy,
        memo,
        forwardRef: comp => comp,
        StyleSheet,
        ActUtils: {
            act: cb => {
                const res = cb();
                flushWork();
                return res;
            }
        }
    };
}

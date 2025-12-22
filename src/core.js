export function createAct(renderer) {
    var tagCounter = 1;
    var rootComponent = null;
    var rootProps = {};
    var renderQueued = false;
    var isRendering = false;
    var componentState = {};
    var hookCursor = {};
    var pendingEffects = [];
    var currentPath = "root";

    function log(level, message) {
        try {
            var g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
            var logger = (g.console && g.console[level]) ? g.console[level] : null;
            if (logger) {
                logger('[act] ' + message);
            }
            if (level === 'error' && typeof g.__log === 'function') {
                g.__log('error', '[act] ' + message);
            }
        } catch (e) {}
    }

    function emitError(message) {
        log('error', message);
    }

    function flattenChildren(args) {
        var out = [];
        for (var i = 2; i < args.length; i++) {
            var child = args[i];
            if (Array.isArray(child)) {
                for (var j = 0; j < child.length; j++) out.push(child[j]);
            } else if (child !== undefined && child !== null && child !== false) {
                out.push(child);
            }
        }
        return out;
    }

    function createElement(type, props) {
        var children = flattenChildren(arguments);
        var p = props || {};
        if (children.length > 0) {
            p.children = children.length === 1 ? children[0] : children;
        }
        return { type: type, props: p, children: children };
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
        var idx = hookCursor[path] !== undefined ? hookCursor[path] : 0;
        hookCursor[path] = idx + 1;
        return idx;
    }

    function getHookSlot(path, index) {
        var state = componentState[path];
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
        for (var i = 0; i < prev.length; i++) {
            if (prev[i] !== next[i]) return true;
        }
        return false;
    }

    function scheduleRender() {
        if (!rootComponent) return;
        if (renderQueued) return;
        renderQueued = true;
        // In some environments we might want to use requestAnimationFrame or setTimeout
        // For now, keep it synchronous to match existing behavior
        renderNow();
    }

    function renderComponent(fn, props, path) {
        if (typeof fn !== 'function') return fn;
        resetHookCursor(path);
        var prevPath = currentPath;
        currentPath = path;
        try {
            var vnode = fn(props || {});
            currentPath = prevPath;
            return vnode;
        } catch (e) {
            currentPath = prevPath;
            emitError('renderComponent failed: ' + (e.message || String(e)));
            throw e;
        }
    }

    function flushEffects() {
        var effects = pendingEffects.slice();
        pendingEffects.length = 0;
        for (var i = 0; i < effects.length; i++) {
            var item = effects[i];
            if (!item || !item.hook || typeof item.effect !== 'function') continue;
            if (typeof item.hook.cleanup === 'function') {
                try {
                    item.hook.cleanup();
                } catch (e) {
                    log('error', 'effect cleanup failed: ' + e.message);
                }
            }
            try {
                var nextCleanup = item.effect();
                if (typeof nextCleanup === 'function') {
                    item.hook.cleanup = nextCleanup;
                } else {
                    item.hook.cleanup = null;
                }
                item.hook.deps = item.deps;
            } catch (e) {
                log('error', 'effect error: ' + e.message);
            }
        }
    }

    function renderNow() {
        renderQueued = false;
        if (isRendering) return;
        if (!rootComponent) return;
        isRendering = true;
        try {
            if (renderer.clear) renderer.clear();
            resetTags();
            hookCursor = {};
            var vnode = renderComponent(rootComponent, rootProps || {}, 'root');
            renderer.mountNode(vnode, -1, 0, null, 'root', {
                nextTag,
                makePath,
                renderComponent,
                log,
                emitError
            });
            flushEffects();
        } catch (e) {
            var errorMsg = 'render failed: ' + (e.message || String(e));
            log('error', errorMsg);
            emitError(errorMsg);
        } finally {
            isRendering = false;
        }
    }

    function useState(initialValue) {
        var path = currentPath;
        var idx = nextHookIndex(path);
        var hook = getHookSlot(path, idx);
        if (!('value' in hook)) {
            hook.value = (typeof initialValue === 'function') ? initialValue() : initialValue;
        }
        var setter = function (next) {
            var nextValue = (typeof next === 'function') ? next(hook.value) : next;
            hook.value = nextValue;
            scheduleRender();
        };
        return [hook.value, setter];
    }

    function useReducer(reducer, initialArg, init) {
        var initialState = (init !== undefined) ? init(initialArg) : initialArg;
        var stateHook = useState(initialState);
        var state = stateHook[0];
        var setState = stateHook[1];
        var dispatch = function (action) {
            setState(function (currentState) {
                return reducer(currentState, action);
            });
        };
        return [state, dispatch];
    }

    function useEffect(effect, deps) {
        var path = currentPath;
        var idx = nextHookIndex(path);
        var hook = getHookSlot(path, idx);
        var shouldRun = shallowDepsChanged(hook.deps, deps);
        if (shouldRun) {
            pendingEffects.push({ hook: hook, effect: effect, deps: deps });
        }
    }

    function useRef(initialValue) {
        var path = currentPath;
        var idx = nextHookIndex(path);
        var hook = getHookSlot(path, idx);
        if (!('ref' in hook)) {
            hook.ref = { current: initialValue };
        }
        return hook.ref;
    }

    function useMemo(factory, deps) {
        var path = currentPath;
        var idx = nextHookIndex(path);
        var hook = getHookSlot(path, idx);
        if (!('value' in hook) || shallowDepsChanged(hook.deps, deps)) {
            hook.value = factory();
            hook.deps = deps;
        }
        return hook.value;
    }

    function useCallback(fn, deps) {
        return useMemo(function () { return fn; }, deps);
    }

    function createContext(defaultValue) {
        var context = {
            _currentValue: defaultValue,
            Provider: function (props) {
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

    function render(component, props) {
        rootComponent = component;
        rootProps = props || {};
        scheduleRender();
    }

    function unmount() {
        for (var path in componentState) {
            var state = componentState[path];
            if (state && state.hooks) {
                for (var i = 0; i < state.hooks.length; i++) {
                    var hook = state.hooks[i];
                    if (hook && typeof hook.cleanup === 'function') {
                        try {
                            hook.cleanup();
                        } catch (e) {
                            log('error', 'hook cleanup failed: ' + e.message);
                        }
                    }
                }
            }
        }
        if (renderer.clear) renderer.clear();
        resetTags();
        componentState = {};
        hookCursor = {};
    }

    var StyleSheet = {
        create: function (styles) {
            return styles;
        }
    };

    return {
        createElement,
        render,
        unmount,
        useState,
        useEffect,
        useLayoutEffect: useEffect,
        useRef,
        useMemo,
        useCallback,
        useReducer,
        createContext,
        useContext,
        Fragment: 'div',
        memo: function (comp) { return comp; },
        forwardRef: function (comp) { return comp; },
        StyleSheet,
        ActUtils: {
            act: (cb) => cb()
        }
    };
}

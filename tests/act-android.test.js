import test from 'node:test';
import assert from 'node:assert';
import { createAct } from '../src/core.js';
import { createAndroidRenderer } from '../src/renderer-android.js';

test('Android: testActInitialization', () => {
    const renderer = createAndroidRenderer();
    const Act = createAct(renderer);

    assert.strictEqual(typeof Act.render, 'function');
    assert.strictEqual(typeof Act.useState, 'function');
});

test('Android: testRenderSimpleDivProducesBridgeMessages', () => {
    const messages = [];
    globalThis.bridge = {
        createView: (tag, type, props) => messages.push({ type: 'createView', tag, viewType: type, props }),
        addChild: (parent, child, index) => messages.push({ type: 'addChild', parent, child, index }),
        updateProps: (tag, props) => messages.push({ type: 'updateProps', tag, props }),
        addEventListener: (tag, event, cb) => messages.push({ type: 'addEventListener', tag, event })
    };

    const renderer = createAndroidRenderer();
    const Act = createAct(renderer);

    function Comp() {
        return Act.createElement('div', { className: 'p-4' }, 'Hello');
    }

    Act.render(Comp, {});

    const types = messages.map(m => m.type);
    assert.ok(types.includes('createView'));
    assert.ok(types.includes('addChild'));

    const divMessage = messages.find(m => m.type === 'createView' && m.viewType === 'div' && m.props.className === 'p-4');
    assert.ok(divMessage);

    delete globalThis.bridge;
});

test('Android: testClickEventListenerIsRegistered', () => {
    const messages = [];
    globalThis.bridge = {
        createView: () => { },
        addChild: () => { },
        addEventListener: (tag, event, cb) => messages.push({ type: 'addEventListener', tag, event })
    };

    const renderer = createAndroidRenderer();
    const Act = createAct(renderer);

    function Comp() {
        return Act.createElement('div', { onClick: () => { } });
    }

    Act.render(Comp, {});

    const hasClick = messages.some(m => m.type === 'addEventListener' && m.event === 'click');
    assert.ok(hasClick);

    delete globalThis.bridge;
});

test('Android: testUseReducer', () => {
    const messages = [];
    globalThis.bridge = {
        createView: (tag, type, props) => messages.push({ type: 'createView', tag, viewType: type, props }),
        addChild: (parent, child, index) => messages.push({ type: 'addChild', parent, child, index }),
        updateProps: (tag, props) => messages.push({ type: 'updateProps', tag, props }),
        removeChild: () => { }
    };

    const renderer = createAndroidRenderer();
    const Act = createAct(renderer);

    let dispatch;
    function reducer(state, action) {
        if (action.type === 'inc') return { count: state.count + 1 };
        return state;
    }

    function Comp() {
        const [state, _dispatch] = Act.useReducer(reducer, { count: 0 });
        dispatch = _dispatch;
        return Act.createElement('text', { text: 'Count: ' + state.count });
    }

    Act.render(Comp, {});

    const count0 = messages.find(m => m.type === 'updateProps' && m.props.text === 'Count: 0');
    // messages might be empty if createView handles initial props, which it does.
    // So let's check createView too.

    Act.ActUtils.act(() => {
        dispatch({ type: 'inc' });
    });
    // console.log('Messages after dispatch:', JSON.stringify(messages, null, 2));
    const count1 = messages.find(m => (m.type === 'updateProps' || m.type === 'createView') && m.props.text === 'Count: 1');
    if (!count1) {
        throw new Error('Could not find Count: 1 in messages: ' + JSON.stringify(messages));
    }
    assert.ok(count1);

    delete globalThis.bridge;
});

test('Android: testUseContext', () => {
    globalThis.bridge = {
        createView: () => { },
        addChild: () => { },
        updateProps: () => { },
        removeChild: () => { }
    };
    const renderer = createAndroidRenderer();
    const Act = createAct(renderer);
    const ThemeContext = Act.createContext('light');

    let capturedTheme;
    function Child() {
        capturedTheme = Act.useContext(ThemeContext);
        return Act.createElement('div');
    }

    function App() {
        return Act.createElement(ThemeContext.Provider, { value: 'dark' },
            Act.createElement(Child)
        );
    }

    Act.render(App, {});
    assert.strictEqual(capturedTheme, 'dark');
    delete globalThis.bridge;
});

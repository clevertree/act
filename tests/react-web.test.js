import test from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { runWebTests } from './web-parity.shared.js';

test('React Web Parity Tests', async (t) => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.Node = dom.window.Node;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.body;
    
    const ActShim = {
        createElement: React.createElement,
        useState: React.useState,
        useEffect: React.useEffect,
        ReactDOM: ReactDOM,
        ActUtils: {
            act: act
        }
    };

    const tests = runWebTests(ActShim, container, true);

    for (const [name, testFn] of Object.entries(tests)) {
        await t.test(name, async () => {
            if (container._reactRoot) {
                container._reactRoot.unmount();
                container._reactRoot = null;
            }
            container.innerHTML = '';
            await testFn();
        });
    }

    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.Node;
});

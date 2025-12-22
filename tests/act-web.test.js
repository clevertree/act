import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createAct } from '../src/core.js';
import { createDomRenderer } from '../src/renderer-dom.js';
import { runWebTests } from './web-parity.shared.js';

test('Act Web Parity Tests', async (t) => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.Node = dom.window.Node;

    const container = document.body;
    const renderer = createDomRenderer(container);
    const Act = createAct(renderer);

    const tests = runWebTests(Act, container, false);

    for (const [name, testFn] of Object.entries(tests)) {
        await t.test(name, async () => {
            container.innerHTML = '';
            Act.unmount();
            await testFn();
        });
    }

    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.Node;
});

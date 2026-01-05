import test from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { createAct } from '../src/core.js';
import { createDomRenderer } from '../src/renderer-dom.js';

test('Error Boundaries', async (t) => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.Node = dom.window.Node;

    const container = document.body;
    const renderer = createDomRenderer(container);
    const Act = createAct(renderer);
    const { createElement, render, useState } = Act;

    await t.test('should catch error and render fallback', async () => {
        let caughtError = null;

        function ErrorBoundary({ children, fallback }) {
            return createElement('div', {
                componentDidCatch: (e) => { caughtError = e; },
                fallback: fallback
            }, children);
        }

        function Buggy() {
            throw new Error('I crashed!');
        }

        render(
            createElement(ErrorBoundary, {
                fallback: (err) => createElement('span', {}, 'Error: ' + err.message)
            },
                createElement(Buggy, {})
            )
        );

        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 50));

        assert.strictEqual(caughtError?.message, 'I crashed!');
        assert.ok(container.innerHTML.includes('Error: I crashed!'));
    });

    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.Node;
});

import assert from 'node:assert';

export function runWebTests(Act, container, isReact = false) {
    const render = async (Comp) => {
        if (isReact) {
            const { createRoot } = Act.ReactDOM;
            if (!container._reactRoot) {
                container._reactRoot = createRoot(container);
            }
            await Act.ActUtils.act(async () => {
                container._reactRoot.render(Act.createElement(Comp, {}));
            });
        } else {
            Act.render(Comp, {});
        }
    };

    // Helper to wait for React's async rendering
    const waitForRender = async () => {
        await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, isReact ? 50 : 0));
    };

    return {
        testSimpleRender: async () => {
            function Comp() {
                return Act.createElement('div', { className: 'web-comp' }, 'Hello Web');
            }

            await render(Comp);
            await waitForRender();

            assert.strictEqual(container.childNodes.length, 1, 'Should have 1 child');
            const div = container.childNodes[0];
            assert.strictEqual(div.tagName, 'DIV');
            assert.strictEqual(div.className, 'web-comp');
            assert.strictEqual(div.textContent, 'Hello Web');
        },

        testStateUpdate: async () => {
            let setVal;
            function Comp() {
                const [val, _setVal] = Act.useState('initial');
                setVal = _setVal;
                return Act.createElement('span', {}, val);
            }

            await render(Comp);
            await waitForRender();
            assert.strictEqual(container.textContent, 'initial');

            Act.ActUtils.act(() => {
                setVal('updated');
            });
            await waitForRender();
            assert.strictEqual(container.textContent, 'updated');
        },

        testUseEffect: async () => {
            let effectCalled = 0;
            function Comp() {
                Act.useEffect(() => {
                    effectCalled++;
                }, []);
                return Act.createElement('div', {}, 'Effect Test');
            }

            await render(Comp);
            await waitForRender();
            assert.strictEqual(effectCalled, 1, 'Effect should be called once');
        },

        testLazyWithSuspenseFallback: async () => {
            let resolveLazy = () => { };

            const LazyComp = Act.lazy(() => new Promise((resolve) => {
                resolveLazy = () => resolve({ default: () => Act.createElement('div', {}, 'Lazy Ready') });
            }));

            function Wrapper() {
                return Act.createElement(
                    Act.Suspense,
                    { fallback: Act.createElement('span', {}, 'loading') },
                    Act.createElement(LazyComp, {})
                );
            }

            await render(Wrapper);
            await waitForRender();
            assert.strictEqual(container.textContent, 'loading');

            await Act.ActUtils.act(async () => {
                resolveLazy();
            });
            await waitForRender();
            await waitForRender();
            assert.strictEqual(container.textContent, 'Lazy Ready');
        }
    };
}

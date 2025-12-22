import assert from 'node:assert';

export function runWebTests(Act, container, isReact = false) {
    const render = (Comp) => {
        if (isReact) {
            const { createRoot } = Act.ReactDOM;
            if (!container._reactRoot) {
                container._reactRoot = createRoot(container);
            }
            container._reactRoot.render(Act.createElement(Comp, {}));
        } else {
            Act.render(Comp, {});
        }
    };

    // Helper to wait for React's async rendering
    const waitForRender = async () => {
        if (isReact) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    };

    return {
        testSimpleRender: async () => {
            function Comp() {
                return Act.createElement('div', { className: 'web-comp' }, 'Hello Web');
            }

            render(Comp);
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

            render(Comp);
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

            render(Comp);
            await waitForRender();
            assert.strictEqual(effectCalled, 1, 'Effect should be called once');
        }
    };
}

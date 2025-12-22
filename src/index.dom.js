import { createAct } from './core.js';
import { createDomRenderer } from './renderer-dom.js';

export function createDomAct(container) {
    const renderer = createDomRenderer(container);
    return createAct(renderer);
}

export function createRoot(container) {
    const act = createDomAct(container);
    return {
        render: (element) => act.render(() => element),
        unmount: () => act.unmount()
    };
}

export function render(element, container) {
    const root = createRoot(container);
    root.render(element);
    return root;
}

const Act = {
    render,
    createRoot,
    createAct: createDomAct,
    createCore: createAct
};

export default Act;
export { Act };

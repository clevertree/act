export function createAndroidRenderer() {
    const normalizeType = (type) => {
        if (typeof type === 'string') return type;
        return 'view';
    };

    const getBridge = () => {
        const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
        return g.bridge;
    };

    function mountNode(node, parentTag, index, parentType, path, helpers) {
        if (node === null || node === undefined || node === false) return;

        // Check for Suspense boundary
        if (node && node.type === helpers.suspenseType) {
            helpers.pushSuspense(node.props ? node.props.fallback : null);
            try {
                const child = node.props ? node.props.children : null;
                mountNode(child, parentTag, index, parentType, helpers.makePath(path, 's'), helpers);
            } finally {
                helpers.popSuspense();
            }
            return;
        }

        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                mountNode(node[i], parentTag, index + i, parentType, helpers.makePath(path, i), helpers);
            }
            return;
        }

        const nb = getBridge();
        if (!nb) {
            helpers.log('error', 'bridge missing');
            return;
        }

        if (typeof node === 'string' || typeof node === 'number') {
            const textVal = String(node);
            if (parentType === 'span' || parentType === 'text' || parentType === 'button') {
                nb.updateProps(parentTag, { text: textVal });
            } else {
                const textTag = helpers.nextTag();
                nb.createView(textTag, 'span', { text: textVal, width: 'wrap_content', height: 'wrap_content' });
                nb.addChild(parentTag, textTag, index);
            }
            return;
        }

        if (node.type === helpers.fragmentType) {
            const kids = node.children || [];
            // Flatten nested arrays (from .map() calls in JSX)
            const flatKids = [];
            for (let i = 0; i < kids.length; i++) {
                if (Array.isArray(kids[i])) {
                    for (let j = 0; j < kids[i].length; j++) {
                        flatKids.push(kids[i][j]);
                    }
                } else {
                    flatKids.push(kids[i]);
                }
            }
            for (let i = 0; i < flatKids.length; i++) {
                mountNode(flatKids[i], parentTag, index + i, parentType, helpers.makePath(path, i), helpers);
            }
            return;
        }

        if (typeof node.type === 'function') {
            const compPath = helpers.makePath(path, `c${index}`);
            try {
                const rendered = helpers.renderComponent(node.type, node.props || {}, compPath);
                mountNode(rendered, parentTag, index, parentType, compPath, helpers);
            } catch (e) {
                helpers.emitError(`Failed to mount component: ${e.message || String(e)}`);
            }
            return;
        }

        const type = normalizeType(node.type);
        const tag = helpers.nextTag();
        const props = Object.assign({}, node.props || {});
        const onClick = props.onClick;
        const onChange = props.onChange || props.onInput;
        delete props.onClick;
        delete props.onChange;
        delete props.onInput;
        delete props.children;

        if (!props.width && parentTag === -1) props.width = 'match_parent';
        if (!props.height && parentTag === -1) props.height = 'match_parent';

        nb.createView(tag, type, props);
        if (typeof onClick === 'function') {
            nb.addEventListener(tag, 'click', onClick);
        }
        if (typeof onChange === 'function') {
            nb.addEventListener(tag, 'change', onChange);
        }

        let kids = node.children || [];
        if (node.props && node.props.children) {
            if (kids.length === 0) {
                kids = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
            }
        }

        // Flatten nested arrays (from .map() calls in JSX)
        const flatKids = [];
        for (let i = 0; i < kids.length; i++) {
            if (Array.isArray(kids[i])) {
                for (let j = 0; j < kids[i].length; j++) {
                    flatKids.push(kids[i][j]);
                }
            } else {
                flatKids.push(kids[i]);
            }
        }

        for (let i = 0; i < flatKids.length; i++) {
            mountNode(flatKids[i], tag, i, type, helpers.makePath(path, i), helpers);
        }

        nb.addChild(parentTag, tag, index);
    }

    return {
        mountNode,
        createInstance(type, props, helpers) {
            const nb = getBridge();
            if (!nb) return null;
            const tag = helpers.nextTag();
            if (type === "TEXT_ELEMENT") {
                nb.createView(tag, "span", { text: String(props.nodeValue || ""), width: 'wrap_content', height: 'wrap_content' });
                return { tag, type: "span" };
            }
            const androidType = normalizeType(type);
            const p = Object.assign({}, props || {});
            delete p.children;
            nb.createView(tag, androidType, p);
            if (typeof props.onClick === 'function') {
                nb.addEventListener(tag, 'click', props.onClick);
            }
            return { tag, type: androidType };
        },
        appendChild(parent, child) {
            const nb = getBridge();
            if (!nb || !child) return;
            const parentTag = parent ? parent.tag : -1;
            nb.addChild(parentTag, child.tag, -1);
        },
        commitUpdate(instance, oldProps, newProps) {
            const nb = getBridge();
            if (!nb || !instance) return;
            if (instance.type === "span" && "nodeValue" in newProps) {
                nb.updateProps(instance.tag, { text: String(newProps.nodeValue || "") });
                return;
            }
            const p = Object.assign({}, newProps || {});
            delete p.children;
            nb.updateProps(instance.tag, p);
            if (newProps.onClick !== oldProps.onClick) {
                if (typeof newProps.onClick === 'function') {
                    nb.addEventListener(instance.tag, 'click', newProps.onClick);
                }
            }
            if (newProps.onChange !== oldProps.onChange || newProps.onInput !== oldProps.onInput) {
                const nextChange = newProps.onChange || newProps.onInput;
                if (typeof nextChange === 'function') {
                    nb.addEventListener(instance.tag, 'change', nextChange);
                }
            }
        },
        removeChild(parent, child) {
            const nb = getBridge();
            if (!nb || !child) return;
            const parentTag = parent ? parent.tag : -1;
            nb.removeChild(parentTag, child.tag);
        },
        clear() {
            const g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
            if (typeof g.__clearViews === 'function') {
                g.__clearViews();
                return;
            }
            const nb = g.bridge;
            if (nb && nb.removeChild) {
                try { nb.removeChild(-1, -1); } catch (e) { }
            }
        }
    };
}

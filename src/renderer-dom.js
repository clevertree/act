export function createDomRenderer(container) {
    const nodes = {};

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

        if (typeof node === 'string' || typeof node === 'number') {
            const textNode = document.createTextNode(String(node));
            const parent = parentTag === -1 ? container : nodes[parentTag];
            if (parent) {
                if (index < parent.childNodes.length) {
                    parent.insertBefore(textNode, parent.childNodes[index]);
                } else {
                    parent.appendChild(textNode);
                }
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

        const tag = helpers.nextTag();
        const type = node.type === 'view' ? 'div' : (node.type === 'text' || node.type === 'span' ? 'span' : node.type);
        const el = document.createElement(type);
        nodes[tag] = el;

        const props = node.props || {};
        for (const key in props) {
            if (key === 'onClick') {
                el.addEventListener('click', props[key]);
            } else if (key === 'className') {
                el.className = props[key];
            } else if (key === 'style' && typeof props[key] === 'object') {
                Object.assign(el.style, props[key]);
            } else if (key !== 'children') {
                el.setAttribute(key, props[key]);
            }
        }

        const kids = node.children || [];
        for (let i = 0; i < kids.length; i++) {
            mountNode(kids[i], tag, i, node.type, helpers.makePath(path, i), helpers);
        }

        const parent = parentTag === -1 ? container : nodes[parentTag];
        if (parent) {
            if (index < parent.childNodes.length) {
                parent.insertBefore(el, parent.childNodes[index]);
            } else {
                parent.appendChild(el);
            }
        }
    }

    return {
        container,
        mountNode,
        createInstance(type, props) {
            if (type === "TEXT_ELEMENT") {
                return document.createTextNode(props.nodeValue || "");
            }
            const domType = type === 'view' ? 'div' : (type === 'text' || type === 'span' ? 'span' : type);
            const el = document.createElement(domType);
            this.commitUpdate(el, {}, props);
            return el;
        },
        appendChild(parent, child) {
            const p = parent || container;
            if (p && child) {
                p.appendChild(child);
            }
        },
        commitUpdate(el, oldProps, newProps) {
            if (el.nodeType === 3) { // Text node
                if (oldProps.nodeValue !== newProps.nodeValue) {
                    el.nodeValue = newProps.nodeValue || "";
                }
                return;
            }
            for (const key in newProps) {
                if (key === 'onClick') {
                    if (oldProps[key]) el.removeEventListener('click', oldProps[key]);
                    el.addEventListener('click', newProps[key]);
                } else if (key === 'className') {
                    el.className = newProps[key];
                } else if (key === 'style' && typeof newProps[key] === 'object') {
                    Object.assign(el.style, newProps[key]);
                } else if (key !== 'children') {
                    el.setAttribute(key, newProps[key]);
                }
            }
            // Remove old props
            for (const key in oldProps) {
                if (!(key in newProps)) {
                    if (key === 'onClick') {
                        el.removeEventListener('click', oldProps[key]);
                    } else {
                        el.removeAttribute(key);
                    }
                }
            }
        },
        removeChild(parent, child) {
            const p = parent || container;
            if (p && child) p.removeChild(child);
        },
        clear() {
            if (container) container.innerHTML = '';
            nodes = {};
        }
    };
}

export function createDomRenderer(container) {
    var nodes = {};

    function mountNode(node, parentTag, index, parentType, path, helpers) {
        if (node === null || node === undefined || node === false) return;

        // Check for Suspense boundary
        if (node && node.type === helpers.suspenseType) {
            helpers.pushSuspense(node.props ? node.props.fallback : null);
            try {
                var child = node.props ? node.props.children : null;
                mountNode(child, parentTag, index, parentType, helpers.makePath(path, 's'), helpers);
            } finally {
                helpers.popSuspense();
            }
            return;
        }

        if (typeof node === 'string' || typeof node === 'number') {
            var textNode = document.createTextNode(String(node));
            var parent = parentTag === -1 ? container : nodes[parentTag];
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
            var compPath = helpers.makePath(path, 'c' + index);
            try {
                var rendered = helpers.renderComponent(node.type, node.props || {}, compPath);
                mountNode(rendered, parentTag, index, parentType, compPath, helpers);
            } catch (e) {
                helpers.emitError('Failed to mount component: ' + (e.message || String(e)));
            }
            return;
        }

        var tag = helpers.nextTag();
        var type = node.type === 'view' ? 'div' : (node.type === 'text' || node.type === 'span' ? 'span' : node.type);
        var el = document.createElement(type);
        nodes[tag] = el;

        var props = node.props || {};
        for (var key in props) {
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

        var kids = node.children || [];
        for (var i = 0; i < kids.length; i++) {
            mountNode(kids[i], tag, i, node.type, helpers.makePath(path, i), helpers);
        }

        var parent = parentTag === -1 ? container : nodes[parentTag];
        if (parent) {
            if (index < parent.childNodes.length) {
                parent.insertBefore(el, parent.childNodes[index]);
            } else {
                parent.appendChild(el);
            }
        }
    }

    return {
        mountNode,
        clear: function () {
            if (container) container.innerHTML = '';
            nodes = {};
        }
    };
}

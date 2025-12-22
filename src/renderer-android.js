export function createAndroidRenderer() {
    function normalizeType(type) {
        if (typeof type === 'string') return type;
        return 'view';
    }

    function getBridge() {
        var g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
        return g.bridge;
    }

    function mountNode(node, parentTag, index, parentType, path, helpers) {
        if (node === null || node === undefined || node === false) return;
        var nb = getBridge();
        if (!nb) {
            helpers.log('error', 'bridge missing');
            return;
        }

        if (typeof node === 'string' || typeof node === 'number') {
            var textVal = String(node);
            if (parentType === 'span' || parentType === 'text' || parentType === 'button') {
                nb.updateProps(parentTag, { text: textVal });
            } else {
                var textTag = helpers.nextTag();
                nb.createView(textTag, 'span', { text: textVal, width: 'wrap_content', height: 'wrap_content' });
                nb.addChild(parentTag, textTag, index);
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

        var type = normalizeType(node.type);
        var tag = helpers.nextTag();
        var props = Object.assign({}, node.props || {});
        var onClick = props.onClick;
        delete props.onClick;
        delete props.children;

        if (!props.width && parentTag === -1) props.width = 'match_parent';
        if (!props.height && parentTag === -1) props.height = 'match_parent';

        nb.createView(tag, type, props);
        if (typeof onClick === 'function') {
            nb.addEventListener(tag, 'click', onClick);
        }

        var kids = node.children || [];
        if (node.props && node.props.children) {
            if (kids.length === 0) {
                kids = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
            }
        }

        // Flatten nested arrays (from .map() calls in JSX)
        var flatKids = [];
        for (var i = 0; i < kids.length; i++) {
            if (Array.isArray(kids[i])) {
                for (var j = 0; j < kids[i].length; j++) {
                    flatKids.push(kids[i][j]);
                }
            } else {
                flatKids.push(kids[i]);
            }
        }

        for (var i = 0; i < flatKids.length; i++) {
            mountNode(flatKids[i], tag, i, type, helpers.makePath(path, i), helpers);
        }

        nb.addChild(parentTag, tag, index);
    }

    return {
        mountNode,
        clear: function () {
            var g = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
            if (typeof g.__clearViews === 'function') {
                g.__clearViews();
                return;
            }
            var nb = g.bridge;
            if (nb && nb.removeChild) {
                try { nb.removeChild(-1, -1); } catch (e) { }
            }
        }
    };
}

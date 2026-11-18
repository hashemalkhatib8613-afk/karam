const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function mount(reduced = false, nicknames = [], layer = 'background', quantity = 'medium') {
  let state = [];
  let effect;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/components/FallingBackground.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, document: { body: {} }, require(id) {
    if (id === 'react-dom') return { createPortal: (element) => element };
    if (id === 'react') return {
      useState: () => [state, (update) => { state = typeof update === 'function' ? update(state) : update; }],
      useEffect: (callback) => { effect = callback; },
    };
    if (id === '@/lib/text') return { popNicknames: (value) => value };
    return require(id);
  } });
  const render = () => exports.default({ reduced, nicknames, layer, quantity });
  render();
  effect();
  return { render, buttons: () => render().props.children[0], labels: () => render().props.children[1].props.children.filter(Boolean) };
}

for (const pointerType of ['mouse', 'touch', 'pen']) {
  test(`${pointerType} press pops only the selected icon and replenishes it after the pop`, () => {
    const h = mount();
    const original = h.buttons()[3];
    assert.equal(original.type, 'button');
    let prevented = false;
    original.props.onPointerDown({ pointerType, isPrimary: true, button: 0, currentTarget: { getBoundingClientRect: () => ({ left: 80, top: 100, width: 44, height: 44 }) }, preventDefault() { prevented = true; } });
    assert.equal(prevented, pointerType === 'mouse');
    assert.equal(h.buttons()[3].props['data-popping'], true);
    assert.equal(h.buttons().filter((button) => button.props['data-popping']).length, 1);
    h.buttons()[3].props.onAnimationEnd({ animationName: 'background-pop-ring' });
    assert.equal(h.buttons()[3].props['data-popping'], true);
    h.buttons()[3].props.onAnimationEnd({ animationName: 'background-pop' });
    assert.equal(h.buttons()[3].props['data-popping'], false);
    assert.notEqual(h.buttons()[3].key, original.key);
    assert.equal(h.buttons().length, 24);
  });
}

test('click fallback pops an icon without pointer events', () => {
  const h = mount();
  h.buttons()[0].props.onClick({ currentTarget: { getBoundingClientRect: () => ({ left: 80, top: 100, width: 44, height: 44 }) } });
  assert.equal(h.buttons()[0].props['data-popping'], true);
});

test('right clicks and secondary touches do not pop icons', () => {
  const h = mount();
  for (const event of [
    { pointerType: 'mouse', isPrimary: true, button: 2 },
    { pointerType: 'touch', isPrimary: false, button: 0 },
  ]) {
    h.buttons()[0].props.onPointerDown({ ...event, preventDefault() { assert.fail('unrelated pointer was intercepted'); } });
    assert.equal(h.buttons()[0].props['data-popping'], false);
  }
});

test('reduced motion hides the icons', () => {
  assert.equal(mount(true).render(), null);
});

test('CMS quantity choices render the expected number of icons', () => {
  assert.equal(mount(false, [], 'background', 'min').buttons().length, 12);
  assert.equal(mount(false, [], 'background', 'medium').buttons().length, 24);
  assert.equal(mount(false, [], 'background', 'max').buttons().length, 40);
});

test('CMS layer choice is exposed to the stylesheet', () => {
  assert.equal(mount(false, [], 'background').render().props['data-layer'], 'background');
  assert.equal(mount(false, [], 'foreground').render().props['data-layer'], 'foreground');
});

test('each pop chooses a configured name and keeps it visible after the icon disappears', () => {
  const h = mount(false, ['Sunshine', 'Sweetheart']);
  const event = { currentTarget: { getBoundingClientRect: () => ({ left: 80, top: 100, width: 44, height: 44 }) } };
  const chosen = new Set();
  for (let i = 0; i < 80; i++) {
    h.buttons()[0].props.onClick(event);
    const label = h.labels()[0];
    assert.ok(['Sunshine', 'Sweetheart'].includes(label.props.children));
    chosen.add(label.props.children);
    h.buttons()[0].props.onAnimationEnd({ animationName: 'background-pop' });
    assert.equal(h.labels().length, 1);
    label.props.onAnimationEnd({ animationName: 'background-nickname' });
    assert.equal(h.labels().length, 0);
    assert.equal(h.buttons()[0].props['data-popping'], false);
  }
  assert.equal(chosen.size, 2);
});

test('an empty nickname list still pops without showing a label', () => {
  const h = mount();
  h.buttons()[0].props.onClick({ currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 44, height: 44 }) } });
  assert.equal(h.labels().length, 0);
  h.buttons()[0].props.onAnimationEnd({ animationName: 'background-pop' });
  assert.equal(h.buttons()[0].props['data-popping'], false);
});

// Check the actual stylesheet as well as React state: a hidden label can pass
// every interaction test while still producing a visually blank pop.
const postcss = require('postcss');
const styles = postcss.parse(fs.readFileSync('src/styles/app.css', 'utf8'));

test('nickname labels are visible by default and hidden only for reduced motion or print', () => {
  let foundLayer = false;
  styles.walkRules((rule) => {
    if (rule.selector === '.falling-background__nicknames' && rule.parent.type === 'root') foundLayer = true;
    const hides = rule.nodes.some((node) => node.prop === 'display' && node.value === 'none');
    if (!hides) return;
    for (const selector of rule.selectors) {
      if (!selector.includes('.falling-background__nicknames')) continue;
      const conditional = rule.parent.type === 'atrule' && rule.parent.name === 'media';
      assert.ok(conditional || selector.includes('[data-motion="reduced"]'), `Unconditionally hidden nickname layer: ${selector}`);
    }
  });
  assert.ok(foundLayer);
});

test('icons support background and foreground layers while open gaps remain click-through', () => {
  const declaration = (selector, property) => {
    let value;
    styles.walkRules(selector, (rule) => rule.walkDecls(property, (decl) => { value = decl.value; }));
    return value;
  };
  assert.equal(declaration('.falling-background', 'z-index'), '0');
  assert.equal(declaration('.falling-background[data-layer="foreground"]', 'z-index'), '20');
  assert.equal(declaration(':where(.shell__main, .center-page)', 'z-index'), '1');
  assert.equal(declaration(':where(.shell__main, .center-page)', 'pointer-events'), 'none');
  const content = ':where(.shell__main > *, .center-page > :not(.falling-background))';
  assert.equal(declaration(content, 'background-color'), 'var(--canvas)');
  assert.equal(declaration(content, 'pointer-events'), 'auto');
  assert.equal(declaration('.center-page > .falling-background[data-layer="background"]', 'z-index'), '-1');
  assert.equal(declaration('.center-page > .falling-background[data-layer="foreground"]', 'z-index'), '2');
});

test('animated decoration is contained and cannot extend the page scroll area', () => {
  const declaration = (selector, property) => {
    let value;
    styles.walkRules(selector, (rule) => rule.walkDecls(property, (decl) => { value = decl.value; }));
    return value;
  };
  assert.equal(declaration('.falling-background', 'overflow'), 'clip');
  assert.equal(declaration('.falling-background', 'contain'), 'layout paint');
  assert.equal(declaration('.falling-background__nicknames', 'overflow'), 'clip');
  assert.equal(declaration('.falling-background__nicknames', 'contain'), 'layout paint');
  assert.equal(declaration('html', 'overflow-x'), 'hidden');
  assert.equal(declaration('html', 'overflow-y'), 'auto');
  assert.equal(declaration('body', 'overflow-x'), undefined);
});

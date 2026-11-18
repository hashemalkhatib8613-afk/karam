const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('the saved album layout is passed to the public gallery renderer', () => {
  const page = fs.readFileSync('src/app/(app)/gallery/[slug]/page.tsx', 'utf8');
  assert.match(page, /albumLayout=\{album\.layout_type\}/);
  assert.match(page, /mediaAspect=\{album\.media_aspect\}/);
});

test('every album layout has a distinct renderer class and stylesheet', () => {
  const component = fs.readFileSync('src/components/Lightbox.tsx', 'utf8');
  const styles = fs.readFileSync('src/styles/app.css', 'utf8');
  for (const layout of ['grid-2', 'grid-3', 'masonry', 'polaroid', 'collage']) {
    assert.ok(component.includes(`"${layout}"`), `missing ${layout} renderer support`);
    assert.ok(styles.includes(`.album-gallery--${layout}`), `missing ${layout} styles`);
  }
  assert.doesNotMatch(component, /filmstrip/);
  assert.doesNotMatch(styles, /album-gallery--filmstrip/);
  assert.match(component, /album-gallery--\$\{layout\}/);
});

test('album media dimensions can be controlled independently in the CMS', () => {
  const config = fs.readFileSync('src/lib/entities.ts', 'utf8');
  const component = fs.readFileSync('src/components/Lightbox.tsx', 'utf8');
  const styles = fs.readFileSync('src/styles/app.css', 'utf8');
  for (const aspect of ['natural', 'square', 'landscape', 'wide', 'portrait']) {
    assert.ok(config.includes(`["${aspect}"`), `missing ${aspect} CMS option`);
    assert.ok(component.includes(`"${aspect}"`), `missing ${aspect} renderer support`);
  }
  for (const aspect of ['landscape', 'wide', 'portrait']) {
    assert.ok(styles.includes(`.lightbox-grid--${aspect}`), `missing ${aspect} dimensions`);
  }
});

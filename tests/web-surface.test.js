import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('browser command surface has accessible launch, canvas, status and local module entry', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url),'utf8');
  for (const id of ['play','screen','overlay','status','pause','restart','fire','music','theme','best']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /aria-describedby="instructions"/);
  assert.match(html, /type="module" src="\.\/web\/app.js"/);
  assert.match(html, /\.\/web\/style.css/);
  const css = await readFile(new URL('../web/style.css', import.meta.url),'utf8');
  assert.match(css, /data-theme="light"/);
  assert.match(css, /@media/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rebuildArtifacts } from '../src/audit.mjs';
import { renderThesis } from '../src/thesis.mjs';

const root = new URL('../', import.meta.url);

test('committed investment thesis matches the offline receipt and epoch audit', async () => {
  const source = JSON.parse(await readFile(new URL('public/data/snapshot.json', root), 'utf8'));
  const template = await readFile(new URL('THESIS.template.md', root), 'utf8');
  const committed = await readFile(new URL('THESIS.md', root), 'utf8');
  const { snapshot, files } = rebuildArtifacts(source);
  const rendered = renderThesis(template, snapshot, files['snapshot.json']);
  assert.equal(committed, rendered);
  assert.match(rendered, /14,234\/17,665 direct `sign` receipts \(80\.6%\)/);
  assert.match(rendered, /72\/80 \(90\.0%\)/);
  assert.match(rendered, /1,219\/1,482/);
  assert.match(rendered, /2,202,384/);
});

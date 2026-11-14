import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('../public/data/', import.meta.url);
test('downloaded manifest resolves and verifies every public artifact including document copies', async () => {
 const manifest = JSON.parse(await readFile(new URL('evidence-manifest.json', base), 'utf8'));
 assert.ok(manifest['../THESIS.md']);
 for (const [path, sealed] of Object.entries(manifest)) {
  const bytes = await readFile(new URL(path, base));
  assert.equal(bytes.length, sealed.bytes, path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sealed.sha256, path);
 }
});

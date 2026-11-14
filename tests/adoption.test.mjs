import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adoptionRead } from '../public/adoption.mjs';
const snapshot=JSON.parse(await readFile(new URL('../public/data/snapshot.json',import.meta.url),'utf8'));
const comparison=JSON.parse(await readFile(new URL('../public/data/comparison.json',import.meta.url),'utf8'));
test('adoption read traces each observation to its actual dated population',()=>{
 const r=adoptionRead(snapshot,comparison);
 assert.match(r.economics,/0\.0080%/);
 assert.equal(r.observations[0].value,'17,665 signing requests');
 assert.equal(r.observations[1].value,'615 → 600 requests');
 assert.match(r.observations[1].detail,/-2\.4%/);
 assert.match(r.observations[2].detail,/14,234 \/ 17,665/);
});
test('a larger short-hour count still cannot establish lasting adoption; missing comparison stays explicit',()=>{
 const changed=structuredClone(comparison);changed.periods[1].directRequests=60000;
 assert.match(adoptionRead(snapshot,changed).heading,/Adoption growth is unproven/);
 assert.match(adoptionRead(snapshot,changed).observations[1].detail,/cannot establish a lasting adoption trend/);
 assert.match(adoptionRead(snapshot,null).observations[1].value,/unavailable/);
 assert.throws(()=>adoptionRead({},null),/Missing dated request evidence/);
});

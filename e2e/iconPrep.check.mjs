import assert from 'node:assert/strict';
import { segmentAlpha, cropToSquare, cleanComponents, otsuThreshold } from '../src/iconPrep.js';

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`PASS ${name}`); }
  catch (error) { fail++; console.error(`FAIL ${name}: ${error.message}`); }
}
const fixture = (background, foreground, alpha = 255) => {
  const rgba = new Uint8ClampedArray(100 * 100 * 4);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
    const art = x >= 25 && x < 75 && y >= 25 && y < 75;
    const value = art ? foreground : background;
    rgba.set([value, value, value, art ? alpha : 255], (y * 100 + x) * 4);
  }
  return rgba;
};
const light = segmentAlpha(fixture(255, 0), 100, 100);
const dark = segmentAlpha(fixture(0, 255), 100, 100);
check('light background removed', () => assert.equal(light[0], 0));
check('dark background removed', () => assert.equal(dark[0], 0));
check('light foreground retained', () => assert.equal(light[5050], 255));
check('dark foreground retained', () => assert.equal(dark[5050], 255));
check('polarity produces identical masks', () => assert.deepEqual(light, dark));
check('mask keeps actual area', () => assert.equal(dark.filter(a => a > 127).length, 2500));
check('uniform opaque input is empty', () => assert.ok(segmentAlpha(fixture(255, 255), 100, 100).every(a => a === 0)));
check('uniform black input is empty', () => assert.ok(segmentAlpha(fixture(0, 0), 100, 100).every(a => a === 0)));
check('1px uniform input is empty', () => assert.deepEqual([...segmentAlpha([1, 1, 1, 255], 1, 1)], [0]));
check('transparent input is empty regardless of hidden RGB', () => assert.deepEqual([...segmentAlpha([99, 100, 255, 0], 1, 1)], [0]));
check('invalid buffer rejected', () => assert.throws(() => segmentAlpha([], 2, 2)));
check('invalid dimensions rejected', () => assert.throws(() => segmentAlpha([], 0, 0)));
check('fractional dimensions rejected', () => assert.throws(() => segmentAlpha([], 0.5, 1)));
check('source opacity is respected', () => assert.equal(segmentAlpha(fixture(255, 0, 80), 100, 100)[5050], 80));
const transparent = fixture(255, 106);
for (let i = 0; i < 10000; i++) if (i % 100 < 25 || i % 100 >= 75 || i < 2500 || i >= 7500) transparent[i * 4 + 3] = 0;
check('already transparent neutral art survives', () => assert.equal(segmentAlpha(transparent, 100, 100)[5050], 255));
check('invisible RGB cannot introduce foreground', () => assert.equal(segmentAlpha(transparent, 100, 100)[0], 0));
const multipart = new Uint8ClampedArray(10000);
for (let y = 5; y < 55; y++) for (let x = 5; x < 55; x++) multipart[y * 100 + x] = 255;
for (let y = 70; y < 80; y++) for (let x = 70; x < 80; x++) multipart[y * 100 + x] = 255;
multipart[9090] = 255;
multipart[3054] = 200;
multipart[3055] = 64;
const cleaned = cleanComponents(multipart, 100, 100);
check('largest part survives', () => assert.equal(cleaned[3030], 255));
check('separate real part survives', () => assert.equal(cleaned[7575], 255));
check('isolated speckle removed', () => assert.equal(cleaned[9090], 0));
check('edge partial alpha survives', () => assert.equal(cleaned[3055], 64));
check('solid partial alpha is not flattened', () => assert.equal(cleaned[3054], 200));
check('fully translucent image stays valid', () => assert.deepEqual([...cleanComponents(new Uint8ClampedArray([70, 70]), 2, 1)], [70, 70]));
check('component routine does not mutate input', () => assert.equal(multipart[9090], 255));
check('center crop geometry', () => assert.deepEqual(cropToSquare(400, 200), { x: 100, y: 0, side: 200 }));
check('left crop reaches edge', () => assert.equal(cropToSquare(400, 200, { x: -1 }).x, 0));
check('right crop reaches edge', () => assert.equal(cropToSquare(400, 200, { x: 1 }).x, 200));
check('portrait bottom crop', () => assert.equal(cropToSquare(200, 400, { y: 1 }).y, 200));
check('zoom reduces selected area', () => assert.equal(cropToSquare(400, 200, { scale: 2 }).side, 100));
check('scale lower bound', () => assert.equal(cropToSquare(400, 200, { scale: 0 }).side, 200));
check('scale upper bound', () => assert.equal(cropToSquare(400, 200, { scale: 100 }).side, 25));
check('pan upper bound', () => assert.equal(cropToSquare(400, 200, { x: 100 }).x, 200));
check('pan lower bound', () => assert.equal(cropToSquare(400, 200, { x: -100 }).x, 0));
check('crop cannot leave original', () => {
  const r = cropToSquare(137, 83, { x: 0.7, y: -0.6, scale: 3 });
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.side <= 137 && r.y + r.side <= 83);
});
check('crop rejects invalid dimensions', () => assert.throws(() => cropToSquare(0, 10)));
check('Otsu deterministic first maximum', () => {
  const h = new Uint32Array(256); h[0] = 100; h[255] = 100;
  assert.equal(otsuThreshold(h), 0.5 / 256);
});
console.log(`iconPrep: ${pass}/${pass + fail} PASS, ${fail} FAIL`);
process.exitCode = fail ? 1 : 0;

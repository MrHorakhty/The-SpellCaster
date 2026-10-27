// Run the actual snapshot CLI against isolated AppData; never touch app data.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = mkdtempSync(join(tmpdir(), 'spellcaster-snapshot-check-'));
const identifier = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url))).identifier;
const uploads = join(root, 'appdata', identifier, 'uploads');
const snapshot = join(root, 'snapshot');
const state = `${snapshot}.state.json`;
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
const run = mode => spawnSync(process.execPath, [fileURLToPath(new URL('./e2e-snapshot.mjs', import.meta.url)), mode, snapshot], {
  env: { ...process.env, APPDATA: join(root, 'appdata') }, encoding: 'utf8',
});
const status = (mode, expected) => {
  const result = run(mode);
  assert.equal(result.status, expected, result.stdout + result.stderr);
};
const put = (name, bytes) => { mkdirSync(uploads, { recursive: true }); writeFileSync(join(uploads, name), bytes); };
try {
  check('absent uploads save successfully', () => status('save-uploads', 0));
  check('absent snapshot records absence', () => assert.equal(JSON.parse(readFileSync(state)).uploadsExisted, false));
  put('created-by-suite.wav', 'test bytes');
  check('absent uploads restore successfully', () => status('restore-uploads', 0));
  check('restore returns uploads to absence', () => assert.equal(existsSync(uploads), false));
  mkdirSync(uploads, { recursive: true });
  check('empty uploads save successfully', () => status('save-uploads', 0));
  put('created-by-suite.wav', 'test bytes');
  check('empty uploads restore successfully', () => status('restore-uploads', 0));
  check('empty directory remains present', () => assert.equal(existsSync(uploads), true));
  check('test files are removed after empty restore', () => assert.equal(existsSync(join(uploads, 'created-by-suite.wav')), false));
  put('user.wav', Buffer.from([0, 255, 1, 128]));
  check('nonempty uploads save successfully', () => status('save-uploads', 0));
  put('user.wav', 'changed'); put('new.wav', 'new');
  check('nonempty uploads restore successfully', () => status('restore-uploads', 0));
  check('user bytes are restored exactly', () => assert.deepEqual(readFileSync(join(uploads, 'user.wav')), Buffer.from([0, 255, 1, 128])));
  check('new test file is removed', () => assert.equal(existsSync(join(uploads, 'new.wav')), false));
  rmSync(state);
  check('legacy nonempty snapshot still restores', () => status('restore-uploads', 0));
  rmSync(snapshot, { recursive: true }); mkdirSync(snapshot);
  check('unmarked empty snapshot is refused', () => status('restore-uploads', 4));
  check('refusal preserves live user bytes', () => assert.equal(readFileSync(join(uploads, 'user.wav')).length, 4));
  writeFileSync(state, JSON.stringify({ version: 1, uploadsExisted: true, fileCount: 1 }));
  check('truncated snapshot is refused', () => status('restore-uploads', 4));
  writeFileSync(state, '{broken');
  check('corrupt metadata is refused', () => status('restore-uploads', 4));
  rmSync(snapshot, { recursive: true });
  check('missing snapshot is refused', () => status('restore-uploads', 4));
  check('all refusals preserve user bytes', () => assert.deepEqual(readFileSync(join(uploads, 'user.wav')), Buffer.from([0, 255, 1, 128])));
  console.log(`snapshotUploads: ${passed}/19 PASS, 0 FAIL`);
} finally {
  rmSync(root, { recursive: true, force: true });
}

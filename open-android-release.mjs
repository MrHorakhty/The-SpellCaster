import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function createReleaseSession({ root, baseTemp = tmpdir(), env = process.env }) {
  const directory = mkdtempSync(path.join(baseTemp, 'spellcaster-android-release-'));
  // Windows environment names are case-insensitive. Remove alternate spellings
  // too, rather than letting spawn choose between TEMP and an inherited Temp.
  const childEnv = Object.fromEntries(Object.entries(env)
    .filter(([key]) => !['TEMP', 'TMP', 'TMPDIR'].includes(key.toUpperCase())));
  childEnv.TEMP = directory;
  childEnv.TMP = directory;
  childEnv.TMPDIR = directory;
  const stamp = new Date().toLocaleString('sv-SE').replaceAll('-', '')
    .replace(' ', '-').replaceAll(':', '');
  const logs = path.join(root, 'logs');
  mkdirSync(logs, { recursive: true });
  return {
    directory,
    env: childEnv,
    logPath: path.join(logs, `android-release-${process.pid}-${path.basename(directory).slice(-6)}-${stamp}.log`),
  };
}

export async function launchReleaseSession(options) {
  const session = createReleaseSession(options);
  const capture = createWriteStream(session.logPath, { flags: 'wx' });
  await new Promise((resolve, reject) => {
    capture.once('open', resolve);
    capture.once('error', reject);
  });
  const notice = `Private Android release session: ${session.directory}\n`
    + `Build log: ${session.logPath}\n`
    + 'Keep this console open while building/signing in Studio.\n';
  process.stdout.write(notice);
  capture.write(notice);
  const child = spawn(process.execPath, [
    path.join(options.root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
    'android', 'build', '--open',
  ], { cwd: options.root, env: session.env, stdio: ['inherit', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { capture.write(chunk); process.stdout.write(chunk); });
  child.stderr.on('data', chunk => { capture.write(chunk); process.stderr.write(chunk); });
  child.once('error', error => {
    const message = `Could not start Tauri: ${error.message}\n`;
    capture.write(message);
    process.stderr.write(message);
  });
  const code = await new Promise(resolve => child.once('close', value => resolve(value ?? 1)));
  await new Promise((resolve, reject) => {
    capture.once('error', reject);
    capture.end(resolve);
  });
  // Studio may still be open after a CLI failure. Its inherited TEMP must remain
  // usable; do not delete the session directory out from under the IDE.
  return { ...session, code };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await launchReleaseSession({ root: path.dirname(fileURLToPath(import.meta.url)) });
    process.exitCode = result.code;
  } catch (error) {
    console.error(`Android release launcher failed: ${error.message}`);
    process.exitCode = 1;
  }
}

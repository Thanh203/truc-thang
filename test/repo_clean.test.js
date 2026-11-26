import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pii from '../scripts/check_no_pii.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = fileURLToPath(new URL('../scripts/check_no_pii.js', import.meta.url));

test('repo thật: không dữ liệu cá nhân, đường dẫn máy, file xlsx hay file dữ liệu; .gitignore và package.json đúng', async () => {
  assert.deepEqual(await pii.checkRepo(root), []);
});

test('trang thật: không gọi mạng ngoài, không eval, không innerHTML', async () => {
  assert.deepEqual(pii.checkPage(await readFile(join(root, 'truc_thang.html'), 'utf8')), []);
});

test('npm run check:pii chạy thật khi gọi trực tiếp và khi gọi qua đường dẫn symlink', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'truc-link-'));
  try {
    const link = join(dir, 'check_link.js');
    await symlink(script, link);
    for (const path of [script, link]) {
      const run = spawnSync(process.execPath, [path], { encoding: 'utf8' });
      assert.equal(run.status, 0, `${path}\n${run.stdout}${run.stderr}`);
      assert.match(run.stdout, /OK: repo sạch/, path);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

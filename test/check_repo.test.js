import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pii from '../scripts/check_no_pii.js';

const SCRIPT = fileURLToPath(new URL('../scripts/check_no_pii.js', import.meta.url));
const NS = ['http', '://schemas.openxmlformats.org/spreadsheetml/2006/main'].join('');
const GOOD_PAGE = `<!doctype html><html><body><script>const ns = '${NS}'; el.textContent = evaluate(x);</script></body></html>`;
const GOOD_IGNORE = 'node_modules/\nlocal/\n.claude/\n*.xlsx\n*.xls\n*.csv\n*.pdf\ntruc_thang_du_lieu*.json\n';
const PHONE = ['09', '12345678'].join('');
const PHONE_INTL = ['+84', ' 912 345 678'].join('');
const PHONE_LANDLINE = ['024', ' 3123 4567'].join('');
const PHONE_HYPHEN = ['090', '-123-4567'].join('');
const PHONE_PAREN = ['(024)', ' 3123 4567'].join('');
const HOME = ['/Us', 'ers/ai/Desktop'].join('');
const DRIVE = ['D', ':\\work\\x'].join('');

async function withRoot(files, fn) {
  const root = await mkdtemp(join(tmpdir(), 'truc-repo-'));
  try {
    const all = { '.gitignore': GOOD_IGNORE, 'package.json': '{"name":"x","type":"module"}', 'truc_thang.html': GOOD_PAGE, ...files };
    for (const [rel, content] of Object.entries(all)) {
      if (content === null) continue;
      await mkdir(dirname(join(root, rel)), { recursive: true });
      await writeFile(join(root, rel), content);
    }
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const check = (files, options) => withRoot(files, async (root) => (await pii.checkRepo(root, options)).join('\n'));

const runCli = (files, env = {}) => withRoot(files, async (root) => {
  await mkdir(join(root, 'scripts'), { recursive: true });
  await copyFile(SCRIPT, join(root, 'scripts', 'check_no_pii.js'));
  const run = spawnSync(process.execPath, [join(root, 'scripts', 'check_no_pii.js')], { encoding: 'utf8', env: { ...process.env, CI: '', ...env } });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
});

test('repo sạch không có vấn đề; thư mục local bị bỏ qua', async () => {
  assert.equal(await check({}), '');
  assert.equal(await check({ 'local/ghi_chu.txt': `${PHONE} ${HOME}`, 'local/du_lieu.xlsx': 'x' }), '');
});

test('thư mục .claude (nhật ký và trạng thái của công cụ) bị bỏ qua khi quét trên máy phát triển', async () => {
  assert.equal(await check({ '.claude/drk/audit.jsonl': '{"hook":"guard-git","outcome":"ask"}\n' }), '');
});

test('file không được vào repo: xlsx ở mọi chỗ (khuôn mẫu cũ cũng không còn ngoại lệ), file dữ liệu người dùng', async () => {
  const out = await check({ 'docs/bao_cao.xlsx': 'x', 'docs/BIEN_BAN.XLSX': 'x', 'site/template/truc.xlsx': 'x', 'truc_thang_du_lieu_9.json': '{}' });
  assert.match(out, /docs\/bao_cao\.xlsx: file xlsx không được đưa vào repo/);
  assert.match(out, /docs\/BIEN_BAN\.XLSX: file xlsx không được đưa vào repo/);
  assert.match(out, /site\/template\/truc\.xlsx: file xlsx không được đưa vào repo/);
  assert.match(out, /truc_thang_du_lieu_9\.json: file dữ liệu người dùng/);
});

test('chỉ cho phép loại file văn bản: xls, csv, pdf, ảnh bị báo; đuôi viết hoa vẫn được quét; LICENSE và .DS_Store không bị báo', async () => {
  const out = await check({
    'docs/a.xls': 'x', 'docs/b.csv': 'x', 'docs/c.pdf': 'x', 'docs/d.PNG': 'x', 'docs/e.TXT': `gọi ${PHONE}`, LICENSE: 'MIT', '.DS_Store': 'x', 'docs/.DS_Store': 'x',
  });
  for (const name of ['a\\.xls', 'b\\.csv', 'c\\.pdf', 'd\\.PNG']) {
    assert.match(out, new RegExp(`docs/${name}: loại file này không được đưa vào repo`));
  }
  assert.match(out, /docs\/e\.TXT: có chuỗi giống số điện thoại/);
  assert.ok(!/^LICENSE:/m.test(out) && !out.includes('DS_Store'), out);
});

test('file json có dạng dữ liệu người dùng bị báo dù đã đổi tên', async () => {
  const out = await check({ 'docs/thang_9.json': '{"schemaVersion":1,"months":{}}', 'docs/ok.json': '{"name":"x"}' });
  assert.match(out, /docs\/thang_9\.json: giống file dữ liệu người dùng/);
  assert.ok(!out.includes('docs/ok.json'), out);
});

test('số điện thoại Việt Nam và đường dẫn máy bị báo trong mọi file văn bản', async () => {
  const out = await check({
    'docs/a.md': `gọi ${PHONE}`, 'docs/b.md': `gọi ${PHONE_INTL}`, 'scripts/c.js': `const p = '${HOME}';`, 'docs/f.md': `mở ${DRIVE}`,
  });
  assert.match(out, /docs\/a\.md: có chuỗi giống số điện thoại/);
  assert.match(out, /docs\/b\.md: có chuỗi giống số điện thoại/);
  assert.match(out, /scripts\/c\.js: có đường dẫn tuyệt đối của máy/);
  assert.match(out, /docs\/f\.md: có đường dẫn tuyệt đối của máy/);
  assert.equal(await check({ 'docs/d.md': 'giờ 2026/10/14, hằng số 4294967296, tiền 150000', 'scripts/g.js': "console.error('lỗi:\\n');" }), '');
});

test('số điện thoại bàn 11 chữ số, có gạch ngang hoặc ngoặc đều bị báo', async () => {
  const out = await check({ 'docs/h.md': `bàn ${PHONE_LANDLINE}`, 'docs/i.md': `di động ${PHONE_HYPHEN}`, 'docs/j.md': `bàn ${PHONE_PAREN}` });
  for (const name of ['h', 'i', 'j']) assert.match(out, new RegExp(`docs/${name}\\.md: có chuỗi giống số điện thoại`));
});

test('danh sách chặn: bắt tên người ở mọi file kể cả chữ có dấu kiểu tổ hợp, không in tên', async () => {
  const out = await check({ 'docs/e.md': 'Gửi Nguyễn Văn Test ký', 'docs/g.md': 'Gửi Nguyễn Văn Test ký'.normalize('NFD') }, { denyTerms: ['Nguyễn Văn Test'] });
  assert.match(out, /docs\/e\.md: còn thuật ngữ #1/);
  assert.match(out, /docs\/g\.md: còn thuật ngữ #1/);
  assert.ok(!out.includes('Nguyễn Văn Test'));
});

test('truc_thang.html: lỗi của trang được báo kèm tên file, file khác được có địa chỉ mạng', async () => {
  const out = await check({ 'truc_thang.html': `${GOOD_PAGE}<script>fetch('x'); el.innerHTML = v;</script>` });
  assert.match(out, /truc_thang\.html: có lệnh gọi mạng/);
  assert.match(out, /truc_thang\.html: dùng API chèn HTML hoặc eval/);
  assert.equal(await check({ 'docs/a.md': 'xem https://example.org/x' }), '');
});

test('cấu trúc: .gitignore thiếu dòng, package.json có dependency, thiếu truc_thang.html', async () => {
  for (const rule of ['local/', '.claude/', '*.xlsx', '*.xls', '*.csv', '*.pdf', 'truc_thang_du_lieu*.json']) {
    const out = await check({ '.gitignore': GOOD_IGNORE.replace(`${rule}\n`, '') });
    assert.ok(out.includes(`.gitignore thiếu dòng ${rule}`), out);
  }
  assert.match(await check({ 'package.json': '{"dependencies":{"x":"1.0.0"}}' }), /package\.json có dependencies/);
  assert.equal(await check({ 'package.json': '{"dependencies":{}}' }), '');
  assert.match(await check({ 'package.json': null }), /package\.json thiếu hoặc không phải JSON/);
  assert.match(await check({ 'truc_thang.html': null }), /thiếu truc_thang\.html/);
});

test('chế độ CI: thư mục local, tasks và .claude có trong checkout bị báo', async () => {
  const out = await check({ 'local/pii_terms.txt': 'x', 'tasks/todo.md': 'x', '.claude/drk/audit.jsonl': '{}' }, { ci: true });
  assert.match(out, /local\/: thư mục này không được có trong repo/);
  assert.match(out, /tasks\/: thư mục này không được có trong repo/);
  assert.match(out, /\.claude\/: thư mục này không được có trong repo/);
  assert.equal(await check({}, { ci: true }), '');
});

test('chạy bằng dòng lệnh: sạch thì thoát 0 và nạp danh sách chặn, có lỗi thì thoát 1 và không in thuật ngữ chặn', async () => {
  const clean = await runCli({ 'local/pii_terms.txt': 'Nguyễn Văn Test\n' });
  assert.equal(clean.status, 0, clean.out);
  assert.match(clean.out, /OK: repo sạch \(1 thuật ngữ chặn đã dùng\)/);
  const bad = await runCli({ 'local/pii_terms.txt': 'Nguyễn Văn Test\n', 'docs/e.md': 'Gửi Nguyễn Văn Test ký' });
  assert.equal(bad.status, 1, bad.out);
  assert.match(bad.out, /VẤN ĐỀ: docs\/e\.md: còn thuật ngữ #1/);
  assert.ok(!bad.out.includes('Nguyễn Văn Test'));
});

test('chạy bằng dòng lệnh trên CI: thư mục local trong checkout là lỗi dù mọi file đều sạch', async () => {
  const run = await runCli({ 'local/pii_terms.txt': 'Nguyễn Văn Test\n' }, { CI: 'true' });
  assert.equal(run.status, 1, run.out);
  assert.match(run.out, /VẤN ĐỀ: local\/: thư mục này không được có trong repo/);
});

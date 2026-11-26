import { realpathSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE = 'truc_thang.html';
const PATH = /\/Users\/|\/home\/|(?<![\p{L}\p{N}])[A-Za-z]:\\/u;
const VN_PHONE = /(?<![\d.])(?:\+84|84|0)(?:[ .\-()]{0,2}\d){9,10}(?!\d)/;
const URL_TEXT = /https?:\/\/[^\s"'<>)\\]*/g;
const ALLOWED_URL = 'http://schemas.openxmlformats.org/';
const PAGE_RULES = [
  [/\b(?:src|href|action)\s*=\s*["']?\/\/|url\(\s*["']?\/\/|@import\s+["']?\/\//, 'có đường dẫn mạng bắt đầu bằng //'],
  [/(?<![\p{L}\p{N}_$])(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)(?![\p{L}\p{N}_$])/u, 'có lệnh gọi mạng'],
  [/\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval)\b|document\.write|new Function/, 'dùng API chèn HTML hoặc eval'],
];
const TEXT_FILE = /\.(js|mjs|json|md|html|css|yml|yaml|txt)$/i;
const TEXT_NAME = /(^|\/)(\.gitignore|LICENSE)$/;
const SKIP_FILE = /(^|\/)\.DS_Store$/;
const ALLOWED_TYPES = 'js, mjs, json, md, html, css, yml, yaml, txt, LICENSE';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'local', '.claude']);
const CI_BANNED_DIRS = ['local', 'tasks', '.claude'];
const REQUIRED_IGNORE = ['local/', '.claude/', '*.xlsx', '*.xls', '*.csv', '*.pdf', 'truc_thang_du_lieu*.json'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const isDir = (path) => stat(path).then((s) => s.isDirectory(), () => false);

export function denyRegexes(terms) {
  return terms
    .map((t) => t.normalize('NFC').trim())
    .filter((t) => t.length >= 4)
    .map((t) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(t)}(?![\\p{L}\\p{N}])`, 'iu'));
}

export function checkPage(html) {
  const problems = [];
  const external = [...html.matchAll(URL_TEXT)].find((m) => !m[0].startsWith(ALLOWED_URL));
  if (external) problems.push(`có địa chỉ mạng ngoài (dòng ${lineOf(html, external.index)}), chỉ cho phép chuỗi namespace của xlsx`);
  for (const [re, message] of PAGE_RULES) {
    const m = re.exec(html);
    if (m) problems.push(`${message} (dòng ${lineOf(html, m.index)})`);
  }
  return problems;
}

async function* walk(dir, root) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full, root);
    } else if (entry.isFile()) {
      yield { full, rel: relative(root, full).split(sep).join('/') };
    }
  }
}

async function checkStructure(root) {
  const problems = [];
  const read = (rel) => readFile(join(root, rel), 'utf8').catch(() => null);
  const rules = ((await read('.gitignore')) ?? '').split(/\r?\n/);
  for (const rule of REQUIRED_IGNORE) if (!rules.includes(rule)) problems.push(`.gitignore thiếu dòng ${rule}`);
  try {
    const json = JSON.parse((await read('package.json')) ?? '');
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      if (json[key] && Object.keys(json[key]).length > 0) problems.push(`package.json có ${key}: repo không được có dependency`);
    }
  } catch {
    problems.push('package.json thiếu hoặc không phải JSON');
  }
  if ((await read(PAGE)) === null) problems.push(`thiếu ${PAGE}`);
  return problems;
}

export async function checkRepo(root, { denyTerms = [], ci = false } = {}) {
  const problems = [];
  const deny = denyRegexes(denyTerms);
  for await (const { full, rel } of walk(root, root)) {
    if (SKIP_FILE.test(rel)) continue;
    if (/\.xlsx$/i.test(rel)) {
      problems.push(`${rel}: file xlsx không được đưa vào repo`);
      continue;
    }
    if (/(^|\/)truc_thang_du_lieu[^/]*\.json$/.test(rel)) problems.push(`${rel}: file dữ liệu người dùng không được đưa vào repo`);
    if (!TEXT_FILE.test(rel) && !TEXT_NAME.test(rel)) {
      problems.push(`${rel}: loại file này không được đưa vào repo (chỉ cho phép ${ALLOWED_TYPES})`);
      continue;
    }
    const text = (await readFile(full, 'utf8')).normalize('NFC');
    if (PATH.test(text)) problems.push(`${rel}: có đường dẫn tuyệt đối của máy`);
    if (VN_PHONE.test(text)) problems.push(`${rel}: có chuỗi giống số điện thoại`);
    deny.forEach((re, i) => {
      if (re.test(text)) problems.push(`${rel}: còn thuật ngữ #${i + 1} của danh sách chặn`);
    });
    if (/\.json$/i.test(rel) && /"schemaVersion"/.test(text) && /"months"/.test(text)) {
      problems.push(`${rel}: giống file dữ liệu người dùng (có schemaVersion và months)`);
    }
    if (rel === PAGE) problems.push(...checkPage(text).map((p) => `${rel}: ${p}`));
  }
  if (ci) {
    for (const dir of CI_BANNED_DIRS) if (await isDir(join(root, dir))) problems.push(`${dir}/: thư mục này không được có trong repo`);
  }
  problems.push(...(await checkStructure(root)));
  return problems;
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  let terms = [];
  try {
    terms = (await readFile(join(root, 'local', 'pii_terms.txt'), 'utf8')).split('\n').filter(Boolean);
  } catch {
    console.log('Không có local/pii_terms.txt: bỏ qua danh sách chặn (bình thường trên CI).');
  }
  const problems = await checkRepo(root, { denyTerms: terms, ci: Boolean(process.env.CI) });
  if (problems.length) {
    for (const p of problems) console.error(`VẤN ĐỀ: ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: repo sạch (${terms.length} thuật ngữ chặn đã dùng).`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

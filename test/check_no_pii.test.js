import test from 'node:test';
import assert from 'node:assert/strict';
import * as pii from '../scripts/check_no_pii.js';

const NS = ['http', '://schemas.openxmlformats.org/spreadsheetml/2006/main'].join('');
const page = (code) => `<!doctype html>\n<html><body>\n<script>\n${code}\n</script>\n</body></html>`;
const problems = (code) => pii.checkPage(page(code)).join('\n');

test('danh sách chặn: bỏ thuật ngữ ngắn, khớp nguyên từ không phân biệt hoa thường và kiểu dấu', () => {
  const [re, ...rest] = pii.denyRegexes(['Nguyễn Văn Test', 'ab']);
  assert.equal(rest.length, 0);
  assert.ok(re.test('Gửi nguyễn văn test ký'.normalize('NFC')));
  assert.ok(!re.test('Nguyễn Văn Testing'));
  const [fromNfd] = pii.denyRegexes(['Nguyễn Văn Test'.normalize('NFD')]);
  assert.ok(fromNfd.test('Nguyễn Văn Test'.normalize('NFC')));
});

test('trang sạch: namespace xlsx, textContent và tên giống từ khóa đều được', () => {
  const code = `const ns = '${NS}'; el.textContent = evaluate(x); const prefetched = 1, refetch = 2;`;
  assert.deepEqual(pii.checkPage(page(code)), []);
});

test('trang: địa chỉ mạng ngoài bị báo, cả tên miền chỉ bắt đầu giống namespace xlsx', () => {
  assert.match(problems("const u = 'https://example.org/x';"), /địa chỉ mạng ngoài/);
  assert.match(problems("const u = 'http://schemas.openxmlformats.org.example.net/x';"), /địa chỉ mạng ngoài/);
});

test('trang: lệnh gọi mạng bị báo kèm số dòng', () => {
  assert.match(problems("fetch('x');"), /lệnh gọi mạng \(dòng 4\)/);
  for (const code of ['new XMLHttpRequest();', "new WebSocket('x');", "new EventSource('x');", "navigator.sendBeacon('x');", "importScripts('x');"]) {
    assert.match(problems(code), /lệnh gọi mạng/, code);
  }
});

test('trang: đường dẫn bắt đầu bằng // trong src, href, url bị báo', () => {
  for (const code of ['<img src="//cdn.example.org/a.png">', "<link href='//cdn.example.org/a.css'>", 'a { background: url(//cdn.example.org/a.png); }']) {
    assert.match(problems(code), /bắt đầu bằng \/\//, code);
  }
});

test('trang: API chèn HTML, eval, new Function, document.write bị báo', () => {
  for (const code of ['el.innerHTML = v;', 'el.outerHTML = v;', "el.insertAdjacentHTML('beforeend', v);", 'eval(code);', "new Function('return 1');", "document.write('x');"]) {
    assert.match(problems(code), /chèn HTML hoặc eval/, code);
  }
});

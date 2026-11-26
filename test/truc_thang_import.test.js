import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crc32, deflateRawSync } from 'node:zlib';

const html = readFileSync(new URL('../truc_thang.html', import.meta.url), 'utf8');
const block = /<script id="cong-thuc">([\s\S]*?)<\/script>/.exec(html);
assert.ok(block, 'thiếu khối <script id="cong-thuc"> trong truc_thang.html');
const TT = new Function(`${block[1]}\nreturn TT;`)();

const enc = new TextEncoder();

// ---- dựng file xlsx thử bằng tay (kiểu Excel: chuỗi dùng chung, công thức kèm kết quả đã lưu, có nén) ----

function zipOf(files, { deflate = false } = {}) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const data = file.data ?? enc.encode(file.text);
    const declared = file.declaredSize ?? data.length;
    const method = file.method ?? (deflate ? 8 : 0);
    const nameBytes = enc.encode(file.name);
    const packed = method === 8 ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(declared, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, Buffer.from(nameBytes), Buffer.from(packed));
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(declared, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, Buffer.from(nameBytes));
    offset += 30 + nameBytes.length + packed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, centralBuf, end]));
}

const colLetters = (n) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};
const colNo = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NS_MAIN = ['http', '://schemas.openxmlformats.org/spreadsheetml/2006/main'].join('');
const NS_REL = ['http', '://schemas.openxmlformats.org/officeDocument/2006/relationships'].join('');

// giá trị ô: số, chuỗi, mảng chuỗi (chữ định dạng nhiều đoạn), null (ô trống có định dạng), { f, v } (công thức và kết quả đã lưu)
function excelBook(sheets, options = {}) {
  const shared = [];
  const sharedIndex = (value) => {
    const key = JSON.stringify(value);
    const i = shared.findIndex((x) => JSON.stringify(x) === key);
    return i >= 0 ? i : shared.push(value) - 1;
  };
  const sheetXml = (cells) => {
    const rows = new Map();
    for (const [ref, val] of Object.entries(cells)) {
      if (val === undefined) continue;
      const m = /^([A-Z]+)(\d+)$/.exec(ref);
      const r = Number(m[2]);
      if (!rows.has(r)) rows.set(r, []);
      let xml;
      if (val === null) xml = `<c r="${ref}" s="3"/>`;
      else if (typeof val === 'number') xml = `<c r="${ref}"><v>${val}</v></c>`;
      else if (typeof val === 'string' || Array.isArray(val)) xml = `<c r="${ref}" t="s"><v>${sharedIndex(val)}</v></c>`;
      else if (typeof val.v === 'number') xml = `<c r="${ref}"><f>${xesc(val.f)}</f><v>${val.v}</v></c>`;
      else xml = `<c r="${ref}" t="str"><f>${xesc(val.f)}</f><v>${xesc(val.v)}</v></c>`;
      rows.get(r).push({ c: colNo(m[1]), xml });
    }
    const body = [...rows.keys()].sort((a, b) => a - b)
      .map((r) => `<row r="${r}">${rows.get(r).sort((a, b) => a.c - b.c).map((x) => x.xml).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS_MAIN}"><cols><col min="1" max="1" width="9"/></cols><sheetData>${body}</sheetData></worksheet>`;
  };
  const sheetXmls = sheets.map((s) => sheetXml(s.cells));
  const si = (value) => (Array.isArray(value)
    ? `<si>${value.map((t) => `<r><rPr><b/></rPr><t xml:space="preserve">${xesc(t)}</t></r>`).join('')}<rPh sb="0" eb="1"><t>ngu</t></rPh></si>`
    : `<si><t xml:space="preserve">${xesc(value)}</t></si>`);
  const files = [
    { name: 'xl/workbook.xml', text: `<?xml version="1.0"?><workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>${sheets.map((s, i) => `<sheet name="${xesc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: `<?xml version="1.0"?><Relationships xmlns="x">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="w" Target="/xl/worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>` },
    { name: 'xl/sharedStrings.xml', text: `<?xml version="1.0"?><sst xmlns="${NS_MAIN}" count="${shared.length}" uniqueCount="${shared.length}">${shared.map(si).join('')}</sst>` },
    ...sheetXmls.map((text, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text })),
  ];
  return zipOf(files, options);
}

// ---- dữ liệu thử: tháng 11 năm 2026 (ngày 1 là chủ nhật), toàn tên giả ----

function dataRow(r, stt, name, title, days, counts) {
  const cells = { [`A${r}`]: stt, [`C${r}`]: name, [`D${r}`]: title };
  for (const d of days) cells[`${colLetters(4 + d)}${r}`] = 'T';
  if (counts) {
    cells[`AJ${r}`] = { f: `COUNTA(E${r}:AI${r})`, v: days.length };
    cells[`AK${r}`] = { f: `COUNTIF(E${r}:AI${r},"T")`, v: counts[0] };
    cells[`AL${r}`] = { f: `COUNTIF(E${r}:AI${r},"N")`, v: counts[1] };
    cells[`AM${r}`] = { f: `COUNTIF(E${r}:AI${r},"L")`, v: counts[2] };
  }
  return cells;
}

function timesheetCells() {
  return {
    C1: 'BỆNH VIỆN THỬ & CỘNG SỰ',
    R1: 'BẢNG CHẤM CÔNG TRỰC',
    C2: 'KHOA / PHÒNG:',
    D2: { f: 'tổng!$D$2', v: 'KHOA <THỬ>' },
    T2: 'Tháng',
    W2: 11,
    Y2: 'năm',
    AB2: { f: 'tổng!AB2', v: 2026 },
    A4: 'Số TT',
    C4: 'Họ và tên',
    D4: 'Mã',
    E4: 'Ngày trong tháng',
    A7: 'A',
    C7: 'B',
    D7: 'C',
    ...dataRow(8, 1, 'Đặc Một', 'BS', [3, 4], [2, 0, 0]),
    ...dataRow(9, 2, 'Thường Một', 'ĐD', [1, 2, 24, 31], [1, 1, 1]),
    ...dataRow(10, 3, 'Thường Hai', 'BS', [], [0, 0, 0]),
    ...dataRow(11, 4, 'Ngoài Một', 'BS', [10], [1, 0, 0]),
    ...dataRow(12, 5, 'Lạ Hoắc', 'BS', [5], [1, 0, 0]),
    ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`C${13 + i}`, null])),
    C27: 'TỔNG CỘNG:',
    C28: 'Ghi chú ngoài bảng',
  };
}

function paySheetCells({ hospital, dept, offset = 0, names, base, nghi, le, meal }) {
  const h = 7 + offset;
  const cells = {
    B1: hospital,
    B2: 'KHOA / PHÒNG:',
    C2: dept,
    A4: 'BẢNG THANH TOÁN TIỀN TRỰC',
    [`A${h}`]: 'STT',
    [`B${h}`]: 'Họ và tên',
    [`C${h}`]: 'Chức danh',
    [`D${h}`]: 'Làm việc ngày Thường',
    [`L${h}`]: meal,
    [`D${h + 1}`]: base,
    [`F${h + 1}`]: { f: `D${h + 1}*1.5`, v: nghi },
    [`H${h + 1}`]: { f: `D${h + 1}*2`, v: le },
  };
  names.forEach((name, i) => {
    const r = h + 3 + i;
    cells[`A${r}`] = { f: 'IFERROR(VLOOKUP(1,x,1,0),"")', v: i + 1 };
    cells[`B${r}`] = { f: 'IF(A10="","",VLOOKUP(A10,x,3,0))', v: name };
  });
  cells[`A${h + 3 + 14}`] = 'Tổng cộng:';
  return cells;
}

// sheet tổng (sheet nhập liệu của file gốc): người của cả ba nhóm kể cả người không trực, chữ T, N, L gõ tay trong ô ngày
function tongRow(r, name, title, marks = {}) {
  const cells = { [`C${r}`]: name, [`D${r}`]: title, [`AJ${r}`]: { f: `COUNTA(E${r}:AI${r})`, v: Object.keys(marks).length } };
  for (const [day, letter] of Object.entries(marks)) cells[`${colLetters(4 + Number(day))}${r}`] = letter;
  return cells;
}

function tongCells(overrides = {}) {
  return {
    C1: 'BỆNH VIỆN TỔNG',
    I1: 'BẢNG CHẤM CÔNG TRỰC',
    C2: 'KHOA / PHÒNG:',
    D2: 'KHOA TỔNG',
    T2: 'Tháng',
    W2: 11,
    Y2: 'năm',
    AB2: { f: 'AB1', v: 2026 },
    A4: 'Số TT',
    C4: 'Họ và tên',
    D4: 'Mã',
    E4: 'Ngày trong tháng',
    A7: 'A',
    C7: 'B',
    D7: 'C',
    C8: 'Trực đặc biệt',
    ...tongRow(9, 'Đặc Một', 'BS', { 3: 'T', 4: 'T' }),
    ...tongRow(10, 'Đặc Hai', 'BS'),
    A11: 3,
    A12: 4,
    C13: 'Trực thường',
    ...tongRow(14, 'Thường Một', 'ĐD', { 1: 'N', 2: 'T', 24: 'L', 31: 'T' }),
    ...tongRow(15, 'Thường Hai', 'BS'),
    ...tongRow(16, 'Thường Ba', 'BS', { 7: 't' }),
    C18: 'Trực ngoài BV',
    ...tongRow(19, 'Ngoài Một', 'BS', { 10: 'T' }),
    A20: 'HĐ',
    A21: 'HĐ',
    C22: 'TỔNG CỘNG:',
    C23: 'Ghi chú ngoài bảng',
    ...overrides,
  };
}

const RATES = {
  thuong: { donGia: 100000, tienAn: 20000, heSoNghi: 1.5, heSoLe: 2 },
  dacBiet: { donGia: 50000, tienAn: 10000, heSoNghi: 1.3, heSoLe: 1.8 },
  ngoaiBV: { donGia: 80000, tienAn: 5000, heSoNghi: 1.2, heSoLe: 2.5 },
};

function fakeSheets({ drop = [] } = {}) {
  const hospital = 'BỆNH VIỆN THỬ & CỘNG SỰ';
  const dept = 'KHOA <THỬ>';
  const all = [
    { name: 'T12', hidden: true, cells: { A1: 'rác', B2: 12345 } },
    { name: 'bảng chấm công in (122020)', cells: { C1: 'bản cũ', W2: 12 } },
    { name: 'bảng chấm công in', cells: timesheetCells() },
    { name: 'Trực thường', cells: paySheetCells({ hospital, dept, names: ['Thường Một', 'Thường Hai'], base: 100000, nghi: 150000, le: 200000, meal: 20000 }) },
    { name: 'Trực ĐB', cells: paySheetCells({ hospital, dept, names: ['Đặc Một'], base: 50000, nghi: 65000, le: 90000, meal: 10000 }) },
    { name: 'Bảng ngoài viện', cells: paySheetCells({ hospital, dept, offset: 1, names: ['Ngoài Một'], base: 80000, nghi: 96000, le: 200000, meal: 5000 }) },
    { name: 'Ẩn bảng ngoài viện', hidden: true, cells: paySheetCells({ hospital, dept, names: ['Người Khác'], base: 1, nghi: 2, le: 3, meal: 4 }) },
  ];
  return all.filter((s) => !drop.includes(s.name));
}

function sheetsWithTong({ drop = [], tong = {} } = {}) {
  const sheets = fakeSheets({ drop });
  sheets.splice(2, 0, { name: 'tổng', cells: tongCells(tong) });
  return sheets;
}

const names = (list) => list.map(({ name, title, days }) => ({ name, title, days }));

// ---- dữ liệu thử cho đường vòng: trang tự xuất xlsx rồi tự đọc lại ----

const person = (name, days, title, id) => ({ id, name, title, days });
function exportedBytes() {
  const settings = { hospital: 'Bệnh viện thử', department: 'Khoa thử', holidays: [{ date: '2026-11-24', name: 'Lễ thử', confirmed: true }] };
  const monthData = {
    signDate: null,
    rates: structuredClone(RATES),
    groups: {
      dacBiet: [person('Đặc Một', [3, 4], 'BS', 'db1'), person('Đặc Hai', [], 'BS', 'db2')],
      thuong: [person('Thường Một', [1, 2, 24], 'ĐD', 'th1'), person('Thường Hai', [], 'BS', 'th2')],
      ngoaiBV: [person('Ngoài Một', [10], 'BS', 'nb1')],
    },
  };
  const days = TT.monthDays(2026, 11, new Set(['2026-11-24']));
  return TT.xlsxBytes(TT.buildSheets({ year: 2026, month: 11, monthData, settings, days, forms: TT.SIGN_FORMS }));
}

// ---------------------------------------------------------------------------------------------

test('readXlsx: đọc file do chính trang xuất ra (chuỗi nằm trong ô, không nén)', async () => {
  const book = await TT.readXlsx(exportedBytes(), ['Trực thường']);
  assert.deepEqual(book.sheetNames, ['tổng', 'bảng chấm công in', 'Trực thường', 'Trực ĐB', 'BS Một', 'bảng chấm công in (122020)']);
  const sheet = book.sheets.get('trực thường');
  assert.equal(sheet.cells.get('10,2'), 'Thường Một');
  assert.equal(sheet.cells.get('8,4'), 100000);
});

for (const deflate of [false, true]) {
  test(`readXlsx: file kiểu Excel (chuỗi dùng chung, công thức kèm kết quả, đường dẫn tuyệt đối, ${deflate ? 'có nén' : 'không nén'})`, async () => {
    const bytes = excelBook([
      { name: 'Một', cells: { A1: 'Tên &amp; <b>', B1: ['Chữ', ' đậm'], C1: { f: 'x', v: 'kết quả' }, D1: { f: 'y', v: 42 }, E1: 3.5, F1: null, G1: 'Tên_x0041_' } },
      { name: 'Hai', hidden: true, cells: { A1: 'ẩn' } },
    ], { deflate });
    const book = await TT.readXlsx(bytes, ['một', 'HAI']);
    assert.deepEqual(book.sheetNames, ['Một', 'Hai']);
    const one = book.sheets.get('một').cells;
    assert.equal(one.get('1,1'), 'Tên &amp; <b>');
    assert.equal(one.get('1,2'), 'Chữ đậm');
    assert.equal(one.get('1,3'), 'kết quả');
    assert.equal(one.get('1,4'), 42);
    assert.equal(one.get('1,5'), 3.5);
    assert.equal(one.has('1,6'), false);
    assert.equal(one.get('1,7'), 'TênA');
    assert.equal(book.sheets.get('hai').cells.get('1,1'), 'ẩn');
  });
}

test('readXlsx: chỉ đọc các sheet được yêu cầu', async () => {
  const book = await TT.readXlsx(excelBook([{ name: 'Một', cells: { A1: 1 } }, { name: 'Hai', cells: { A1: 2 } }]), ['Hai']);
  assert.deepEqual([...book.sheets.keys()], ['hai']);
});

test('readXlsx: không phải zip, zip bị cắt cụt, rỗng đều báo lỗi rõ', async () => {
  await assert.rejects(() => TT.readXlsx(enc.encode('đây là chữ, không phải xlsx, dài hơn hai mươi hai byte'), []), /không đọc được gói zip/);
  await assert.rejects(() => TT.readXlsx(new Uint8Array(0), []), /không đọc được gói zip/);
  const good = excelBook([{ name: 'Một', cells: { A1: 1 } }]);
  await assert.rejects(() => TT.readXlsx(good.slice(0, good.length - 10), []), /không đọc được gói zip/);
});

test('readXlsx: gói zip hợp lệ nhưng không có workbook thì báo thiếu xl/workbook.xml', async () => {
  await assert.rejects(() => TT.readXlsx(zipOf([{ name: 'a.txt', text: 'x' }]), []), /thiếu xl\/workbook\.xml/);
});

test('readXlsx: phần nén quá lớn khi giải nén bị chặn (zip bom)', async () => {
  const bomb = zipOf([
    { name: 'xl/workbook.xml', text: `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.alloc(70 * 1024 * 1024, 0x20), method: 8 },
  ]);
  await assert.rejects(() => TT.readXlsx(bomb, ['A']), /quá lớn/);
});

function bombZip(file) {
  return zipOf([
    { name: 'xl/workbook.xml', text: `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', method: 8, ...file },
  ]);
}

test('readXlsx: khai báo kích thước giải nén quá lớn thì chặn ngay, không cần giải nén', async () => {
  const zip = bombZip({ data: enc.encode('<worksheet/>'), declaredSize: 80 * 1024 * 1024 });
  await assert.rejects(() => TT.readXlsx(zip, ['A']), /quá lớn/);
});

test('readXlsx: khai báo nhỏ nhưng thực tế phình ra quá lớn thì bị chặn trong lúc giải nén', async () => {
  const zip = bombZip({ data: Buffer.alloc(70 * 1024 * 1024, 0x20), declaredSize: 1000 });
  await assert.rejects(() => TT.readXlsx(zip, ['A']), /quá lớn/);
});

test('importXlsx: đường vòng, đọc lại đúng file trang vừa xuất (người, ngày trực, đơn giá, bệnh viện, khoa, tháng)', async () => {
  const got = await TT.importXlsx(exportedBytes());
  assert.equal(got.source, 'tong');
  assert.deepEqual(got.holidays, ['2026-11-24']);
  assert.deepEqual([got.year, got.month, got.hospital, got.department], [2026, 11, 'Bệnh viện thử', 'Khoa thử']);
  assert.deepEqual(names(got.groups.dacBiet), [{ name: 'Đặc Một', title: 'BS', days: [3, 4] }, { name: 'Đặc Hai', title: 'BS', days: [] }]);
  assert.deepEqual(names(got.groups.thuong), [{ name: 'Thường Một', title: 'ĐD', days: [1, 2, 24] }, { name: 'Thường Hai', title: 'BS', days: [] }]);
  assert.deepEqual(names(got.groups.ngoaiBV), [{ name: 'Ngoài Một', title: 'BS', days: [10] }]);
  assert.deepEqual(got.rates, RATES);
  assert.deepEqual(got.groups.thuong[0].counts, { T: 1, N: 1, L: 1 });
  assert.deepEqual(got.notes, []);
});

test('importXlsx: file kiểu Excel gốc, xếp nhóm theo bảng thanh toán, sheet ngoài BV tên khác và lệch một dòng, bỏ qua sheet ẩn và sheet bản cũ', async () => {
  const got = await TT.importXlsx(excelBook(fakeSheets(), { deflate: true }));
  assert.deepEqual([got.year, got.month, got.hospital, got.department], [2026, 11, 'BỆNH VIỆN THỬ & CỘNG SỰ', 'KHOA <THỬ>']);
  assert.deepEqual(names(got.groups.dacBiet), [{ name: 'Đặc Một', title: 'BS', days: [3, 4] }]);
  assert.deepEqual(names(got.groups.thuong), [
    { name: 'Thường Một', title: 'ĐD', days: [1, 2, 24] },
    { name: 'Thường Hai', title: 'BS', days: [] },
    { name: 'Lạ Hoắc', title: 'BS', days: [5] },
  ]);
  assert.deepEqual(names(got.groups.ngoaiBV), [{ name: 'Ngoài Một', title: 'BS', days: [10] }]);
  assert.deepEqual(got.rates, RATES);
  assert.deepEqual(got.groups.thuong[0].counts, { T: 1, N: 1, L: 1 });
});

test('importXlsx: ghi chú cho người không có trong bảng thanh toán nào và ô ngày nằm ngoài tháng', async () => {
  const got = await TT.importXlsx(excelBook(fakeSheets()));
  assert.equal(got.notes.length, 2, got.notes.join(' | '));
  assert.match(got.notes[0], /1 dòng ở bảng chấm công in không có trong bảng thanh toán nào, đã xếp vào Trực thường/);
  assert.match(got.notes[1], /1 ô ngày nằm ngoài tháng 11, đã bỏ qua/);
});

test('importXlsx: cùng một tên có ở hai nhóm thì dòng đầu về nhóm đặc biệt, dòng sau về nhóm thường', async () => {
  const sheets = fakeSheets();
  const ts = sheets.find((s) => s.name === 'bảng chấm công in').cells;
  delete ts.I12;
  Object.assign(ts, dataRow(12, 5, 'Đặc Một', 'BS', [20], [1, 0, 0]));
  sheets.find((s) => s.name === 'Trực thường').cells.B12 = { f: 'x', v: 'Đặc Một' };
  const got = await TT.importXlsx(excelBook(sheets));
  assert.deepEqual(names(got.groups.dacBiet), [{ name: 'Đặc Một', title: 'BS', days: [3, 4] }]);
  assert.deepEqual(names(got.groups.thuong).map((p) => [p.name, p.days]), [['Thường Một', [1, 2, 24]], ['Thường Hai', []], ['Đặc Một', [20]]]);
});

test('importXlsx: thiếu một bảng thanh toán thì không có đơn giá của nhóm đó và có ghi chú', async () => {
  const got = await TT.importXlsx(excelBook(fakeSheets({ drop: ['Trực ĐB'] })));
  assert.deepEqual(Object.keys(got.rates).sort(), ['ngoaiBV', 'thuong']);
  assert.ok(got.notes.some((n) => /Không thấy sheet "Trực ĐB"/.test(n)), got.notes.join(' | '));
});

test('readXlsx: trả về danh sách sheet đang hiện, không có sheet ẩn', async () => {
  const book = await TT.readXlsx(excelBook(fakeSheets()), []);
  assert.ok(book.sheetNames.includes('T12') && !book.visibleNames.includes('T12'));
  assert.ok(book.visibleNames.includes('Bảng ngoài viện') && !book.visibleNames.includes('Ẩn bảng ngoài viện'));
});

test('importXlsx: sheet thanh toán ngoài BV tên lạ được nhận ra theo cấu trúc, tên là Trực ngoài BV thì dùng thẳng', async () => {
  const sheets = fakeSheets();
  sheets.find((s) => s.name === 'Bảng ngoài viện').name = 'Trực ngoài BV';
  const got = await TT.importXlsx(excelBook(sheets));
  assert.deepEqual(got.rates.ngoaiBV, RATES.ngoaiBV);
  assert.deepEqual(names(got.groups.ngoaiBV), [{ name: 'Ngoài Một', title: 'BS', days: [10] }]);
});

test('importXlsx: có hai sheet đang hiện trông như bảng thanh toán chưa rõ tên thì không đoán, có ghi chú', async () => {
  const sheets = fakeSheets();
  sheets.push({ name: 'Bảng ngoài viện cũ', cells: paySheetCells({ hospital: 'x', dept: 'y', names: ['Người Cũ'], base: 1, nghi: 2, le: 3, meal: 4 }) });
  const got = await TT.importXlsx(excelBook(sheets));
  assert.equal(got.rates.ngoaiBV, undefined);
  assert.ok(got.notes.some((n) => /Có 2 sheet đang hiện trông như bảng thanh toán/.test(n)), got.notes.join(' | '));
  assert.ok(got.notes.every((n) => !/Không thấy sheet "Trực ngoài BV"/.test(n)), got.notes.join(' | '));
  assert.ok(got.groups.thuong.some((p) => p.name === 'Ngoài Một'), 'người ngoài BV rơi về Trực thường vì không biết nhóm');
});

test('importXlsx: đơn giá bằng 0 hoặc thiếu thì không điền, có ghi chú', async () => {
  const sheets = fakeSheets();
  sheets.find((s) => s.name === 'Trực thường').cells.D8 = 0;
  const got = await TT.importXlsx(excelBook(sheets));
  assert.equal(got.rates.thuong, undefined);
  assert.ok(got.notes.some((n) => /Trực thường: không đọc được đơn giá và hệ số/.test(n)), got.notes.join(' | '));
});

test('importXlsx: có sheet tổng thì đọc từ tổng và bỏ qua bảng chấm công in: người không trực cũng có mặt, nhóm theo dòng đầu nhóm', async () => {
  const got = await TT.importXlsx(excelBook(sheetsWithTong(), { deflate: true }));
  assert.equal(got.source, 'tong');
  assert.deepEqual([got.year, got.month, got.hospital, got.department], [2026, 11, 'BỆNH VIỆN TỔNG', 'KHOA TỔNG']);
  assert.deepEqual(names(got.groups.dacBiet), [{ name: 'Đặc Một', title: 'BS', days: [3, 4] }, { name: 'Đặc Hai', title: 'BS', days: [] }]);
  assert.deepEqual(names(got.groups.thuong), [
    { name: 'Thường Một', title: 'ĐD', days: [1, 2, 24] },
    { name: 'Thường Hai', title: 'BS', days: [] },
    { name: 'Thường Ba', title: 'BS', days: [7] },
  ]);
  assert.deepEqual(names(got.groups.ngoaiBV), [{ name: 'Ngoài Một', title: 'BS', days: [10] }]);
  assert.deepEqual(got.rates, RATES);
  assert.deepEqual(got.notes, ['1 ô ngày nằm ngoài tháng 11, đã bỏ qua.']);
});

test('importXlsx: chữ L (hoa hoặc thường) gõ trong tổng cho ra ngày lễ, số ngày T, N, L đếm theo chữ gõ như sheet', async () => {
  const got = await TT.importXlsx(excelBook(sheetsWithTong({ tong: { ...tongRow(15, 'Thường Hai', 'BS', { 12: 'l' }) } })));
  assert.deepEqual(got.holidays, ['2026-11-12', '2026-11-24']);
  assert.deepEqual(got.groups.thuong.map((p) => p.counts), [{ T: 1, N: 1, L: 1 }, { T: 0, N: 0, L: 1 }, { T: 1, N: 0, L: 0 }]);
  assert.deepEqual(got.groups.dacBiet.map((p) => p.counts), [{ T: 2, N: 0, L: 0 }, { T: 0, N: 0, L: 0 }]);
});

test('importXlsx: sheet tổng không có chữ L thì không có ngày lễ', async () => {
  const got = await TT.importXlsx(excelBook(sheetsWithTong({ tong: { AB14: 'T' } })));
  assert.deepEqual(got.holidays, []);
});

test('importXlsx: có tổng nhưng không có bảng thanh toán nào thì vẫn đọc người, không có đơn giá, mỗi nhóm có một ghi chú', async () => {
  const got = await TT.importXlsx(excelBook(sheetsWithTong({ drop: ['Trực thường', 'Trực ĐB', 'Bảng ngoài viện', 'Ẩn bảng ngoài viện'] })));
  assert.deepEqual(got.rates, {});
  assert.equal(got.groups.thuong.length, 3);
  assert.equal(got.notes.filter((n) => /^Không thấy sheet/.test(n)).length, 3, got.notes.join(' | '));
});

test('importXlsx: file không có sheet tổng thì đọc bảng chấm công in', async () => {
  const got = await TT.importXlsx(excelBook(fakeSheets()));
  assert.equal(got.source, 'chamCong');
  assert.deepEqual(got.holidays, []);
});

test('importXlsx: sheet tổng không có dòng đầu nhóm nào thì dùng bảng chấm công in, không có cả hai thì báo lỗi', async () => {
  const noHeads = { C8: undefined, C13: undefined, C18: undefined };
  const fallback = await TT.importXlsx(excelBook(sheetsWithTong({ tong: noHeads })));
  assert.equal(fallback.source, 'chamCong');
  await assert.rejects(() => TT.importXlsx(excelBook(sheetsWithTong({ drop: ['bảng chấm công in'], tong: noHeads }))), /Không thấy sheet "tổng" có dòng đầu nhóm/);
});

test('importXlsx: thiếu sheet bảng chấm công in, thiếu tháng năm, thiếu cột họ và tên đều báo lỗi rõ', async () => {
  await assert.rejects(() => TT.importXlsx(excelBook(fakeSheets({ drop: ['bảng chấm công in'] }))), /Không thấy sheet "tổng" hoặc "bảng chấm công in"/);
  const noMonth = fakeSheets();
  delete noMonth.find((s) => s.name === 'bảng chấm công in').cells.W2;
  await assert.rejects(() => TT.importXlsx(excelBook(noMonth)), /Không đọc được tháng và năm/);
  const noName = fakeSheets();
  delete noName.find((s) => s.name === 'bảng chấm công in').cells.C4;
  await assert.rejects(() => TT.importXlsx(excelBook(noName)), /không có cột "Họ và tên"/);
});

// ---------------------------------------------------------------------------------------------

const rate = (donGia, tienAn, heSoNghi, heSoLe) => ({ donGia, tienAn, heSoNghi, heSoLe });
const row = (name, title, days, counts = null) => ({ name, title, days, counts });
const imported = (groups, extra = {}) => ({
  year: 2026, month: 11, hospital: 'BV nhập', department: 'Khoa nhập', rates: {}, notes: [], holidays: [],
  groups: { dacBiet: [], thuong: [], ngoaiBV: [], ...groups }, ...extra,
});
function dataWithMonth() {
  const data = TT.emptyData();
  data.months['2026_11'] = {
    signDate: null,
    rates: { thuong: rate(1, 2, 3, 4), dacBiet: rate(5, 6, 7, 8), ngoaiBV: rate(9, 10, 11, 12) },
    groups: {
      dacBiet: [person('Xa', [3], 'BS', 'x1')],
      thuong: [person('A', [5], '', 'a1'), person('B', [6], 'ĐD', 'b1')],
      ngoaiBV: [],
    },
  };
  return data;
}

test('applyImport: đặt ngày trực theo file, thêm người mới ở cuối nhóm, giữ người vắng mặt nhưng xóa ngày trực', () => {
  const data = dataWithMonth();
  const out = TT.applyImport(data, imported({ thuong: [row('A', 'BS', [1, 2]), row('C', 'BS', [7])] }));
  const m = data.months['2026_11'];
  assert.deepEqual(m.groups.thuong.map((p) => [p.name, p.title, p.days]), [['A', 'BS', [1, 2]], ['B', 'ĐD', []], ['C', 'BS', [7]]]);
  assert.deepEqual(m.groups.dacBiet.map((p) => [p.name, p.days]), [['Xa', []]]);
  assert.deepEqual([out.key, out.added, out.updated, out.cleared, out.duty], ['2026_11', 1, 1, 2, 3]);
});

test('applyImport: chức danh đã có thì giữ, chỉ điền khi đang trống', () => {
  const data = dataWithMonth();
  TT.applyImport(data, imported({ thuong: [row('A', 'BS mới', [1]), row('B', 'ĐD mới', [2])] }));
  const [a, b] = data.months['2026_11'].groups.thuong;
  assert.deepEqual([a.title, b.title], ['BS mới', 'ĐD']);
});

test('applyImport: điền đơn giá và hệ số cho nhóm có trong file, nhóm khác giữ nguyên', () => {
  const data = dataWithMonth();
  const out = TT.applyImport(data, imported({}, { rates: { thuong: rate(100, 20, 1.5, 2) } }));
  assert.deepEqual(data.months['2026_11'].rates.thuong, rate(100, 20, 1.5, 2));
  assert.deepEqual(data.months['2026_11'].rates.dacBiet, rate(5, 6, 7, 8));
  assert.deepEqual(out.ratesFilled, ['thuong']);
});

test('applyImport: bệnh viện và khoa chỉ điền khi đang trống', () => {
  const blank = dataWithMonth();
  TT.applyImport(blank, imported({}));
  assert.deepEqual([blank.settings.hospital, blank.settings.department], ['BV nhập', 'Khoa nhập']);
  const filled = dataWithMonth();
  filled.settings.hospital = 'Của tôi';
  filled.settings.department = 'Khoa của tôi';
  TT.applyImport(filled, imported({}));
  assert.deepEqual([filled.settings.hospital, filled.settings.department], ['Của tôi', 'Khoa của tôi']);
});

test('applyImport: tháng chưa có thì tạo từ đơn giá của tháng trước, người lấy từ file rồi đặt ngày trực, tháng trước không đổi', () => {
  const data = dataWithMonth();
  data.months['2026_10'] = data.months['2026_11'];
  delete data.months['2026_11'];
  const before = JSON.stringify(data.months['2026_10']);
  const out = TT.applyImport(data, imported({ thuong: [row('B', 'ĐD', [9])] }));
  const m = data.months['2026_11'];
  assert.deepEqual(m.groups.thuong.map((p) => [p.name, p.title, p.days]), [['B', 'ĐD', [9]]]);
  assert.deepEqual(m.groups.dacBiet, []);
  assert.deepEqual(m.rates.thuong, rate(1, 2, 3, 4));
  assert.equal(JSON.stringify(data.months['2026_10']), before);
  assert.deepEqual([out.added, out.updated], [1, 0]);
});

test('applyImport: cảnh báo khi số ngày T, N, L trong file khác tính của trang theo danh sách ngày lễ hiện có', () => {
  const rows = { thuong: [row('A', 'BS', [1, 2, 24], { T: 1, N: 1, L: 1 })] };
  const noHoliday = dataWithMonth();
  const warned = TT.applyImport(noHoliday, imported(rows));
  assert.ok(warned.notes.some((n) => /1 dòng có số ngày T, N, L khác file.*mục Ngày lễ/.test(n)), warned.notes.join(' | '));
  const withHoliday = dataWithMonth();
  withHoliday.settings.holidays.push({ date: '2026-11-24', name: 'Lễ', confirmed: true });
  assert.deepEqual(TT.applyImport(withHoliday, imported(rows)).notes, []);
});

test('applyImport: dòng không có số ngày trong file thì không cảnh báo', () => {
  const out = TT.applyImport(dataWithMonth(), imported({ thuong: [row('A', 'BS', [1, 2, 24], null)] }));
  assert.deepEqual(out.notes, []);
});

test('applyImport: ghi chú của lúc đọc file được giữ lại trong kết quả', () => {
  const out = TT.applyImport(dataWithMonth(), imported({}, { notes: ['ghi chú từ file'] }));
  assert.deepEqual(out.notes, ['ghi chú từ file']);
});

test('applyImport: thêm ngày lễ theo chữ L trong file ở trạng thái chưa xác nhận, không trùng ngày đã có, giữ thứ tự, có ghi chú', () => {
  const data = dataWithMonth();
  data.settings.holidays = [{ date: '2026-11-03', name: 'Của tôi', confirmed: true }, { date: '2026-12-25', name: 'Giáng sinh', confirmed: true }];
  const out = TT.applyImport(data, imported({}, { holidays: ['2026-11-03', '2026-11-24'] }));
  assert.deepEqual(data.settings.holidays, [
    { date: '2026-11-03', name: 'Của tôi', confirmed: true },
    { date: '2026-11-24', name: 'Ngày lễ theo file xlsx, chờ kế toán xác nhận', confirmed: false },
    { date: '2026-12-25', name: 'Giáng sinh', confirmed: true },
  ]);
  assert.deepEqual(out.holidaysAdded, ['2026-11-24']);
  assert.ok(out.notes.some((n) => /Đã thêm ngày lễ theo chữ L trong file \(chưa xác nhận\): 24\/11\/2026\. Kế toán xác nhận/.test(n)), out.notes.join(' | '));
});

test('applyImport: ngày lễ thêm vào được tính trước khi so số ngày T, N, L với file nên khớp thì không cảnh báo', () => {
  const data = dataWithMonth();
  const out = TT.applyImport(data, imported({ thuong: [row('A', 'BS', [1, 2, 24], { T: 1, N: 1, L: 1 })] }, { holidays: ['2026-11-24'] }));
  assert.deepEqual(out.notes.filter((n) => /khác file/.test(n)), []);
});

test('applyImport: không có ngày lễ nào trong file thì không thêm và không ghi chú', () => {
  const data = dataWithMonth();
  const out = TT.applyImport(data, imported({}));
  assert.deepEqual([data.settings.holidays, out.holidaysAdded], [[], []]);
});

test('applyImport có mẫu: tháng chưa có bắt đầu từ đơn giá của mẫu, người lấy từ file, nhóm không có trong file giữ đơn giá mẫu, mẫu không đổi', () => {
  const template = dataWithMonth().months['2026_11'];
  const data = TT.emptyData();
  data.months['2026_11'] = template;
  const before = JSON.stringify(template);
  const out = TT.applyImport(data, imported({ thuong: [row('B', 'ĐD', [9]), row('C', 'BS', [4])] }, { month: 8, rates: { thuong: rate(100, 20, 1.5, 2) } }), { key: '2026_11', monthData: template });
  const m = data.months['2026_08'];
  assert.deepEqual(m.groups.thuong.map((p) => [p.name, p.days]), [['B', [9]], ['C', [4]]]);
  assert.deepEqual(m.groups.dacBiet, []);
  assert.deepEqual(m.rates.thuong, rate(100, 20, 1.5, 2));
  assert.deepEqual(m.rates.dacBiet, rate(5, 6, 7, 8));
  assert.deepEqual([out.key, out.added, out.updated, out.cleared], ['2026_08', 2, 0, 0]);
  assert.equal(JSON.stringify(template), before);
});

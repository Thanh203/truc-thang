import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crc32 } from 'node:zlib';

const html = readFileSync(new URL('../truc_thang.html', import.meta.url), 'utf8');
const block = /<script id="cong-thuc">([\s\S]*?)<\/script>/.exec(html);
assert.ok(block, 'thiếu khối <script id="cong-thuc"> trong truc_thang.html');
const TT = new Function(`${block[1]}\nreturn TT;`)();

const person = (name, days, title = 'BS', id = `id_${name}`) => ({ id, name, title, days });
const rates = (donGia, tienAn, heSoNghi, heSoLe) => ({ donGia, tienAn, heSoNghi, heSoLe });
const dutyA = [1, 2, 5, 6, 7];
const ALL_FORMS = ['chamCong', 'thuong', 'dacBiet', 'ngoaiBV'];
const ORIGINAL_MERGES = {
  chamCong: ['C1:H1', 'W2:X2', 'AB2:AD2', 'E4:AI4', 'AE29:AM29', 'C30:D30', 'M30:S30', 'W30:AB30', 'AH30:AK30', 'A4:A6', 'C4:C6', 'D4:D6', 'AJ4:AJ7', 'AN4:AN6', 'AK4:AM5'],
  thuong: ['B1:E1', 'G1:N1', 'G2:N2', 'A4:N4', 'D7:E7', 'F7:G7', 'H7:I7', 'D8:E8', 'F8:G8', 'H8:I8', 'A21:B21', 'C22:N22', 'J23:N23', 'C24:D24', 'E24:G24', 'H24:J24', 'K24:N24', 'A7:A9', 'B7:B9', 'C7:C9', 'L8:L9', 'M7:M9', 'N7:N9', 'J7:K8'],
  dacBiet: ['B1:E1', 'G1:N1', 'G2:N2', 'A4:N4', 'D7:E7', 'F7:G7', 'H7:I7', 'D8:E8', 'F8:G8', 'H8:I8', 'A23:B23', 'C24:N24', 'J25:N25', 'C26:D26', 'E26:G26', 'H26:J26', 'K26:N26', 'A7:A9', 'B7:B9', 'C7:C9', 'L8:L9', 'M7:M9', 'N7:N9', 'J7:K8'],
  ngoaiBV: ['B2:E2', 'G2:N2', 'G3:N3', 'A5:N5', 'D8:E8', 'F8:G8', 'H8:I8', 'D9:E9', 'F9:G9', 'H9:I9', 'A14:B14', 'C15:N15', 'J17:N17', 'C18:D18', 'E18:G18', 'H18:J18', 'K18:N18', 'A8:A10', 'B8:B10', 'C8:C10', 'L9:L10', 'M8:M10', 'N8:N10', 'J8:K9'],
  tong: ['C1:H1', 'I1:AI1', 'D2:I2', 'AB2:AC2', 'E4:AI4', 'AJ4:AM4', 'A4:A6', 'C4:C6', 'D4:D6', 'AJ5:AJ6'],
};

const settingsOf = (over = {}) => ({
  hospital: 'Bệnh viện Thử', department: 'Khoa Thử', rateHistory: [], seededYears: [2026],
  holidays: [{ date: '2026-09-02', name: 'Quốc khánh', confirmed: true }], ...over,
});

function sampleMonth() {
  return {
    signDate: null,
    rates: { thuong: rates(100000, 20000, 1.5, 2), dacBiet: rates(50000, 10000, 1.3, 1.8), ngoaiBV: rates(80000, 5000, 1.2, 2.5) },
    groups: {
      dacBiet: [person('Người A', dutyA, 'BS', 'db1'), person('Người B', [], 'BS', 'db2')],
      thuong: [person('Người A', dutyA, 'BS', 'th1'), person('Người B', [], 'BS', 'th2')],
      ngoaiBV: [person('Người A', dutyA, 'BS', 'nb1')],
    },
  };
}

function build({ monthData = sampleMonth(), settings = settingsOf(), forms = ALL_FORMS } = {}) {
  const days = TT.monthDays(2026, 9, TT.holidayIsoSet(settings));
  return TT.buildSheets({ year: 2026, month: 9, monthData, settings, days, forms });
}

const cell = (sheet, ref) => sheet.cells.get(ref)?.v;
const values = (sheet, refs) => refs.map((ref) => cell(sheet, ref));
const sheetNamed = (sheets, name) => sheets.find((s) => s.name === name);

const SIX_SHEETS = ['tổng', 'bảng chấm công in', 'Trực thường', 'Trực ĐB', 'BS A', 'bảng chấm công in (122020)'];

test('buildSheets: đủ sáu sheet theo thứ tự như file gốc, sheet tổng luôn có, chỉ lấy các bảng in được chọn', () => {
  assert.deepEqual(build().map((s) => s.name), SIX_SHEETS);
  assert.deepEqual(build({ forms: ['thuong'] }).map((s) => s.name), ['tổng', 'Trực thường']);
  assert.deepEqual(build({ forms: ['ngoaiBV', 'dacBiet'] }).map((s) => s.name), ['tổng', 'Trực ĐB', 'BS A']);
  assert.deepEqual(build({ forms: ['chamCong'] }).map((s) => s.name), ['tổng', 'bảng chấm công in', 'bảng chấm công in (122020)']);
});

test('buildSheets: màu thẻ sheet như file gốc, xanh lá ở các bảng in, sheet tổng và Trực thường không màu', () => {
  assert.deepEqual(build().map((s) => [s.name, s.tab]), [['tổng', undefined], ['bảng chấm công in', '00B050'], ['Trực thường', undefined], ['Trực ĐB', '00B050'], ['BS A', '00B050'], ['bảng chấm công in (122020)', '00B050']]);
});

test('sheet nhóm ngoài BV: một người thì đặt tên BS và tên cuối như file gốc, ngược lại tên chung, bỏ ký tự cấm, tối đa 31 ký tự', () => {
  const nameFor = (people) => {
    const monthData = sampleMonth();
    monthData.groups.ngoaiBV = people;
    return build({ monthData, forms: ['ngoaiBV'] })[1].name;
  };
  assert.equal(nameFor([person('Trần Văn Hoa', [1])]), 'BS Hoa');
  assert.equal(nameFor([person('  Lê   Thị   Mai  ', [1])]), 'BS Mai');
  assert.equal(nameFor([person('Nguyễn A', [1]), person('Trần B', [2])]), 'Trực ngoài BV');
  assert.equal(nameFor([person('Nguyễn A', [1]), person('   ', [])]), 'BS A');
  assert.equal(nameFor([]), 'Trực ngoài BV');
  assert.equal(nameFor([person('   ', [])]), 'Trực ngoài BV');
  assert.equal(nameFor([person('Nam [x]/y:z?*\\', [1])]), 'BS xyz');
  assert.equal(nameFor([person('***', [1])]), 'Trực ngoài BV');
  assert.equal(nameFor([person(`A ${'B'.repeat(40)}`, [1])]), `BS ${'B'.repeat(28)}`);
});

test('Trực thường: đầu bảng, đơn giá và tiêu đề cột nằm đúng ô của bảng gốc', () => {
  const sh = sheetNamed(build(), 'Trực thường');
  assert.deepEqual(values(sh, ['B1', 'G1', 'B2', 'C2', 'G2', 'A4', 'F5', 'G5', 'H5', 'I5']),
    ['Bệnh viện Thử', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'KHOA / PHÒNG:', 'Khoa Thử', 'Độc lập - Tự do - Hạnh phúc', 'BẢNG THANH TOÁN TIỀN TRỰC', 'Tháng', 9, 'năm', 2026]);
  assert.deepEqual(values(sh, ['A7', 'B7', 'C7', 'D7', 'F7', 'H7', 'J7', 'M7', 'N7']),
    ['STT', 'Họ và tên', 'Chức danh', 'Làm việc ngày Thường', 'Làm việc Ngày T7,CN', 'Làm việc Ngày Lễ, tết', 'Tổng cộng', 'Thực nhận', 'Ký nhận']);
  assert.deepEqual(values(sh, ['L7', 'D8', 'F8', 'H8']), [20000, 100000, 150000, 200000]);
  assert.equal(cell(sh, 'L8'), 'Kinh phí hỗ trợ tiền ăn cho người trực 24/24');
  assert.deepEqual(values(sh, ['D9', 'E9', 'F9', 'G9', 'H9', 'I9', 'J9', 'K9']),
    ['Tổng số ngày', 'Thành tiền', 'Tổng số ngày', 'Thành tiền', 'Tổng số ngày', 'Thành tiền', 'Tổng số ngày', 'Thành tiền']);
});

test('Trực thường: hàng người, số 0 để trống, dòng trống có khung, tổng cộng, tiền bằng chữ, ngày ký, chữ ký', () => {
  const sh = sheetNamed(build(), 'Trực thường');
  assert.deepEqual(values(sh, ['A10', 'B10', 'C10', 'D10', 'E10', 'F10', 'G10', 'H10', 'I10', 'J10', 'K10', 'L10', 'M10']),
    [1, 'Người A', 'BS', 2, 200000, 2, 300000, 1, 200000, 5, 700000, 100000, 800000]);
  assert.deepEqual(values(sh, ['A11', 'B11', 'C11', 'D11', 'E11', 'K11', 'M11']), [2, 'Người B', 'BS', undefined, undefined, undefined, undefined]);
  assert.equal(cell(sh, 'B12'), undefined);
  assert.equal(sh.cells.get('B12').s.bd, 'lrtb');
  assert.deepEqual(values(sh, ['A21', 'D21', 'E21', 'F21', 'G21', 'H21', 'I21', 'J21', 'K21', 'L21', 'M21']),
    ['Tổng cộng:', 2, 200000, 2, 300000, 1, 200000, 5, 700000, 100000, 800000]);
  assert.deepEqual(values(sh, ['B22', 'C22', 'J23']), ['Số tiền bằng chữ:', 'Tám trăm nghìn đồng', 'Ngày     01   tháng   10  năm 2026']);
  assert.deepEqual(values(sh, ['B24', 'C24', 'E24', 'H24', 'K24']), ['GIÁM ĐỐC', 'PHÒNG TC-HC', 'PHÒNG TCKT', 'TRƯỞNG KHOA/PHÒNG', 'NGƯỜI LẬP']);
});

test('Trực thường: các ô gộp trùng đúng 24 ô gộp của bảng gốc (11 dòng người)', () => {
  assert.deepEqual([...sheetNamed(build(), 'Trực thường').merges].sort(), [...ORIGINAL_MERGES.thuong].sort());
});

test('Trực thường: nhiều người hơn 11 dòng thì bảng dài ra, tổng cộng dịch xuống', () => {
  const monthData = sampleMonth();
  monthData.groups.thuong = Array.from({ length: 16 }, (_, i) => person(`Người ${i + 1}`, [1], 'BS', `t${i}`));
  const sh = sheetNamed(build({ monthData }), 'Trực thường');
  assert.deepEqual(values(sh, ['B25', 'A26', 'M26', 'B27', 'C27']), ['Người 16', 'Tổng cộng:', 1920000, 'Số tiền bằng chữ:', 'Một triệu chín trăm hai mươi nghìn đồng']);
  assert.ok(sh.merges.includes('A26:B26') && sh.merges.includes('C27:N27'));
  assert.ok(!sh.merges.includes('A24:B24'));
});

test('Trực ĐB: chỉ người có trực, 13 dòng nên tổng cộng ở hàng 23, các ô gộp trùng bảng gốc', () => {
  const sh = sheetNamed(build(), 'Trực ĐB');
  assert.deepEqual([...sh.merges].sort(), [...ORIGINAL_MERGES.dacBiet].sort());
  assert.deepEqual(values(sh, ['L7', 'D8', 'F8', 'H8']), [10000, 50000, 65000, 90000]);
  assert.deepEqual(values(sh, ['A10', 'B10', 'D10', 'E10', 'F10', 'G10', 'H10', 'I10', 'J10', 'K10', 'L10', 'M10']),
    [1, 'Người A', 2, 100000, 2, 130000, 1, 90000, 5, 320000, 50000, 370000]);
  assert.equal(cell(sh, 'B11'), undefined);
  assert.deepEqual(values(sh, ['A23', 'M23', 'C24', 'J25']), ['Tổng cộng:', 370000, 'Ba trăm bảy mươi nghìn đồng', 'Ngày     01   tháng   10  năm 2026']);
  assert.deepEqual(values(sh, ['B26', 'C26', 'E26', 'H26', 'K26']), ['THỦ TRƯỞNG ĐƠN VỊ', 'PHÒNG TCCB', 'PHÒNG KHTH', 'TRƯỞNG KHOA/PHÒNG', 'NGƯỜI LẬP']);
});

test('sheet ngoài BV (BS A): bảng lệch một hàng so với Trực thường, 3 dòng người, tổng cộng ở hàng 14, các ô gộp trùng bảng gốc', () => {
  const sh = sheetNamed(build(), 'BS A');
  assert.deepEqual([...sh.merges].sort(), [...ORIGINAL_MERGES.ngoaiBV].sort());
  assert.deepEqual(values(sh, ['B2', 'G2', 'B3', 'C3', 'G3', 'A5', 'F6', 'G6', 'H6', 'I6']),
    ['Bệnh viện Thử', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'KHOA / PHÒNG:', 'Khoa Thử', 'Độc lập - Tự do - Hạnh phúc', 'BẢNG THANH TOÁN TIỀN TRỰC', 'Tháng', 9, 'năm', 2026]);
  assert.deepEqual(values(sh, ['A8', 'B8', 'C8', 'D8', 'M8', 'N8']), ['STT', 'Họ và tên', 'Chức danh', 'Làm việc ngày Thường', 'Thực nhận', 'Ký nhận']);
  assert.deepEqual(values(sh, ['L8', 'D9', 'F9', 'H9']), [5000, 80000, 96000, 200000]);
  assert.deepEqual(values(sh, ['B11', 'E11', 'G11', 'I11', 'K11', 'L11', 'M11']), ['Người A', 160000, 192000, 200000, 552000, 25000, 577000]);
  assert.equal(cell(sh, 'B12'), undefined);
  assert.deepEqual(values(sh, ['A14', 'M14', 'C15', 'J17']), ['Tổng cộng:', 577000, 'Năm trăm bảy mươi bảy nghìn đồng', 'Ngày     01   tháng   10  năm 2026']);
  assert.deepEqual(values(sh, ['B18', 'C18', 'E18', 'H18', 'K18']), ['THỦ TRƯỞNG ĐƠN VỊ', 'PHÒNG TCCB', 'PHÒNG KHTH', 'TRƯỞNG KHOA/PHÒNG', 'NGƯỜI LẬP']);
});

const tsGroups = () => ({
  dacBiet: [person('Người X', [3]), person('Người Y', [])],
  thuong: [person('Người P', [1, 2]), person('Người Q', []), person('  ', [])],
  ngoaiBV: [person('Người Z', [10])],
});

test('bảng chấm công in: người, ngày trực, số ngày T N L và tổng từng ngày nằm đúng ô', () => {
  const monthData = sampleMonth();
  monthData.groups = tsGroups();
  const sh = sheetNamed(build({ monthData }), 'bảng chấm công in');
  assert.deepEqual(values(sh, ['A8', 'C8', 'D8', 'G8', 'E8']), [1, 'Người X', 'BS', 'T', undefined]);
  assert.deepEqual(values(sh, ['A9', 'C9', 'E9', 'F9', 'G9']), [2, 'Người P', 'T', 'T', undefined]);
  assert.deepEqual(values(sh, ['A10', 'C10', 'AJ10']), [3, 'Người Q', undefined]);
  assert.deepEqual(values(sh, ['A11', 'C11', 'N11']), [4, 'Người Z', 'T']);
  assert.deepEqual(values(sh, ['AJ8', 'AK8', 'AL8', 'AM8']), [1, 1, undefined, undefined]);
  assert.deepEqual(values(sh, ['AJ9', 'AK9', 'AL9', 'AM9']), [2, 1, undefined, 1]);
  assert.deepEqual(values(sh, ['C27', 'E27', 'F27', 'G27', 'H27', 'N27', 'AH27', 'AI27']), ['TỔNG CỘNG:', 1, 1, 1, 0, 1, 0, undefined]);
  assert.deepEqual(values(sh, ['AJ27', 'AK27', 'AL27', 'AM27']), [4, 3, 0, 1]);
});

test('bảng chấm công in: đầu bảng, ngày, thứ, số ngày và chữ ký như bảng gốc', () => {
  const sh = sheetNamed(build(), 'bảng chấm công in');
  assert.deepEqual(values(sh, ['C1', 'R1', 'C2', 'D2', 'T2', 'W2', 'Y2', 'AB2']),
    ['Bệnh viện Thử', 'BẢNG CHẤM CÔNG TRỰC', 'KHOA / PHÒNG:', 'Khoa Thử', 'Tháng', 9, 'năm', 2026]);
  assert.deepEqual(values(sh, ['A4', 'C4', 'D4', 'E4', 'AJ4', 'AK4', 'AN4', 'AK6', 'AL6', 'AM6', 'A7', 'C7', 'D7', 'AK7', 'AL7', 'AM7']),
    ['Số TT', 'Họ và tên', 'Mã', 'Ngày trong tháng', 'Tổng cộng', 'Ngày', 'Ghi chú', 'Thường', 'Nghỉ', 'Lễ', 'A', 'B', 'C', 'A', 'B', 'C']);
  assert.deepEqual(values(sh, ['E5', 'F5', 'AH5', 'AI5']), [46266, 46267, 46295, undefined]);
  assert.deepEqual(values(sh, ['E6', 'F6', 'I6', 'J6']), ['Thứ 3', 'Thứ 4', 'Thứ 7', 'Chủ nhật']);
  assert.deepEqual(values(sh, ['E7', 'AH7', 'AI7']), [1, 30, undefined]);
  assert.deepEqual(values(sh, ['AE29', 'C30', 'F30', 'M30', 'W30', 'AH30']),
    ['Ngày  01  tháng  10  năm 2026', 'GIÁM ĐỐC', 'PHÒNG TC-HC', 'PHÒNG KHTH-CĐT-QLCL', 'TRƯỞNG KHOA', 'NGƯỜI LẬP']);
  assert.deepEqual([...sh.merges].sort(), [...ORIGINAL_MERGES.chamCong].sort());
});

test('bảng chấm công in: cột B ẩn, 40 cột, T7 và CN tô xám, ngày lễ tô cam nhạt chữ đỏ cả cột kể cả dòng trống (màu của quy tắc định dạng trong file gốc)', () => {
  const sh = sheetNamed(build(), 'bảng chấm công in');
  assert.deepEqual(sh.hidden, [2]);
  assert.equal(sh.widths.length, 40);
  const fillOf = (ref) => sh.cells.get(ref).s.fill;
  assert.deepEqual(['I5', 'J7', 'I20', 'J26'].map(fillOf), ['BFBFBF', 'BFBFBF', 'BFBFBF', 'BFBFBF']);
  assert.deepEqual(['F5', 'F6', 'F7', 'F8', 'F20'].map(fillOf), ['FCD5B5', 'FCD5B5', 'FCD5B5', 'FCD5B5', 'FCD5B5']);
  assert.deepEqual(['E5', 'E6', 'E20', 'K5'].map(fillOf), [undefined, undefined, undefined, undefined]);
  assert.equal(sh.cells.get('E6').s.rot, 90);
});

test('xlsxFileName: TRỰC THÁNG hai chữ số tháng và năm', () => {
  assert.equal(TT.xlsxFileName(2026, 9), 'TRỰC THÁNG 09 2026.xlsx');
  assert.equal(TT.xlsxFileName(2027, 12), 'TRỰC THÁNG 12 2027.xlsx');
});

function unzipStore(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50, 'thiếu bản ghi cuối của zip');
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(p, true), 0x02014b50);
    assert.equal(view.getUint16(p + 10, true), 0, 'chỉ dùng kiểu lưu không nén');
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const skip = view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    assert.equal(crc32(data), crc, `CRC của ${name}`);
    files.set(name, new TextDecoder().decode(data));
    p += 46 + nameLen + skip;
  }
  return files;
}

function assertWellFormed(name, xml) {
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'), `${name}: thiếu khai báo xml`);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/.test(xml), `${name}: có ký tự & lẻ`);
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml), `${name}: có ký tự điều khiển`);
  const body = xml.replace(/^<\?xml[^>]*\?>/, '');
  const stack = [];
  let pos = 0;
  for (const m of body.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g)) {
    assert.ok(!body.slice(pos, m.index).includes('<'), `${name}: thẻ sai cú pháp gần vị trí ${pos}`);
    pos = m.index + m[0].length;
    if (m[1]) assert.equal(stack.pop(), m[2], `${name}: đóng thẻ ${m[2]} không khớp`);
    else if (!m[4]) stack.push(m[2]);
  }
  assert.ok(!body.slice(pos).includes('<'), `${name}: thẻ sai cú pháp ở cuối`);
  assert.deepEqual(stack, [], `${name}: còn thẻ chưa đóng`);
}

const unescapeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

function readSheet(xml) {
  const cells = new Map();
  const order = [];
  for (const row of xml.matchAll(/<row r="(\d+)"[^>]*?(?:\/>|>(.*?)<\/row>)/gs)) {
    order.push(Number(row[1]));
    let last = 0;
    for (const m of (row[2] ?? '').matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      assert.equal(Number(m[2]), Number(row[1]), `ô ${m[1]}${m[2]} nằm sai hàng`);
      assert.ok(colIndex(m[1]) > last, `ô ${m[1]}${m[2]} sai thứ tự cột`);
      last = colIndex(m[1]);
      const inner = m[4] ?? '';
      let v;
      if (m[3].includes('t="inlineStr"')) v = unescapeXml(/<t[^>]*>(.*?)<\/t>/s.exec(inner)[1]);
      else if (inner.includes('<v>')) v = Number(/<v>(.*?)<\/v>/.exec(inner)[1]);
      cells.set(`${m[1]}${m[2]}`, { v, s: Number(/ s="(\d+)"/.exec(m[3])?.[1] ?? 0) });
    }
  }
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'hàng sai thứ tự');
  return cells;
}

test('xlsxBytes: gói hợp lệ, mọi phần XML đúng cú pháp, quan hệ và kiểu nội dung đầy đủ, kiểu ô nằm trong khoảng', () => {
  const files = unzipStore(TT.xlsxBytes(build(), new Date(2026, 9, 15, 10, 0, 0)));
  for (const [name, xml] of files) assertWellFormed(name, xml);
  const workbook = files.get('xl/workbook.xml');
  const names = [...workbook.matchAll(/<sheet name="([^"]*)" sheetId="(\d+)" r:id="(rId\d+)"/g)];
  assert.deepEqual(names.map((m) => unescapeXml(m[1])), SIX_SHEETS);
  const rels = new Map([...files.get('xl/_rels/workbook.xml.rels').matchAll(/<Relationship Id="(rId\d+)" Type="[^"]*" Target="([^"]*)"\/>/g)].map((m) => [m[1], m[2]]));
  for (const m of names) assert.ok(files.has(`xl/${rels.get(m[3])}`), `thiếu phần ${rels.get(m[3])}`);
  assert.ok(files.has(`xl/${rels.get('rId7')}`), 'thiếu styles');
  const types = files.get('[Content_Types].xml');
  for (const part of files.keys()) {
    if (part.startsWith('xl/') && part.endsWith('.xml') && !part.includes('_rels')) assert.ok(types.includes(`PartName="/${part}"`), `thiếu kiểu nội dung cho ${part}`);
  }
  assert.ok(files.get('_rels/.rels').includes('Target="xl/workbook.xml"'));
  const styles = files.get('xl/styles.xml');
  const count = (tag) => Number(new RegExp(`<${tag} count="(\\d+)"`).exec(styles)[1]);
  const inside = (tag, child) => (new RegExp(`<${tag} count="\\d+">(.*?)</${tag}>`, 's').exec(styles)[1].match(new RegExp(`<${child}[ />]`, 'g')) ?? []).length;
  assert.deepEqual([count('fonts'), count('fills'), count('borders'), count('cellXfs')], [inside('fonts', 'font'), inside('fills', 'fill'), inside('borders', 'border'), inside('cellXfs', 'xf')]);
  assert.ok(/<fills count="\d+"><fill><patternFill patternType="none"\/><\/fill><fill><patternFill patternType="gray125"\/><\/fill>/.test(styles));
  for (const [id, m] of names.entries()) {
    const sheet = readSheet(files.get(`xl/${rels.get(m[3])}`));
    for (const { s } of sheet.values()) assert.ok(s < count('cellXfs'), `kiểu ô ${s} vượt khoảng`);
    assert.equal(files.get(`xl/${rels.get(m[3])}`).includes('tabSelected="1"'), id === 0, 'chỉ sheet đầu được chọn');
  }
  for (const m of styles.matchAll(/<xf numFmtId="(\d+)" fontId="(\d+)" fillId="(\d+)" borderId="(\d+)"/g)) {
    assert.ok(Number(m[2]) < count('fonts') && Number(m[3]) < count('fills') && Number(m[4]) < count('borders'));
  }
});

test('xlsxBytes: đọc lại ra đúng giá trị, đúng số ô gộp, giữ khoảng trắng và ký tự đặc biệt, tên bắt đầu bằng dấu bằng vẫn là chữ', () => {
  const monthData = sampleMonth();
  monthData.groups.thuong = [person('=SUM(1,2) & <Tom> "Jerry"', dutyA, 'BS', 'x1'), person('Người B', [1], 'BS', 'x2')];
  const files = unzipStore(TT.xlsxBytes(build({ monthData }), new Date(2026, 9, 15)));
  const xml = files.get('xl/worksheets/sheet3.xml');
  assertWellFormed('sheet3', xml);
  assert.ok(xml.includes('=SUM(1,2) &amp; &lt;Tom&gt; &quot;Jerry&quot;'));
  const sheet = readSheet(xml);
  assert.equal(sheet.get('B10').v, '=SUM(1,2) & <Tom> "Jerry"');
  assert.ok(/<c r="B10"[^>]*t="inlineStr"/.test(xml));
  assert.deepEqual([sheet.get('M10').v, sheet.get('M11').v, sheet.get('M21').v], [800000, 120000, 920000]);
  assert.deepEqual([sheet.get('G5').v, sheet.get('I5').v], [9, 2026]);
  assert.equal(sheet.get('J23').v, 'Ngày     01   tháng   10  năm 2026');
  assert.equal(Number(/<mergeCells count="(\d+)"/.exec(xml)[1]), (xml.match(/<mergeCell ref=/g) ?? []).length);
  const pageSetup = /<pageSetup [^>]*\/>/.exec(xml)[0];
  for (const attr of ['paperSize="9"', 'orientation="landscape"', 'fitToWidth="1"', 'fitToHeight="0"']) assert.ok(pageSetup.includes(attr), attr);
  assert.ok(xml.includes('<pageSetUpPr fitToPage="1"/>'));
});

function styleParts(files, sheetPath, ref) {
  const styles = files.get('xl/styles.xml');
  const list = (tag, child) => [...new RegExp(`<${tag} count="\\d+">(.*?)</${tag}>`, 's').exec(styles)[1].matchAll(child)].map((m) => m[0]);
  const fonts = list('fonts', /<font>.*?<\/font>/gs);
  const fills = list('fills', /<fill>.*?<\/fill>/gs);
  const borders = list('borders', /<border>.*?<\/border>/gs);
  const xfs = list('cellXfs', /<xf [^>]*?\/>|<xf [^>]*?>.*?<\/xf>/gs);
  const xf = xfs[readSheet(files.get(sheetPath)).get(ref).s];
  const id = (attr) => Number(new RegExp(`${attr}="(\\d+)"`).exec(xf)[1]);
  return { xf, font: fonts[id('fontId')], fill: fills[id('fillId')], border: borders[id('borderId')] };
}

test('xlsxBytes: kiểu ô được ghi đúng vào file: font, khung, màu nền, xoay chữ, ngăn hàng nghìn, canh lề', () => {
  const files = unzipStore(TT.xlsxBytes(build(), new Date(2026, 9, 15)));
  const cc = 'xl/worksheets/sheet2.xml';
  const pay = 'xl/worksheets/sheet3.xml';
  const weekday = styleParts(files, cc, 'E6');
  assert.ok(weekday.xf.includes('textRotation="90"') && weekday.font.includes('<b/>') && weekday.font.includes('<sz val="7"/>'));
  const holiday = styleParts(files, cc, 'F5');
  assert.ok(holiday.fill.includes('rgb="FFFCD5B5"') && holiday.font.includes('<color rgb="FFFF0000"/>') && holiday.xf.includes('numFmtId="164"'));
  assert.ok(styleParts(files, cc, 'I8').fill.includes('rgb="FFBFBFBF"'));
  assert.ok(!styleParts(files, cc, 'E8').fill.includes('rgb='));
  const net = styleParts(files, pay, 'M10');
  assert.ok(net.xf.includes('numFmtId="3"') && net.xf.includes('horizontal="right"') && net.font.includes('<b/>') && net.font.includes('<sz val="12"/>'));
  assert.equal((net.border.match(/style="thin"/g) ?? []).length, 4);
  const title = styleParts(files, pay, 'A4');
  assert.ok(title.font.includes('<b/>') && title.font.includes('<sz val="16"/>') && title.xf.includes('horizontal="center"'));
  const name = styleParts(files, pay, 'B10');
  assert.ok(name.xf.includes('horizontal="left"') && name.xf.includes('wrapText="1"'));
  const sign = styleParts(files, pay, 'J23');
  assert.ok(sign.font.includes('<i/>') && sign.font.includes('<sz val="13"/>'));
  const words = styleParts(files, pay, 'C22');
  assert.ok(words.border.includes('<top style="thin">') && words.border.includes('<left/>'));
  assert.ok(files.get('xl/styles.xml').match(/<name val="([^"]*)"/g).every((n) => n === '<name val="Times New Roman"'));
  assert.ok(styleParts(files, cc, 'R1').font.includes('<color rgb="FFE46C0A"/>') && styleParts(files, cc, 'R1').font.includes('<sz val="16"/>'));
  assert.ok(styleParts(files, pay, 'A21').font.includes('<u/>') && styleParts(files, pay, 'A21').font.includes('<b/>'));
  const accounting = styleParts(files, pay, 'L7');
  assert.ok(Number(/numFmtId="(\d+)"/.exec(accounting.xf)[1]) >= 165 && /<numFmt numFmtId="165" formatCode="_\(\* #,##0_\);_\(\* \\\(#,##0\\\);_\(\* &quot;-&quot;\?\?_\);_\(@_\)"\/>/.test(files.get('xl/styles.xml')));
});

test('xlsxBytes: không có công thức, thuộc tính tác giả hay công ty', () => {
  const files = unzipStore(TT.xlsxBytes(build(), new Date(2026, 9, 15)));
  for (const [name, xml] of files) {
    assert.ok(!xml.includes('<f>') && !xml.includes('<f '), `${name} có công thức`);
    assert.ok(!/dc:creator|<Company>|lastModifiedBy/i.test(xml), `${name} có thông tin tác giả`);
  }
  assert.ok(![...files.keys()].some((n) => n.startsWith('docProps/')));
});

// ---- sheet tổng (sheet nhập liệu của file gốc) ----

test('tổng: đầu bảng, ngày, thứ và nhãn cột như sheet nhập liệu của file gốc, cố định 7 hàng và 4 cột đầu, thu phóng 85', () => {
  const sh = sheetNamed(build(), 'tổng');
  assert.deepEqual(values(sh, ['C1', 'I1', 'C2', 'D2', 'T2', 'W2', 'Y2', 'AB2']), ['Bệnh viện Thử', 'BẢNG CHẤM CÔNG TRỰC', 'KHOA / PHÒNG:', 'Khoa Thử', 'Tháng', 9, 'năm', 2026]);
  assert.deepEqual(values(sh, ['A4', 'C4', 'D4', 'E4', 'AJ5', 'AK6', 'AL6', 'AM6', 'A7', 'C7', 'D7']),
    ['Số TT', 'Họ và tên', 'Mã', 'Ngày trong tháng', 'Tổng cộng', 'Ngày thường', 'Ngày nghỉ', 'Ngày lễ', 'A', 'B', 'C']);
  assert.deepEqual(values(sh, ['E5', 'F5', 'AH5', 'AI5']), [46266, 46267, 46295, undefined]);
  assert.deepEqual(values(sh, ['E6', 'F6', 'I6', 'J6']), ['Thứ 3', 'Thứ 4', 'Thứ 7', 'Chủ nhật']);
  assert.deepEqual(values(sh, ['E7', 'AH7', 'AI7']), [1, 30, undefined]);
  assert.deepEqual([...sh.merges].sort(), [...ORIGINAL_MERGES.tong].sort());
  assert.equal(sh.widths.length, 39);
  assert.deepEqual([sh.zoom, sh.freeze], [85, { x: 4, y: 7 }]);
  assert.deepEqual(sh.margins, { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 });
});

test('tổng: ba nhóm nối tiếp, dòng dự phòng 39, 24 và 5 như file gốc, chữ T N L theo lịch, số ngày từng người, tổng cộng ở hàng 79', () => {
  const sh = sheetNamed(build(), 'tổng');
  assert.deepEqual(values(sh, ['C8', 'C48', 'C73', 'C79']), ['Trực đặc biệt', 'Trực thường', 'Trực ngoài BV', 'TỔNG CỘNG:']);
  assert.deepEqual(values(sh, ['A9', 'B9', 'C9', 'D9', 'E9', 'F9', 'G9', 'I9', 'J9', 'K9', 'AJ9', 'AK9', 'AL9', 'AM9']),
    [1, 1, 'Người A', 'BS', 'T', 'L', undefined, 'N', 'N', 'T', 5, 2, 2, 1]);
  assert.deepEqual(values(sh, ['A10', 'B10', 'C10', 'E10', 'AJ10', 'AK10', 'AL10', 'AM10']), [2, 0, 'Người B', undefined, 0, 0, 0, 0]);
  assert.deepEqual(values(sh, ['A11', 'C11', 'AJ11']), [undefined, undefined, undefined]);
  assert.deepEqual(values(sh, ['A49', 'C49', 'E49', 'A50', 'C50', 'A74', 'C74', 'F74', 'A75']), [1, 'Người A', 'T', 2, 'Người B', 1, 'Người A', 'L', undefined]);
  assert.deepEqual(values(sh, ['E79', 'F79', 'G79', 'AJ79', 'AK79', 'AL79', 'AM79']), [3, 3, 0, 15, 6, 6, 3]);
});

test('tổng: nhiều người hơn số dòng dự phòng thì nhóm dài ra, các nhóm sau và tổng cộng dịch xuống', () => {
  const monthData = sampleMonth();
  monthData.groups.dacBiet = Array.from({ length: 41 }, (_, i) => person(`Người ${i + 1}`, [1], 'BS', `d${i}`));
  const sh = sheetNamed(build({ monthData }), 'tổng');
  assert.deepEqual(values(sh, ['C49', 'C50', 'C75', 'C81']), ['Người 41', 'Trực thường', 'Trực ngoài BV', 'TỔNG CỘNG:']);
  assert.deepEqual(values(sh, ['AJ81', 'E81']), [41 + 5 + 5, 43]);
});

test('tổng: người không có tên bị bỏ, người đặt đúng thứ tự, số thứ tự tính lại từng nhóm', () => {
  const monthData = sampleMonth();
  monthData.groups.thuong = [person('  ', []), person('Người B', [3], 'ĐD', 't2'), person('Người C', [], 'ĐD', 't3')];
  const sh = sheetNamed(build({ monthData }), 'tổng');
  assert.deepEqual(values(sh, ['A49', 'C49', 'D49', 'A50', 'C50', 'A51']), [1, 'Người B', 'ĐD', 2, 'Người C', undefined]);
});

test('tổng: màu như file gốc, nhãn nhóm, nền từng nhóm, T7 và CN xám, ngày lễ cam nhạt chữ đỏ, tiêu đề cam', () => {
  const sh = sheetNamed(build(), 'tổng');
  const s = (ref) => sh.cells.get(ref).s;
  assert.deepEqual(['C8', 'C48', 'C73'].map((r) => s(r).fill), ['FAC090', 'FA72D6', 'FA72D6']);
  assert.equal(s('I1').color, 'E46C0A');
  assert.deepEqual(['A9', 'C9', 'AJ9', 'L9', 'C30', 'AM47'].map((r) => s(r).fill), ['CCFFFF', 'CCFFFF', 'CCFFFF', 'CCFFFF', 'CCFFFF', 'CCFFFF']);
  assert.deepEqual(['C74', 'L74', 'C75', 'L75', 'AM78'].map((r) => s(r).fill), ['FDEADA', 'FDEADA', '66FF99', '66FF99', '66FF99']);
  assert.deepEqual(['I5', 'I6', 'I7', 'I9', 'I30', 'I49', 'I74'].map((r) => s(r).fill), Array(7).fill('BFBFBF'));
  assert.deepEqual(['F5', 'F9', 'F50'].map((r) => [s(r).fill, s(r).color]), Array(3).fill(['FCD5B5', 'FF0000']));
  assert.deepEqual(['E9', 'K9', 'E49'].map((r) => s(r).fill), ['CCFFFF', 'CCFFFF', undefined]);
  assert.deepEqual(['E49', 'E74'].map((r) => [s(r).sz, s(r).b ?? false]), [[9, true], [12, false]]);
  assert.equal(s('C79').b, true);
  assert.ok(['A4', 'E5', 'E6', 'C9', 'AM47', 'C79'].every((r) => s(r).bd === 'lrtb'));
  assert.equal(s('E6').rot, 90);
  assert.equal(s('E5').nf, 'dd');
});

test('tổng trong tệp xlsx: ghi cố định ô, thu phóng và không màu thẻ, các sheet in có màu thẻ xanh lá', () => {
  const files = unzipStore(TT.xlsxBytes(build(), new Date(2026, 9, 15)));
  const tong = files.get('xl/worksheets/sheet1.xml');
  assertWellFormed('tong', tong);
  assert.ok(tong.includes('zoomScale="85"') && tong.includes('<pane xSplit="4" ySplit="7" topLeftCell="E8" activePane="bottomRight" state="frozen"/>'));
  assert.ok(!tong.includes('<tabColor'));
  assert.ok(files.get('xl/worksheets/sheet2.xml').includes('<sheetPr><tabColor rgb="FF00B050"/><pageSetUpPr fitToPage="1"/></sheetPr>'));
  assert.ok(!files.get('xl/worksheets/sheet3.xml').includes('<tabColor'));
  assert.ok(/<pageMargins left="0\.7" right="0\.7" top="0\.75" bottom="0\.75" header="0\.3" footer="0\.3"\/>/.test(files.get('xl/worksheets/sheet3.xml')));
  assert.ok(/<pageMargins left="0" right="0" top="0\.748" bottom="0\.748" header="0\.315" footer="0\.315"\/>/.test(files.get('xl/worksheets/sheet2.xml')));
});

test('bảng chấm công in (122020): bản sao của bảng chấm công in, cùng nội dung và cùng định dạng', () => {
  const sheets = build();
  const a = sheetNamed(sheets, 'bảng chấm công in');
  const b = sheetNamed(sheets, 'bảng chấm công in (122020)');
  assert.deepEqual([...b.cells.entries()].map(([ref, c]) => [ref, c.v, c.s]), [...a.cells.entries()].map(([ref, c]) => [ref, c.v, c.s]));
  assert.deepEqual([b.merges, b.widths, b.heights, b.tab], [a.merges, a.widths, a.heights, a.tab]);
  assert.notEqual(a, b);
});

test('định dạng bảng in như file gốc: tiêu đề bảng chấm công màu cam, tổng cộng gạch chân, chiều cao hàng đặc trưng', () => {
  const sheets = build();
  const cc = sheetNamed(sheets, 'bảng chấm công in');
  assert.equal(cc.cells.get('R1').s.color, 'E46C0A');
  assert.deepEqual([cc.heights[1], cc.heights[3], cc.heights[6], cc.heights[28], cc.heights[29], cc.heights[30]], [23.2, 17.6, 33.05, 9.75, 19.2, 25.5]);
  const th = sheetNamed(sheets, 'Trực thường');
  assert.equal(th.cells.get('A21').s.u, true);
  assert.deepEqual([th.heights[4], th.heights[9], th.heights[21], th.heights[22], th.heights[24]], [23.2, 44, 24.6, 21.6, 25.5]);
  const db = sheetNamed(sheets, 'Trực ĐB');
  assert.deepEqual([db.heights[5], db.heights[6], db.heights[9], db.heights[23], db.heights[24], db.heights[26]], [24.75, 10.5, 44, 33.75, 19.2, 25.5]);
  assert.deepEqual([th.widths[1], th.widths[13], db.widths[1], db.widths[13]], [21.711, 6.141, 24.141, 12.711]);
  const bs = sheetNamed(sheets, 'BS A');
  assert.deepEqual([bs.heights[6], bs.heights[7], bs.heights[10], bs.heights[11], bs.heights[14], bs.heights[15], bs.heights[17], bs.heights[18]], [24.75, 10.5, 44, 25.5, 33.75, 19.2, 16.5, 25.5]);
  assert.deepEqual([bs.heights[12], bs.heights[13]], [undefined, undefined]);
  assert.deepEqual(['H11', 'I11', 'J11', 'K11', 'I14'].map((ref) => bs.cells.get(ref).s.h), ['center', 'center', 'center', 'right', 'center']);
  assert.deepEqual(['I11', 'K11'].map((ref) => th.cells.get(ref).s.h), ['right', 'right']);
});

test('chữ ký cuối bảng như file gốc: nhãn đứng một ô canh trái, các nhãn gộp canh giữa và tự xuống dòng, nhãn cuối không tự xuống dòng', () => {
  const sheets = build();
  const th = sheetNamed(sheets, 'Trực thường');
  assert.deepEqual(['B24', 'C24', 'E24', 'H24', 'K24'].map((ref) => [th.cells.get(ref).s.h, th.cells.get(ref).s.wrap ?? false]),
    [[undefined, false], ['center', true], ['center', true], ['center', true], ['center', false]]);
  const cc = sheetNamed(sheets, 'bảng chấm công in');
  assert.deepEqual(['C30', 'F30', 'M30', 'W30', 'AH30'].map((ref) => [cc.cells.get(ref).s.h, cc.cells.get(ref).s.wrap ?? false]),
    [['center', true], [undefined, false], ['center', true], ['center', true], ['center', false]]);
});

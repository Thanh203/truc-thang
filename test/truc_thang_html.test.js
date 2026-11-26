import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../truc_thang.html', import.meta.url), 'utf8');
const block = /<script id="cong-thuc">([\s\S]*?)<\/script>/.exec(html);
assert.ok(block, 'thiếu khối <script id="cong-thuc"> trong truc_thang.html');
const TT = new Function(`${block[1]}\nreturn TT;`)();

const SEP_HOLIDAYS = new Set(['2026-09-02']);
const sepDays = (holidays = SEP_HOLIDAYS) => TT.monthDays(2026, 9, holidays);
const person = (name, days, title = 'BS', id = `id_${name}`) => ({ id, name, title, days });
const rates = (donGia, tienAn, heSoNghi, heSoLe) => ({ donGia, tienAn, heSoNghi, heSoLe });
const dutyA = [1, 2, 5, 6, 7];

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

test('monthDays: thứ của tháng 9 năm 2026 và loại ngày T, N, L', () => {
  const days = sepDays();
  assert.equal(days.length, 30);
  assert.equal(days[0].iso, '2026-09-01');
  assert.deepEqual(days.slice(0, 7).map((d) => [d.day, d.weekday, d.type]), [
    [1, 2, 'T'], [2, 3, 'L'], [3, 4, 'T'], [4, 5, 'T'], [5, 6, 'N'], [6, 0, 'N'], [7, 1, 'T'],
  ]);
});

test('monthDays: ngày lễ rơi vào thứ 7 vẫn là L', () => {
  assert.equal(sepDays(new Set(['2026-09-05']))[4].type, 'L');
});

for (const [year, month, expected] of [[2026, 2, 28], [2028, 2, 29], [2100, 2, 28], [2000, 2, 29], [2026, 9, 30], [2026, 12, 31]]) {
  test(`daysInMonth(${year}, ${month}) là ${expected}`, () => assert.equal(TT.daysInMonth(year, month), expected));
}

test('shiftMonth qua ranh giới năm', () => {
  assert.deepEqual(TT.shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(TT.shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
});

test('defaultSignDate là mùng 1 của tháng sau, kể cả tháng 12', () => {
  assert.equal(TT.defaultSignDate(2026, 9), '2026-10-01');
  assert.equal(TT.defaultSignDate(2026, 12), '2027-01-01');
});

test('signDateTexts giữ kiểu khoảng trắng của bảng chấm công và bảng thanh toán', () => {
  assert.deepEqual(TT.signDateTexts('2026-10-01'), {
    timesheet: 'Ngày  01  tháng  10  năm 2026',
    pay: 'Ngày     01   tháng   10  năm 2026',
  });
});

const wordCases = [
  [0, 'Không đồng'], [1, 'Một đồng'], [10, 'Mười đồng'], [11, 'Mười một đồng'], [15, 'Mười lăm đồng'],
  [21, 'Hai mươi mốt đồng'], [24, 'Hai mươi bốn đồng'], [25, 'Hai mươi lăm đồng'], [100, 'Một trăm đồng'],
  [105, 'Một trăm lẻ năm đồng'], [110, 'Một trăm mười đồng'], [1000, 'Một nghìn đồng'],
  [1005, 'Một nghìn không trăm lẻ năm đồng'], [1000000, 'Một triệu đồng'],
  [3005000, 'Ba triệu không trăm lẻ năm nghìn đồng'],
  [1234567, 'Một triệu hai trăm ba mươi bốn nghìn năm trăm sáu mươi bảy đồng'],
  [29661000, 'Hai mươi chín triệu sáu trăm sáu mươi mốt nghìn đồng'],
  [31551000, 'Ba mươi mốt triệu năm trăm năm mươi mốt nghìn đồng'],
  [1000000000, 'Một tỷ đồng'], [1000005000, 'Một tỷ không trăm lẻ năm nghìn đồng'],
  [2500000000000, 'Hai nghìn năm trăm tỷ đồng'],
];
for (const [amount, expected] of wordCases) {
  test(`soTienBangChu(${amount})`, () => assert.equal(TT.soTienBangChu(amount), expected));
}

test('soTienBangChu từ chối số âm, số lẻ và không phải số', () => {
  for (const bad of [-1, 1.5, NaN, Infinity, '5', null]) {
    assert.throws(() => TT.soTienBangChu(bad), /số nguyên không âm/);
  }
});

test('payGroup: tính tay một người nhóm Thường (2 ngày T, 2 ngày N, 1 ngày L)', () => {
  const g = TT.payGroup([person('Người A', dutyA)], sepDays(), rates(100000, 20000, 1.5, 2), true);
  assert.deepEqual(g.unit, { T: 100000, N: 150000, L: 200000, meal: 20000 });
  assert.deepEqual(g.rows[0], {
    stt: 1, id: 'id_Người A', name: 'Người A', title: 'BS',
    nT: 2, amtT: 200000, nN: 2, amtN: 300000, nL: 1, amtL: 200000,
    nTotal: 5, amount: 700000, meal: 100000, net: 800000,
  });
  assert.equal(g.words, 'Tám trăm nghìn đồng');
});

test('payGroup: dòng Tổng cộng cộng số ngày từng cột rồi nhân đơn giá', () => {
  const g = TT.payGroup([person('Người A', dutyA), person('Người B', [1, 5])], sepDays(), rates(100000, 20000, 1.5, 2), true);
  assert.equal(g.rows[1].net, 290000);
  assert.deepEqual(g.total, {
    nT: 3, amtT: 300000, nN: 3, amtN: 450000, nL: 1, amtL: 200000,
    nTotal: 7, amount: 950000, meal: 140000, net: 1090000,
  });
});

test('payGroup: làm tròn 15 chữ số như Excel, 100000 nhân 1,15 là 115000 chứ không phải 114999.99999999999', () => {
  const g = TT.payGroup([person('Người A', [5])], sepDays(), rates(100000, 0, 1.15, 2), true);
  assert.equal(g.unit.N, 115000);
  assert.equal(g.rows[0].amtN, 115000);
});

test('payGroup: số 0 để trống, người không trực vẫn có dòng khi hiện cả danh sách', () => {
  const people = [person('Người A', [1]), person('Người B', [])];
  const full = TT.payGroup(people, sepDays(), rates(100000, 20000, 1.5, 2), true);
  const [a, b] = full.rows;
  assert.deepEqual([a.nT, a.nN, a.nL, a.amtN, a.amtL], [1, null, null, null, null]);
  assert.deepEqual([b.stt, b.name, b.nT, b.nTotal, b.amount, b.meal, b.net], [2, 'Người B', null, null, null, null, null]);
  const dutyOnly = TT.payGroup(people, sepDays(), rates(100000, 20000, 1.5, 2), false);
  assert.deepEqual(dutyOnly.rows.map((r) => r.name), ['Người A']);
});

test('payGroup: dòng không có tên không vào bảng', () => {
  const g = TT.payGroup([person('  ', [1]), person('Người A', [1])], sepDays(), rates(100000, 20000, 1.5, 2), true);
  assert.deepEqual(g.rows.map((r) => r.name), ['Người A']);
});

test('payGroup: không ai trực thì tổng để trống và không có số tiền bằng chữ', () => {
  const g = TT.payGroup([person('Người A', [])], sepDays(), rates(100000, 20000, 1.5, 2), true);
  assert.deepEqual(g.total, { nT: null, amtT: null, nN: null, amtN: null, nL: null, amtL: null, nTotal: null, amount: null, meal: null, net: null });
  assert.equal(g.words, '');
});

test('payAll: mỗi nhóm dùng đúng bộ số của nhóm mình, nhóm Thường hiện cả danh sách', () => {
  const all = TT.payAll(sampleMonth(), sepDays());
  assert.deepEqual([all.thuong.total.net, all.dacBiet.total.net, all.ngoaiBV.total.net], [800000, 370000, 577000]);
  assert.deepEqual([all.thuong.rows.length, all.dacBiet.rows.length, all.ngoaiBV.rows.length], [2, 1, 1]);
});

test('timesheetRows: thứ tự nhóm, STT liên tục, số ngày T N L, tổng từng ngày', () => {
  const month = sampleMonth();
  month.groups = {
    dacBiet: [person('Người X', [3]), person('Người Y', [])],
    thuong: [person('Người P', [1, 2]), person('Người Q', []), person('  ', [])],
    ngoaiBV: [person('Người Z', [10])],
  };
  const t = TT.timesheetRows(month, sepDays());
  assert.deepEqual(t.rows.map((r) => [r.stt, r.name, r.nTotal, r.nT, r.nN, r.nL]), [
    [1, 'Người X', 1, 1, null, null],
    [2, 'Người P', 2, 1, null, 1],
    [3, 'Người Q', null, null, null, null],
    [4, 'Người Z', 1, 1, null, null],
  ]);
  assert.equal(t.rows[1].marks.length, 30);
  assert.deepEqual(t.rows[1].marks.slice(0, 3), [true, true, false]);
  assert.deepEqual([t.dayTotals[0], t.dayTotals[1], t.dayTotals[2], t.dayTotals[3], t.dayTotals[9]], [1, 1, 1, 0, 1]);
  assert.deepEqual(t.sums, { nTotal: 4, nT: 3, nN: 0, nL: 1 });
});

test('getMonth: tháng mới chỉ sao đơn giá từ tháng trước, không sao người, chưa ghi vào dữ liệu', () => {
  const data = TT.emptyData();
  const sep = { signDate: '2026-10-05', rates: sampleMonth().rates, groups: { dacBiet: [], thuong: [person('Người A', [1, 2])], ngoaiBV: [] } };
  data.months['2026_09'] = sep;
  const got = TT.getMonth(data, 2026, 10);
  assert.equal(got.exists, false);
  assert.equal(got.key, '2026_10');
  assert.deepEqual(got.monthData.groups, { dacBiet: [], thuong: [], ngoaiBV: [] });
  assert.deepEqual(got.monthData.rates, sep.rates);
  assert.equal(got.monthData.signDate, null);
  got.monthData.rates.thuong.donGia = 1;
  assert.equal(sep.rates.thuong.donGia, 100000);
  assert.equal(data.months['2026_10'], undefined);
  assert.equal(TT.getMonth(data, 2026, 9).monthData, sep);
});

test('getMonth: chưa có tháng nào thì danh sách rỗng và bộ số bằng 0', () => {
  const got = TT.getMonth(TT.emptyData(), 2026, 9);
  assert.deepEqual(got.monthData.groups, { dacBiet: [], thuong: [], ngoaiBV: [] });
  assert.deepEqual(got.monthData.rates.thuong, rates(0, 0, 0, 0));
});

test('toggleDay: thêm giữ thứ tự tăng dần, bấm lại thì bỏ', () => {
  const p = person('Người A', [5]);
  assert.equal(TT.toggleDay(p, 2), true);
  assert.deepEqual(p.days, [2, 5]);
  assert.equal(TT.toggleDay(p, 5), false);
  assert.deepEqual(p.days, [2]);
});

const goodFile = () => ({
  schemaVersion: 1,
  settings: { department: 'Khoa', rateHistory: [], holidays: [{ date: '2026-09-02', name: 'Quốc khánh', confirmed: false }] },
  months: { '2026_09': sampleMonth() },
});

test('checkShape: nhận file bản cũ không có hospital, signLabels, seededYears', () => {
  assert.doesNotThrow(() => TT.checkShape(goodFile()));
  assert.doesNotThrow(() => TT.checkShape(TT.emptyData()));
});

test('checkShape: từ chối schemaVersion lạ, ngày ngoài tháng và id trùng', () => {
  const wrongVersion = goodFile();
  wrongVersion.schemaVersion = 2;
  assert.throws(() => TT.checkShape(wrongVersion), /schemaVersion/);
  const outside = goodFile();
  outside.months['2026_09'].groups.thuong[0].days = [31];
  assert.throws(() => TT.checkShape(outside), /ngày/);
  const duplicated = goodFile();
  duplicated.months['2026_09'].groups.thuong[1].id = duplicated.months['2026_09'].groups.thuong[0].id;
  assert.throws(() => TT.checkShape(duplicated), /trùng/);
});

test('parseDataText: báo lỗi rõ khi không phải JSON', () => {
  assert.throws(() => TT.parseDataText('{bad'), /không phải JSON/);
});

test('normalizeName: chuẩn hóa NFC, bỏ ký tự vô hình, gộp khoảng trắng', () => {
  assert.equal(TT.normalizeName('  Lê  Van​ \t A '), 'Lê Van A');
});

test('parseMoney: nhận số nguyên có dấu ngăn nghìn, từ chối số thập phân và dấu lẫn lộn', () => {
  for (const [text, expected] of [['100.000', 100000], ['100,000', 100000], ['100000', 100000], [' 1.234.567 ', 1234567], ['0', 0]]) {
    assert.equal(TT.parseMoney(text), expected, text);
  }
  for (const bad of ['100000,00', '100000.00', '12.34', '1.5', '1.234,567', '', 'abc', '-5']) {
    assert.ok(Number.isNaN(TT.parseMoney(bad)), bad);
  }
});

test('parseCoef: nhận dấu phẩy hoặc dấu chấm thập phân, từ chối chữ và số âm', () => {
  for (const [text, expected] of [['1,3', 1.3], ['1.8', 1.8], ['2', 2], ['0', 0]]) {
    assert.equal(TT.parseCoef(text), expected, text);
  }
  for (const bad of ['', 'x', '1,3,4', '-1']) {
    assert.ok(Number.isNaN(TT.parseCoef(bad)), bad);
  }
});

test('seedHolidays: nạp ngày lễ 2026 một lần, xóa rồi nạp lại không hiện lại', () => {
  const settings = TT.emptyData().settings;
  assert.ok(TT.seedHolidays(settings, 2026) > 0);
  assert.ok(settings.holidays.some((h) => h.date === '2026-09-02'));
  assert.equal(TT.seedHolidays(settings, 2026), 0);
  TT.removeHoliday(settings, '2026-09-02');
  assert.equal(TT.seedHolidays(settings, 2026), 0);
  assert.ok(!settings.holidays.some((h) => h.date === '2026-09-02'));
});

test('seedHolidays: file cũ đã có ngày lễ của năm đó thì không nạp thêm ngày đã bị xóa', () => {
  const settings = TT.emptyData().settings;
  delete settings.seededYears;
  settings.holidays.push({ date: '2026-05-01', name: 'Quốc tế Lao động', confirmed: true });
  assert.equal(TT.seedHolidays(settings, 2026), 0);
  assert.deepEqual(settings.holidays.map((h) => h.date), ['2026-05-01']);
});

test('seedHolidays: năm không có danh sách nạp sẵn thì không thêm gì', () => {
  const settings = TT.emptyData().settings;
  assert.equal(TT.seedHolidays(settings, 2031), 0);
  assert.deepEqual(settings.holidays, []);
});

test('addHoliday: từ chối ngày sai và ngày trùng, giữ thứ tự theo ngày', () => {
  const settings = TT.emptyData().settings;
  TT.addHoliday(settings, { date: '2026-09-02', name: 'Quốc khánh' });
  TT.addHoliday(settings, { date: '2026-05-01', name: 'Quốc tế Lao động' });
  assert.deepEqual(settings.holidays.map((h) => h.date), ['2026-05-01', '2026-09-02']);
  assert.throws(() => TT.addHoliday(settings, { date: '2026-02-30', name: 'x' }), /không hợp lệ/);
  assert.throws(() => TT.addHoliday(settings, { date: '2026-09-02', name: 'x' }), /đã có/);
});

test('validateMonth: lỗi khi có ngày trực mà không có tên, hoặc có người trực mà bộ số bằng 0', () => {
  const month = sampleMonth();
  month.rates.thuong = rates(0, 0, 0, 0);
  month.groups = { dacBiet: [person(' ', [3])], thuong: [person('Người A', [1])], ngoaiBV: [] };
  const result = TT.validateMonth({ year: 2026, month: 9, monthData: month, settings: { holidays: [{ date: '2026-09-02', name: 'Quốc khánh', confirmed: false }] } });
  assert.deepEqual(result.errors.map((e) => `${e.code}:${e.group}`), ['thieu_ten:dacBiet', 'chua_nhap_so:thuong']);
  assert.deepEqual(result.warnings, []);
});

test('validateMonth: cảnh báo khi năm chưa có ngày lễ hoặc tiền ăn bằng 0 mà có người trực', () => {
  const month = sampleMonth();
  month.rates.thuong = rates(100000, 0, 1.5, 2);
  month.groups = { dacBiet: [], thuong: [person('Người A', [1])], ngoaiBV: [] };
  const result = TT.validateMonth({ year: 2026, month: 9, monthData: month, settings: { holidays: [] } });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings.map((w) => `${w.code}:${w.group ?? ''}`), ['khong_co_ngay_le:', 'tien_an_bang_0:thuong']);
});

test('cellKeyAction: T, N, L (hoa hoặc thường) là đánh dấu kèm chữ đã gõ', () => {
  for (const key of ['t', 'T']) assert.deepEqual(TT.cellKeyAction(key), { act: 'set', letter: 'T' });
  for (const key of ['n', 'N']) assert.deepEqual(TT.cellKeyAction(key), { act: 'set', letter: 'N' });
  for (const key of ['l', 'L']) assert.deepEqual(TT.cellKeyAction(key), { act: 'set', letter: 'L' });
});

test('cellKeyAction: phím cách đảo trạng thái, Delete và Backspace xóa', () => {
  assert.deepEqual(TT.cellKeyAction(' '), { act: 'toggle' });
  assert.deepEqual(TT.cellKeyAction('Delete'), { act: 'clear' });
  assert.deepEqual(TT.cellKeyAction('Backspace'), { act: 'clear' });
});

test('cellKeyAction: phím khác bị bỏ qua, kể cả tên phím trùng thuộc tính của đối tượng', () => {
  for (const key of ['a', 'x', '1', 'tn', 'Enter', 'Tab', 'Escape', 'ArrowUp', 'Process', 'Unidentified', '', 'constructor']) {
    assert.equal(TT.cellKeyAction(key), null, key);
  }
});

test('letterNote: chữ trùng loại ngày hoặc không gõ chữ thì không có ghi chú', () => {
  assert.equal(TT.letterNote('T', 'T', 5), null);
  assert.equal(TT.letterNote('N', 'N', 8), null);
  assert.equal(TT.letterNote('L', 'L', 2), null);
  assert.equal(TT.letterNote(null, 'N', 8), null);
});

test('letterNote: chữ khác loại ngày nói rõ ngày đó được tính loại nào', () => {
  assert.equal(TT.letterNote('N', 'T', 5), 'Ngày 5 là ngày thường, trang tính T, không tính N.');
  assert.equal(TT.letterNote('T', 'N', 8), 'Ngày 8 là thứ 7 hoặc chủ nhật, trang tính N, không tính T.');
  assert.equal(TT.letterNote('T', 'L', 2), 'Ngày 2 là ngày lễ, trang tính L, không tính T.');
});

test('letterNote: gõ L vào ngày chưa có trong danh sách lễ thì chỉ cách thêm ngày lễ', () => {
  assert.equal(TT.letterNote('L', 'T', 24), 'Ngày 24 là ngày thường, trang tính T, không tính L. Muốn tính lễ, thêm ngày này vào mục Ngày lễ.');
  assert.equal(TT.letterNote('L', 'N', 8), 'Ngày 8 là thứ 7 hoặc chủ nhật, trang tính N, không tính L. Muốn tính lễ, thêm ngày này vào mục Ngày lễ.');
});

const GRID = { rows: 3, cols: 5 };
const at = (row, col) => ({ row, col });

test('gridStep: mũi tên đi một ô', () => {
  assert.deepEqual(TT.gridStep(at(1, 2), 'ArrowUp', false, GRID), at(0, 2));
  assert.deepEqual(TT.gridStep(at(1, 2), 'ArrowDown', false, GRID), at(2, 2));
  assert.deepEqual(TT.gridStep(at(1, 2), 'ArrowLeft', false, GRID), at(1, 1));
  assert.deepEqual(TT.gridStep(at(1, 2), 'ArrowRight', false, GRID), at(1, 3));
});

test('gridStep: Enter đi xuống, Shift Enter đi lên, Home và End về đầu và cuối dòng', () => {
  assert.deepEqual(TT.gridStep(at(1, 2), 'Enter', false, GRID), at(2, 2));
  assert.deepEqual(TT.gridStep(at(1, 2), 'Enter', true, GRID), at(0, 2));
  assert.deepEqual(TT.gridStep(at(1, 2), 'Home', false, GRID), at(1, 0));
  assert.deepEqual(TT.gridStep(at(1, 2), 'End', false, GRID), at(1, 4));
});

test('gridStep: ở mép thì đứng yên, không vượt ra ngoài', () => {
  assert.deepEqual(TT.gridStep(at(0, 0), 'ArrowUp', false, GRID), at(0, 0));
  assert.deepEqual(TT.gridStep(at(0, 0), 'ArrowLeft', false, GRID), at(0, 0));
  assert.deepEqual(TT.gridStep(at(2, 4), 'ArrowDown', false, GRID), at(2, 4));
  assert.deepEqual(TT.gridStep(at(2, 4), 'ArrowRight', false, GRID), at(2, 4));
  assert.deepEqual(TT.gridStep(at(2, 4), 'Enter', false, GRID), at(2, 4));
});

test('gridStep: phím không phải phím di chuyển trả về null', () => {
  for (const key of ['t', 'Tab', 'Escape', 'PageDown', ' ', 'constructor']) assert.equal(TT.gridStep(at(1, 2), key, false, GRID), null, key);
});

const holiday = (date, name, confirmed = true) => ({ date, name, confirmed });
const withMonths = (months) => ({ ...TT.emptyData(), months });

test('mergeDefaults: thêm các tháng chưa có và trả về khóa tháng đã thêm theo thứ tự', () => {
  const data = TT.emptyData();
  const defaults = withMonths({ '2026_11': sampleMonth(), '2026_09': sampleMonth() });
  assert.deepEqual(TT.mergeDefaults(data, defaults), ['2026_09', '2026_11']);
  assert.deepEqual(Object.keys(data.months).sort(), ['2026_09', '2026_11']);
});

test('mergeDefaults: không ghi đè tháng đã có, kể cả khi nội dung khác', () => {
  const mine = sampleMonth();
  mine.groups.thuong[0].name = 'Tên đã sửa';
  const data = withMonths({ '2026_11': mine });
  const defaults = withMonths({ '2026_11': sampleMonth(), '2026_12': sampleMonth() });
  assert.deepEqual(TT.mergeDefaults(data, defaults), ['2026_12']);
  assert.equal(data.months['2026_11'].groups.thuong[0].name, 'Tên đã sửa');
});

test('mergeDefaults: tháng thêm vào là bản sao, sửa tiếp không làm đổi dữ liệu mặc định', () => {
  const data = TT.emptyData();
  const defaults = withMonths({ '2026_11': sampleMonth() });
  TT.mergeDefaults(data, defaults);
  data.months['2026_11'].groups.thuong.push(person('Người mới', [30]));
  data.months['2026_11'].rates.thuong.donGia = 1;
  assert.deepEqual(defaults.months['2026_11'], sampleMonth());
});

test('mergeDefaults: chỉ lấy ngày lễ của tháng vừa thêm, giữ thứ tự ngày', () => {
  const data = withMonths({ '2026_09': sampleMonth() });
  data.settings.holidays = [holiday('2026-09-02', 'Của tôi')];
  const defaults = withMonths({ '2026_09': sampleMonth(), '2026_11': sampleMonth() });
  defaults.settings.holidays = [holiday('2026-09-01', 'Mặc định tháng 9'), holiday('2026-09-02', 'Mặc định khác'),
    holiday('2026-11-24', 'Mặc định tháng 11', false), holiday('2026-12-25', 'Mặc định tháng 12')];
  assert.deepEqual(TT.mergeDefaults(data, defaults), ['2026_11']);
  assert.deepEqual(data.settings.holidays, [holiday('2026-09-02', 'Của tôi'), holiday('2026-11-24', 'Mặc định tháng 11', false)]);
});

test('mergeDefaults: ngày lễ đã có cùng ngày thì giữ bản của người dùng', () => {
  const data = TT.emptyData();
  data.settings.holidays = [holiday('2026-11-24', 'Của tôi')];
  const defaults = withMonths({ '2026_11': sampleMonth() });
  defaults.settings.holidays = [holiday('2026-11-24', 'Mặc định', false)];
  TT.mergeDefaults(data, defaults);
  assert.deepEqual(data.settings.holidays, [holiday('2026-11-24', 'Của tôi')]);
});

test('mergeDefaults: điền bệnh viện và khoa khi đang trống, không đè khi đã có', () => {
  const defaults = withMonths({ '2026_11': sampleMonth() });
  defaults.settings.hospital = 'Bệnh viện mặc định';
  defaults.settings.department = 'Khoa mặc định';
  const blank = TT.emptyData();
  TT.mergeDefaults(blank, defaults);
  assert.deepEqual([blank.settings.hospital, blank.settings.department], ['Bệnh viện mặc định', 'Khoa mặc định']);
  const filled = TT.emptyData();
  filled.settings.hospital = 'Của tôi';
  filled.settings.department = 'Khoa của tôi';
  TT.mergeDefaults(filled, defaults);
  assert.deepEqual([filled.settings.hospital, filled.settings.department], ['Của tôi', 'Khoa của tôi']);
});

test('mergeDefaults: mặc định không có bệnh viện thì không thêm khóa hospital vào dữ liệu', () => {
  const data = TT.emptyData();
  delete data.settings.hospital;
  const defaults = withMonths({ '2026_11': sampleMonth() });
  delete defaults.settings.hospital;
  TT.mergeDefaults(data, defaults);
  assert.equal('hospital' in data.settings, false);
});

test('mergeDefaults: không có tháng nào để thêm thì dữ liệu giữ nguyên, kể cả bệnh viện và ngày lễ', () => {
  const data = withMonths({ '2026_11': sampleMonth() });
  const before = JSON.parse(JSON.stringify(data));
  const defaults = withMonths({ '2026_11': sampleMonth() });
  defaults.settings.hospital = 'Bệnh viện mặc định';
  defaults.settings.holidays = [holiday('2026-11-24', 'Mặc định')];
  assert.deepEqual(TT.mergeDefaults(data, defaults), []);
  assert.deepEqual(data, before);
});

test('mergeDefaults: dữ liệu mặc định sai cấu trúc thì ném lỗi và dữ liệu giữ nguyên', () => {
  const data = TT.emptyData();
  const bad = { ...withMonths({ '2026_11': sampleMonth() }), schemaVersion: 2 };
  assert.throws(() => TT.mergeDefaults(data, bad), /schemaVersion/);
  assert.deepEqual(data, TT.emptyData());
});

test('mergeDefaults: ngày lễ sau khi gộp vẫn xếp theo ngày, kể cả khi ngày thêm vào sớm hơn ngày đã có', () => {
  const data = withMonths({ '2026_12': sampleMonth() });
  data.settings.holidays = [holiday('2026-12-25', 'Của tôi')];
  const defaults = withMonths({ '2026_11': sampleMonth() });
  defaults.settings.holidays = [holiday('2026-11-24', 'Mặc định', false)];
  TT.mergeDefaults(data, defaults);
  assert.deepEqual(data.settings.holidays.map((h) => h.date), ['2026-11-24', '2026-12-25']);
});

// ---- tháng mẫu mặc định: tháng chưa có dữ liệu lấy người và đơn giá từ mẫu ----

function novMonth() {
  return {
    signDate: null,
    rates: sampleMonth().rates,
    groups: {
      dacBiet: [person('Người A', [3], 'BS', 'a1')],
      thuong: [person('Người A', [1, 2], 'BS', 'a2'), person('Người B', [4], 'ĐD', 'b2')],
      ngoaiBV: [],
    },
  };
}
const templateOf = (monthData, key = '2026_11') => ({ key, monthData });
const namesOf = (m, g = 'thuong') => m.groups[g].map((p) => p.name);

test('monthTemplate: lấy tháng mới nhất trong dữ liệu mặc định, không có tháng nào thì null', () => {
  const nov = novMonth();
  const defaults = withMonths({ '2026_11': nov, '2026_09': sampleMonth() });
  assert.deepEqual(TT.monthTemplate(defaults), { key: '2026_11', monthData: nov });
  assert.equal(TT.monthTemplate(TT.emptyData()), null);
});

test('monthTemplate: dữ liệu mặc định sai cấu trúc thì ném lỗi', () => {
  const bad = { ...withMonths({ '2026_11': sampleMonth() }), schemaVersion: 2 };
  assert.throws(() => TT.monthTemplate(bad), /schemaVersion/);
});

const rosterNames = (m) => ['dacBiet', 'thuong', 'ngoaiBV'].map((g) => m.groups[g].map((p) => p.name));

test('getMonth có mẫu: tháng sớm hơn mọi tháng có dữ liệu lấy đơn giá từ mẫu và không có người nào, là bản sao, chưa ghi vào dữ liệu', () => {
  const nov = novMonth();
  const data = withMonths({ '2026_11': nov });
  const got = TT.getMonth(data, 2026, 8, templateOf(nov));
  assert.equal(got.exists, false);
  assert.equal(got.key, '2026_08');
  assert.deepEqual(got.monthData.groups, { dacBiet: [], thuong: [], ngoaiBV: [] });
  assert.deepEqual(got.monthData.rates, nov.rates);
  assert.equal(got.monthData.signDate, null);
  got.monthData.rates.thuong.donGia = 1;
  assert.equal(nov.rates.thuong.donGia, 100000);
  assert.deepEqual(nov.groups.thuong.map((p) => [p.name, p.days]), [['Người A', [1, 2]], ['Người B', [4]]]);
  assert.equal(data.months['2026_08'], undefined);
});

test('getMonth không có mẫu: tháng sớm hơn mọi tháng có dữ liệu vẫn rỗng như trước', () => {
  const got = TT.getMonth(withMonths({ '2026_11': novMonth() }), 2026, 8);
  assert.deepEqual(got.monthData.groups, { dacBiet: [], thuong: [], ngoaiBV: [] });
  assert.deepEqual(got.monthData.rates.thuong, rates(0, 0, 0, 0));
});

test('getMonth có mẫu: tháng nằm giữa tháng cũ hơn mẫu và tháng mẫu lấy đơn giá từ mẫu, không lấy từ tháng cũ hơn, không có người', () => {
  const sep = { signDate: null, rates: { thuong: rates(1, 1, 1, 1), dacBiet: rates(1, 1, 1, 1), ngoaiBV: rates(1, 1, 1, 1) }, groups: { dacBiet: [], thuong: [person('Người A', [1], 'BS', 'a1')], ngoaiBV: [] } };
  const nov = novMonth();
  const data = withMonths({ '2026_09': sep, '2026_11': nov });
  const got = TT.getMonth(data, 2026, 10, templateOf(nov));
  assert.deepEqual(rosterNames(got.monthData), [[], [], []]);
  assert.deepEqual(got.monthData.rates, nov.rates);
  assert.equal(TT.getMonth(data, 2026, 9, templateOf(nov)).monthData, sep);
  assert.equal(TT.getMonth(data, 2026, 9, templateOf(nov)).exists, true);
});

test('getMonth có mẫu: tháng sau tháng mẫu sao đơn giá từ tháng gần nhất đã có dữ liệu, giữ chỉnh sửa của người dùng, không quay về mẫu, không sao người', () => {
  const nov = novMonth();
  nov.rates.thuong.donGia = 111000;
  const templateNov = novMonth();
  assert.equal(templateNov.rates.thuong.donGia, 100000);
  const onlyNov = withMonths({ '2026_11': nov });
  const dec = TT.getMonth(onlyNov, 2026, 12, templateOf(templateNov)).monthData;
  assert.equal(dec.rates.thuong.donGia, 111000);
  assert.deepEqual(rosterNames(dec), [[], [], []]);

  const decMine = novMonth();
  decMine.rates.thuong.donGia = 222000;
  decMine.groups.thuong.push(person('Người C', [], 'BS', 'c3'));
  const both = withMonths({ '2026_11': nov, '2026_12': decMine });
  const jan = TT.getMonth(both, 2027, 1, templateOf(templateNov)).monthData;
  assert.deepEqual(rosterNames(jan), [[], [], []]);
  assert.equal(jan.rates.thuong.donGia, 222000);
});

test('getMonth có mẫu: dữ liệu chưa có tháng mẫu thì tháng sau mẫu dùng đơn giá của mẫu, không dùng tháng cũ hơn mẫu', () => {
  const sep = { signDate: null, rates: { thuong: rates(1, 1, 1, 1), dacBiet: rates(1, 1, 1, 1), ngoaiBV: rates(1, 1, 1, 1) }, groups: { dacBiet: [], thuong: [person('Người A', [1], 'BS', 'a1')], ngoaiBV: [] } };
  const nov = novMonth();
  const got = TT.getMonth(withMonths({ '2026_09': sep }), 2026, 12, templateOf(nov));
  assert.deepEqual(rosterNames(got.monthData), [[], [], []]);
  assert.deepEqual(got.monthData.rates, nov.rates);
});

test('getMonth có mẫu: tháng đã có dữ liệu thì dùng dữ liệu đó, mẫu không đè', () => {
  const mine = novMonth();
  mine.groups.thuong = [person('Chỉ mình tôi', [5], 'BS', 'm1')];
  mine.rates.thuong.donGia = 7;
  const got = TT.getMonth(withMonths({ '2026_08': mine }), 2026, 8, templateOf(novMonth()));
  assert.equal(got.exists, true);
  assert.equal(got.monthData, mine);
});

test('trang: hai nút Lưu file JSON và Mở file JSON ẩn sẵn ngay trong HTML (không nhấp nháy trước khi mã chạy), ô chọn file vẫn còn', () => {
  assert.match(html, /<button type="button" id="luu-json" hidden>Lưu file JSON<\/button>/);
  assert.match(html, /<button type="button" id="mo-json" hidden>Mở file JSON<\/button>/);
  assert.match(html, /<input id="chon-json" type="file"[^>]*hidden>/);
  assert.match(html, /\$\(name\)\.hidden = location\.hash !== '#json'/);
});

// ---- mặc định chỉ có đơn giá: tên, chức danh và ngày trực đều để trống ----

test('mergeDefaults: tháng thêm từ mặc định chỉ có đơn giá, mọi người, ngày trực và ngày ký bị bỏ, dữ liệu mặc định không đổi', () => {
  const data = TT.emptyData();
  const withSign = sampleMonth();
  withSign.signDate = '2026-12-05';
  const defaults = withMonths({ '2026_11': withSign, '2026_09': sampleMonth() });
  TT.mergeDefaults(data, defaults);
  for (const key of ['2026_09', '2026_11']) {
    const m = data.months[key];
    assert.deepEqual(m.groups, { dacBiet: [], thuong: [], ngoaiBV: [] });
    assert.deepEqual(m.rates, sampleMonth().rates);
    assert.equal(m.signDate, null);
  }
  assert.deepEqual(defaults.months['2026_11'], withSign);
  assert.deepEqual(defaults.months['2026_09'].groups.thuong[0].days, dutyA);
});

// ---- dọn một lần: tháng đã lưu mà chưa có ngày trực nào thì bỏ hết người ----

const idleMonth = () => {
  const m = sampleMonth();
  for (const g of ['dacBiet', 'thuong', 'ngoaiBV']) for (const p of m.groups[g]) p.days = [];
  return m;
};
const noGroups = { dacBiet: [], thuong: [], ngoaiBV: [] };

test('clearIdleRosters: tháng có người mà chưa có ngày trực nào thì bỏ hết người ở cả ba nhóm, giữ đơn giá và ngày ký, trả về khóa tháng theo thứ tự', () => {
  const idle = idleMonth();
  idle.signDate = '2026-12-05';
  const data = withMonths({ '2026_11': idleMonth(), '2026_09': idle });
  assert.deepEqual(TT.clearIdleRosters(data), ['2026_09', '2026_11']);
  for (const key of ['2026_09', '2026_11']) {
    assert.deepEqual(data.months[key].groups, noGroups);
    assert.deepEqual(data.months[key].rates, sampleMonth().rates);
  }
  assert.equal(data.months['2026_09'].signDate, '2026-12-05');
});

test('clearIdleRosters: tháng đã có ít nhất một ngày trực ở bất kỳ nhóm nào giữ nguyên, kể cả những người không có ngày', () => {
  for (const group of ['dacBiet', 'thuong', 'ngoaiBV']) {
    const busy = idleMonth();
    busy.groups[group][0].days = [4];
    const data = withMonths({ '2026_11': busy, '2026_10': idleMonth() });
    const before = structuredClone(busy);
    assert.deepEqual(TT.clearIdleRosters(data), ['2026_10'], group);
    assert.deepEqual(data.months['2026_11'], before, group);
  }
});

test('clearIdleRosters: tháng chưa có người nào hoặc dữ liệu trống thì không động tới và không nằm trong kết quả', () => {
  const noPeople = sampleMonth();
  noPeople.groups = structuredClone(noGroups);
  const data = withMonths({ '2026_12': noPeople });
  const before = structuredClone(data);
  assert.deepEqual(TT.clearIdleRosters(data), []);
  assert.deepEqual(data, before);
  assert.deepEqual(TT.clearIdleRosters(TT.emptyData()), []);
});

test('clearIdleRosters: không đổi ngày lễ, bệnh viện, khoa và các tháng khác', () => {
  const data = withMonths({ '2026_11': idleMonth(), '2026_12': sampleMonth() });
  data.settings.holidays = [holiday('2026-11-24', 'Lễ', false)];
  data.settings.hospital = 'BV';
  data.settings.department = 'Khoa';
  const settings = structuredClone(data.settings);
  const dec = structuredClone(data.months['2026_12']);
  TT.clearIdleRosters(data);
  assert.deepEqual(data.settings, settings);
  assert.deepEqual(data.months['2026_12'], dec);
});

// ---- tháng đã lưu nhưng trống hoặc dở dang không được làm mất đơn giá mặc định của các tháng sau ----

const blankMonth = (signDate = null) => ({ signDate, rates: { dacBiet: rates(0, 0, 0, 0), thuong: rates(0, 0, 0, 0), ngoaiBV: rates(0, 0, 0, 0) }, groups: { dacBiet: [], thuong: [], ngoaiBV: [] } });
const pricesOnlyMonth = (fromMonth = novMonth()) => ({ ...blankMonth(), rates: structuredClone(fromMonth.rates) });

test('getMonth có mẫu: tháng đã lưu nhưng trống (đơn giá 0) được xem như chưa có, lấy đơn giá từ tháng gần nhất có đơn giá, giữ ngày ký, không sửa bản đã lưu', () => {
  const nov = novMonth();
  const dec = blankMonth('2026-12-05');
  const data = withMonths({ '2026_11': nov, '2026_12': dec });
  const got = TT.getMonth(data, 2026, 12, templateOf(nov));
  assert.equal(got.exists, false);
  assert.deepEqual(rosterNames(got.monthData), [[], [], []]);
  assert.deepEqual(got.monthData.rates, nov.rates);
  assert.equal(got.monthData.signDate, '2026-12-05');
  assert.equal(data.months['2026_12'], dec);
  assert.deepEqual(dec, blankMonth('2026-12-05'));
  got.monthData.rates.thuong.donGia = 1;
  assert.equal(nov.rates.thuong.donGia, 100000);
});

test('getMonth có mẫu: các tháng sau một tháng trống vẫn lấy đơn giá từ tháng có đơn giá gần nhất, bỏ qua tháng trống', () => {
  const nov = novMonth();
  nov.rates.thuong.donGia = 111000;
  const data = withMonths({ '2026_11': nov, '2026_12': blankMonth(), '2027_02': blankMonth() });
  for (const [y, m] of [[2027, 1], [2027, 3], [2027, 9]]) {
    const got = TT.getMonth(data, y, m, templateOf(novMonth()));
    assert.deepEqual(rosterNames(got.monthData), [[], [], []], `${m}/${y}`);
    assert.equal(got.monthData.rates.thuong.donGia, 111000, `${m}/${y}`);
  }
});

test('getMonth có mẫu: tháng có người nhưng chưa có đơn giá giữ người và ngày, lấy đơn giá từ nguồn; tháng có đơn giá nhưng chưa có người dùng nguyên bản đã lưu, không sao người', () => {
  const nov = novMonth();
  const onlyPeople = blankMonth();
  onlyPeople.groups.thuong = [person('Người riêng', [3, 4], 'BS', 'r1')];
  const a = TT.getMonth(withMonths({ '2026_11': nov, '2026_12': onlyPeople }), 2026, 12, templateOf(nov));
  assert.equal(a.exists, false);
  assert.deepEqual(a.monthData.groups.thuong.map((p) => [p.name, p.days]), [['Người riêng', [3, 4]]]);
  assert.deepEqual(a.monthData.rates, nov.rates);
  assert.deepEqual(onlyPeople.groups.thuong[0].days, [3, 4]);
  assert.deepEqual(onlyPeople.rates, blankMonth().rates);
  const onlyPrices = blankMonth();
  onlyPrices.rates = { dacBiet: rates(7, 7, 7, 7), thuong: rates(8, 8, 8, 8), ngoaiBV: rates(9, 9, 9, 9) };
  const b = TT.getMonth(withMonths({ '2026_11': nov, '2027_01': onlyPrices }), 2027, 1, templateOf(nov));
  assert.equal(b.exists, true);
  assert.equal(b.monthData, onlyPrices);
  assert.deepEqual(rosterNames(b.monthData), [[], [], []]);
});

test('getMonth có mẫu: tháng chỉ có người mà chưa có đơn giá không làm nguồn đơn giá, tháng sau nó lấy đơn giá từ tháng có đơn giá và không lấy người của nó', () => {
  const nov = novMonth();
  const dec = blankMonth();
  dec.groups.thuong = [person('Người riêng', [], 'BS', 'r1')];
  const got = TT.getMonth(withMonths({ '2026_11': nov, '2026_12': dec }), 2027, 1, templateOf(nov));
  assert.deepEqual(got.monthData.groups, noGroups);
  assert.deepEqual(got.monthData.rates, nov.rates);
});

test('getMonth không có mẫu: tháng trống ở giữa không làm các tháng sau mất đơn giá, tháng trống không có nguồn thì giữ nguyên bản đã lưu', () => {
  const sep = novMonth();
  const oct = blankMonth();
  const data = withMonths({ '2026_09': sep, '2026_10': oct });
  const nov = TT.getMonth(data, 2026, 11);
  assert.deepEqual(rosterNames(nov.monthData), [[], [], []]);
  assert.deepEqual(nov.monthData.rates, sep.rates);
  const healed = TT.getMonth(data, 2026, 10);
  assert.equal(healed.exists, false);
  assert.deepEqual(rosterNames(healed.monthData), [[], [], []]);
  assert.deepEqual(healed.monthData.rates, sep.rates);
  const lonely = withMonths({ '2026_12': blankMonth() });
  const same = TT.getMonth(lonely, 2026, 12);
  assert.equal(same.exists, true);
  assert.equal(same.monthData, lonely.months['2026_12']);
});

test('getMonth: tháng đã lưu có đơn giá dùng nguyên bản đã lưu, kể cả khi chỉ một nhóm có người hoặc một nhóm có đơn giá', () => {
  const mine = blankMonth();
  mine.groups.ngoaiBV = [person('Chỉ một', [2], 'BS', 'm1')];
  mine.rates.dacBiet = rates(0, 0, 0, 5);
  const data = withMonths({ '2026_11': novMonth(), '2026_12': mine });
  const got = TT.getMonth(data, 2026, 12, templateOf(novMonth()));
  assert.equal(got.exists, true);
  assert.equal(got.monthData, mine);
});

test('monthTemplate: bỏ qua tháng trống ở cuối file mặc định và tháng chỉ có người mà chưa có đơn giá, lấy tháng mới nhất có đơn giá dù không có người', () => {
  const nov = novMonth();
  const defaults = withMonths({ '2026_11': nov, '2026_12': blankMonth(), '2027_01': blankMonth() });
  assert.deepEqual(TT.monthTemplate(defaults), { key: '2026_11', monthData: nov });
  const onlyPeople = blankMonth();
  onlyPeople.groups.thuong = [person('Người riêng', [], 'BS', 'r1')];
  assert.equal(TT.monthTemplate(withMonths({ '2026_12': blankMonth(), '2026_10': onlyPeople })), null);
  assert.equal(TT.monthTemplate(withMonths({ '2026_12': blankMonth() })), null);
  const prices = pricesOnlyMonth();
  assert.equal(TT.monthTemplate(withMonths({ '2026_12': blankMonth(), '2026_10': prices })).key, '2026_10');
  assert.equal(TT.monthTemplate(withMonths({ '2026_12': blankMonth(), '2026_10': prices, '2026_08': novMonth() })).key, '2026_10');
});

test('getMonth có mẫu: file mặc định chỉ có đơn giá (không người nào) và có tháng trống ở cuối thì mọi tháng trước, sau và giữa đều có đơn giá mặc định và không có người', () => {
  const prices = pricesOnlyMonth();
  const defaults = withMonths({ '2026_11': prices, '2026_12': blankMonth() });
  const data = TT.emptyData();
  TT.mergeDefaults(data, defaults);
  const template = TT.monthTemplate(defaults);
  for (const [y, m] of [[2026, 8], [2026, 11], [2026, 12], [2027, 5]]) {
    const got = TT.getMonth(data, y, m, template);
    assert.deepEqual(rosterNames(got.monthData), [[], [], []], `${m}/${y}`);
    assert.deepEqual(got.monthData.rates, prices.rates, `${m}/${y}`);
  }
});

test('file mặc định kiểu cũ có cả tên, chức danh và ngày trực: mọi tháng vẫn chỉ có đơn giá, không người, không ngày', () => {
  const defaults = withMonths({ '2026_11': novMonth(), '2026_09': sampleMonth() });
  const data = TT.emptyData();
  TT.mergeDefaults(data, defaults);
  const template = TT.monthTemplate(defaults);
  for (const [y, m] of [[2026, 8], [2026, 9], [2026, 10], [2026, 11], [2026, 12], [2027, 6]]) {
    const got = TT.getMonth(data, y, m, template);
    assert.deepEqual(rosterNames(got.monthData), [[], [], []], `${m}/${y}`);
    assert.ok(got.monthData.rates.thuong.donGia > 0, `${m}/${y}`);
  }
});

test('trang: đầu trang có thẻ noindex để bản đăng công khai không bị máy tìm kiếm lập chỉ mục', () => {
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1];
  assert.match(head, /<meta name="robots" content="noindex, nofollow">/);
});

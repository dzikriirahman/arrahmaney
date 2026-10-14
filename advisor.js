// Dashboard penasihat bisnis, hutang & piutang, target, filter riwayat, dan ekspor laporan
// untuk aplikasi keuangan Toko Grosir AR-Rahman.
//
// Catatan metode: buku kas ini berbasis kas (cash basis). "Laba kotor" = penjualan - pembelian barang
// (kulakan) pada periode yang sama, jadi bukan HPP akuntansi murni (stok awal/akhir tidak dihitung).
// Angka, skor, dan saran adalah indikator bantu keputusan, bukan pengganti akuntan.
(function () {
  'use strict';

  // ------------------------------------------------------------------ util
  const $ = id => document.getElementById(id);
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseISO = s => { const [y, m, d] = String(s || '').slice(0, 10).split('-').map(Number); return new Date(y || 1970, (m || 1) - 1, d || 1); };
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const monthKeyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rp = n => {
    const v = Math.round(num(n));
    return (v < 0 ? '-' : '') + 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.abs(v));
  };
  const rpShort = n => {
    const v = num(n), a = Math.abs(v), sign = v < 0 ? '-' : '';
    if (a >= 1e9) return sign + 'Rp ' + (a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace('.', ',') + ' M';
    if (a >= 1e6) return sign + 'Rp ' + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' jt';
    if (a >= 1e3) return sign + 'Rp ' + Math.round(a / 1e3) + ' rb';
    return sign + 'Rp ' + Math.round(a);
  };
  const pct = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v)) ? '-' : (v * 100).toFixed(d).replace('.', ',') + '%';
  const monthLabel = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }); };
  const toast = (msg, type) => { if (typeof window.showToast === 'function') window.showToast(msg, type); };
  const getTrx = () => (typeof transactions !== 'undefined' && Array.isArray(transactions)) ? transactions : [];

  // Kategori dikenali lewat awalan nama supaya tahan terhadap perubahan kecil penulisan.
  const isSale = k => /^penjualan/i.test(k || '');
  const isCogs = k => /^pembelian barang/i.test(k || '');
  const isPayroll = k => /^gaji/i.test(k || '');
  const isRent = k => /^sewa/i.test(k || '');
  const isUtil = k => /^biaya operasional/i.test(k || '');
  const isTransport = k => /^transportasi/i.test(k || '');

  // ------------------------------------------------------------------ state
  const S = {
    period: 'thisMonth',
    trendFilter: 'monthly',
    compMode: 'pengeluaran',
    receivables: [],
    receivablesReady: null, // null = belum dicek, false = tabel belum dibuat
    settings: { targetOmzet: 0, budgetBiaya: 0, targetMargin: 0, danaDaruratBulan: 3 },
    settingsSource: 'local',
    charts: {},
    showAllInsights: false,
    debtFilter: { tipe: 'semua', status: 'belum' },
    hist: { q: '', jenis: '', kat: '', from: '', to: '' }
  };
  const SETTINGS_LS_KEY = 'arrahmaney_settings_v1';

  // ------------------------------------------------------------------ periode
  const PERIODS = [
    ['thisMonth', 'Bulan ini'], ['lastMonth', 'Bulan lalu'], ['30d', '30 hari terakhir'],
    ['90d', '90 hari terakhir'], ['ytd', 'Tahun ini'], ['all', 'Semua data']
  ];

  function getRange(key, now, list) {
    const today = startOfDay(now || new Date());
    const y = today.getFullYear(), m = today.getMonth();
    let start, end, prevStart = null, prevEnd = null, label = '', prevLabel = '';
    if (key === 'thisMonth') {
      start = new Date(y, m, 1); end = today;
      const pm = new Date(y, m - 1, 1);
      prevStart = pm;
      prevEnd = new Date(pm.getFullYear(), pm.getMonth(), Math.min(today.getDate(), daysInMonth(pm.getFullYear(), pm.getMonth())));
      label = 'Bulan ini'; prevLabel = 'periode sama bulan lalu';
    } else if (key === 'lastMonth') {
      start = new Date(y, m - 1, 1); end = new Date(y, m, 0);
      prevStart = new Date(y, m - 2, 1); prevEnd = new Date(y, m - 1, 0);
      label = 'Bulan lalu'; prevLabel = 'bulan sebelumnya';
    } else if (key === '30d' || key === '90d') {
      const n = key === '30d' ? 30 : 90;
      start = addDays(today, -(n - 1)); end = today;
      prevEnd = addDays(start, -1); prevStart = addDays(prevEnd, -(n - 1));
      label = n + ' hari terakhir'; prevLabel = n + ' hari sebelumnya';
    } else if (key === 'ytd') {
      start = new Date(y, 0, 1); end = today;
      prevStart = new Date(y - 1, 0, 1);
      prevEnd = new Date(y - 1, m, Math.min(today.getDate(), daysInMonth(y - 1, m)));
      label = 'Tahun ini'; prevLabel = 'periode sama tahun lalu';
    } else {
      const dates = (list || []).map(t => t.tanggal).filter(Boolean).sort();
      start = dates.length ? parseISO(dates[0]) : today; end = today;
      label = 'Semua data';
    }
    return { key, start, end, prevStart, prevEnd, label, prevLabel, days: daysBetween(start, end) + 1 };
  }

  const inRange = (t, s, e) => !!t.tanggal && t.tanggal >= iso(s) && t.tanggal <= iso(e);

  // ------------------------------------------------------------------ metrik
  function calc(list) {
    const m = {
      income: 0, sales: 0, otherIncome: 0, expense: 0, cogs: 0, payroll: 0, rent: 0, util: 0, transport: 0, other: 0,
      count: list.length, salesCount: 0, byCatIn: {}, byCatOut: {}
    };
    list.forEach(t => {
      const v = num(t.nominal), k = t.kategori || 'Lainnya';
      if (t.jenis === 'pemasukan') {
        m.income += v; m.byCatIn[k] = (m.byCatIn[k] || 0) + v;
        if (isSale(k)) { m.sales += v; m.salesCount++; } else m.otherIncome += v;
      } else {
        m.expense += v; m.byCatOut[k] = (m.byCatOut[k] || 0) + v;
        if (isCogs(k)) m.cogs += v;
        else if (isPayroll(k)) m.payroll += v;
        else if (isRent(k)) m.rent += v;
        else if (isUtil(k)) m.util += v;
        else if (isTransport(k)) m.transport += v;
        else m.other += v;
      }
    });
    m.opex = m.expense - m.cogs;
    m.net = m.income - m.expense;
    m.gross = m.sales - m.cogs;
    m.netMargin = m.income > 0 ? m.net / m.income : null;
    m.grossMargin = m.sales > 0 ? m.gross / m.sales : null;
    m.opexRatio = m.sales > 0 ? m.opex / m.sales : null;
    m.cogsRatio = m.sales > 0 ? m.cogs / m.sales : null;
    m.payrollRatio = m.sales > 0 ? m.payroll / m.sales : null;
    return m;
  }

  function groupByMonth(list) {
    const map = {};
    list.forEach(t => { if (t.tanggal) (map[t.tanggal.slice(0, 7)] = map[t.tanggal.slice(0, 7)] || []).push(t); });
    const out = {};
    Object.keys(map).forEach(k => { out[k] = calc(map[k]); });
    return out;
  }

  function cashBalance(list) {
    return list.reduce((n, t) => n + (t.jenis === 'pemasukan' ? num(t.nominal) : -num(t.nominal)), 0);
  }

  // Bulan lengkap terakhir (maks. 3) yang punya data; jika belum ada, pakai bulan berjalan yang diskalakan.
  function baseline(list, now) {
    const today = startOfDay(now || new Date());
    const curKey = monthKeyOf(today);
    const months = groupByMonth(list);
    const keys = Object.keys(months).filter(k => k < curKey).sort().slice(-3);
    if (keys.length) {
      const avg = f => keys.reduce((n, k) => n + f(months[k]), 0) / keys.length;
      const sales = avg(x => x.sales), cogs = avg(x => x.cogs), transport = avg(x => x.transport);
      return {
        basis: keys.length + ' bulan terakhir', months: keys.length,
        avgIncome: avg(x => x.income), avgExpense: avg(x => x.expense), avgNet: avg(x => x.net),
        avgOpex: avg(x => x.opex), avgSales: sales,
        fixed: avg(x => x.payroll + x.rent + x.util + x.other),
        cmr: sales > 0 ? (sales - cogs - transport) / sales : null
      };
    }
    const cur = months[curKey];
    const elapsed = today.getDate();
    if (cur && elapsed >= 7) {
      const f = daysInMonth(today.getFullYear(), today.getMonth()) / elapsed;
      return {
        basis: 'bulan berjalan (diperkirakan)', months: 0,
        avgIncome: cur.income * f, avgExpense: cur.expense * f, avgNet: cur.net * f, avgOpex: cur.opex * f,
        avgSales: cur.sales * f, fixed: (cur.payroll + cur.rent + cur.util + cur.other) * f,
        cmr: cur.sales > 0 ? (cur.sales - cur.cogs - cur.transport) / cur.sales : null
      };
    }
    return null;
  }

  function linreg(ys) {
    const n = ys.length;
    const xs = ys.map((_, i) => i);
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0;
    xs.forEach((x, i) => { sxx += (x - mx) * (x - mx); sxy += (x - mx) * (ys[i] - my); });
    let slope = sxx ? sxy / sxx : 0;
    const limit = Math.abs(my) * 0.15; // redam tren agar proyeksi tidak liar
    slope = clamp(slope, -limit, limit);
    return { slope, intercept: my - slope * mx };
  }

  function forecast(list, now) {
    const curKey = monthKeyOf(startOfDay(now || new Date()));
    const months = groupByMonth(list);
    const keys = Object.keys(months).filter(k => k < curKey).sort().slice(-6);
    if (keys.length < 3) return null;
    const inc = linreg(keys.map(k => months[k].income)), exp = linreg(keys.map(k => months[k].expense));
    const out = [];
    let [y, m] = keys[keys.length - 1].split('-').map(Number);
    for (let i = 0; i < 3; i++) {
      m += 1; if (m > 12) { m = 1; y += 1; }
      const idx = keys.length + i;
      out.push({ key: y + '-' + pad(m), income: Math.max(0, inc.intercept + inc.slope * idx), expense: Math.max(0, exp.intercept + exp.slope * idx) });
    }
    return { keys, months, future: out };
  }

  // ------------------------------------------------------------------ struk (supplier & barang)
  const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  function parseReceipts(list) {
    const out = [];
    list.forEach(t => {
      if (!String(t.keterangan || '').startsWith('[DETAIL_STRUK]')) return;
      let d = {};
      try { d = typeof parseSavedReceipt === 'function' ? parseSavedReceipt(t) : JSON.parse(String(t.keterangan).replace(/^\[DETAIL_STRUK\]\s*/, '')); } catch (_) { d = {}; }
      out.push({
        id: t.id, date: t.tanggal, total: num(t.nominal),
        supplier: String(d.supplier || '').trim(), invoice: String(d.invoice || '').trim(),
        items: Array.isArray(d.items) ? d.items : []
      });
    });
    return out;
  }

  function receiptAnalysis(allList, periodList) {
    const periodReceipts = parseReceipts(periodList);
    const bySupplier = {};
    periodReceipts.forEach(r => {
      const k = r.supplier || '(tanpa nama supplier)';
      const e = bySupplier[k] || (bySupplier[k] = { name: k, spend: 0, count: 0 });
      e.spend += r.total; e.count++;
    });
    const suppliers = Object.values(bySupplier).sort((a, b) => b.spend - a.spend);
    const supplierTotal = suppliers.reduce((n, x) => n + x.spend, 0);

    const byItem = {};
    periodReceipts.forEach(r => r.items.forEach(it => {
      const key = normName(it.name);
      if (!key || /tidak terbaca/.test(key)) return;
      const e = byItem[key] || (byItem[key] = { name: String(it.name).trim(), spend: 0, qty: 0, count: 0 });
      e.spend += num(it.amount) || (num(it.qty) * num(it.unitPrice)); e.qty += num(it.qty); e.count++;
    }));
    const topItems = Object.values(byItem).sort((a, b) => b.spend - a.spend).slice(0, 10);

    // Kenaikan harga satuan: pembelian terakhir vs sebelumnya (seluruh riwayat struk).
    const history = {};
    parseReceipts(allList).sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(r => r.items.forEach(it => {
      const key = normName(it.name), price = num(it.unitPrice);
      if (!key || price <= 0 || /tidak terbaca/.test(key)) return;
      (history[key] = history[key] || []).push({ date: r.date, price, name: String(it.name).trim(), supplier: r.supplier, id: r.id });
    }));
    const priceChanges = [];
    Object.keys(history).forEach(k => {
      const h = history[k];
      for (let i = h.length - 1; i > 0; i--) {
        if (h[i].id !== h[i - 1].id) {
          const change = (h[i].price - h[i - 1].price) / h[i - 1].price;
          priceChanges.push({ name: h[i].name, from: h[i - 1].price, to: h[i].price, change, date: h[i].date, supplier: h[i].supplier });
          break;
        }
      }
    });
    priceChanges.sort((a, b) => b.change - a.change);
    return { suppliers, supplierTotal, topItems, priceRises: priceChanges.filter(c => c.change >= 0.05), priceDrops: priceChanges.filter(c => c.change <= -0.05).reverse(), receiptCount: periodReceipts.length };
  }

  // ------------------------------------------------------------------ anomali
  function findAnomalies(allList, range) {
    const groups = {};
    allList.forEach(t => { const k = t.jenis + '|' + t.kategori; (groups[k] = groups[k] || []).push(num(t.nominal)); });
    const stats = {};
    Object.keys(groups).forEach(k => {
      const arr = groups[k];
      if (arr.length < 8) return;
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
      stats[k] = { mean, sd };
    });
    const periodList = allList.filter(t => inRange(t, range.start, range.end));
    const large = periodList.filter(t => {
      const s = stats[t.jenis + '|' + t.kategori];
      return s && s.sd > 0 && num(t.nominal) > s.mean + 3 * s.sd;
    }).sort((a, b) => num(b.nominal) - num(a.nominal)).slice(0, 5);

    const dupMap = {};
    periodList.forEach(t => { const k = [t.jenis, t.tanggal, t.kategori, num(t.nominal)].join('|'); (dupMap[k] = dupMap[k] || []).push(t); });
    const duplicates = Object.values(dupMap).filter(g => g.length > 1).sort((a, b) => num(b[0].nominal) * b.length - num(a[0].nominal) * a.length).slice(0, 5);
    return { large, duplicates, stats };
  }

  // ------------------------------------------------------------------ pola hari
  function weekdayPattern(list) {
    const names = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const sum = Array(7).fill(0), days = Array.from({ length: 7 }, () => new Set());
    list.forEach(t => {
      if (t.jenis !== 'pemasukan' || !isSale(t.kategori) || !t.tanggal) return;
      const wd = parseISO(t.tanggal).getDay();
      sum[wd] += num(t.nominal); days[wd].add(t.tanggal);
    });
    const avg = sum.map((s, i) => days[i].size ? s / days[i].size : 0);
    return { names, avg, activeDays: days.reduce((n, d) => n + d.size, 0) };
  }

  // ------------------------------------------------------------------ hutang & piutang
  function recvStats(now) {
    const today = startOfDay(now || new Date());
    const open = S.receivables.filter(r => r.status !== 'lunas');
    const sum = f => open.filter(f).reduce((n, r) => n + num(r.nominal), 0);
    const isOverdue = r => r.jatuh_tempo && parseISO(r.jatuh_tempo) < today;
    const dueSoon = r => r.jatuh_tempo && !isOverdue(r) && daysBetween(today, parseISO(r.jatuh_tempo)) <= 7;
    return {
      piutang: sum(r => r.tipe === 'piutang'), hutang: sum(r => r.tipe === 'hutang'),
      piutangOverdue: sum(r => r.tipe === 'piutang' && isOverdue(r)), hutangOverdue: sum(r => r.tipe === 'hutang' && isOverdue(r)),
      hutangSoon: sum(r => r.tipe === 'hutang' && dueSoon(r)), piutangSoon: sum(r => r.tipe === 'piutang' && dueSoon(r)),
      overdueCount: open.filter(isOverdue).length, soonCount: open.filter(dueSoon).length, isOverdue, dueSoon
    };
  }

  // ------------------------------------------------------------------ skor kesehatan
  function healthScore(cur, prev, cover) {
    const parts = [];
    const nm = cur.netMargin;
    parts.push({ label: 'Profitabilitas', max: 30, score: nm === null ? 0 : clamp(nm / 0.15, 0, 1) * 30, detail: nm === null ? 'Belum ada pemasukan' : 'Margin bersih ' + pct(nm) + ' (target sehat ≥ 15%)' });
    const gm = cur.grossMargin;
    parts.push({ label: 'Margin barang', max: 15, score: gm === null ? 0 : clamp(gm / 0.12, 0, 1) * 15, detail: gm === null ? 'Belum ada penjualan' : 'Margin kotor ' + pct(gm) + ' (acuan grosir ≥ 12%)' });
    parts.push({ label: 'Likuiditas kas', max: 25, score: cover === null ? 0 : clamp(cover / 3, 0, 1) * 25, detail: cover === null ? 'Belum cukup data biaya' : 'Kas menutup ' + cover.toFixed(1).replace('.', ',') + ' bulan biaya operasional (target ≥ 3)' });
    let growth = null;
    if (prev && prev.income > 0) growth = (cur.income - prev.income) / prev.income;
    parts.push({ label: 'Pertumbuhan', max: 15, score: growth === null ? 7.5 : clamp((growth + 0.1) / 0.2, 0, 1) * 15, detail: growth === null ? 'Belum ada pembanding periode lalu (nilai netral)' : 'Pemasukan ' + (growth >= 0 ? 'naik ' : 'turun ') + pct(Math.abs(growth)) + ' vs periode pembanding' });
    const or = cur.opexRatio;
    parts.push({ label: 'Disiplin biaya', max: 15, score: or === null ? 0 : clamp((0.2 - or) / 0.12, 0, 1) * 15, detail: or === null ? 'Belum ada penjualan' : 'Biaya operasional ' + pct(or) + ' dari penjualan (ideal ≤ 8%)' });
    const total = Math.round(parts.reduce((n, p) => n + p.score, 0));
    const grade = total >= 80 ? { t: 'Sangat sehat', c: '#059669' } : total >= 65 ? { t: 'Sehat', c: '#10b981' } : total >= 50 ? { t: 'Waspada', c: '#f59e0b' } : { t: 'Kritis', c: '#e11d48' };
    return { total, parts, grade, growth };
  }

  // ------------------------------------------------------------------ analisis utama
  function analyze(now) {
    const all = getTrx();
    const range = getRange(S.period, now, all);
    const curList = all.filter(t => inRange(t, range.start, range.end));
    const prevList = range.prevStart ? all.filter(t => inRange(t, range.prevStart, range.prevEnd)) : null;
    const cur = calc(curList);
    const prev = prevList ? calc(prevList) : null;
    const cash = cashBalance(all);
    const base = baseline(all, now);
    const cover = base && base.avgOpex > 0 ? cash / base.avgOpex : null;
    const burn = base && base.avgNet < 0 ? -base.avgNet : 0;
    const runway = base ? (burn > 0 ? cash / burn : Infinity) : null;
    const breakEven = base && base.cmr && base.cmr > 0 ? base.fixed / base.cmr : null;
    const today = startOfDay(now || new Date());
    const mtdList = all.filter(t => inRange(t, new Date(today.getFullYear(), today.getMonth(), 1), today));
    const mtd = calc(mtdList);
    const dim = daysInMonth(today.getFullYear(), today.getMonth());
    const projSales = today.getDate() > 0 ? mtd.sales / today.getDate() * dim : 0;
    const projOpex = today.getDate() > 0 ? mtd.opex / today.getDate() * dim : 0;
    const rec = receiptAnalysis(all, curList);
    const anomalies = findAnomalies(all, range);
    const weekday = weekdayPattern(curList);
    const fc = forecast(all, now);
    const score = healthScore(cur, prev, cover);
    const sales = all.filter(t => t.jenis === 'pemasukan' && isSale(t.kategori) && t.tanggal).map(t => t.tanggal).sort();
    const lastSaleDate = sales.length ? sales[sales.length - 1] : null;
    const ctx = { all, range, cur, prev, cash, base, cover, burn, runway, breakEven, mtd, projSales, projOpex, dim, today, rec, anomalies, weekday, fc, score, lastSaleDate, recv: S.receivablesReady ? recvStats(now) : null };
    ctx.insights = buildInsights(ctx);
    return ctx;
  }

  // ------------------------------------------------------------------ insight penasihat
  function buildInsights(c) {
    const out = [];
    const add = (sev, title, detail, action) => out.push({ sev, title, detail, action });
    const { cur, prev, base, cash, cover, runway, breakEven, rec, anomalies, weekday, recv, mtd, projSales, projOpex, today } = c;
    const T = S.settings;
    if (!c.all.length) {
      add('info', 'Mulai catat transaksi', 'Belum ada data. Catat penjualan dan pembelian harian agar analisis bisa dibuat.', 'Buka tab Input Transaksi dan catat transaksi hari ini.');
      return out;
    }

    if (cur.count && cur.net < 0) add('critical', 'Pengeluaran melebihi pemasukan', 'Selisih ' + rp(cur.net) + ' pada ' + c.range.label.toLowerCase() + '. Pengeluaran terbesar: ' + topKey(cur.byCatOut) + '.', 'Tunda pembelian non-esensial, tagih piutang, dan periksa kategori pengeluaran terbesar.');
    if (cover !== null && cover < 1) add('critical', 'Cadangan kas sangat tipis', 'Kas ' + rp(cash) + ' hanya menutup ' + cover.toFixed(1).replace('.', ',') + ' bulan biaya operasional.', 'Prioritaskan penagihan piutang dan tahan kulakan yang stoknya masih cukup sampai kas ≥ 1 bulan biaya.');
    else if (cover !== null && cover < 2) add('warn', 'Cadangan kas di bawah standar aman', 'Kas menutup ' + cover.toFixed(1).replace('.', ',') + ' bulan biaya operasional (standar aman ≥ 3 bulan).', 'Sisihkan sebagian laba tiap minggu ke dana cadangan sampai mencapai 3 bulan biaya operasional.');
    if (runway !== null && Number.isFinite(runway) && runway < 6) add('critical', 'Kas terkuras jika pola ini berlanjut', 'Rata-rata ' + base.basis + ' arus kas negatif; kas habis sekitar ' + runway.toFixed(1).replace('.', ',') + ' bulan lagi.', 'Naikkan penjualan atau pangkas biaya sekarang, jangan menunggu kas menipis.');

    if (cur.grossMargin !== null) {
      if (cur.grossMargin < 0) add('critical', 'Pembelian barang lebih besar dari penjualan', 'Margin kotor ' + pct(cur.grossMargin) + '. Bisa karena stok menumpuk (kulakan besar) atau harga jual di bawah modal.', 'Cek apakah kulakan periode ini untuk stok jangka panjang; bila tidak, periksa harga jual barang utama.');
      else if (cur.grossMargin < 0.05) add('warn', 'Margin kotor tipis (' + pct(cur.grossMargin) + ')', 'Sedikit kenaikan harga kulakan bisa menghapus keuntungan.', 'Tinjau harga jual barang berputar cepat, dan negosiasikan harga/diskon dengan supplier utama.');
    }
    if (cur.opexRatio !== null && cur.opexRatio > 0.12) add('warn', 'Biaya operasional tinggi', 'Biaya operasional ' + pct(cur.opexRatio) + ' dari penjualan (ideal ≤ 8%). Terbesar: ' + topKey(Object.fromEntries(Object.entries(cur.byCatOut).filter(([k]) => !isCogs(k)))) + '.', 'Tinjau tagihan listrik/transport dan jadwal tenaga kerja untuk memangkas biaya tetap.');
    if (cur.payrollRatio !== null && cur.payrollRatio > 0.08) add('info', 'Gaji ' + pct(cur.payrollRatio) + ' dari penjualan', 'Beban gaji relatif besar terhadap omzet.', 'Pertimbangkan insentif berbasis penjualan atau jadwal shift sesuai jam ramai.');

    if (prev && prev.income > 0) {
      const g = (cur.income - prev.income) / prev.income;
      if (g <= -0.1) add('warn', 'Pemasukan turun ' + pct(Math.abs(g)), 'Dibanding ' + c.range.prevLabel + ': ' + rp(prev.income) + ' → ' + rp(cur.income) + '. Penurunan terbesar: ' + biggestDrop(cur.byCatIn, prev.byCatIn) + '.', 'Hubungi pelanggan grosir utama dan cek apakah ada barang kosong atau pesaing baru.');
      else if (g >= 0.1) add('good', 'Pemasukan tumbuh ' + pct(g), 'Naik dari ' + rp(prev.income) + ' menjadi ' + rp(cur.income) + ' dibanding ' + c.range.prevLabel + '.', 'Pastikan stok barang laris cukup dan kas tidak tertahan di piutang saat volume naik.');
    }
    if (prev && prev.expense > 0 && cur.income > 0 && prev.income > 0) {
      const ge = (cur.expense - prev.expense) / prev.expense, gi = (cur.income - prev.income) / prev.income;
      if (ge > 0.15 && ge > gi + 0.1) add('warn', 'Pengeluaran naik lebih cepat dari pemasukan', 'Pengeluaran +' + pct(ge) + ' sementara pemasukan ' + (gi >= 0 ? '+' : '') + pct(gi) + '.', 'Telusuri kategori yang melonjak sebelum menjadi kebiasaan.');
    }

    if (breakEven && base) {
      if (base.avgSales < breakEven) add('warn', 'Penjualan di bawah titik impas', 'Titik impas ± ' + rp(breakEven) + '/bulan, rata-rata penjualan ' + base.basis + ' ' + rp(base.avgSales) + '.', 'Naikkan penjualan atau turunkan biaya tetap sampai penjualan melewati titik impas.');
      else if ((base.avgSales - breakEven) / base.avgSales < 0.15) add('info', 'Ruang aman di atas titik impas tipis', 'Penjualan hanya ' + pct((base.avgSales - breakEven) / base.avgSales) + ' di atas titik impas (' + rp(breakEven) + '/bulan).', 'Bangun margin keamanan ≥ 20% sebelum menambah biaya tetap (karyawan/sewa).');
    }

    if (T.targetOmzet > 0) {
      const gap = projSales - T.targetOmzet;
      if (today.getDate() < 5) add('info', 'Target omzet bulan ini ' + rp(T.targetOmzet), 'Terlalu awal untuk proyeksi (baru tanggal ' + today.getDate() + ').', 'Pantau lagi setelah tanggal 5.');
      else if (gap < 0) add('warn', 'Proyeksi omzet di bawah target', 'Laju sekarang → ± ' + rp(projSales) + ' dari target ' + rp(T.targetOmzet) + ' (kurang ' + rp(-gap) + ').', 'Butuh ± ' + rp(-gap / Math.max(1, c.dim - today.getDate())) + ' tambahan penjualan per hari sisa bulan.');
      else add('good', 'Proyeksi omzet mencapai target', 'Laju sekarang → ± ' + rp(projSales) + ' dari target ' + rp(T.targetOmzet) + '.', 'Pertahankan ritme dan jaga ketersediaan stok.');
    }
    if (T.budgetBiaya > 0 && projOpex > T.budgetBiaya) add('warn', 'Proyeksi biaya operasional melebihi anggaran', 'Laju sekarang → ± ' + rp(projOpex) + ' dari batas ' + rp(T.budgetBiaya) + '.', 'Tahan pengeluaran non-urgent hingga akhir bulan.');

    if (rec.suppliers.length >= 2 && rec.supplierTotal > 0) {
      const top = rec.suppliers[0], share = top.spend / rec.supplierTotal;
      if (share > 0.5 && top.name !== '(tanpa nama supplier)') add('warn', 'Ketergantungan pada satu supplier (' + pct(share, 0) + ')', top.name + ' menyumbang ' + rp(top.spend) + ' dari belanja bernota periode ini.', 'Siapkan supplier cadangan untuk barang utama dan bandingkan harga secara berkala.');
    }
    if (rec.priceRises.length) {
      const p = rec.priceRises.slice(0, 3).map(x => x.name + ' +' + pct(x.change, 0)).join(', ');
      add('warn', rec.priceRises.length + ' barang naik harga kulakan', p + '. Pembandingnya pembelian sebelumnya dengan nama barang yang sama.', 'Sesuaikan harga jual barang tersebut atau cari supplier alternatif.');
    }
    if (cur.cogs > 0) {
      const covered = rec.suppliers.reduce((n, s) => n + s.spend, 0);
      if (rec.receiptCount === 0 || covered / cur.cogs < 0.5) add('info', 'Kulakan belum banyak punya rincian struk', 'Hanya ' + pct(Math.min(1, covered / cur.cogs), 0) + ' belanja barang periode ini yang punya rincian nota, sehingga analisis supplier dan harga terbatas.', 'Foto struk lewat tab Detail Struk agar tren harga dan supplier terbaca.');
    }

    if (recv) {
      if (recv.piutangOverdue > 0) add('warn', 'Piutang lewat jatuh tempo ' + rp(recv.piutangOverdue), 'Dana ini tertahan di pelanggan.', 'Kirim pengingat sekarang (tombol WhatsApp di tab Hutang & Piutang) dan hentikan kredit baru untuk pelanggan terlambat.');
      if (recv.hutangOverdue > 0) add('critical', 'Hutang supplier lewat jatuh tempo ' + rp(recv.hutangOverdue), 'Keterlambatan bisa merusak hubungan dan syarat kredit supplier.', 'Jadwalkan pembayaran dan komunikasikan ke supplier.');
      if (recv.hutangSoon > 0) add('info', 'Hutang jatuh tempo ≤ 7 hari: ' + rp(recv.hutangSoon), 'Siapkan kas sebelum jatuh tempo.', cash >= recv.hutangSoon ? 'Kas saat ini cukup untuk melunasi.' : 'Kas saat ini ' + rp(cash) + ' belum cukup — tagih piutang lebih dulu.');
    }

    if (anomalies.duplicates.length) add('warn', anomalies.duplicates.length + ' kemungkinan transaksi ganda', anomalies.duplicates.slice(0, 2).map(g => g[0].tanggal + ' • ' + g[0].kategori + ' • ' + rp(g[0].nominal) + ' ×' + g.length).join('; ') + '.', 'Periksa di Riwayat dan hapus bila memang dobel input.');
    if (anomalies.large.length) add('info', anomalies.large.length + ' transaksi jauh di atas kebiasaan', anomalies.large.slice(0, 2).map(t => t.tanggal + ' • ' + t.kategori + ' • ' + rp(t.nominal)).join('; ') + '.', 'Pastikan nominalnya benar (bukan salah ketik angka nol).');

    if (c.lastSaleDate) {
      const gap = daysBetween(parseISO(c.lastSaleDate), today);
      if (gap >= 3) add('warn', 'Pencatatan penjualan terhenti ' + gap + ' hari', 'Penjualan terakhir tercatat ' + c.lastSaleDate + '. Dashboard bisa tidak mencerminkan kondisi sebenarnya.', 'Catat penjualan harian (atau rekap harian) agar angka akurat.');
    }
    if (weekday.activeDays >= 14) {
      const idx = weekday.avg.map((v, i) => [v, i]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]);
      if (idx.length >= 3) add('info', 'Hari tersibuk: ' + weekday.names[idx[0][1]] + ', tersepi: ' + weekday.names[idx[idx.length - 1][1]], 'Rata-rata penjualan per hari aktif ' + rp(idx[0][0]) + ' vs ' + rp(idx[idx.length - 1][0]) + '.', 'Pastikan stok & tenaga cukup di hari tersibuk; coba promo di hari tersepi.');
    }
    if (cur.netMargin !== null && cur.net > 0 && cover !== null && cover >= 3 && cur.grossMargin !== null && cur.grossMargin >= 0.08) add('good', 'Fondasi keuangan kuat', 'Laba positif, margin barang ' + pct(cur.grossMargin) + ', dan cadangan kas ' + cover.toFixed(1).replace('.', ',') + ' bulan.', 'Pertimbangkan investasi terukur: tambah variasi barang cepat laku atau diskon tunai dari supplier.');

    const order = { critical: 0, warn: 1, info: 2, good: 3 };
    return out.sort((a, b) => order[a.sev] - order[b.sev]);
  }

  function topKey(obj) {
    const e = Object.entries(obj || {}).sort((a, b) => b[1] - a[1])[0];
    return e ? e[0] + ' (' + rp(e[1]) + ')' : '-';
  }
  function biggestDrop(curMap, prevMap) {
    let best = null;
    Object.keys(prevMap || {}).forEach(k => {
      const d = (curMap[k] || 0) - prevMap[k];
      if (d < 0 && (!best || d < best.d)) best = { k, d };
    });
    return best ? best.k + ' (' + rp(best.d) + ')' : 'merata di semua kategori';
  }

  // ------------------------------------------------------------------ pengaturan (target)
  async function loadSettings() {
    let loaded = null;
    try {
      const { data, error } = await supabaseClient.from('business_settings').select('value').eq('key', 'targets').maybeSingle();
      if (error) throw error;
      if (data && data.value) { loaded = data.value; S.settingsSource = 'cloud'; }
      else { S.settingsSource = 'cloud'; }
    } catch (_) { S.settingsSource = 'local'; }
    if (!loaded) { try { loaded = JSON.parse(localStorage.getItem(SETTINGS_LS_KEY) || 'null'); } catch (_) { loaded = null; } }
    if (loaded) S.settings = Object.assign({ targetOmzet: 0, budgetBiaya: 0, targetMargin: 0, danaDaruratBulan: 3 }, loaded);
  }

  async function saveSettings(next) {
    S.settings = Object.assign({}, S.settings, next);
    try { localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(S.settings)); } catch (_) {}
    try {
      const { error } = await supabaseClient.from('business_settings').upsert({ key: 'targets', value: S.settings, updated_at: new Date().toISOString() });
      if (error) throw error;
      S.settingsSource = 'cloud';
      toast('Target tersimpan.');
    } catch (_) {
      S.settingsSource = 'local';
      toast('Target tersimpan di perangkat ini saja (tabel pengaturan di cloud belum dibuat).', 'error');
    }
    renderAdvisorDashboard();
  }

  window.openTargetSettings = function () {
    if ($('target-modal')) $('target-modal').remove();
    const T = S.settings;
    const wrap = document.createElement('div');
    wrap.id = 'target-modal';
    wrap.className = 'fixed inset-0 z-[95] bg-black/60 p-4 flex items-center justify-center';
    wrap.innerHTML =
      '<div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" role="dialog" aria-modal="true" aria-labelledby="target-title">' +
      '<h3 id="target-title" class="text-lg font-bold text-slate-900 mb-1">Target & Anggaran Bulanan</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Dipakai untuk proyeksi dan peringatan di dashboard. Kosongkan (0) bila tidak dipakai.</p>' +
      field('t-omzet', 'Target omzet penjualan per bulan (Rp)', T.targetOmzet) +
      field('t-biaya', 'Batas biaya operasional per bulan (Rp)', T.budgetBiaya) +
      field('t-margin', 'Target margin bersih (%)', T.targetMargin) +
      field('t-dana', 'Dana darurat yang diinginkan (bulan biaya operasional)', T.danaDaruratBulan) +
      '<div class="flex gap-2 mt-5"><button type="button" id="t-cancel" class="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700">Batal</button>' +
      '<button type="button" id="t-save" class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-bold text-white">Simpan</button></div></div>';
    document.body.appendChild(wrap);
    $('t-cancel').onclick = () => wrap.remove();
    wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
    $('t-save').onclick = () => {
      const next = {
        targetOmzet: Math.max(0, num($('t-omzet').value)), budgetBiaya: Math.max(0, num($('t-biaya').value)),
        targetMargin: clamp(num($('t-margin').value), 0, 100), danaDaruratBulan: clamp(num($('t-dana').value) || 3, 1, 24)
      };
      wrap.remove();
      saveSettings(next);
    };
    function field(id, label, value) {
      return '<label for="' + id + '" class="block text-xs font-bold text-slate-600 mb-1.5 mt-3">' + label + '</label>' +
        '<input id="' + id + '" type="number" min="0" step="any" value="' + (num(value) || '') + '" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none">';
    }
  };

  // ------------------------------------------------------------------ hutang & piutang: data
  async function loadReceivables() {
    try {
      const { data, error } = await supabaseClient.from('receivables').select('*').order('jatuh_tempo', { ascending: true, nullsFirst: false });
      if (error) throw error;
      S.receivables = data || [];
      S.receivablesReady = true;
    } catch (err) {
      S.receivables = [];
      S.receivablesReady = false;
      console.warn('Tabel receivables belum tersedia:', err && err.message);
    }
  }

  window.loadAdvisorData = async function () {
    await Promise.all([loadSettings(), loadReceivables()]);
    renderAdvisorDashboard();
    if (!$('debts').classList.contains('hidden')) renderDebtsTab();
  };

  window.clearAdvisorData = function () {
    S.receivables = []; S.receivablesReady = null;
    Object.keys(S.charts).forEach(k => { try { S.charts[k].destroy(); } catch (_) {} });
    S.charts = {};
    const root = $('advisor-root');
    if (root) { root.removeAttribute('data-ready'); root.innerHTML = ''; }
    const debts = $('debts-root'); if (debts) debts.innerHTML = '';
    const hf = $('history-filters'); if (hf) hf.innerHTML = '';
  };

  // ------------------------------------------------------------------ dashboard: render
  function deltaHtml(cur, prev, opts) {
    opts = opts || {};
    if (prev === null || prev === undefined) return '';
    if (opts.points) {
      if (cur === null || prev === null) return '';
      const d = (cur - prev) * 100;
      const cls = Math.abs(d) < 0.05 ? 'adv-delta-flat' : (d > 0 ? 'adv-delta-up' : 'adv-delta-down');
      return '<span class="' + cls + ' text-[11px] font-bold">' + (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '• ') + d.toFixed(1).replace('.', ',') + ' poin</span>';
    }
    if (prev === 0) return cur === 0 ? '' : '<span class="adv-delta-flat text-[11px] font-bold">baru</span>';
    const d = (cur - prev) / Math.abs(prev);
    const good = opts.invert ? d < 0 : d > 0;
    const cls = Math.abs(d) < 0.005 ? 'adv-delta-flat' : (good ? 'adv-delta-up' : 'adv-delta-down');
    return '<span class="' + cls + ' text-[11px] font-bold">' + (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '• ') + (d * 100).toFixed(1).replace('.', ',') + '%</span>';
  }

  function kpi(o) {
    return '<div class="adv-card p-4 border-l-4" style="border-left-color:' + o.color + '">' +
      '<div class="flex items-start justify-between gap-2"><p class="adv-kicker">' + o.label + '</p><i class="fas ' + o.icon + ' text-sm" style="color:' + o.color + '"></i></div>' +
      '<p class="text-xl lg:text-[22px] font-extrabold text-slate-900 mt-1 leading-tight break-words">' + o.value + '</p>' +
      '<div class="mt-1 flex items-center gap-2 flex-wrap">' + (o.delta || '') + '<span class="text-[11px] text-slate-500">' + (o.sub || '') + '</span></div></div>';
  }

  function shell() {
    const root = $('advisor-root');
    if (!root || root.getAttribute('data-ready')) return root;
    root.setAttribute('data-ready', '1');
    root.innerHTML =
      '<div class="adv-hero bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl shadow-sm text-white p-5 md:p-6 mb-5 border border-emerald-700/50">' +
        '<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">' +
          '<div><h2 class="text-xl md:text-2xl font-bold tracking-tight">Ruang Kendali Bisnis</h2>' +
          '<p id="adv-subtitle" class="text-xs text-emerald-100 mt-1"></p></div>' +
          '<div class="adv-hero-actions flex flex-wrap items-center gap-2">' +
            '<select id="adv-period" class="px-3 py-2 bg-white/10 border border-white/25 rounded-xl text-xs font-semibold text-white outline-none cursor-pointer">' +
              PERIODS.map(p => '<option class="text-slate-900" value="' + p[0] + '">' + p[1] + '</option>').join('') + '</select>' +
            '<button type="button" id="adv-targets-btn" class="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/25 rounded-xl text-xs font-semibold flex items-center gap-1.5"><i class="fas fa-bullseye"></i>Target</button>' +
            '<button type="button" id="adv-export-btn" class="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/25 rounded-xl text-xs font-semibold flex items-center gap-1.5"><i class="fas fa-file-excel"></i>Unduh Laporan</button>' +
            '<button type="button" id="adv-sync-btn" class="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/25 rounded-xl text-xs font-semibold flex items-center gap-1.5"><i class="fas fa-sync-alt"></i>Sinkronkan</button>' +
          '</div></div></div>' +

      '<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">' +
        '<div id="adv-score" class="adv-card p-5"></div>' +
        '<div id="adv-insights" class="adv-card p-5 lg:col-span-2"></div></div>' +

      '<div id="adv-kpi1" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3"></div>' +
      '<div id="adv-kpi2" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"></div>' +
      '<div id="adv-targets" class="mb-5"></div>' +

      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">' +
        '<div class="adv-card p-5"><div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider"><i class="fas fa-chart-line text-emerald-600 mr-1.5"></i>Tren Kinerja</h3>' +
          '<select id="adv-trend-filter" class="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none"><option value="daily">30 hari</option><option value="monthly">Bulanan</option><option value="yearly">Tahunan</option></select></div>' +
          '<div class="relative h-64"><canvas id="c-trend"></canvas></div></div>' +
        '<div class="adv-card p-5"><div class="flex items-center justify-between mb-3"><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider"><i class="fas fa-chart-pie text-indigo-600 mr-1.5"></i>Komposisi</h3>' +
          '<select id="adv-comp-mode" class="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none"><option value="pengeluaran">Pengeluaran</option><option value="pemasukan">Pemasukan</option></select></div>' +
          '<div class="relative h-64"><canvas id="c-comp"></canvas></div></div></div>' +

      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">' +
        '<div class="adv-card p-5"><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3"><i class="fas fa-coins text-amber-600 mr-1.5"></i>Laba Kotor vs Biaya vs Laba Bersih (bulanan)</h3><div class="relative h-64"><canvas id="c-monthly"></canvas></div></div>' +
        '<div class="adv-card p-5"><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3"><i class="fas fa-wallet text-blue-600 mr-1.5"></i>Saldo Kas Akhir Bulan</h3><div class="relative h-64"><canvas id="c-cash"></canvas></div></div></div>' +

      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">' +
        '<div class="adv-card p-5"><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider mb-1"><i class="fas fa-calendar-week text-teal-600 mr-1.5"></i>Pola Penjualan per Hari</h3><p class="text-[11px] text-slate-400 mb-3">Rata-rata penjualan per hari aktif, pada periode terpilih.</p><div class="relative h-56"><canvas id="c-weekday"></canvas></div></div>' +
        '<div class="adv-card p-5"><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider mb-1"><i class="fas fa-binoculars text-purple-600 mr-1.5"></i>Proyeksi 3 Bulan</h3><p id="adv-forecast-note" class="text-[11px] text-slate-400 mb-3"></p><div class="relative h-56"><canvas id="c-forecast"></canvas></div></div></div>' +

      '<div id="adv-working" class="mb-5"></div>' +

      '<div class="adv-card p-5 mb-5"><div class="flex flex-wrap items-center justify-between gap-2 mb-3"><div><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider"><i class="fas fa-table text-slate-600 mr-1.5"></i>Laporan Laba Rugi Bulanan</h3><p class="text-[11px] text-slate-400">12 bulan terakhir yang punya data. Dasar kas, bukan HPP akuntansi penuh.</p></div></div>' +
        '<div id="adv-pnl" class="overflow-x-auto -mx-2 px-2"></div></div>' +

      '<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">' +
        '<div id="adv-suppliers" class="adv-card p-5"></div><div id="adv-items" class="adv-card p-5"></div><div id="adv-prices" class="adv-card p-5"></div></div>' +

      '<p class="text-[11px] text-slate-400 mb-8">Skor, ambang batas, dan saran di halaman ini adalah indikator heuristik untuk grosir sembako, bukan nasihat akuntansi atau pajak. Sesuaikan dengan kondisi toko dan konsultasikan dengan akuntan untuk keputusan besar.</p>';

    $('adv-period').value = S.period;
    $('adv-period').addEventListener('change', e => { S.period = e.target.value; renderAdvisorDashboard(); });
    $('adv-trend-filter').value = S.trendFilter === 'daily' ? 'daily' : S.trendFilter;
    $('adv-trend-filter').addEventListener('change', e => { S.trendFilter = e.target.value; renderAdvisorDashboard(); });
    $('adv-comp-mode').addEventListener('change', e => { S.compMode = e.target.value; renderAdvisorDashboard(); });
    $('adv-targets-btn').addEventListener('click', () => window.openTargetSettings());
    $('adv-export-btn').addEventListener('click', () => window.exportReport());
    $('adv-sync-btn').addEventListener('click', () => { if (typeof loadDataFromSupabase === 'function') loadDataFromSupabase(); loadReceivables().then(() => { renderAdvisorDashboard(); }); });
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-adv-action]');
      if (!t) return;
      if (t.dataset.advAction === 'toggle-insights') { S.showAllInsights = !S.showAllInsights; renderAdvisorDashboard(); }
      if (t.dataset.advAction === 'goto-debts') window.switchTab && window.switchTab('debts');
    });
    return root;
  }

  function renderScore(c) {
    const s = c.score, r = 52, circ = 2 * Math.PI * r, off = circ * (1 - s.total / 100);
    $('adv-score').innerHTML =
      '<p class="adv-kicker mb-3">Skor Kesehatan Bisnis</p>' +
      '<div class="flex items-center gap-4"><div class="relative w-28 h-28 shrink-0"><svg viewBox="0 0 120 120" class="w-28 h-28 -rotate-90"><circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#e2e8f0" stroke-width="12"/><circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + s.grade.c + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg>' +
      '<div class="absolute inset-0 flex flex-col items-center justify-center"><span class="text-3xl font-extrabold text-slate-900">' + s.total + '</span><span class="text-[10px] text-slate-400 -mt-0.5">dari 100</span></div></div>' +
      '<div><p class="text-lg font-extrabold" style="color:' + s.grade.c + '">' + s.grade.t + '</p><p class="text-[11px] text-slate-500 mt-0.5">' + esc(c.range.label) + (c.prev ? ' vs ' + esc(c.range.prevLabel) : '') + '</p></div></div>' +
      '<div class="mt-4 space-y-2.5">' + s.parts.map(p => {
        const ratio = p.score / p.max, color = ratio >= 0.7 ? '#10b981' : ratio >= 0.4 ? '#f59e0b' : '#e11d48';
        return '<div title="' + esc(p.detail) + '"><div class="flex justify-between text-[11px] font-semibold text-slate-600 mb-1"><span>' + p.label + '</span><span>' + Math.round(p.score) + '/' + p.max + '</span></div><div class="adv-bar"><span style="width:' + (ratio * 100).toFixed(0) + '%;background:' + color + '"></span></div><p class="text-[10px] text-slate-400 mt-0.5">' + esc(p.detail) + '</p></div>';
      }).join('') + '</div>';
  }

  function renderInsights(c) {
    const style = { critical: ['#e11d48', '#fff1f2', 'fa-triangle-exclamation', 'Kritis'], warn: ['#d97706', '#fffbeb', 'fa-circle-exclamation', 'Perhatian'], info: ['#2563eb', '#eff6ff', 'fa-lightbulb', 'Info'], good: ['#059669', '#ecfdf5', 'fa-circle-check', 'Bagus'] };
    const list = S.showAllInsights ? c.insights : c.insights.slice(0, 6);
    const counts = { critical: 0, warn: 0, info: 0, good: 0 };
    c.insights.forEach(i => counts[i.sev]++);
    $('adv-insights').innerHTML =
      '<div class="flex flex-wrap items-center justify-between gap-2 mb-3"><p class="adv-kicker">Penasihat Bisnis · Temuan &amp; Tindakan</p>' +
      '<div class="flex gap-1.5 text-[10px] font-bold">' +
        (counts.critical ? '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">' + counts.critical + ' kritis</span>' : '') +
        (counts.warn ? '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">' + counts.warn + ' perhatian</span>' : '') +
        (counts.good ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">' + counts.good + ' bagus</span>' : '') + '</div></div>' +
      (list.length ? '<div class="space-y-2.5">' + list.map(i => {
        const st = style[i.sev];
        return '<div class="adv-insight rounded-xl p-3" style="border-left-color:' + st[0] + ';background:' + st[1] + '"><div class="flex items-start gap-2.5"><i class="fas ' + st[2] + ' mt-0.5" style="color:' + st[0] + '"></i><div class="min-w-0">' +
          '<p class="text-[13px] font-bold text-slate-900">' + esc(i.title) + '</p><p class="text-xs text-slate-600 mt-0.5">' + esc(i.detail) + '</p>' +
          '<p class="text-xs mt-1" style="color:' + st[0] + '"><span class="font-bold">Langkah: </span>' + esc(i.action) + '</p></div></div></div>';
      }).join('') + '</div>' : '<p class="text-sm text-slate-500">Belum ada temuan.</p>') +
      (c.insights.length > 6 ? '<button type="button" data-adv-action="toggle-insights" class="mt-3 text-xs font-bold text-emerald-700 hover:underline">' + (S.showAllInsights ? 'Tampilkan lebih sedikit' : 'Lihat semua ' + c.insights.length + ' temuan') + '</button>' : '');
  }

  function renderKpis(c) {
    const { cur, prev } = c;
    const noData = !cur.count;
    const dash = '–';
    $('adv-kpi1').innerHTML =
      kpi({ label: 'Omzet (Pemasukan)', value: rp(cur.income), delta: deltaHtml(cur.income, prev && prev.income), sub: 'Penjualan ' + rp(cur.sales), icon: 'fa-arrow-down', color: '#059669' }) +
      kpi({ label: 'Total Pengeluaran', value: rp(cur.expense), delta: deltaHtml(cur.expense, prev && prev.expense, { invert: true }), sub: 'Kulakan ' + rp(cur.cogs), icon: 'fa-arrow-up', color: '#e11d48' }) +
      kpi({ label: 'Laba Bersih', value: rp(cur.net), delta: deltaHtml(cur.net, prev && prev.net), sub: 'Margin ' + pct(cur.netMargin), icon: 'fa-chart-line', color: '#4f46e5' }) +
      kpi({ label: 'Saldo Kas Saat Ini', value: rp(c.cash), sub: 'Seluruh riwayat', icon: 'fa-wallet', color: '#2563eb' });
    const be = c.breakEven;
    $('adv-kpi2').innerHTML =
      kpi({ label: 'Laba Kotor Barang', value: noData ? dash : rp(cur.gross), delta: deltaHtml(cur.grossMargin, prev && prev.grossMargin, { points: true }), sub: 'Margin ' + pct(cur.grossMargin), icon: 'fa-boxes-stacked', color: '#0d9488' }) +
      kpi({ label: 'Biaya Operasional', value: rp(cur.opex), delta: deltaHtml(cur.opexRatio, prev && prev.opexRatio, { points: true }), sub: pct(cur.opexRatio) + ' dari penjualan', icon: 'fa-gears', color: '#d97706' }) +
      kpi({ label: 'Cadangan Kas', value: c.cover === null ? dash : c.cover.toFixed(1).replace('.', ',') + ' bulan', sub: c.runway === null ? 'Butuh data bulan lengkap' : (Number.isFinite(c.runway) ? 'Kas habis ± ' + c.runway.toFixed(1).replace('.', ',') + ' bln jika pola berlanjut' : 'Arus kas rata-rata positif'), icon: 'fa-shield-halved', color: '#7c3aed' }) +
      kpi({ label: 'Titik Impas Bulanan', value: be ? rpShort(be) : dash, sub: c.base && be ? (c.base.avgSales >= be ? 'Penjualan di atas impas (' + c.base.basis + ')' : 'Penjualan di bawah impas (' + c.base.basis + ')') : 'Butuh data penjualan & biaya', icon: 'fa-scale-balanced', color: '#db2777' });
    $('adv-subtitle').textContent = c.range.label + ' · ' + c.cur.count + ' transaksi' + (c.prev ? ' · pembanding: ' + c.range.prevLabel : '') + ' · rata-rata ' + (c.base ? c.base.basis : 'belum cukup data');
  }

  function progressRow(label, valueText, ratio, color, note) {
    return '<div class="mb-4 last:mb-0"><div class="flex justify-between items-baseline gap-2 text-xs font-semibold text-slate-700 mb-1.5"><span>' + label + '</span><span class="text-slate-500">' + valueText + '</span></div>' +
      '<div class="adv-bar"><span style="width:' + clamp(ratio * 100, 0, 100).toFixed(0) + '%;background:' + color + '"></span></div>' +
      (note ? '<p class="text-[11px] text-slate-500 mt-1">' + note + '</p>' : '') + '</div>';
  }

  function renderTargets(c) {
    const T = S.settings, el = $('adv-targets');
    const rows = [];
    if (T.targetOmzet > 0) {
      const r = c.mtd.sales / T.targetOmzet, proj = c.projSales / T.targetOmzet;
      rows.push(progressRow('Omzet penjualan bulan ini', rp(c.mtd.sales) + ' / ' + rp(T.targetOmzet), r, r >= 1 || proj >= 1 ? '#10b981' : proj >= 0.85 ? '#f59e0b' : '#e11d48',
        c.today.getDate() >= 5 ? 'Proyeksi akhir bulan ± ' + rp(c.projSales) + ' (' + pct(proj, 0) + ' dari target)' : 'Proyeksi tersedia setelah tanggal 5'));
    }
    if (T.budgetBiaya > 0) {
      const r = c.mtd.opex / T.budgetBiaya;
      rows.push(progressRow('Biaya operasional bulan ini', rp(c.mtd.opex) + ' / ' + rp(T.budgetBiaya), r, r < 0.8 ? '#10b981' : r < 1 ? '#f59e0b' : '#e11d48', c.today.getDate() >= 5 ? 'Proyeksi akhir bulan ± ' + rp(c.projOpex) : ''));
    }
    if (T.targetMargin > 0) {
      const m = c.mtd.netMargin, r = m === null ? 0 : m / (T.targetMargin / 100);
      rows.push(progressRow('Margin bersih bulan ini', pct(m) + ' / ' + T.targetMargin + '%', r, r >= 1 ? '#10b981' : r >= 0.6 ? '#f59e0b' : '#e11d48', ''));
    }
    if (c.base && c.base.avgOpex > 0 && T.danaDaruratBulan > 0) {
      const goal = c.base.avgOpex * T.danaDaruratBulan, r = c.cash / goal;
      rows.push(progressRow('Dana darurat (' + T.danaDaruratBulan + ' bulan biaya operasional)', rp(Math.max(0, c.cash)) + ' / ' + rp(goal), r, r >= 1 ? '#10b981' : r >= 0.5 ? '#f59e0b' : '#e11d48', 'Dihitung dari saldo kas total; belum memisahkan rekening cadangan.'));
    }
    el.innerHTML = '<div class="adv-card p-5"><div class="flex items-center justify-between mb-4"><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider"><i class="fas fa-bullseye text-rose-600 mr-1.5"></i>Target &amp; Anggaran</h3>' +
      '<button type="button" onclick="openTargetSettings()" class="text-xs font-bold text-emerald-700 hover:underline">Atur target</button></div>' +
      (rows.length ? rows.join('') : '<p class="text-sm text-slate-500">Belum ada target. Tekan <b>Atur target</b> untuk menetapkan target omzet, batas biaya, dan dana darurat agar dashboard bisa memberi peringatan dini.</p>') +
      (S.settingsSource === 'local' && rows.length ? '<p class="text-[11px] text-amber-700 mt-3">Target tersimpan di perangkat ini saja. Jalankan supabase-setup.sql agar tersimpan di cloud.</p>' : '') + '</div>';
  }

  function renderWorking(c) {
    const el = $('adv-working');
    const r = c.recv;
    if (S.receivablesReady === false) {
      el.innerHTML = '<div class="adv-card p-4 text-xs text-slate-600"><i class="fas fa-handshake text-slate-400 mr-1.5"></i>Fitur Hutang &amp; Piutang belum aktif: jalankan <b>supabase-setup.sql</b> di Supabase untuk membuat tabelnya.</div>';
      return;
    }
    if (!r) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">' +
      kpi({ label: 'Piutang Belum Lunas', value: rp(r.piutang), sub: r.piutangOverdue > 0 ? 'Terlambat ' + rp(r.piutangOverdue) : 'Tidak ada yang terlambat', icon: 'fa-hand-holding-dollar', color: '#2563eb' }) +
      kpi({ label: 'Hutang Belum Lunas', value: rp(r.hutang), sub: r.hutangOverdue > 0 ? 'Terlambat ' + rp(r.hutangOverdue) : 'Jatuh tempo ≤ 7 hari: ' + rp(r.hutangSoon), icon: 'fa-file-invoice-dollar', color: '#e11d48' }) +
      kpi({ label: 'Posisi Kas Bersih', value: rp(c.cash + r.piutang - r.hutang), sub: 'Kas + piutang − hutang', icon: 'fa-scale-unbalanced', color: '#0d9488' }) +
      '<button type="button" data-adv-action="goto-debts" class="adv-card p-4 text-left hover:bg-slate-50"><p class="adv-kicker">Perlu tindakan</p><p class="text-xl font-extrabold text-slate-900 mt-1">' + (r.overdueCount + r.soonCount) + ' tagihan</p><p class="text-[11px] text-slate-500 mt-1">' + r.overdueCount + ' terlambat · ' + r.soonCount + ' jatuh tempo ≤ 7 hari. Buka tab Hutang &amp; Piutang →</p></button></div>';
  }

  function table(headers, rows, emptyText) {
    if (!rows.length) return '<p class="text-sm text-slate-400">' + emptyText + '</p>';
    return '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-left text-slate-400 uppercase text-[10px]">' + headers.map((h, i) => '<th class="py-1.5 ' + (i ? 'text-right' : '') + '">' + h + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr class="border-t border-slate-100">' + r.map((v, i) => '<td class="py-1.5 ' + (i ? 'text-right whitespace-nowrap' : 'pr-2') + '">' + v + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  function renderSuppliersAndItems(c) {
    const r = c.rec;
    $('adv-suppliers').innerHTML = '<h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3"><i class="fas fa-truck-field text-orange-600 mr-1.5"></i>Supplier Teratas</h3>' +
      table(['Supplier', 'Belanja', 'Porsi'], r.suppliers.slice(0, 6).map(s => [esc(s.name) + ' <span class="text-slate-400">(' + s.count + ' nota)</span>', rpShort(s.spend), pct(r.supplierTotal ? s.spend / r.supplierTotal : 0, 0)]), 'Belum ada struk kulakan di periode ini. Foto struk lewat tab Detail Struk.');
    $('adv-items').innerHTML = '<h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3"><i class="fas fa-box text-teal-600 mr-1.5"></i>Barang Paling Banyak Dibeli</h3>' +
      table(['Barang', 'Belanja'], r.topItems.slice(0, 8).map(i => [esc(i.name) + ' <span class="text-slate-400">(' + i.count + '×)</span>', rpShort(i.spend)]), 'Belum ada rincian barang di periode ini.');
    $('adv-prices').innerHTML = '<h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider mb-1"><i class="fas fa-tags text-rose-600 mr-1.5"></i>Perubahan Harga Kulakan</h3><p class="text-[11px] text-slate-400 mb-3">Pembelian terakhir vs sebelumnya (nama barang sama).</p>' +
      table(['Barang', 'Harga', 'Ubah'], r.priceRises.slice(0, 5).map(p => [esc(p.name), rpShort(p.from) + ' → ' + rpShort(p.to), '<span class="adv-delta-down font-bold">+' + pct(p.change, 0) + '</span>'])
        .concat(r.priceDrops.slice(0, 3).map(p => [esc(p.name), rpShort(p.from) + ' → ' + rpShort(p.to), '<span class="adv-delta-up font-bold">' + pct(p.change, 0) + '</span>'])), 'Belum ada kenaikan/penurunan harga ≥ 5% yang terdeteksi.');
  }

  function pnlRows(all) {
    const months = groupByMonth(all);
    return Object.keys(months).sort().slice(-12).map(k => ({ key: k, m: months[k] }));
  }

  function renderPnl() {
    const rows = pnlRows(getTrx());
    if (!rows.length) { $('adv-pnl').innerHTML = '<p class="text-sm text-slate-400">Belum ada data.</p>'; return; }
    const tot = calc(getTrx().filter(t => t.tanggal && rows.some(r => r.key === t.tanggal.slice(0, 7))));
    const line = (label, m, bold) => {
      const cell = v => '<td>' + rp(v) + '</td>';
      return '<tr class="' + (bold ? 'font-bold bg-slate-100' : '') + '"><td>' + label + '</td>' + cell(m.sales) + cell(m.otherIncome) + cell(m.cogs) + '<td class="' + (m.gross < 0 ? 'text-rose-600' : '') + '">' + rp(m.gross) + '</td><td>' + pct(m.grossMargin) + '</td>' +
        cell(m.payroll) + cell(m.rent) + cell(m.util) + cell(m.transport) + cell(m.other) + '<td class="font-bold ' + (m.net < 0 ? 'text-rose-600' : 'text-emerald-700') + '">' + rp(m.net) + '</td><td>' + pct(m.netMargin) + '</td></tr>';
    };
    $('adv-pnl').innerHTML = '<table class="adv-table w-full"><thead><tr><th>Bulan</th><th>Penjualan</th><th>Pendapatan lain</th><th>Kulakan</th><th>Laba kotor</th><th>Margin kotor</th><th>Gaji</th><th>Sewa</th><th>Listrik/Air/Net</th><th>Transport</th><th>Lain-lain</th><th>Laba bersih</th><th>Margin bersih</th></tr></thead><tbody>' +
      rows.map(r => line(monthLabel(r.key), r.m, false)).join('') + line('Total', tot, true) + '</tbody></table>';
  }

  // ------------------------------------------------------------------ grafik
  function makeChart(id, cfg) {
    const canvas = $(id);
    if (!canvas || typeof Chart === 'undefined') return;
    if (S.charts[id]) { try { S.charts[id].destroy(); } catch (_) {} }
    S.charts[id] = new Chart(canvas.getContext('2d'), cfg);
  }
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#14b8a6', '#f43f5e', '#84cc16', '#0ea5e9'];
  const axisMoney = { ticks: { callback: v => rpShort(v), font: { size: 10 } } };
  const moneyTooltip = { callbacks: { label: ctx => (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + rp(ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed) } };

  function renderCharts(c) {
    const all = c.all;
    // Tren
    const f = S.trendFilter;
    const grouped = {};
    const today = c.today, since = iso(addDays(today, -29));
    all.forEach(t => {
      if (!t.tanggal) return;
      if (f === 'daily' && t.tanggal < since) return;
      const key = f === 'daily' ? t.tanggal : f === 'monthly' ? t.tanggal.slice(0, 7) : t.tanggal.slice(0, 4);
      const g = grouped[key] || (grouped[key] = { in: 0, out: 0 });
      if (t.jenis === 'pemasukan') g.in += num(t.nominal); else g.out += num(t.nominal);
    });
    let keys = Object.keys(grouped).sort();
    if (f === 'monthly') keys = keys.slice(-12);
    const labels = keys.map(k => f === 'daily' ? parseISO(k).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : f === 'monthly' ? monthLabel(k) : k);
    makeChart('c-trend', {
      type: 'line',
      data: { labels: labels.length ? labels : ['Belum ada data'], datasets: [
        { label: 'Pemasukan', data: keys.map(k => grouped[k].in), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.1)', borderWidth: 2.5, tension: .3, fill: true },
        { label: 'Pengeluaran', data: keys.map(k => grouped[k].out), borderColor: '#e11d48', backgroundColor: 'rgba(225,29,72,.08)', borderWidth: 2.5, tension: .3, fill: true },
        { label: 'Laba bersih', data: keys.map(k => grouped[k].in - grouped[k].out), borderColor: '#4f46e5', borderWidth: 2.5, tension: .3, fill: false }
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: moneyTooltip }, scales: { y: axisMoney } }
    });

    // Komposisi
    const src = S.compMode === 'pemasukan' ? c.cur.byCatIn : c.cur.byCatOut;
    const entries = Object.entries(src).sort((a, b) => b[1] - a[1]);
    makeChart('c-comp', {
      type: 'doughnut',
      data: { labels: entries.length ? entries.map(e => e[0]) : ['Belum ada data'], datasets: [{ data: entries.length ? entries.map(e => e[1]) : [1], backgroundColor: COLORS, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => ctx.label + ': ' + rp(ctx.parsed) } } } }
    });

    // Bulanan: laba kotor, biaya operasional, laba bersih
    const rows = pnlRows(all);
    makeChart('c-monthly', {
      type: 'bar',
      data: { labels: rows.map(r => monthLabel(r.key)), datasets: [
        { label: 'Laba kotor', data: rows.map(r => r.m.gross), backgroundColor: '#14b8a6' },
        { label: 'Biaya operasional', data: rows.map(r => r.m.opex), backgroundColor: '#f59e0b' },
        { label: 'Laba bersih', data: rows.map(r => r.m.net), backgroundColor: '#4f46e5' }
      ] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: moneyTooltip }, scales: { y: axisMoney } }
    });

    // Saldo kas akhir bulan
    const monthsAll = groupByMonth(all), mk = Object.keys(monthsAll).sort();
    let run = 0; const bal = {};
    mk.forEach(k => { run += monthsAll[k].net; bal[k] = run; });
    const mk12 = mk.slice(-12);
    makeChart('c-cash', {
      type: 'line',
      data: { labels: mk12.map(monthLabel), datasets: [{ label: 'Saldo kas', data: mk12.map(k => bal[k]), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.1)', borderWidth: 2.5, tension: .25, fill: true }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: moneyTooltip }, scales: { y: axisMoney } }
    });

    // Pola hari
    makeChart('c-weekday', {
      type: 'bar',
      data: { labels: c.weekday.names, datasets: [{ label: 'Rata-rata penjualan', data: c.weekday.avg, backgroundColor: c.weekday.avg.map(v => v === Math.max.apply(null, c.weekday.avg) && v > 0 ? '#0d9488' : '#99f6e4') }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: moneyTooltip }, scales: { y: axisMoney } }
    });

    // Proyeksi
    const note = $('adv-forecast-note');
    if (c.fc) {
      const hist = c.fc.keys, fut = c.fc.future;
      const labelsF = hist.map(monthLabel).concat(fut.map(x => monthLabel(x.key) + '*'));
      const pad2 = Array(fut.length).fill(null);
      const incH = hist.map(k => c.fc.months[k].income), expH = hist.map(k => c.fc.months[k].expense);
      makeChart('c-forecast', {
        type: 'line',
        data: { labels: labelsF, datasets: [
          { label: 'Pemasukan', data: incH.concat(pad2), borderColor: '#059669', borderWidth: 2.5, tension: .25 },
          { label: 'Pengeluaran', data: expH.concat(pad2), borderColor: '#e11d48', borderWidth: 2.5, tension: .25 },
          { label: 'Proyeksi pemasukan', data: Array(hist.length - 1).fill(null).concat([incH[incH.length - 1]], fut.map(x => x.income)), borderColor: '#059669', borderDash: [6, 5], borderWidth: 2, pointStyle: 'rectRot', tension: .25 },
          { label: 'Proyeksi pengeluaran', data: Array(hist.length - 1).fill(null).concat([expH[expH.length - 1]], fut.map(x => x.expense)), borderColor: '#e11d48', borderDash: [6, 5], borderWidth: 2, pointStyle: 'rectRot', tension: .25 }
        ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } }, tooltip: moneyTooltip }, scales: { y: axisMoney } }
      });
      const net = fut.reduce((n, x) => n + x.income - x.expense, 0);
      note.textContent = '* Tren linear dari ' + hist.length + ' bulan terakhir (diredam). Laba bersih 3 bulan ke depan ± ' + rp(net) + '. Indikatif, bukan jaminan.';
    } else {
      if (S.charts['c-forecast']) { try { S.charts['c-forecast'].destroy(); } catch (_) {} delete S.charts['c-forecast']; }
      const cv = $('c-forecast'); if (cv) { const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); }
      note.textContent = 'Proyeksi muncul setelah ada minimal 3 bulan data lengkap.';
    }
  }

  window.renderAdvisorDashboard = function () {
    if (!shell()) return;
    try {
      const c = analyze(new Date());
      window.__advisorLast = c;
      renderScore(c); renderInsights(c); renderKpis(c); renderTargets(c); renderWorking(c); renderSuppliersAndItems(c); renderPnl(); renderCharts(c);
    } catch (err) {
      console.error('Dashboard gagal dirender:', err);
      const root = $('advisor-root');
      if (root && !root.querySelector('#adv-score')) root.innerHTML = '<p class="p-6 text-sm text-rose-600">Dashboard gagal dimuat: ' + esc(err.message) + '</p>';
      toast('Dashboard gagal dirender: ' + err.message, 'error');
    }
  };

  // ------------------------------------------------------------------ ekspor
  function download(filename, workbookOrText, isText) {
    if (isText) {
      const blob = new Blob(['﻿' + workbookOrText], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } else {
      XLSX.writeFile(workbookOrText, filename);
    }
  }
  const stamp = () => iso(new Date());

  function trxToRow(t) {
    let ket = String(t.keterangan || '');
    if (ket.startsWith('[DETAIL_STRUK]')) {
      const d = parseReceipts([t])[0];
      ket = 'Struk kulakan' + (d && d.supplier ? ' • ' + d.supplier : '') + (d && d.invoice ? ' • Inv. ' + d.invoice : '') + (d ? ' • ' + d.items.length + ' item' : '');
    }
    return { Tanggal: t.tanggal, Jenis: t.jenis, Kategori: t.kategori, Keterangan: ket, Nominal: num(t.nominal), ID: t.id };
  }

  window.exportReport = function () {
    if (typeof XLSX === 'undefined') { toast('Pustaka Excel belum termuat. Periksa koneksi internet.', 'error'); return; }
    const c = window.__advisorLast || analyze(new Date());
    const wb = XLSX.utils.book_new();
    const m = c.cur;
    const summary = [
      ['Laporan Keuangan Toko Grosir AR-Rahman'], ['Periode', c.range.label + ' (' + iso(c.range.start) + ' s/d ' + iso(c.range.end) + ')'], ['Dibuat', stamp()], [],
      ['Pemasukan', m.income], ['  Penjualan', m.sales], ['  Pendapatan lain', m.otherIncome],
      ['Pengeluaran', m.expense], ['  Pembelian barang (kulakan)', m.cogs], ['  Gaji', m.payroll], ['  Sewa', m.rent], ['  Listrik/Air/Internet', m.util], ['  Transportasi', m.transport], ['  Lain-lain', m.other],
      ['Laba kotor (penjualan - kulakan)', m.gross], ['Margin kotor', m.grossMargin === null ? '' : m.grossMargin],
      ['Laba bersih', m.net], ['Margin bersih', m.netMargin === null ? '' : m.netMargin],
      ['Saldo kas saat ini (seluruh riwayat)', c.cash], ['Cadangan kas (bulan biaya operasional)', c.cover === null ? '' : Number(c.cover.toFixed(2))],
      ['Skor kesehatan bisnis (0-100)', c.score.total], [],
      ['Catatan', 'Dasar kas. Laba kotor bukan HPP akuntansi penuh. Skor dan saran adalah indikator heuristik.']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Ringkasan');
    const pnl = pnlRows(c.all).map(r => ({ Bulan: r.key, Penjualan: r.m.sales, 'Pendapatan lain': r.m.otherIncome, Kulakan: r.m.cogs, 'Laba kotor': r.m.gross, 'Margin kotor': r.m.grossMargin === null ? '' : r.m.grossMargin, Gaji: r.m.payroll, Sewa: r.m.rent, 'Listrik/Air/Internet': r.m.util, Transport: r.m.transport, 'Lain-lain': r.m.other, 'Laba bersih': r.m.net, 'Margin bersih': r.m.netMargin === null ? '' : r.m.netMargin }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pnl.length ? pnl : [{ Info: 'Belum ada data' }]), 'Laba Rugi Bulanan');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(c.insights.length ? c.insights.map(i => ({ Tingkat: i.sev, Temuan: i.title, Rincian: i.detail, Langkah: i.action })) : [{ Info: 'Tidak ada temuan' }]), 'Temuan Penasihat');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(c.all.slice().sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal))).map(trxToRow)), 'Semua Transaksi');
    if (S.receivables.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(S.receivables.map(r => ({ Tipe: r.tipe, Pihak: r.pihak, Nominal: num(r.nominal), Tanggal: r.tanggal, 'Jatuh tempo': r.jatuh_tempo || '', Status: r.status, Catatan: r.catatan || '' }))), 'Hutang Piutang');
    download('laporan-keuangan-ar-rahman-' + stamp() + '.xlsx', wb);
    toast('Laporan Excel diunduh.');
  };

  // ------------------------------------------------------------------ riwayat: filter & ekspor
  function searchText(t) {
    let s = [t.kategori, t.jenis, t.tanggal, t.keterangan && !String(t.keterangan).startsWith('[DETAIL_STRUK]') ? t.keterangan : ''].join(' ');
    if (String(t.keterangan || '').startsWith('[DETAIL_STRUK]')) {
      const d = parseReceipts([t])[0];
      if (d) s += ' ' + d.supplier + ' ' + d.invoice + ' ' + d.items.map(i => i.name).join(' ');
    }
    return s.toLowerCase();
  }

  window.getHistoryFiltered = function () {
    const h = S.hist, q = h.q.trim().toLowerCase();
    return getTrx().filter(t => {
      if (h.jenis && t.jenis !== h.jenis) return false;
      if (h.kat && t.kategori !== h.kat) return false;
      if (h.from && (!t.tanggal || t.tanggal < h.from)) return false;
      if (h.to && (!t.tanggal || t.tanggal > h.to)) return false;
      if (q && !searchText(t).includes(q)) return false;
      return true;
    }).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  };

  window.updateHistorySummary = function (list) {
    const el = $('history-summary');
    if (!el) return;
    const inc = list.filter(t => t.jenis === 'pemasukan').reduce((n, t) => n + num(t.nominal), 0);
    const out = list.filter(t => t.jenis !== 'pemasukan').reduce((n, t) => n + num(t.nominal), 0);
    el.innerHTML = '<span class="font-semibold text-slate-700">' + list.length + ' transaksi</span> · Pemasukan <span class="font-bold text-emerald-700">' + rp(inc) + '</span> · Pengeluaran <span class="font-bold text-rose-600">' + rp(out) + '</span> · Selisih <span class="font-bold ' + (inc - out < 0 ? 'text-rose-600' : 'text-indigo-700') + '">' + rp(inc - out) + '</span>';
  };

  window.renderHistoryFilters = function () {
    const box = $('history-filters');
    if (!box) return;
    const cats = Array.from(new Set(getTrx().map(t => t.kategori).filter(Boolean))).sort();
    if (box.getAttribute('data-ready')) {
      const sel = $('hf-kat'), cur = S.hist.kat;
      sel.innerHTML = '<option value="">Semua kategori</option>' + cats.map(k => '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(k) + '</option>').join('');
      return;
    }
    box.setAttribute('data-ready', '1');
    const input = 'px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500';
    box.innerHTML = '<div class="adv-card p-4 mb-4"><div class="grid grid-cols-2 lg:grid-cols-6 gap-2">' +
      '<input id="hf-q" type="search" placeholder="Cari transaksi…" class="col-span-2 ' + input + '">' +
      '<select id="hf-jenis" class="' + input + '"><option value="">Semua jenis</option><option value="pemasukan">Pemasukan</option><option value="pengeluaran">Pengeluaran</option></select>' +
      '<select id="hf-kat" class="' + input + '"></select>' +
      '<input id="hf-from" type="date" aria-label="Dari tanggal" class="' + input + '"><input id="hf-to" type="date" aria-label="Sampai tanggal" class="' + input + '"></div>' +
      '<div class="flex flex-wrap items-center justify-between gap-2 mt-3"><p id="history-summary" class="text-xs text-slate-500"></p>' +
      '<div class="flex gap-2"><button type="button" id="hf-reset" class="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600">Reset</button>' +
      '<button type="button" id="hf-xlsx" class="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"><i class="fas fa-file-excel mr-1"></i>Excel</button>' +
      '<button type="button" id="hf-csv" class="px-3 py-2 rounded-lg bg-slate-700 text-white text-xs font-bold"><i class="fas fa-file-csv mr-1"></i>CSV</button></div></div></div>';
    const rerender = () => { if (typeof renderHistoryTable === 'function') renderHistoryTable(); };
    let timer;
    $('hf-q').addEventListener('input', e => { S.hist.q = e.target.value; clearTimeout(timer); timer = setTimeout(rerender, 200); });
    $('hf-jenis').addEventListener('change', e => { S.hist.jenis = e.target.value; rerender(); });
    $('hf-kat').addEventListener('change', e => { S.hist.kat = e.target.value; rerender(); });
    $('hf-from').addEventListener('change', e => { S.hist.from = e.target.value; rerender(); });
    $('hf-to').addEventListener('change', e => { S.hist.to = e.target.value; rerender(); });
    $('hf-reset').addEventListener('click', () => {
      S.hist = { q: '', jenis: '', kat: '', from: '', to: '' };
      ['hf-q', 'hf-jenis', 'hf-kat', 'hf-from', 'hf-to'].forEach(id => { $(id).value = ''; });
      rerender();
    });
    $('hf-xlsx').addEventListener('click', () => {
      if (typeof XLSX === 'undefined') { toast('Pustaka Excel belum termuat.', 'error'); return; }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(window.getHistoryFiltered().map(trxToRow)), 'Transaksi');
      download('riwayat-transaksi-' + stamp() + '.xlsx', wb);
    });
    $('hf-csv').addEventListener('click', () => {
      const rows = window.getHistoryFiltered().map(trxToRow);
      const head = ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Nominal', 'ID'];
      const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      download('riwayat-transaksi-' + stamp() + '.csv', [head.join(',')].concat(rows.map(r => head.map(h => q(r[h])).join(','))).join('\r\n'), true);
    });
    const sel = $('hf-kat'); sel.innerHTML = '<option value="">Semua kategori</option>' + cats.map(k => '<option value="' + esc(k) + '">' + esc(k) + '</option>').join('');
  };

  // ------------------------------------------------------------------ hutang & piutang: UI
  function dueBadge(r) {
    if (r.status === 'lunas') return '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Lunas</span>';
    if (!r.jatuh_tempo) return '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">Tanpa tempo</span>';
    const d = daysBetween(new Date(), parseISO(r.jatuh_tempo));
    if (d < 0) return '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">Terlambat ' + (-d) + ' hari</span>';
    if (d === 0) return '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">Jatuh tempo hari ini</span>';
    if (d <= 7) return '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">' + d + ' hari lagi</span>';
    return '<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">' + d + ' hari lagi</span>';
  }

  window.renderDebtsTab = function () {
    const root = $('debts-root');
    if (!root) return;
    if (S.receivablesReady === false) {
      root.innerHTML = '<div class="adv-card p-6"><h2 class="text-lg font-bold text-slate-900 mb-1">Hutang &amp; Piutang</h2><p class="text-sm text-slate-600">Tabel belum dibuat. Jalankan file <b>supabase-setup.sql</b> di Supabase (SQL Editor), lalu muat ulang halaman ini.</p></div>';
      return;
    }
    if (S.receivablesReady === null) { root.innerHTML = '<p class="p-6 text-sm text-slate-400">Memuat…</p>'; return; }
    const r = recvStats(new Date());
    const f = S.debtFilter;
    const list = S.receivables.filter(x => (f.tipe === 'semua' || x.tipe === f.tipe) && (f.status === 'semua' || (f.status === 'belum' ? x.status !== 'lunas' : x.status === 'lunas')))
      .sort((a, b) => (a.jatuh_tempo || '9999').localeCompare(b.jatuh_tempo || '9999'));
    const input = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500';
    root.innerHTML =
      '<div class="m-dup-head adv-card p-5 mb-4"><div class="flex items-center gap-3 mb-1"><div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><i class="fas fa-handshake text-lg"></i></div><div><h2 class="text-xl font-bold text-slate-900">Hutang &amp; Piutang</h2><p class="text-xs text-slate-500">Pantau uang yang belum diterima dari pelanggan dan kewajiban ke supplier.</p></div></div></div>' +
      '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">' +
        kpi({ label: 'Piutang belum lunas', value: rp(r.piutang), sub: 'Terlambat ' + rp(r.piutangOverdue), icon: 'fa-hand-holding-dollar', color: '#2563eb' }) +
        kpi({ label: 'Hutang belum lunas', value: rp(r.hutang), sub: 'Terlambat ' + rp(r.hutangOverdue), icon: 'fa-file-invoice-dollar', color: '#e11d48' }) +
        kpi({ label: 'Jatuh tempo ≤ 7 hari', value: String(r.soonCount) + ' tagihan', sub: 'Hutang ' + rp(r.hutangSoon) + ' · Piutang ' + rp(r.piutangSoon), icon: 'fa-clock', color: '#d97706' }) +
        kpi({ label: 'Terlambat', value: String(r.overdueCount) + ' tagihan', sub: 'Perlu tindakan segera', icon: 'fa-triangle-exclamation', color: '#be123c' }) + '</div>' +
      '<div class="adv-card p-5 mb-4"><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3">Catat baru</h3>' +
        '<form id="debt-form" class="grid grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">' +
          '<div><label class="block text-[11px] font-bold text-slate-500 mb-1">Jenis</label><select id="d-tipe" class="' + input + '"><option value="piutang">Piutang (pelanggan berutang)</option><option value="hutang">Hutang (ke supplier)</option></select></div>' +
          '<div><label class="block text-[11px] font-bold text-slate-500 mb-1">Nama pihak</label><input id="d-pihak" required class="' + input + '" placeholder="Nama pelanggan/supplier"></div>' +
          '<div><label class="block text-[11px] font-bold text-slate-500 mb-1">Nominal (Rp)</label><input id="d-nominal" type="number" min="1" required class="' + input + '"></div>' +
          '<div><label class="block text-[11px] font-bold text-slate-500 mb-1">Tanggal</label><input id="d-tanggal" type="date" required class="' + input + '"></div>' +
          '<div><label class="block text-[11px] font-bold text-slate-500 mb-1">Jatuh tempo</label><input id="d-tempo" type="date" class="' + input + '"></div>' +
          '<button type="submit" class="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold">Simpan</button>' +
          '<input id="d-catatan" class="col-span-2 lg:col-span-6 ' + input + '" placeholder="Catatan (opsional): nomor nota, barang, kesepakatan bayar…"></form>' +
        '<p class="text-[11px] text-slate-500 mt-3"><i class="fas fa-circle-info mr-1"></i>Buku kas ini berbasis kas: jangan catat penjualan/kulakan kredit di tab Input sebelum lunas. Saat ditandai lunas, Anda bisa langsung mencatatnya ke buku kas agar tidak tercatat dua kali.</p></div>' +
      '<div class="adv-card p-5"><div class="flex flex-wrap items-center justify-between gap-2 mb-3"><h3 class="font-bold text-slate-800 text-sm uppercase tracking-wider">Daftar</h3><div class="flex gap-2">' +
        '<select id="df-tipe" class="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"><option value="semua">Semua jenis</option><option value="piutang">Piutang</option><option value="hutang">Hutang</option></select>' +
        '<select id="df-status" class="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"><option value="belum">Belum lunas</option><option value="lunas">Lunas</option><option value="semua">Semua</option></select></div></div>' +
      (list.length ? '<div class="space-y-2">' + list.map(x => {
        const isP = x.tipe === 'piutang';
        return '<div class="rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ' + (isP ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700') + '">' + (isP ? 'Piutang' : 'Hutang') + '</span><span class="text-sm font-bold text-slate-900 break-words">' + esc(x.pihak) + '</span>' + dueBadge(x) + '</div>' +
          '<p class="text-[11px] text-slate-500 mt-1">Tgl ' + esc(x.tanggal) + (x.jatuh_tempo ? ' · Tempo ' + esc(x.jatuh_tempo) : '') + (x.catatan ? ' · ' + esc(x.catatan) : '') + (x.status === 'lunas' && x.dibayar_tanggal ? ' · Dibayar ' + esc(x.dibayar_tanggal) : '') + '</p></div>' +
          '<div class="flex items-center gap-2 sm:justify-end"><span class="text-base font-extrabold ' + (isP ? 'text-blue-700' : 'text-rose-600') + ' whitespace-nowrap">' + rp(x.nominal) + '</span>' +
          (x.status !== 'lunas' ? '<button type="button" data-d-act="paid" data-id="' + esc(x.id) + '" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">Lunas</button>' : '') +
          (x.status !== 'lunas' && isP ? '<button type="button" data-d-act="wa" data-id="' + esc(x.id) + '" class="px-2.5 py-1.5 rounded-lg bg-green-100 text-green-800 text-[11px] font-bold" title="Kirim pengingat lewat WhatsApp"><i class="fab fa-whatsapp"></i></button>' : '') +
          '<button type="button" data-d-act="del" data-id="' + esc(x.id) + '" class="px-2 py-1.5 text-slate-400 hover:text-rose-600" title="Hapus"><i class="fas fa-trash"></i></button></div></div>';
      }).join('') + '</div>' : '<p class="text-sm text-slate-400 py-4 text-center">Tidak ada data untuk filter ini.</p>') + '</div>';

    $('d-tanggal').value = iso(new Date());
    $('df-tipe').value = f.tipe; $('df-status').value = f.status;
    $('df-tipe').addEventListener('change', e => { S.debtFilter.tipe = e.target.value; renderDebtsTab(); });
    $('df-status').addEventListener('change', e => { S.debtFilter.status = e.target.value; renderDebtsTab(); });
    $('debt-form').addEventListener('submit', addReceivable);
    root.querySelectorAll('[data-d-act]').forEach(b => b.addEventListener('click', () => debtAction(b.dataset.dAct, b.dataset.id)));
  };

  async function addReceivable(e) {
    e.preventDefault();
    const rec = {
      id: 'RCV-' + Date.now(), tipe: $('d-tipe').value, pihak: $('d-pihak').value.trim(), nominal: Math.round(num($('d-nominal').value)),
      tanggal: $('d-tanggal').value, jatuh_tempo: $('d-tempo').value || null, status: 'belum', catatan: $('d-catatan').value.trim() || null
    };
    if (!rec.pihak || rec.nominal <= 0 || !rec.tanggal) { toast('Lengkapi nama pihak, nominal, dan tanggal.', 'error'); return; }
    const { error } = await supabaseClient.from('receivables').insert([rec]);
    if (error) { toast('Gagal menyimpan: ' + error.message, 'error'); return; }
    S.receivables.push(rec);
    toast('Tersimpan.');
    renderDebtsTab(); renderAdvisorDashboard();
  }

  async function debtAction(act, id) {
    const rec = S.receivables.find(x => String(x.id) === String(id));
    if (!rec) return;
    if (act === 'del') {
      if (!confirm('Hapus catatan ' + rec.tipe + ' "' + rec.pihak + '" sebesar ' + rp(rec.nominal) + '?')) return;
      const { error } = await supabaseClient.from('receivables').delete().eq('id', id);
      if (error) { toast('Gagal menghapus: ' + error.message, 'error'); return; }
      S.receivables = S.receivables.filter(x => String(x.id) !== String(id));
    } else if (act === 'wa') {
      const today = startOfDay(new Date());
      const late = rec.jatuh_tempo && parseISO(rec.jatuh_tempo) < today;
      const text = 'Assalamualaikum ' + rec.pihak + ', kami dari Toko Grosir AR-Rahman. Mengingatkan tagihan sebesar ' + rp(rec.nominal) + (rec.jatuh_tempo ? ' dengan jatuh tempo ' + rec.jatuh_tempo : '') + (late ? ' yang sudah terlewat' : '') + '. Mohon konfirmasi jadwal pembayarannya. Terima kasih.';
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      return;
    } else if (act === 'paid') {
      if (!confirm('Tandai ' + rec.tipe + ' "' + rec.pihak + '" sebesar ' + rp(rec.nominal) + ' sebagai LUNAS?')) return;
      const when = iso(new Date());
      const { error } = await supabaseClient.from('receivables').update({ status: 'lunas', dibayar_tanggal: when }).eq('id', id);
      if (error) { toast('Gagal memperbarui: ' + error.message, 'error'); return; }
      rec.status = 'lunas'; rec.dibayar_tanggal = when;
      const isP = rec.tipe === 'piutang';
      if (confirm('Catat juga ' + rp(rec.nominal) + ' ke buku kas sebagai ' + (isP ? 'PEMASUKAN (penjualan)' : 'PENGELUARAN (kulakan)') + '?\n\nOK = catat ke buku kas\nBatal = hanya tandai lunas (jika sudah pernah dicatat manual)')) {
        const trx = { id: 'TRX-' + Date.now(), jenis: isP ? 'pemasukan' : 'pengeluaran', tanggal: when, kategori: isP ? 'Penjualan Grosir (Partai Besar)' : 'Pembelian Barang (Kulakan Stok)', nominal: rec.nominal, keterangan: (isP ? 'Pelunasan piutang: ' : 'Pelunasan hutang supplier: ') + rec.pihak, timestamp: new Date().toISOString() };
        const res = await supabaseClient.from('transactions').insert([trx]);
        if (res.error) toast('Lunas tersimpan, tetapi gagal mencatat ke buku kas: ' + res.error.message, 'error');
        else { transactions.unshift(trx); toast('Dicatat ke buku kas.'); }
      }
    }
    renderDebtsTab(); renderAdvisorDashboard();
    if (typeof renderHistoryTable === 'function') renderHistoryTable();
  }

  // Untuk pengujian di luar browser.
  window.AdvisorCore = { calc, getRange, baseline, forecast, healthScore, analyze, buildInsights, receiptAnalysis, findAnomalies, weekdayPattern, groupByMonth, S, recvStats };
})();

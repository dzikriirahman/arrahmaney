// Perilaku khusus HP: judul besar mengikuti tab, ketuk tab aktif = ke atas, tab bar disembunyikan saat keyboard terbuka.
(function () {
  'use strict';
  const TITLES = {
    dashboard: ['Ringkasan', 'date'],
    input: ['Catat transaksi', 'Pemasukan atau pengeluaran harian'],
    expenses: ['Detail struk', 'Foto struk, periksa, lalu simpan'],
    history: ['Riwayat', 'Semua transaksi tersimpan di cloud'],
    debts: ['Hutang & piutang', 'Pantau uang masuk dan kewajiban'],
    kulakan: ['Kulakan', 'Belanja barang, supplier, dan margin']
  };
  const $ = id => document.getElementById(id);
  let current = 'dashboard';

  function todayLabel() {
    try { return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (_) { return ''; }
  }

  function setTitle(tab) {
    const t = TITLES[tab] || TITLES.dashboard;
    const title = $('m-title'), sub = $('m-subtitle');
    if (title) title.textContent = t[0];
    if (sub) sub.textContent = t[1] === 'date' ? todayLabel() : t[1];
  }

  function wrapSwitchTab() {
    const original = window.switchTab;
    if (typeof original !== 'function' || original.__mobileWrapped) return false;
    const wrapped = function (tabId) {
      const same = tabId === current;
      original.apply(this, arguments);
      current = tabId;
      setTitle(tabId);
      document.body.setAttribute('data-tab', tabId);
      try { window.scrollTo({ top: 0, behavior: same ? 'smooth' : 'auto' }); } catch (_) { window.scrollTo(0, 0); }
    };
    wrapped.__mobileWrapped = true;
    window.switchTab = wrapped;
    return true;
  }

  // Sembunyikan tab bar saat mengetik supaya tidak menumpuk di atas keyboard iOS.
  function bindKeyboard() {
    const isField = el => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|button|submit|file)$/i.test(el.type || '');
    let timer;
    document.addEventListener('focusin', e => { if (isField(e.target)) { clearTimeout(timer); document.body.classList.add('kb-open'); } });
    document.addEventListener('focusout', () => { clearTimeout(timer); timer = setTimeout(() => { if (!isField(document.activeElement)) document.body.classList.remove('kb-open'); }, 120); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    wrapSwitchTab();
    setTitle('dashboard');
    document.body.setAttribute('data-tab', 'dashboard');
    bindKeyboard();
  });
  // Jika skrip lain mendefinisikan ulang switchTab setelah ini, pasang lagi.
  window.addEventListener('load', wrapSwitchTab);
})();

// Login untuk aplikasi keuangan AR-Rahman (Supabase Auth, email + password).
//
// Catatan keamanan penting:
//  - Layar login ini hanya mengatur tampilan. Yang benar-benar melindungi data adalah RLS di Supabase.
//    Jalankan supabase-setup.sql agar tabel hanya bisa diakses pengguna yang sudah login.
//  - Matikan pendaftaran publik di Supabase (Authentication > Sign In / Providers > "Allow new users to sign up"),
//    lalu buat akun pengguna secara manual lewat Authentication > Users > Add user.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let currentUserId = null;
  let booted = false;

  function setMessage(el, text, kind) {
    if (!el) return;
    if (!text) { el.classList.add('hidden'); el.textContent = ''; return; }
    el.textContent = text;
    el.className = 'mb-4 rounded-xl px-3 py-2.5 text-xs font-semibold ' +
      (kind === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200');
  }

  function friendlyError(err) {
    const msg = String((err && err.message) || err || '').toLowerCase();
    if (msg.includes('invalid login credentials')) return 'Email atau password salah.';
    if (msg.includes('email not confirmed')) return 'Email belum dikonfirmasi. Minta pemilik toko mengonfirmasi akun Anda di Supabase.';
    if (msg.includes('rate limit') || msg.includes('too many')) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
    if (msg.includes('signups not allowed') || msg.includes('signup')) return 'Akun tidak ditemukan atau pendaftaran dinonaktifkan.';
    return 'Gagal masuk: ' + (err && err.message ? err.message : 'kesalahan tidak diketahui');
  }

  function showView(view) {
    const login = $('login-form'), recovery = $('recovery-form');
    if (login) login.classList.toggle('hidden', view !== 'login');
    if (recovery) recovery.classList.toggle('hidden', view !== 'recovery');
  }

  function lockApp() {
    document.body.classList.add('auth-locked');
    const screen = $('login-screen');
    if (screen) screen.classList.remove('hidden');
    const email = $('user-email');
    if (email) email.textContent = '';
    // Hapus data dari memori saat keluar supaya tidak tersisa di layar/perangkat bersama.
    try { if (typeof transactions !== 'undefined') transactions.length = 0; } catch (_) {}
    if (window.clearAdvisorData) window.clearAdvisorData();
  }

  function unlockApp(session) {
    document.body.classList.remove('auth-locked');
    const screen = $('login-screen');
    if (screen) screen.classList.add('hidden');
    const email = $('user-email');
    if (email) email.textContent = (session.user && session.user.email) || '';
    const pass = $('login-password');
    if (pass) pass.value = '';
    setMessage($('login-message'), '');
  }

  function loadEverything() {
    if (typeof window.loadDataFromSupabase === 'function') window.loadDataFromSupabase();
    if (window.loadAdvisorData) window.loadAdvisorData();
  }

  function applySession(session) {
    if (session && session.user) {
      const isNewUser = currentUserId !== session.user.id;
      currentUserId = session.user.id;
      unlockApp(session);
      if (isNewUser) loadEverything();
    } else {
      currentUserId = null;
      lockApp();
      showView('login');
    }
  }

  window.appSignOut = async function () {
    try { await supabaseClient.auth.signOut(); } catch (e) { console.error('signOut', e); }
    applySession(null);
  };

  window.initAuth = async function () {
    if (booted) return;
    booted = true;
    const boot = $('login-boot');
    if (boot) boot.classList.remove('hidden');

    const toggle = $('login-toggle-pass');
    if (toggle) toggle.addEventListener('click', () => {
      const input = $('login-password');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = '<i class="fas ' + (show ? 'fa-eye-slash' : 'fa-eye') + '"></i>';
      toggle.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
    });

    const form = $('login-form');
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('login-email').value.trim();
      const password = $('login-password').value;
      const btn = $('login-submit');
      if (!email || !password) { setMessage($('login-message'), 'Isi email dan password.', 'err'); return; }
      btn.disabled = true; btn.classList.add('opacity-60');
      setMessage($('login-message'), '');
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        applySession(data.session);
      } catch (err) {
        setMessage($('login-message'), friendlyError(err), 'err');
      } finally {
        btn.disabled = false; btn.classList.remove('opacity-60');
      }
    });

    const forgot = $('login-forgot');
    if (forgot) forgot.addEventListener('click', async () => {
      const email = $('login-email').value.trim();
      if (!email) { setMessage($('login-message'), 'Isi email Anda di kolom Email, lalu tekan "Lupa password?" lagi.', 'err'); return; }
      try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
        if (error) throw error;
        setMessage($('login-message'), 'Jika email terdaftar, tautan reset password sudah dikirim. Periksa kotak masuk Anda.', 'ok');
      } catch (err) {
        setMessage($('login-message'), friendlyError(err), 'err');
      }
    });

    const recovery = $('recovery-form');
    if (recovery) recovery.addEventListener('submit', async e => {
      e.preventDefault();
      const p1 = $('recovery-password').value, p2 = $('recovery-password2').value;
      const msg = $('recovery-message');
      if (p1.length < 8) { setMessage(msg, 'Password minimal 8 karakter.', 'err'); return; }
      if (p1 !== p2) { setMessage(msg, 'Kedua password tidak sama.', 'err'); return; }
      try {
        const { error } = await supabaseClient.auth.updateUser({ password: p1 });
        if (error) throw error;
        setMessage(msg, '');
        const { data } = await supabaseClient.auth.getSession();
        history.replaceState(null, '', window.location.pathname);
        showView('login');
        applySession(data.session);
        if (typeof showToast === 'function') showToast('Password berhasil diganti.');
      } catch (err) {
        setMessage(msg, 'Gagal mengganti password: ' + (err.message || 'kesalahan'), 'err');
      }
    });

    // Jangan memanggil fungsi Supabase lain langsung di dalam callback ini (bisa deadlock) -> tunda dengan setTimeout.
    supabaseClient.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (event === 'PASSWORD_RECOVERY') { lockApp(); showView('recovery'); return; }
        if (event === 'SIGNED_OUT') { applySession(null); return; }
        if (session && session.user) applySession(session);
      }, 0);
    });

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      // Jika halaman dibuka dari tautan reset password, event PASSWORD_RECOVERY akan menanganinya.
      if (!/type=recovery/.test(window.location.hash)) applySession(data.session);
    } catch (err) {
      console.error('Gagal memeriksa sesi', err);
      applySession(null);
    } finally {
      if (boot) boot.classList.add('hidden');
    }
  };
})();

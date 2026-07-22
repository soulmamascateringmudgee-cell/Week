/* Coffee Kingdom Rewards — customer app logic */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const screens = ['loading', 'setup', 'auth', 'main'];
  function show(name) {
    screens.forEach((s) => $('screen-' + s).classList.toggle('is-active', s === name));
  }
  function toast(msg, kind) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 3200);
  }
  function money(cents, currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: (currency || 'AUD').toUpperCase() }).format((cents || 0) / 100);
    } catch { return '$' + ((cents || 0) / 100).toFixed(2); }
  }

  let sb = null;        // supabase client
  let cfg = null;       // program config
  let signupMode = false;

  // ---- boot ---------------------------------------------------------
  async function boot() {
    try {
      cfg = await fetch('/api/config').then((r) => r.json());
    } catch {
      cfg = { configured: false };
    }
    if (!cfg.configured || !window.supabase) { show('setup'); return; }

    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

    // fill offer copy
    $('auth-pay').textContent = cfg.payCoffees;
    $('auth-get').textContent = cfg.bundleCoffees;
    $('note-pay').textContent = cfg.payCoffees;
    $('note-get').textContent = cfg.bundleCoffees;
    $('buy-price').textContent = money(cfg.priceCents, cfg.currency);

    // handle return from Square checkout
    const params = new URLSearchParams(location.search);
    const paid = params.get('paid');
    if (paid) {
      history.replaceState({}, '', location.pathname);
      if (paid === 'success') toast('Payment received — adding your coffees…', 'ok');
      else if (paid === 'cancel') toast('Payment cancelled.', 'err');
    }

    const { data: { session } } = await sb.auth.getSession();
    if (session) { await enterApp(paid === 'success'); }
    else { show('auth'); }
  }

  // ---- auth ---------------------------------------------------------
  function setAuthMode(signup) {
    signupMode = signup;
    $('field-name').hidden = !signup;
    $('auth-title').textContent = signup ? 'Create your account' : 'Welcome back';
    $('auth-submit').textContent = signup ? 'Create account' : 'Sign in';
    $('switch-text').textContent = signup ? 'Already a member?' : 'New here?';
    $('switch-link').textContent = signup ? 'Sign in' : 'Create an account';
    $('password').autocomplete = signup ? 'new-password' : 'current-password';
    $('auth-error').hidden = true;
  }

  $('switch-link').addEventListener('click', (e) => { e.preventDefault(); setAuthMode(!signupMode); });

  $('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim();
    const password = $('password').value;
    const name = $('name').value.trim();
    const errEl = $('auth-error');
    errEl.hidden = true;
    const btn = $('auth-submit');
    btn.disabled = true; btn.textContent = 'Please wait…';

    try {
      if (signupMode) {
        const { data, error } = await sb.auth.signUp({
          email, password, options: { data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) {
          toast('Check your email to confirm, then sign in.', 'ok');
          setAuthMode(false);
        } else {
          await enterApp(false);
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await enterApp(false);
      }
    } catch (err) {
      errEl.textContent = err.message || 'Something went wrong.';
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      setAuthMode(signupMode);
    }
  });

  $('signout').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
  });

  // ---- main app -----------------------------------------------------
  async function enterApp(justPaid) {
    show('main');
    const { data: { user } } = await sb.auth.getUser();
    const { data: prof } = await sb.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const first = (prof?.full_name || '').split(' ')[0];
    $('hello').textContent = first ? `Hi ${first} 👋` : 'Hi there 👋';

    await refresh();
    if (justPaid) pollForCredit(0);
  }

  async function token() {
    const { data: { session } } = await sb.auth.getSession();
    return session?.access_token;
  }

  async function refresh() {
    const { data: { user } } = await sb.auth.getUser();
    const { data: credit } = await sb.from('credits').select('balance').eq('user_id', user.id).maybeSingle();
    const balance = credit?.balance ?? 0;
    renderBalance(balance);

    const { data: txns } = await sb.from('transactions')
      .select('kind,coffees,amount_cents,created_at')
      .order('created_at', { ascending: false }).limit(8);
    renderHistory(txns || []);
    return balance;
  }

  function renderBalance(balance) {
    $('balance').textContent = balance;
    $('redeem').disabled = balance <= 0;
    const total = cfg.bundleCoffees;
    const cups = $('cups');
    cups.innerHTML = '';
    const filled = Math.min(balance, total);
    for (let i = 0; i < total; i++) {
      const s = document.createElement('span');
      s.textContent = '☕';
      if (i < filled) s.className = 'filled';
      cups.appendChild(s);
    }
  }

  function renderHistory(txns) {
    const list = $('history-list');
    if (!txns.length) { list.innerHTML = '<li class="muted">No activity yet.</li>'; return; }
    list.innerHTML = '';
    txns.forEach((t) => {
      const li = document.createElement('li');
      const label = t.kind === 'purchase' ? `Bundle purchased${t.amount_cents ? ' · ' + money(t.amount_cents, cfg.currency) : ''}`
        : t.kind === 'redeem' ? 'Coffee redeemed' : 'Adjustment';
      const when = new Date(t.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      const pos = t.coffees >= 0;
      li.innerHTML = `<span>${label}<br><span class="when">${when}</span></span>`
        + `<span class="amt ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${t.coffees} ☕</span>`;
      list.appendChild(li);
    });
  }

  // Poll a few times after payment while the webhook credits the account.
  function pollForCredit(prev, tries) {
    tries = tries || 0;
    if (tries > 6) return;
    setTimeout(async () => {
      const bal = await refresh();
      if (bal > prev) toast('Your coffees are ready! ☕', 'ok');
      else pollForCredit(prev, tries + 1);
    }, 2500);
  }

  // ---- buy ----------------------------------------------------------
  $('buy').addEventListener('click', async () => {
    if (!cfg.paymentsConfigured) { toast('Payments aren’t switched on yet.', 'err'); return; }
    const btn = $('buy'); btn.disabled = true;
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST', headers: { Authorization: 'Bearer ' + await token() },
      });
      const data = await res.json();
      if (data.url) { location.href = data.url; }
      else { toast(data.error || 'Could not start checkout.', 'err'); btn.disabled = false; }
    } catch {
      toast('Could not start checkout.', 'err'); btn.disabled = false;
    }
  });

  // ---- redeem -------------------------------------------------------
  const modal = $('modal-redeem');
  $('redeem').addEventListener('click', () => { $('pin').value = ''; $('redeem-error').hidden = true; modal.hidden = false; $('pin').focus(); });
  $('redeem-cancel').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  $('redeem-confirm').addEventListener('click', async () => {
    const pin = $('pin').value.trim();
    const errEl = $('redeem-error'); errEl.hidden = true;
    const btn = $('redeem-confirm'); btn.disabled = true; btn.textContent = 'Redeeming…';
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok) {
        modal.hidden = true;
        renderBalance(data.balance);
        await refresh();
        toast('Enjoy your coffee! ☕', 'ok');
      } else {
        errEl.textContent = data.error || 'Could not redeem.';
        errEl.hidden = false;
      }
    } catch {
      errEl.textContent = 'Could not redeem.'; errEl.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Redeem 1 coffee';
    }
  });

  // ---- service worker ----------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  boot();
})();

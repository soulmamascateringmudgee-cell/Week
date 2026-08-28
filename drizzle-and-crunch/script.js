/* Drizzle & Crunch site behaviour
   Three things: sticky nav, the drizzle/crunch builder, the enquiry form. */

(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var money = function (n) { return '$' + n.toFixed(2); };

  /* ── Year ────────────────────────────────────────────── */
  var yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ── Sticky nav ──────────────────────────────────────── */
  var nav = $('#nav');

  // the hero slides up under the nav, so it needs the real measured height
  var setNavH = function () {
    document.documentElement.style.setProperty('--navh', nav.offsetHeight + 'px');
  };
  setNavH();
  window.addEventListener('resize', setNavH);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setNavH);

  var onScroll = function () {
    nav.classList.toggle('is-stuck', window.scrollY > 40);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var toggle = $('#navToggle');
  var links = $('.nav__links');
  if (toggle && links) {
    links.id = links.id || 'navLinks';
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── The builder ─────────────────────────────────────────
     Prices are the real window prices off the van menu.
     Sundaes and stick waffles include 1 drizzle + 1 crunch:
     modelled as a discount equal to the cheapest selected item
     in each group, capped at the standard rate. That way a $3
     kataifi crunch used as the "included" one still costs $2,
     which matches how the printed menu prices it.            */

  var BASES = [
    { id: 'sundae',  name: 'Sundae',            price: 12.50, inc: true  },
    { id: 'waffle',  name: 'Stick waffle',      price: 17.50, inc: true  },
    { id: 'acai-r',  name: 'Açaí bowl, regular', price: 15.50, inc: false, note: 'toppings extra' },
    { id: 'acai-l',  name: 'Açaí bowl, large',   price: 18.50, inc: false, note: 'toppings extra' }
  ];

  var DRIZZLES = [
    { name: 'Nutella',          price: 2 },
    { name: 'Bueno',            price: 2 },
    { name: 'Pistachio',        price: 2 },
    { name: 'White chocolate',  price: 2 },
    { name: 'Biscoff',          price: 2 }
  ];

  var CRUNCHES = [
    { name: 'Pistachio crumble',  price: 1 },
    { name: 'Coconut sprinkle',   price: 1 },
    { name: 'Peanut butter',      price: 1 },
    { name: 'Oreo crumble',       price: 1 },
    { name: "M&M Mini's",         price: 1 },
    { name: 'Biscoff crumbs',     price: 1 },
    { name: 'Pistachio + kataifi', price: 3 },
    { name: 'Bueno + kataifi',     price: 3 }
  ];

  var FRUIT = [
    { name: 'Strawberry',      price: 1 },
    { name: 'Banana',          price: 1 },
    { name: 'Blueberry',       price: 1 },
    { name: 'Kiwi',            price: 1 },
    { name: 'Granola',         price: 1 },
    { name: 'Passionfruit pulp', price: 1 }
  ];

  var STD = { drizzle: 2, crunch: 1 };

  var form = $('#builder');
  if (form) buildUI();

  function buildUI() {
    var baseWrap = $('.opts--base', form);

    BASES.forEach(function (b, i) {
      baseWrap.insertAdjacentHTML('beforeend',
        '<label class="opt">' +
          '<input type="radio" name="base" value="' + b.id + '"' + (i === 0 ? ' checked' : '') + '>' +
          '<span>' + b.name + ' <b>' + money(b.price) + '</b>' +
            (b.note ? ' <i class="opt__note">' + b.note + '</i>' : '') + '</span>' +
        '</label>');
    });

    fill('.opts--drizzle', DRIZZLES, 'drizzle');
    fill('.opts--crunch',  CRUNCHES, 'crunch');
    fill('.opts--fruit',   FRUIT,    'fruit');

    form.addEventListener('change', recalc);
    recalc();
  }

  function fill(sel, list, group) {
    var wrap = $(sel, form);
    list.forEach(function (o) {
      wrap.insertAdjacentHTML('beforeend',
        '<label class="opt">' +
          '<input type="checkbox" data-group="' + group + '" data-price="' + o.price + '" value="' + o.name + '">' +
          '<span>' + o.name + ' <b>+' + money(o.price) + '</b></span>' +
        '</label>');
    });
  }

  function picked(group) {
    return Array.prototype.slice
      .call(form.querySelectorAll('input[data-group="' + group + '"]:checked'))
      .map(function (el) { return { name: el.value, price: parseFloat(el.dataset.price), el: el }; });
  }

  function recalc() {
    var baseEl = form.querySelector('input[name="base"]:checked');
    var base = BASES.filter(function (b) { return b.id === baseEl.value; })[0];

    var d = picked('drizzle');
    var c = picked('crunch');
    var f = picked('fruit');

    var sum = function (a) { return a.reduce(function (t, x) { return t + x.price; }, 0); };
    var total = base.price + sum(d) + sum(c) + sum(f);

    // included drizzle + crunch on sundaes and waffles
    var freed = { drizzle: null, crunch: null };
    if (base.inc) {
      [['drizzle', d], ['crunch', c]].forEach(function (pair) {
        var group = pair[0], list = pair[1];
        if (!list.length) return;
        var cheapest = list.reduce(function (a, b) { return b.price < a.price ? b : a; });
        total -= Math.min(cheapest.price, STD[group]);
        freed[group] = cheapest.el;
      });
    }

    // strike through the price on whichever chip is being covered
    form.querySelectorAll('.opt b').forEach(function (b) { b.classList.remove('is-free'); });
    Object.keys(freed).forEach(function (g) {
      if (freed[g]) {
        var b = freed[g].nextElementSibling.querySelector('b');
        if (b && freed[g].dataset.price <= STD[g]) b.classList.add('is-free');
      }
    });

    // açaí includes nothing, so the badge flips to a charge notice rather than dimming
    form.querySelectorAll('.binc').forEach(function (el) {
      el.classList.toggle('is-extra', !base.inc);
      el.textContent = base.inc ? 'first one included' : 'all extra on açaí';
    });

    // readout
    var bits = []
      .concat(d.map(function (x) { return x.name; }))
      .concat(c.map(function (x) { return x.name; }))
      .concat(f.map(function (x) { return x.name; }));

    $('#tallyName').textContent = base.name;
    $('#tallyBits').textContent = bits.length ? bits.join(' · ') : 'no toppings yet';
    $('#tallyNum').textContent = money(total);
  }

  /* ── Enquiry form ────────────────────────────────────── */
  var enq = $('#enquiry');
  if (!enq) return;

  var note = $('#formNote');
  var btn = $('#send');

  enq.addEventListener('submit', function (e) {
    e.preventDefault();
    note.className = 'form__note';
    note.textContent = '';

    // honeypot: bots fill this, people never see it
    if (enq.company.value) return;

    var bad = null;
    ['name', 'phone', 'email'].forEach(function (n) {
      var el = enq[n];
      var ok = el.value.trim() && (n !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !bad) bad = el;
    });
    if (bad) {
      note.className = 'form__note is-err';
      note.textContent = 'Please fill in your name, phone and a valid email.';
      bad.focus();
      return;
    }

    var data = {};
    new FormData(enq).forEach(function (v, k) {
      data[k] = data[k] ? data[k] + ', ' + v : v;
    });

    btn.disabled = true;
    btn.textContent = 'Sending…';

    fetch('api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Send failed');
        enq.reset();
        note.className = 'form__note is-ok';
        note.textContent = "Got it, we'll be in touch shortly. Thanks!";
        btn.textContent = 'Sent';
      })
      .catch(function () {
        note.className = 'form__note is-err';
        note.innerHTML = "Couldn't send that just now. Please call " +
          '<a href="tel:+61477702618">0477 702 618</a> or email ' +
          '<a href="mailto:drizzleandcrunch@outlook.com.au">drizzleandcrunch@outlook.com.au</a>.';
        btn.disabled = false;
        btn.textContent = 'Try again';
      });
  });
})();

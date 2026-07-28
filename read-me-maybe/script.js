/* ============================================================
   Read Me Maybe — shop wiring
   ------------------------------------------------------------
   EDIT THIS BLOCK ONLY. Paste your two Stripe Payment Link URLs
   below (see README.md for how to make them), and change the
   vibes/handles if you like. Everything under CONFIG is plumbing.
   ============================================================ */

const CONFIG = {
  // Stripe Payment Links — paste the full https://buy.stripe.com/... URLs here.
  stripe: {
    'one-off': 'PASTE_YOUR_ONE_OFF_PAYMENT_LINK_HERE',
    'monthly': 'PASTE_YOUR_SUBSCRIPTION_PAYMENT_LINK_HERE',
  },

  // The vibe options shown on both cards.
  // `id` is what gets sent to Stripe, `label` is what customers see.
  vibes: [
    { id: 'romance',    label: 'Romance 💕' },
    { id: 'spice',      label: 'Spice 🌶️' },
    { id: 'thriller',   label: 'Thriller & mystery 🔪' },
    { id: 'fantasy',    label: 'Fantasy ✨' },
    { id: 'historical', label: 'Historical 🕰️' },
    { id: 'literary',   label: 'Literary fiction 📖' },
    { id: 'surprise',   label: 'Surprise me 🎁' },
  ],

  instagram: 'https://instagram.com/readmemaybe',
  email: 'hello@readmemaybe.com.au',
};

/* ---------- plumbing ---------- */

const isConfigured = (url) => typeof url === 'string' && url.startsWith('https://');

/** Build the chips for one plan card and return a getter for the chosen vibe. */
function buildVibes(card, planId) {
  const chips = card.querySelector('.chips');

  CONFIG.vibes.forEach((vibe, i) => {
    const label = document.createElement('label');
    label.className = 'chip';
    label.innerHTML =
      `<input type="radio" name="vibe-${planId}" value="${vibe.id}"` +
      ` id="vibe-${planId}-${i}"><span>${vibe.label}</span>`;
    chips.append(label);
  });

  return () => {
    const picked = chips.querySelector('input:checked');
    return picked ? picked.value : null;
  };
}

/** Nudge the customer towards the vibe picker instead of sending them to Stripe blind. */
function nudge(card, message) {
  const fieldset = card.querySelector('.vibes');
  const hint = card.querySelector('[data-hint]');

  hint.dataset.original ??= hint.textContent;
  hint.textContent = message;
  hint.classList.add('nudge');
  fieldset.classList.add('nudge');

  fieldset.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => fieldset.classList.remove('nudge'), 400);
}

function clearNudge(card) {
  const hint = card.querySelector('[data-hint]');
  const fieldset = card.querySelector('.vibes');
  if (hint.dataset.original) hint.textContent = hint.dataset.original;
  hint.classList.remove('nudge');
  fieldset.classList.remove('nudge');
}

document.querySelectorAll('.plan').forEach((card) => {
  const planId = card.dataset.plan;
  const getVibe = buildVibes(card, planId);
  const button = card.querySelector('[data-checkout]');

  card.addEventListener('change', () => clearNudge(card));

  button.addEventListener('click', (event) => {
    event.preventDefault();

    const vibe = getVibe();
    if (!vibe) {
      nudge(card, 'Choose a vibe first so we know who to set you up with.');
      return;
    }

    const link = CONFIG.stripe[planId];
    if (!isConfigured(link)) {
      nudge(card, 'Checkout isn’t connected yet — add your Stripe Payment Link in script.js.');
      return;
    }

    // Payment Links accept a client_reference_id in the URL. It shows up on the
    // payment in your Stripe dashboard, so you know which vibe to pack.
    const url = new URL(link);
    url.searchParams.set('client_reference_id', `${planId}-${vibe}`);
    window.location.href = url.toString();
  });
});

/* ---------- contact links ---------- */

const instagram = document.querySelector('[data-instagram]');
if (instagram) instagram.href = CONFIG.instagram;

const email = document.querySelector('[data-email]');
if (email) email.href = `mailto:${CONFIG.email}`;

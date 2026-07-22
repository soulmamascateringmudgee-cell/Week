/* Country Smart AI — workshop registration form
 *
 * By default this opens a pre-filled email to hello@countrysmartai.com.au
 * (no backend required — deploys anywhere as a static site).
 *
 * To collect submissions silently instead, create a free form endpoint
 * (e.g. Formspree, Getform, Basin) and paste its URL into FORM_ENDPOINT
 * below. When set, the form POSTs there in the background and never opens
 * an email client.
 */
const FORM_ENDPOINT = ''; // e.g. 'https://formspree.io/f/xxxxxxxx'
const CONTACT_EMAIL = 'hello@countrysmartai.com.au';

(function () {
  const form = document.getElementById('register-form');
  if (!form) return;
  const status = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');

  function collect() {
    const data = {
      Name: form.name.value.trim(),
      Email: form.email.value.trim(),
      Socials: form.social.value.trim() || '—',
      'AI frequency': (form.querySelector('input[name="frequency"]:checked') || {}).value || '—',
      'How they use it': (form.querySelector('input[name="usage"]:checked') || {}).value || '—',
      'Tools tried': Array.from(form.querySelectorAll('input[name="tools"]:checked'))
        .map((c) => c.value).join(', ') || '—',
      'Hoping to do': form.hope.value.trim(),
      'Anything else': form.notes.value.trim() || '—',
    };
    return data;
  }

  function showConfirmation() {
    if (status) status.hidden = false;
    if (button) {
      button.disabled = true;
      button.textContent = 'Registered ✓';
      button.style.opacity = '0.6';
      button.style.cursor = 'default';
    }
  }

  function sendByEmail(data) {
    const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
    const body = 'Workshop registration — Free AI Workshop, Mudgee\n\n' + lines.join('\n');
    const subject = `Workshop registration — ${data.Name || 'New registration'}`;
    window.location.href =
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Native validation for required fields (name, email, frequency, usage, hope)
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = collect();

    if (FORM_ENDPOINT) {
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(showConfirmation)
        .catch(function () {
          // Fall back to email if the endpoint fails
          sendByEmail(data);
          showConfirmation();
        });
    } else {
      sendByEmail(data);
      showConfirmation();
    }
  });
})();

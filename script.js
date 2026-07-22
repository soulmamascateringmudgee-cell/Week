// ===== Country Smart AI — interactions =====
(function () {
  "use strict";

  // Web3Forms — responses are emailed to the address this key is registered to
  // (hello@countrysmartai.com.au). This key is safe to be public.
  var ACCESS_KEY = "e8f05fe6-2742-4283-aa85-605939258c26";
  var ENDPOINT = "https://api.web3forms.com/submit";

  // Current year in footer
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var form = document.getElementById("leadForm");
  var note = document.getElementById("formNote");
  var button = form ? form.querySelector('button[type="submit"]') : null;
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var get = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : "";
    };

    var name = get("name");
    var email = get("email");

    if (!name || !email) {
      showNote("Please add your name and email so I can get back to you.", "err");
      return;
    }

    // Honeypot — if a bot filled this hidden field, silently pretend success
    if (form.botcheck && form.botcheck.checked) return;

    var tasks = Array.prototype.slice
      .call(form.querySelectorAll('input[name="tasks"]:checked'))
      .map(function (c) { return c.value.replace(/&amp;/g, "&"); });

    var business = get("business");

    var payload = {
      access_key: ACCESS_KEY,
      subject: "Country Smart AI — " + (business || name),
      from_name: "Country Smart AI website",
      replyto: email,
      "Name": name,
      "Business": business,
      "Email": email,
      "Phone": get("phone"),
      "What the business does": get("does"),
      "What eats up most of the week": get("timedrain"),
      "Hours a week lost to admin/repetitive work": get("hours"),
      "Time-sink tasks": tasks.join(", "),
      "One task they'd love to stop": get("stop"),
      "What they'd do with the time back": get("free"),
      "How they feel about AI": get("comfort"),
      "Anything else": get("notes")
    };

    setBusy(true);
    showNote("Sending…", "");

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success) {
          form.reset();
          showNote("Sent! Thank you — I'll be in touch soon. 🌿", "ok");
        } else {
          showNote(
            "Sorry, something went wrong sending that. Please email me directly at hello@countrysmartai.com.au.",
            "err"
          );
        }
      })
      .catch(function () {
        showNote(
          "Couldn't send just now — please check your connection, or email me at hello@countrysmartai.com.au.",
          "err"
        );
      })
      .finally(function () { setBusy(false); });
  });

  function setBusy(busy) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? "Sending…" : "Send it to me →";
  }

  function showNote(msg, type) {
    if (!note) return;
    note.textContent = msg;
    note.className = "form-note " + type;
    note.scrollIntoView({ behavior: "smooth", block: "center" });
  }
})();

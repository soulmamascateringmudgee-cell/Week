// ===== Country Smart AI — interactions =====
(function () {
  "use strict";

  // Where responses go. Change this one line to point somewhere else.
  var TO_EMAIL = "jessmyn.toovey@hotmail.com";

  // Current year in footer
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var form = document.getElementById("leadForm");
  var note = document.getElementById("formNote");
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

    // Gather ticked "time-sink" tasks
    var tasks = Array.prototype.slice
      .call(form.querySelectorAll('input[name="tasks"]:checked'))
      .map(function (c) { return c.value.replace(/&amp;/g, "&"); });

    var business = get("business");
    var line = function (label, val) { return val ? label + ": " + val + "\n" : ""; };

    var body =
      "Hi Jessmyn,\n\n" +
      "I filled in the Country Smart AI form — here are my answers:\n\n" +
      "— ABOUT ME —\n" +
      line("Name", name) +
      line("Business", business) +
      line("Email", email) +
      line("Phone", get("phone")) +
      line("What the business does", get("does")) +
      "\n— WHERE MY TIME GOES —\n" +
      line("What eats up most of the week", get("timedrain")) +
      line("Hours a week lost to admin/repetitive work", get("hours")) +
      (tasks.length ? "Time-sink tasks: " + tasks.join(", ") + "\n" : "") +
      line("One task I'd love to stop doing", get("stop")) +
      line("What I'd do with the time back", get("free")) +
      "\n— LAST THING —\n" +
      line("How I feel about AI right now", get("comfort")) +
      line("Anything else", get("notes")) +
      "\nThanks!\n" + name;

    var subject = "Country Smart AI — " + (business || name);

    var mailto =
      "mailto:" + TO_EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);

    window.location.href = mailto;
    showNote("Opening your email app now — just press send and it comes straight to me. Thank you!", "ok");
  });

  function showNote(msg, type) {
    if (!note) return;
    note.textContent = msg;
    note.className = "form-note " + type;
    note.scrollIntoView({ behavior: "smooth", block: "center" });
  }
})();

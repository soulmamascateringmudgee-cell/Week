// ===== Bomber Boxing — interactions =====
(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.getElementById("navToggle");
  var mobileNav = document.getElementById("mobileNav");
  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileNav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Current year in footer
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Contact form — opens the user's email client with a prefilled enquiry
  var form = document.getElementById("signupForm");
  var note = document.getElementById("formNote");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var phone = form.phone.value.trim();
      var interest = form.interest.value;

      if (!name || !email) {
        showNote("Please add your name and email so we can get back to you.", "err");
        return;
      }

      var subject = "Bomber Boxing enquiry — " + interest;
      var body =
        "Hi Bomber Boxing team,\n\n" +
        "I'd like to find out more about: " + interest + "\n\n" +
        "Name: " + name + "\n" +
        "Email: " + email + "\n" +
        (phone ? "Phone: " + phone + "\n" : "") +
        "\nThanks!";

      var mailto =
        "mailto:bomberboxing@outlook.com" +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      window.location.href = mailto;
      showNote("Opening your email app — hit send and we'll be in touch!", "ok");
      form.reset();
    });
  }

  function showNote(msg, type) {
    if (!note) return;
    note.textContent = msg;
    note.className = "form-note " + type;
  }
})();

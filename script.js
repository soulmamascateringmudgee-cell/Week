// ===== Restore Massage and Beauty — interactions =====
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

  // Enquiry form — opens the user's email client with a prefilled message.
  // EDIT: change the address below to Restore's real email.
  var RESTORE_EMAIL = "hello@restorebeautyandmassage.com.au";
  var form = document.getElementById("enquiryForm");
  var note = document.getElementById("formNote");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var phone = form.phone.value.trim();
      var interest = form.interest.value;
      var message = form.message.value.trim();

      if (!name || !email) {
        showNote("Please add your name and email so we can get back to you.", "err");
        return;
      }

      var subject = "Booking enquiry — " + interest;
      var body =
        "Hi Restore team,\n\n" +
        "I'd like to enquire about: " + interest + "\n\n" +
        (message ? message + "\n\n" : "") +
        "Name: " + name + "\n" +
        "Email: " + email + "\n" +
        (phone ? "Phone: " + phone + "\n" : "") +
        "\nThank you!";

      var mailto =
        "mailto:" + RESTORE_EMAIL +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      window.location.href = mailto;
      showNote("Opening your email app — hit send and we'll be in touch soon.", "ok");
      form.reset();
    });
  }

  function showNote(msg, type) {
    if (!note) return;
    note.textContent = msg;
    note.className = "form-note " + type;
  }
})();

// ===== Coffee Kingdom — interactions =====
(function () {
  "use strict";

  /* ---- Mobile nav toggle ---- */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Close the menu when a link is tapped (mobile)
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- Current year in footer ---- */
  var year = document.getElementById("year");
  if (year) { year.textContent = new Date().getFullYear(); }

  /* ---- Enquiry form → prefilled email ---- */
  var form = document.getElementById("enquiryForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = (document.getElementById("name").value || "").trim();
      var email = (document.getElementById("email").value || "").trim();
      var phone = (document.getElementById("phone").value || "").trim();
      var topic = document.getElementById("topic").value || "Enquiry";
      var message = (document.getElementById("message").value || "").trim();

      if (!name || !email) {
        alert("Please add your name and email so we can get back to you.");
        return;
      }

      var subject = "Coffee Kingdom enquiry: " + topic;
      var bodyLines = [
        "Name: " + name,
        "Email: " + email,
        "Phone: " + (phone || "—"),
        "Enquiring about: " + topic,
        "",
        "Message:",
        message || "—"
      ];
      var body = bodyLines.join("\r\n");

      var mailto = "mailto:coffeekingdomcafe@gmail.com"
        + "?subject=" + encodeURIComponent(subject)
        + "&body=" + encodeURIComponent(body);

      window.location.href = mailto;
    });
  }
})();

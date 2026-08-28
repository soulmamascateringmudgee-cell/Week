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

  // ===== Reels =====
  // To add a reel: drop an .mp4 in assets/reels/ and add an entry below.
  // `poster` is the thumbnail (any image in assets/), `src` is the video file.
  var INSTAGRAM = "https://www.instagram.com/bomberboxing";
  var REELS = [
    { tag: "Fight Night", title: "Ringwalk", poster: "/assets/victory.jpg", src: "/assets/reels/ringwalk.mp4" },
    { tag: "Training", title: "Pad Work", poster: "/assets/training.jpg", src: "/assets/reels/padwork.mp4" },
    { tag: "Sparring", title: "Toe to Toe", poster: "/assets/gallery-3.jpg", src: "/assets/reels/sparring.mp4" },
    { tag: "Fight Night", title: "The Finish", poster: "/assets/fight-night.jpg", src: "/assets/reels/finish.mp4" }
  ];

  var grid = document.getElementById("reelsGrid");
  var lightbox = document.getElementById("reelLightbox");
  var stage = document.getElementById("reelStage");
  var captionEl = document.getElementById("reelCaption");
  var closeBtn = document.getElementById("reelClose");
  var lastFocused = null;

  var PLAY_ICON =
    '<span class="reel-play" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>';

  if (grid) {
    if (!REELS.length) {
      grid.innerHTML = '<p class="reels-empty">Reels coming soon — follow us on Instagram for the latest.</p>';
    } else {
      REELS.forEach(function (reel, i) {
        var card = document.createElement("button");
        card.type = "button";
        card.className = "reel-card";
        card.setAttribute("role", "listitem");
        card.setAttribute("aria-label", "Play reel: " + reel.title);
        card.innerHTML =
          '<img src="' + reel.poster + '" alt="' + reel.title + '" loading="lazy" />' +
          PLAY_ICON +
          '<span class="reel-meta">' +
          '<span class="reel-tag">' + reel.tag + '</span>' +
          '<span class="reel-title">' + reel.title + '</span>' +
          "</span>";
        card.addEventListener("click", function () { openReel(i); });
        grid.appendChild(card);
      });
    }
  }

  function openReel(index) {
    if (!lightbox || !stage) return;
    var reel = REELS[index];
    if (!reel) return;

    lastFocused = document.activeElement;
    stage.innerHTML = "";

    var video = document.createElement("video");
    video.setAttribute("controls", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("poster", reel.poster);
    video.src = reel.src;
    // Graceful fallback if the video file isn't there yet.
    video.addEventListener("error", function () { showReelFallback(); });
    stage.appendChild(video);

    if (captionEl) captionEl.textContent = reel.tag + " — " + reel.title;

    lightbox.hidden = false;
    document.body.classList.add("reel-open");
    if (closeBtn) closeBtn.focus();

    var playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function () { /* autoplay blocked — controls remain */ });
    }
  }

  function showReelFallback() {
    if (!stage) return;
    stage.innerHTML =
      '<div class="reel-fallback">' +
      "<p>This reel isn't available to play here yet.</p>" +
      '<a class="btn btn-primary" href="' + INSTAGRAM + '" target="_blank" rel="noopener">Watch on Instagram</a>' +
      "</div>";
  }

  function closeReel() {
    if (!lightbox) return;
    var video = stage ? stage.querySelector("video") : null;
    if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
    if (stage) stage.innerHTML = "";
    lightbox.hidden = true;
    document.body.classList.remove("reel-open");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-reel-close")) closeReel();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lightbox.hidden) closeReel();
    });
  }
})();

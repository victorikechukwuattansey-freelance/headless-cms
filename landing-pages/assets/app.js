/* ============================================================
   AI Workflow Dashboard — Shared page behavior
   Nav state, mobile menu, reveal animations, FAQ accordion,
   waitlist forms, promo countdown.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Nav: scrolled state + mobile menu ---------- */
  var nav = document.querySelector(".nav");
  var burger = document.querySelector(".nav-burger");
  var mobileMenu = document.querySelector(".nav-mobile");

  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (burger && mobileMenu) {
    burger.addEventListener("click", function () {
      var open = mobileMenu.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileMenu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        mobileMenu.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var btn = item.querySelector(".faq-q");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(function (open) {
        open.classList.remove("open");
        open.querySelector(".faq-q").setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* ---------- Waitlist form ----------
     Client-side capture: validates, persists to localStorage, shows success.
     To wire a real endpoint (Formspree, Buttondown, your API), replace the
     submit handler body with a fetch() to your service, then showSuccess(). */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var STORAGE_KEY = "awd_waitlist";

  function saveEntry(payload) {
    try {
      var entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      entries.push(payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch (e) {
      return false;
    }
  }

  document.querySelectorAll("form[data-waitlist]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var emailInput = form.querySelector('input[type="email"]');
      var errorEl = form.querySelector(".form-error");
      var email = emailInput.value.trim();
      var ok = true;

      if (!EMAIL_RE.test(email)) {
        emailInput.classList.add("invalid");
        if (errorEl) errorEl.textContent = "Please enter a valid email address.";
        ok = false;
      } else {
        emailInput.classList.remove("invalid");
        if (errorEl) errorEl.textContent = "";
      }

      if (!ok) {
        emailInput.focus();
        return;
      }

      var payload = {
        email: email,
        name: (form.querySelector('input[name="name"]') || {}).value || "",
        role: (form.querySelector('input[name="role"]') || {}).value || "",
        source: form.getAttribute("data-source") || "unknown",
        ts: new Date().toISOString()
      };

      if (!saveEntry(payload)) {
        if (errorEl) errorEl.textContent = "Couldn't save your signup in this browser. Email us directly at hello@aiworkflowdashboard.com";
        return;
      }

      form.style.display = "none";
      var success = form.parentElement.querySelector(".form-success");
      if (success) {
        success.classList.add("show");
        var emailSpan = success.querySelector(".success-email");
        if (emailSpan) emailSpan.textContent = email;
      }
    });

    var emailInput = form.querySelector('input[type="email"]');
    emailInput.addEventListener("input", function () {
      emailInput.classList.remove("invalid");
      var errorEl = form.querySelector(".form-error");
      if (errorEl) errorEl.textContent = "";
    });
  });

  /* ---------- Promo countdown ----------
     Target: 30 days from first visit, persisted so it stays stable. */
  var countdownEl = document.querySelector("[data-countdown]");
  if (countdownEl) {
    var TARGET_KEY = "awd_countdown_target";
    var target = parseInt(localStorage.getItem(TARGET_KEY), 10);
    if (!target || target < Date.now()) {
      target = Date.now() + 30 * 24 * 60 * 60 * 1000;
      localStorage.setItem(TARGET_KEY, String(target));
    }

    var boxes = {
      days: countdownEl.querySelector("[data-cd-days]"),
      hours: countdownEl.querySelector("[data-cd-hours]"),
      mins: countdownEl.querySelector("[data-cd-mins]"),
      secs: countdownEl.querySelector("[data-cd-secs]")
    };

    function pad(n) { return String(Math.max(0, n)).padStart(2, "0"); }

    function tick() {
      var diff = Math.max(0, target - Date.now());
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      if (boxes.days) boxes.days.textContent = pad(d);
      if (boxes.hours) boxes.hours.textContent = pad(h);
      if (boxes.mins) boxes.mins.textContent = pad(m);
      if (boxes.secs) boxes.secs.textContent = pad(s);
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();

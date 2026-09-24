/* Open Bracket - renders all content from data/event.json. Vanilla JS, no build step. */
(function () {
  "use strict";

  var STORAGE_KEY = "openBracket.registrations";

  // ---------- helpers ----------
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Wrap [PLACEHOLDER] markers in a visible tag so draft copy is obvious on the page.
  function copy(value) {
    return esc(value).replace(/\[PLACEHOLDER\]/g, '<span class="placeholder-tag">Placeholder</span>');
  }

  function $(id) { return document.getElementById(id); }

  function to12h(hhmm) {
    var parts = hhmm.split(":");
    var h = parseInt(parts[0], 10);
    var suffix = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return { text: h12 + ":" + parts[1], suffix: suffix };
  }

  function timeRange(start, end) {
    var a = to12h(start);
    var b = to12h(end);
    if (a.suffix === b.suffix) return a.text + "-" + b.text + " " + b.suffix;
    return a.text + " " + a.suffix + "-" + b.text + " " + b.suffix;
  }

  function sectionHead(num, kicker, title, id) {
    return (
      '<div class="section-head">' +
        '<span class="section-num" aria-hidden="true">' + esc(num) + "</span>" +
        "<div>" +
          '<p class="section-kicker">' + esc(kicker) + "</p>" +
          '<h2 class="section-title" id="' + id + '">' + esc(title) + "</h2>" +
        "</div>" +
      "</div>"
    );
  }

  // ---------- renderers ----------
  function renderNotice(meta) {
    var n = $("placeholder-notice");
    n.textContent = meta.placeholderNotice;
  }

  function renderHero(d) {
    var h = d.hero, m = d.meta;
    $("hero").innerHTML =
      '<div class="hero-sun" aria-hidden="true"></div>' +
      '<div class="hero-meta"><span class="edition">' + esc(m.edition) + "</span>" +
        "<span>Creator Games</span><span>New York</span><span>" + esc(m.datesShort) + "</span></div>" +
      '<p class="hero-kicker">' + esc(h.kicker) + "</p>" +
      '<h1 id="hero-title">' + h.lines.map(function (l) { return "<span>" + esc(l) + "</span>"; }).join("") + "</h1>" +
      '<dl class="hero-facts">' +
        "<dt>Dates</dt><dd>" + esc(m.dates) + "</dd>" +
        '<dt>Location</dt><dd class="loc">' + esc(m.location) + "</dd>" +
      "</dl>" +
      '<p class="hero-sub">' + copy(h.sub) + "</p>" +
      '<div class="hero-ctas">' +
        '<a class="btn btn-red" href="' + esc(h.primaryCta.href) + '" data-reg-type="' + esc(h.primaryCta.type) + '">' +
          esc(h.primaryCta.label) + ' <span class="arrow" aria-hidden="true">&rarr;</span></a>' +
        '<a class="btn" href="' + esc(h.secondaryCta.href) + '">' + esc(h.secondaryCta.label) +
          ' <span class="arrow" aria-hidden="true">&rarr;</span></a>' +
      "</div>" +
      '<ul class="hero-numerals" aria-label="Event at a glance">' +
        h.numerals.map(function (n) {
          return '<li><span class="n">' + esc(n.value) + '</span><span class="l">' + esc(n.label) + "</span></li>";
        }).join("") +
      "</ul>";
  }

  function renderAbout(d) {
    var a = d.about;
    $("about-body").innerHTML =
      sectionHead("01", "About the event", a.heading, "about-title") +
      '<div class="about-grid">' +
        '<div class="about-copy">' + a.paragraphs.map(function (p, i) {
          return "<p" + (i === 0 ? ' class="lede"' : "") + ">" + copy(p) + "</p>";
        }).join("") + "</div>" +
        '<ul class="facts" aria-label="Key numbers">' + a.facts.map(function (f) {
          return '<li><span class="n">' + esc(f.value) + '</span><span class="l">' + copy(f.label) + "</span></li>";
        }).join("") + "</ul>" +
      "</div>";
  }

  function sessionClass(track) {
    if (track === "Qualifiers") return " is-play";
    if (track === "Finals") return " is-final";
    return "";
  }

  function renderSchedule(d) {
    var s = d.schedule;
    var tabs = s.days.map(function (day, i) {
      return '<button class="day-tab" role="tab" type="button" id="tab-' + day.id + '" aria-controls="panel-' + day.id +
        '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' +
        '<span class="dt-label">' + esc(day.label) + '</span><span class="dt-title">' + esc(day.title) + "</span></button>";
    }).join("");

    var panels = s.days.map(function (day, i) {
      return '<div class="day-panel" role="tabpanel" id="panel-' + day.id + '" aria-labelledby="tab-' + day.id + '"' +
        (i === 0 ? "" : " hidden") + ' tabindex="0">' +
        '<span class="day-date">' + esc(day.date) + "</span>" +
        '<p class="day-summary">' + copy(day.summary) + "</p>" +
        '<ol class="sessions">' + day.sessions.map(function (x) {
          return '<li class="session' + sessionClass(x.track) + '">' +
            '<span class="session-code" aria-hidden="true">' + esc(x.code) + "</span>" +
            '<span class="session-time"><time datetime="' + esc(x.start) + '">' + esc(timeRange(x.start, x.end)) + "</time></span>" +
            '<div class="session-body"><h3 class="session-title">' + esc(x.title) + "</h3>" +
              '<p class="session-detail">' + copy(x.detail) + "</p></div>" +
            '<span class="session-track">' + esc(x.track) + "</span>" +
          "</li>";
        }).join("") + "</ol>" +
      "</div>";
    }).join("");

    $("schedule-body").innerHTML =
      sectionHead("02", "Schedule", s.heading, "schedule-title") +
      '<p class="schedule-note">' + copy(s.note) + "</p>" +
      '<div class="day-tabs" role="tablist" aria-label="Event days">' + tabs + "</div>" +
      panels;

    wireTabs($("schedule-body"));
  }

  function wireTabs(root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab, false); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") next = tabs[0];
        if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
  }

  function renderGames(d) {
    var g = d.games;
    $("games-body").innerHTML =
      sectionHead("03", "The games", g.heading, "games-title") +
      '<p class="lede">' + copy(g.intro) + "</p>" +
      '<ul class="games-grid">' + g.items.map(function (x) {
        return '<li class="game"><span class="game-num" aria-hidden="true">' + esc(x.code) + "</span>" +
          '<h3 class="game-name">' + esc(x.name) + "</h3>" +
          '<span class="game-format">' + esc(x.format) + "</span>" +
          "<p>" + copy(x.desc) + "</p></li>";
      }).join("") + "</ul>";
  }

  function renderCreators(d) {
    var c = d.creators;
    $("creators-body").innerHTML =
      sectionHead("04", "Day 2 invited creators", c.heading, "creators-title") +
      '<p class="lede">' + copy(c.intro) + "</p>" +
      '<ul class="creators-grid">' + c.items.map(function (x, i) {
        var n = String(i + 1).padStart(2, "0");
        return '<li class="creator">' +
          '<div class="creator-slot" aria-hidden="true"><span>' + n + "</span></div>" +
          '<h3 class="creator-name">' + esc(x.name) + "</h3>" +
          '<span class="creator-meta">' + esc(x.handle) + "</span>" +
          '<span class="creator-meta">' + esc(x.platform) + " / " + esc(x.specialty) + "</span>" +
          (x.bio ? '<p class="creator-bio">' + copy(x.bio) + "</p>" : "") + "</li>";
      }).join("") + "</ul>" +
      '<p class="creators-more">' + copy(c.more) + "</p>";
  }

  function renderLogistics(d) {
    var l = d.logistics;
    var routes = l.routes.map(function (r) {
      var first = to12h(r.firstBoat), last = to12h(r.lastBoat);
      return '<article class="route" aria-labelledby="route-' + esc(r.code) + '">' +
        '<div class="route-head"><span class="route-code" aria-hidden="true">' + esc(r.code) + "</span>" +
          '<h3 class="route-from" id="route-' + esc(r.code) + '">' + esc(r.from) + "</h3></div>" +
        '<ol class="route-steps">' +
          '<li><span class="step-n" aria-hidden="true">1</span><div><span class="step-label">Subway</span>' + copy(r.subway) + "</div></li>" +
          '<li><span class="step-n" aria-hidden="true">2</span><div><span class="step-label">Ferry landing</span>' + copy(r.landing) + "</div></li>" +
          '<li><span class="step-n" aria-hidden="true">3</span><div><span class="step-label">Ferry</span>' + copy(r.ferry) + "</div></li>" +
        "</ol>" +
        '<div class="boats">' +
          '<div><span class="step-label">First boat</span><span class="t">' + first.text + " " + first.suffix + "</span></div>" +
          '<div><span class="step-label">Last boat back</span><span class="t">' + last.text + " " + last.suffix + "</span></div>" +
        "</div>" +
      "</article>";
    }).join("");

    $("logistics-body").innerHTML =
      sectionHead("05", "Getting there and logistics", l.heading, "logistics-title") +
      '<p class="lede">' + copy(l.intro) + "</p>" +
      '<div class="routes">' + routes + "</div>" +
      '<p class="last-ferry" role="note"><strong aria-hidden="true">!</strong><span>' + copy(l.lastFerryWarning) + "</span></p>" +
      '<ul class="info-cards">' + l.cards.map(function (c, i) {
        return '<li class="info-card"><h3><span class="i" aria-hidden="true">' + String(i + 1).padStart(2, "0") + "</span>" + esc(c.title) + "</h3>" +
          "<p>" + copy(c.body) + "</p></li>";
      }).join("") + "</ul>";
  }

  function renderWatch(d) {
    var w = d.watch;
    $("watch-body").innerHTML =
      sectionHead("06", "Watch remotely", w.heading, "watch-title") +
      '<p class="lede">' + copy(w.intro) + "</p>" +
      '<ul class="channels">' + w.channels.map(function (c) {
        return '<li class="channel"><span class="channel-code">' + esc(c.code) + "</span>" +
          "<h3>" + esc(c.name) + "</h3><p>" + copy(c.detail) + "</p></li>";
      }).join("") + "</ul>" +
      '<p class="watch-vote">' + copy(w.vote) + "</p>";
  }

  // ---------- registration ----------
  function renderRegistration(d) {
    var r = d.registration;
    var games = d.games.items;

    var typeOptions = r.types.map(function (t, i) {
      return '<div class="type-option">' +
        '<input type="radio" name="type" id="type-' + t.id + '" value="' + t.id + '"' + (i === 0 ? " checked" : "") + ">" +
        '<label for="type-' + t.id + '"><span class="t-name">' + esc(t.label) + '</span><span class="t-price">' + copy(t.price) +
        '</span><span class="t-desc">' + copy(t.desc) + "</span></label></div>";
    }).join("");

    var landingOptions = '<option value="">Choose one</option>' + r.landings.map(function (x) {
      return '<option>' + esc(x) + "</option>";
    }).join("");

    var gameChecks = games.map(function (g) {
      return '<label class="check"><input type="checkbox" name="games" value="' + esc(g.name) + '"><span>' +
        esc(g.code) + " " + esc(g.name) + "</span></label>";
    }).join("");

    var dayChecks = r.spectatorDays.map(function (x, i) {
      return '<label class="check"><input type="checkbox" name="days" value="' + esc(x) + '"' + (i === 1 ? " checked" : "") +
        "><span>" + esc(x) + "</span></label>";
    }).join("");

    $("register-body").innerHTML =
      sectionHead("07", "Registration", r.heading, "register-title") +
      '<p class="lede">' + copy(r.intro) + "</p>" +
      '<p class="demo-notice" role="note">' + esc(r.demoNotice) + "</p>" +
      '<div id="reg-output">' +
      '<form class="reg-form" id="reg-form" novalidate>' +
        '<fieldset><legend>Ticket type</legend><div class="type-options">' + typeOptions + "</div></fieldset>" +
        '<div class="two-col">' +
          '<div class="field"><label class="field-label" for="f-name">Full name</label>' +
            '<input type="text" id="f-name" name="name" autocomplete="name" required aria-describedby="e-name">' +
            '<span class="error" id="e-name"></span></div>' +
          '<div class="field"><label class="field-label" for="f-email">Email</label>' +
            '<input type="email" id="f-email" name="email" autocomplete="email" required aria-describedby="h-email e-email">' +
            '<span class="hint" id="h-email">Your QR code and heat assignment go here.</span>' +
            '<span class="error" id="e-email"></span></div>' +
        "</div>" +
        '<div class="field"><label class="field-label" for="f-landing">Which ferry will you take?</label>' +
          '<select id="f-landing" name="landing" aria-describedby="h-landing">' + landingOptions + "</select>" +
          '<span class="hint" id="h-landing">Helps us staff the right check-in lane. You can change your mind.</span></div>' +
        '<fieldset class="type-fields" data-for="competitor" aria-describedby="h-games e-games">' +
          "<legend>Games you want to play</legend>" +
          '<p class="hint" id="h-games">Pick at least three. We try to match you, but heat assignments are final.</p>' +
          '<div class="checks two-col">' + gameChecks + "</div>" +
          '<span class="error" id="e-games"></span>' +
        "</fieldset>" +
        '<fieldset class="type-fields" data-for="spectator" hidden aria-describedby="e-days">' +
          "<legend>Which days are you coming?</legend>" +
          '<div class="checks">' + dayChecks + "</div>" +
          '<span class="error" id="e-days"></span>' +
        "</fieldset>" +
        '<div class="field"><label class="field-label" for="f-access">Access needs (optional)</label>' +
          '<textarea id="f-access" name="access" aria-describedby="h-access"></textarea>' +
          '<span class="hint" id="h-access">Mobility, sensory, dietary, anything. We read every one.</span></div>' +
        '<div><button type="submit" class="btn btn-red" id="reg-submit">Register as competitor <span class="arrow" aria-hidden="true">&rarr;</span></button></div>' +
      "</form></div>";

    wireForm(r);
  }

  function currentType(form) {
    var el = form.querySelector('input[name="type"]:checked');
    return el ? el.value : "competitor";
  }

  function syncType(form) {
    var type = currentType(form);
    Array.prototype.forEach.call(form.querySelectorAll(".type-fields"), function (fs) {
      fs.hidden = fs.getAttribute("data-for") !== type;
    });
    var btn = form.querySelector("#reg-submit");
    btn.className = "btn " + (type === "competitor" ? "btn-red" : "btn-blue");
    btn.innerHTML = "Register as " + type + ' <span class="arrow" aria-hidden="true">&rarr;</span>';
  }

  function setError(field, msgEl, msg) {
    if (field) field.setAttribute("aria-invalid", msg ? "true" : "false");
    msgEl.textContent = msg || "";
  }

  function wireForm(r) {
    var form = $("reg-form");
    if (!form) return;
    form.addEventListener("change", function (e) {
      if (e.target.name === "type") syncType(form);
    });
    syncType(form);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var type = currentType(form);
      var name = form.elements.name;
      var email = form.elements.email;
      var firstInvalid = null;

      var nameMsg = name.value.trim() ? "" : "Enter your name.";
      setError(name, $("e-name"), nameMsg);
      if (nameMsg && !firstInvalid) firstInvalid = name;

      var emailVal = email.value.trim();
      var emailMsg = !emailVal ? "Enter your email." : (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal) ? "" : "Check the email format, for example name@example.com.");
      setError(email, $("e-email"), emailMsg);
      if (emailMsg && !firstInvalid) firstInvalid = email;

      var picks = [];
      if (type === "competitor") {
        picks = Array.prototype.filter.call(form.querySelectorAll('input[name="games"]'), function (c) { return c.checked; })
          .map(function (c) { return c.value; });
        var gMsg = picks.length >= 3 ? "" : "Pick at least three games (" + picks.length + " selected).";
        setError(null, $("e-games"), gMsg);
        if (gMsg && !firstInvalid) firstInvalid = form.querySelector('input[name="games"]');
      } else {
        picks = Array.prototype.filter.call(form.querySelectorAll('input[name="days"]'), function (c) { return c.checked; })
          .map(function (c) { return c.value; });
        var dMsg = picks.length ? "" : "Pick at least one day.";
        setError(null, $("e-days"), dMsg);
        if (dMsg && !firstInvalid) firstInvalid = form.querySelector('input[name="days"]');
      }

      if (firstInvalid) { firstInvalid.focus(); return; }

      var record = {
        ticket: "OB-" + (type === "competitor" ? "C" : "S") + "-" + Math.floor(1000 + Math.random() * 9000),
        type: type,
        name: name.value.trim(),
        email: emailVal,
        landing: form.elements.landing.value || "Not sure yet",
        picks: picks,
        access: form.elements.access.value.trim(),
        createdAt: new Date().toISOString()
      };
      saveRecord(record);
      showConfirmation(record, r);
    });
  }

  function saveRecord(record) {
    try {
      var list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      list.push(record);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      // Storage can be blocked (private mode). The confirmation still shows.
    }
  }

  function showConfirmation(rec, r) {
    var isComp = rec.type === "competitor";
    var out = $("reg-output");
    out.innerHTML =
      '<div class="confirm' + (isComp ? "" : " is-spectator") + '" role="status" tabindex="-1" id="reg-confirm">' +
        '<div class="confirm-head"><p class="section-kicker">Demo confirmation</p>' +
          "<h3>" + (isComp ? "You are in the bracket." : "See you on the island.") + "</h3></div>" +
        '<div class="confirm-body">' +
          '<p class="ticket-no">' + esc(rec.ticket) + "</p>" +
          "<dl>" +
            "<dt>Name</dt><dd>" + esc(rec.name) + "</dd>" +
            "<dt>Email</dt><dd>" + esc(rec.email) + "</dd>" +
            "<dt>Ticket</dt><dd>" + (isComp ? "Competitor" : "Spectator") + "</dd>" +
            "<dt>Ferry</dt><dd>" + esc(rec.landing) + "</dd>" +
            "<dt>" + (isComp ? "Games" : "Days") + "</dt><dd>" + esc(rec.picks.join(", ")) + "</dd>" +
          "</dl>" +
          "<p>" + (isComp
            ? "Heat assignments arrive by email 48 hours before Day 1. Check in at Soissons Landing when you get off the ferry."
            : "No check-in needed on Day 1. On Day 2, head straight from the ferry to the Parade Ground.") + "</p>" +
          '<p class="hint">' + esc(r.demoNotice) + "</p>" +
          '<button type="button" class="btn btn-small" id="reg-again">Register someone else</button>' +
        "</div>" +
      "</div>";
    var box = $("reg-confirm");
    box.focus();
    $("reg-again").addEventListener("click", function () {
      renderRegistration(window.__OB_DATA__);
      var f = $("f-name");
      if (f) f.focus();
    });
  }

  // Compete button in the hero preselects the competitor ticket.
  function wirePreselect() {
    document.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest("[data-reg-type]");
      if (!link) return;
      var radio = document.getElementById("type-" + link.getAttribute("data-reg-type"));
      if (radio) {
        radio.checked = true;
        syncType($("reg-form"));
      }
    });
  }

  function renderFaq(d) {
    var f = d.faq;
    $("faq-body").innerHTML =
      sectionHead("08", "Questions", f.heading, "faq-title") +
      '<div class="faq-list">' + f.items.map(function (x, i) {
        return '<details class="faq-item"><summary><span class="q-n" aria-hidden="true">Q' + String(i + 1).padStart(2, "0") +
          "</span><span>" + esc(x.q) + '</span><span class="q-icon" aria-hidden="true">+</span></summary>' +
          '<div class="a"><p>' + copy(x.a) + "</p></div></details>";
      }).join("") + "</div>";
  }

  function renderFooter(d) {
    var f = d.footer, m = d.meta;
    $("footer").innerHTML =
      '<div class="footer-inner">' +
        '<p class="footer-word" aria-hidden="true">Open<span>/</span>Bracket</p>' +
        '<nav aria-label="Footer"><ul class="footer-links">' + f.links.map(function (l) {
          return '<li><a href="' + esc(l.href) + '">' + esc(l.label) + "</a></li>";
        }).join("") + "</ul></nav>" +
        '<p class="footer-small">' + esc(m.dates) + " / " + esc(m.locationDetail) + "</p>" +
        '<p class="footer-small">' + esc(f.line) + " " + esc(f.builtOn) + "</p>" +
      "</div>";
  }

  function showLoadError(err) {
    var n = $("placeholder-notice");
    n.classList.add("is-error");
    n.textContent = "Content failed to load from data/event.json.";
    $("hero").innerHTML =
      '<div class="load-error"><h1 id="hero-title">Content did not load</h1>' +
      "<p>The page could not read data/event.json. If you opened index.html directly from your computer, " +
      "serve it over http instead (GitHub Pages does this for you). Detail: " + esc(err && err.message) + "</p></div>";
  }

  // ---------- boot ----------
  fetch("data/event.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      window.__OB_DATA__ = data;
      renderNotice(data.meta);
      renderHero(data);
      renderAbout(data);
      renderSchedule(data);
      renderGames(data);
      renderCreators(data);
      renderLogistics(data);
      renderWatch(data);
      renderRegistration(data);
      renderFaq(data);
      renderFooter(data);
      wirePreselect();
      // If the page was opened with a hash, jump there now that content exists.
      if (location.hash && location.hash.length > 1) {
        var target = document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView();
      }
    })
    .catch(showLoadError);
})();

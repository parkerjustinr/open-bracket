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
    return esc(value)
      .replace(/\[PLACEHOLDER\]/g, '<span class="placeholder-tag">Placeholder</span>')
      .replace(TOKEN, function (_, iso) { return timeEl(iso, null, "inline"); });
  }

  function $(id) { return document.getElementById(id); }

  // ---------- time zones ----------
  // Times in event.json are ISO 8601 with an offset. HOME_TZ is the event's zone (meta.timezone).
  // Every time on the page renders in the visitor's zone or Eastern, with the other alongside.
  var HOME_TZ = "America/New_York";
  var LOCAL_TZ = (function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || HOME_TZ; } catch (err) { return HOME_TZ; }
  })();
  var TZ_KEY = "openBracket.tzMode";
  var tzMode = "local";
  try { if (localStorage.getItem(TZ_KEY) === "home") tzMode = "home"; } catch (err) { /* storage blocked */ }

  var fmtCache = {};
  function fmt(zone, kind) {
    var key = zone + "|" + kind;
    if (!fmtCache[key]) {
      var opts = { timeZone: zone };
      if (kind === "time") { opts.hour = "numeric"; opts.minute = "2-digit"; }
      if (kind === "zone") { opts.hour = "numeric"; opts.timeZoneName = "short"; }
      if (kind === "day") { opts.year = "numeric"; opts.month = "2-digit"; opts.day = "2-digit"; }
      if (kind === "weekday") { opts.weekday = "short"; }
      fmtCache[key] = new Intl.DateTimeFormat(undefined, opts);
    }
    return fmtCache[key];
  }

  function zoneName(date, zone) {
    var part = fmt(zone, "zone").formatToParts(date).filter(function (p) { return p.type === "timeZoneName"; })[0];
    return part ? part.value : zone;
  }

  function dayKey(date, zone) { return fmt(zone, "day").format(date); }

  // Clock time in a zone. dropPeriod removes a trailing AM/PM so ranges read "9:00-10:00 AM".
  function clock(date, zone, dropPeriod) {
    var parts = fmt(zone, "time").formatToParts(date);
    if (dropPeriod) {
      var i = parts.length - 1;
      if (parts[i].type === "dayPeriod") {
        parts = parts.slice(0, i);
        if (parts.length && parts[parts.length - 1].type === "literal") parts = parts.slice(0, -1);
      }
    }
    return parts.map(function (p) { return p.value; }).join("").trim();
  }

  function trailingPeriod(date, zone) {
    var parts = fmt(zone, "time").formatToParts(date);
    var last = parts[parts.length - 1];
    return last.type === "dayPeriod" ? last.value : null;
  }

  // "9:00-10:00 AM EDT". A weekday is added when the zone puts the time on a different
  // calendar day from the event day on the island (for example Sun 1:00 AM in Tokyo).
  function rangeText(start, end, zone) {
    var eventDay = dayKey(start, HOME_TZ);
    var startDay = dayKey(start, zone);
    var a, b = "";
    if (end) {
      var endDay = dayKey(end, zone);
      var p = trailingPeriod(start, zone);
      var collapse = startDay === endDay && p && p === trailingPeriod(end, zone);
      a = clock(start, zone, collapse);
      b = clock(end, zone, false);
      if (endDay !== startDay) b = fmt(zone, "weekday").format(end) + " " + b;
    } else {
      a = clock(start, zone, false);
    }
    if (startDay !== eventDay) a = fmt(zone, "weekday").format(start) + " " + a;
    return a + (b ? "-" + b : "") + " " + zoneName(end || start, zone);
  }

  // Styles: "block" (primary over secondary), "inline" (secondary in brackets), "boat" (large primary).
  function timeInner(startIso, endIso, style) {
    var start = new Date(startIso), end = endIso ? new Date(endIso) : null;
    var primaryZone = tzMode === "home" ? HOME_TZ : LOCAL_TZ;
    var otherZone = tzMode === "home" ? LOCAL_TZ : HOME_TZ;
    var primary = rangeText(start, end, primaryZone);
    var other = rangeText(start, end, otherZone);
    var same = primary === other;
    if (style === "inline") {
      return esc(primary) + (same ? "" : ' <span class="tz-secondary">(' + esc(other) + ")</span>");
    }
    return '<span class="tz-primary' + (style === "boat" ? " t" : "") + '">' + esc(primary) + "</span>" +
      (same ? "" : '<span class="tz-secondary">' + esc(other) + "</span>");
  }

  function timeEl(startIso, endIso, style) {
    return '<time class="tz-time tz-' + style + '" datetime="' + esc(startIso) + '" data-start="' + esc(startIso) + '"' +
      (endIso ? ' data-end="' + esc(endIso) + '"' : "") + ' data-style="' + style + '">' +
      timeInner(startIso, endIso, style) + "</time>";
  }

  function refreshTimes() {
    Array.prototype.forEach.call(document.querySelectorAll(".tz-time"), function (el) {
      el.innerHTML = timeInner(el.getAttribute("data-start"), el.getAttribute("data-end"), el.getAttribute("data-style"));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-tz]"), function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-tz") === tzMode));
    });
  }

  function setTzMode(mode) {
    tzMode = mode === "home" ? "home" : "local";
    try { localStorage.setItem(TZ_KEY, tzMode); } catch (err) { /* storage blocked */ }
    refreshTimes();
  }

  // Toggle between the visitor's zone and Eastern. refDate picks the abbreviation (EDT vs EST).
  function tzToggle(refIso) {
    var ref = new Date(refIso);
    var localAbbr = zoneName(ref, LOCAL_TZ), homeAbbr = zoneName(ref, HOME_TZ);
    var matches = clock(ref, LOCAL_TZ) === clock(ref, HOME_TZ) && localAbbr === homeAbbr;
    return '<div class="tz-bar">' +
      '<div class="tz-toggle" role="group" aria-label="Show times in">' +
        '<button type="button" data-tz="local" aria-pressed="' + (tzMode === "local") + '">Your time (' + esc(localAbbr) + ")</button>" +
        '<button type="button" data-tz="home" aria-pressed="' + (tzMode === "home") + '">Eastern (' + esc(homeAbbr) + ")</button>" +
      "</div>" +
      '<p class="tz-zone">' + (matches
        ? "Your device is on Eastern Time, the same as the island."
        : "Your device zone: " + esc(LOCAL_TZ.replace(/_/g, " ")) + ". The island is on Eastern Time.") + "</p>" +
    "</div>";
  }

  // Prose can carry times as {{t:ISO}} tokens. copy() renders them as live <time> elements,
  // plain() renders them as fixed Eastern text for calendar files.
  var TOKEN = /\{\{t:([0-9T:+\-]+)\}\}/g;

  // ---------- calendar (.ics) ----------
  function plain(value) {
    return String(value == null ? "" : value)
      .replace(TOKEN, function (_, iso) { return rangeText(new Date(iso), null, HOME_TZ); })
      .replace(/\s*\[PLACEHOLDER\]/g, "")
      .replace(/[\u00a0\u202f]/g, " ");
  }

  function icsEscape(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }

  function icsDate(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  // RFC 5545: lines longer than 75 octets are folded with CRLF plus a space.
  function icsFold(line) {
    var out = [], cur = "", bytes = 0;
    Array.from(line).forEach(function (ch) {
      var cp = ch.codePointAt(0);
      var n = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (bytes + n > 75) { out.push(cur); cur = " "; bytes = 1; }
      cur += ch;
      bytes += n;
    });
    out.push(cur);
    return out.join("\r\n");
  }

  function pageUrl() {
    return /^https?:/.test(location.protocol) ? location.href.split("#")[0] : "";
  }

  // events: [{ uid, start, end, summary, description, location }]
  function buildIcs(events) {
    var stamp = icsDate(new Date());
    var url = pageUrl();
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Open Bracket//Event site//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "X-WR-CALNAME:Open Bracket", "X-WR-TIMEZONE:" + HOME_TZ];
    events.forEach(function (e) {
      lines.push("BEGIN:VEVENT",
        "UID:" + e.uid + "@open-bracket",
        "DTSTAMP:" + stamp,
        "DTSTART:" + icsDate(new Date(e.start)),
        "DTEND:" + icsDate(new Date(e.end)),
        "SUMMARY:" + icsEscape(e.summary),
        "DESCRIPTION:" + icsEscape(e.description + (url ? "\n\n" + url : "")),
        "LOCATION:" + icsEscape(e.location));
      if (url) lines.push("URL:" + url);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.map(icsFold).join("\r\n") + "\r\n";
  }

  function downloadFile(filename, text) {
    var blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    var href = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 1000);
  }

  function dayBounds(day) {
    return { start: day.sessions[0].start, end: day.sessions[day.sessions.length - 1].end };
  }

  function sessionEvent(d, day, x) {
    return {
      uid: day.id + "-" + x.code.toLowerCase() + "-" + x.start.slice(0, 10),
      start: x.start,
      end: x.end,
      summary: "Open Bracket: " + x.title,
      description: plain(x.detail) + "\n\n" + day.label + " - " + day.title + ", " + d.meta.location + ".",
      location: d.meta.calendarLocation
    };
  }

  function icsFor(kind, a, b) {
    var d = window.__OB_DATA__;
    if (kind === "event") {
      return {
        name: "open-bracket.ics",
        events: d.schedule.days.map(function (day) {
          var span = dayBounds(day);
          return {
            uid: day.id + "-" + span.start.slice(0, 10),
            start: span.start,
            end: span.end,
            summary: "Open Bracket " + day.label + ": " + day.title,
            description: plain(day.summary) + "\n\n" + plain(d.logistics.lastFerryWarning),
            location: d.meta.calendarLocation
          };
        })
      };
    }
    if (kind === "session") {
      var day = d.schedule.days[a], x = day.sessions[b];
      return { name: "open-bracket-" + day.id + "-" + x.code.toLowerCase() + ".ics", events: [sessionEvent(d, day, x)] };
    }
    if (kind === "stream") {
      var c = d.watch.channels[a];
      return {
        name: "open-bracket-stream-" + c.code.toLowerCase() + ".ics",
        events: [{
          uid: "stream-" + c.code.toLowerCase() + "-" + c.start.slice(0, 10),
          start: c.start,
          end: c.end,
          summary: "Open Bracket live: " + c.name,
          description: plain(c.detail) + "\n\nLive on Twitch and YouTube. Links are posted on the Open Bracket site the morning of each day.",
          location: "Twitch and YouTube"
        }]
      };
    }
    return null;
  }

  function icsButton(kind, a, b, label, ariaLabel) {
    return '<button type="button" class="ics-btn" data-ics="' + kind + '"' +
      (a != null ? ' data-a="' + a + '"' : "") + (b != null ? ' data-b="' + b + '"' : "") +
      ' aria-label="' + esc(ariaLabel) + '"><span aria-hidden="true">+</span> ' + esc(label) + "</button>";
  }

  function wireGlobalControls() {
    document.addEventListener("click", function (e) {
      var tz = e.target.closest && e.target.closest("[data-tz]");
      if (tz) { setTzMode(tz.getAttribute("data-tz")); return; }
      var ics = e.target.closest && e.target.closest("[data-ics]");
      if (ics) {
        var a = ics.getAttribute("data-a"), b = ics.getAttribute("data-b");
        var file = icsFor(ics.getAttribute("data-ics"), a == null ? null : +a, b == null ? null : +b);
        if (file) downloadFile(file.name, buildIcs(file.events));
      }
    });
  }

  // ---------- countdown ----------
  var countdownTimer = null;

  function renderCountdown(d) {
    var box = $("countdown");
    if (!box) return;
    var days = d.schedule.days.map(function (day) {
      var span = dayBounds(day);
      return { day: day, start: new Date(span.start), end: new Date(span.end) };
    });

    function pad(n) { return String(n).padStart(2, "0"); }

    function tick() {
      var now = Date.now();
      var next = null, live = null;
      days.forEach(function (x) {
        if (live || next) return;
        if (now >= x.start && now < x.end) live = x;
        else if (now < x.start) next = x;
      });
      var label = box.querySelector(".countdown-label");
      var units = box.querySelector(".countdown-units");
      var when = box.querySelector(".countdown-when");
      if (next) {
        var s = Math.max(0, Math.floor((next.start - now) / 1000));
        label.textContent = next.day.label + " - " + next.day.title + " starts in";
        units.hidden = false;
        units.querySelector('[data-u="d"]').textContent = pad(Math.floor(s / 86400));
        units.querySelector('[data-u="h"]').textContent = pad(Math.floor(s % 86400 / 3600));
        units.querySelector('[data-u="m"]').textContent = pad(Math.floor(s % 3600 / 60));
        units.querySelector('[data-u="s"]').textContent = pad(s % 60);
        if (when.getAttribute("data-for") !== next.day.id) {
          when.setAttribute("data-for", next.day.id);
          when.innerHTML = "Starts " + esc(next.day.date) + ", " + timeEl(next.day.sessions[0].start, null, "inline");
        }
      } else {
        units.hidden = true;
        if (live) {
          label.textContent = live.day.label + " - " + live.day.title + " is on now";
          if (when.getAttribute("data-for") !== "live-" + live.day.id) {
            when.setAttribute("data-for", "live-" + live.day.id);
            when.innerHTML = 'Not on the island? <a href="#watch">Watch the stream</a>.';
          }
        } else {
          label.textContent = "That's a wrap. Thanks for playing.";
          if (when.getAttribute("data-for") !== "done") {
            when.setAttribute("data-for", "done");
            when.innerHTML = 'Replays are up on YouTube. <a href="#watch">Find them here</a>.';
          }
          clearInterval(countdownTimer);
        }
      }
    }

    tick();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 1000);
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
      '<div class="countdown" id="countdown" role="timer" aria-atomic="true">' +
        '<p class="countdown-label"></p>' +
        '<ol class="countdown-units">' +
          '<li><span class="n" data-u="d">00</span><span class="l">Days</span></li>' +
          '<li><span class="n" data-u="h">00</span><span class="l">Hours</span></li>' +
          '<li><span class="n" data-u="m">00</span><span class="l">Min</span></li>' +
          '<li><span class="n" data-u="s">00</span><span class="l">Sec</span></li>' +
        "</ol>" +
        '<p class="countdown-when"></p>' +
        icsButton("event", null, null, "Add both days to calendar", "Add both days of Open Bracket to your calendar (.ics file)") +
      "</div>" +
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
        '<ol class="sessions">' + day.sessions.map(function (x, j) {
          return '<li class="session' + sessionClass(x.track) + '">' +
            '<span class="session-code" aria-hidden="true">' + esc(x.code) + "</span>" +
            '<span class="session-time">' + timeEl(x.start, x.end, "block") + "</span>" +
            '<div class="session-body"><h3 class="session-title">' + esc(x.title) + "</h3>" +
              '<p class="session-detail">' + copy(x.detail) + "</p>" +
              icsButton("session", i, j, "Calendar", "Add " + x.title + ", " + day.label + ", to your calendar (.ics file)") +
            "</div>" +
            '<span class="session-track">' + esc(x.track) + "</span>" +
          "</li>";
        }).join("") + "</ol>" +
      "</div>";
    }).join("");

    $("schedule-body").innerHTML =
      sectionHead("02", "Schedule", s.heading, "schedule-title") +
      '<p class="schedule-note">' + copy(s.note) + "</p>" +
      tzToggle(s.days[0].sessions[0].start) +
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
      return '<article class="route" aria-labelledby="route-' + esc(r.code) + '">' +
        '<div class="route-head"><span class="route-code" aria-hidden="true">' + esc(r.code) + "</span>" +
          '<h3 class="route-from" id="route-' + esc(r.code) + '">' + esc(r.from) + "</h3></div>" +
        '<ol class="route-steps">' +
          '<li><span class="step-n" aria-hidden="true">1</span><div><span class="step-label">Subway</span>' + copy(r.subway) + "</div></li>" +
          '<li><span class="step-n" aria-hidden="true">2</span><div><span class="step-label">Ferry landing</span>' + copy(r.landing) + "</div></li>" +
          '<li><span class="step-n" aria-hidden="true">3</span><div><span class="step-label">Ferry</span>' + copy(r.ferry) + "</div></li>" +
        "</ol>" +
        '<div class="boats">' +
          '<div><span class="step-label">First boat</span>' + timeEl(r.firstBoat, null, "boat") + "</div>" +
          '<div><span class="step-label">Last boat back</span>' + timeEl(r.lastBoat, null, "boat") + "</div>" +
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
      tzToggle(w.channels.filter(function (c) { return c.start; })[0].start) +
      '<ul class="channels">' + w.channels.map(function (c, i) {
        return '<li class="channel"><span class="channel-code">' + esc(c.code) + "</span>" +
          "<h3>" + esc(c.name) + "</h3>" +
          (c.start ? '<p class="channel-time">' + timeEl(c.start, c.end, "block") + "</p>" : "") +
          "<p>" + copy(c.detail) + "</p>" +
          (c.start ? icsButton("stream", i, null, "Add stream to calendar", "Add the " + c.name + " to your calendar (.ics file)") : "") +
        "</li>";
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
            ? "Your heat time arrives by email 48 hours before Day 1. Check in at the tent on the Parade Ground at least 30 minutes before your heat."
            : "Pick up your wristband at the check-in tent on the Parade Ground when you arrive. It is a 5 minute walk from both ferry landings.") + "</p>" +
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
      if (data.meta.timezone) HOME_TZ = data.meta.timezone;
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
      renderCountdown(data);
      wirePreselect();
      wireGlobalControls();
      // If the page was opened with a hash, jump there now that content exists.
      if (location.hash && location.hash.length > 1) {
        var target = document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView();
      }
    })
    .catch(showLoadError);
})();

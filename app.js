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
  // calendar day from the event day on the island (for example Sun 1:00 AM in Tokyo),
  // or always when withDay is set (reminders that fall before the event).
  function rangeText(start, end, zone, withDay) {
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
    if (withDay || startDay !== eventDay) a = fmt(zone, "weekday").format(start) + " " + a;
    return a + (b ? "-" + b : "") + " " + zoneName(end || start, zone);
  }

  // Styles: "block" (primary over secondary), "inline" (secondary in brackets), "boat" (large primary).
  function timeInner(startIso, endIso, style, withDay) {
    var start = new Date(startIso), end = endIso ? new Date(endIso) : null;
    var primaryZone = tzMode === "home" ? HOME_TZ : LOCAL_TZ;
    var otherZone = tzMode === "home" ? LOCAL_TZ : HOME_TZ;
    var primary = rangeText(start, end, primaryZone, withDay);
    var other = rangeText(start, end, otherZone, withDay);
    var same = primary === other;
    if (style === "inline") {
      return esc(primary) + (same ? "" : ' <span class="tz-secondary">(' + esc(other) + ")</span>");
    }
    return '<span class="tz-primary' + (style === "boat" ? " t" : "") + '">' + esc(primary) + "</span>" +
      (same ? "" : '<span class="tz-secondary">' + esc(other) + "</span>");
  }

  function timeEl(startIso, endIso, style, withDay) {
    return '<time class="tz-time tz-' + style + '" datetime="' + esc(startIso) + '" data-start="' + esc(startIso) + '"' +
      (endIso ? ' data-end="' + esc(endIso) + '"' : "") + ' data-style="' + style + '"' + (withDay ? ' data-day="1"' : "") + ">" +
      timeInner(startIso, endIso, style, withDay) + "</time>";
  }

  function refreshTimes() {
    Array.prototype.forEach.call(document.querySelectorAll(".tz-time"), function (el) {
      el.innerHTML = timeInner(el.getAttribute("data-start"), el.getAttribute("data-end"), el.getAttribute("data-style"), el.hasAttribute("data-day"));
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

  // events: [{ uid, start, end, summary, description, location, alarms? }] (alarms are TRIGGER values like -PT2H)
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
      (e.alarms || []).forEach(function (trigger) {
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEscape(e.summary), "TRIGGER:" + trigger, "END:VALARM");
      });
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

  // A whole day as one calendar event. The description lists every session in Eastern Time.
  function dayEvent(d, day) {
    var span = dayBounds(day);
    var lines = day.sessions.map(function (x) {
      return plain(rangeText(new Date(x.start), new Date(x.end), HOME_TZ)) + "  " + x.title;
    });
    return {
      uid: day.id + "-" + span.start.slice(0, 10),
      start: span.start,
      end: span.end,
      summary: "Open Bracket " + day.label + ": " + day.title,
      description: plain(day.summary) + "\n\nSchedule (Eastern Time):\n" + lines.join("\n") + "\n\n" + plain(d.logistics.lastFerryWarning),
      location: d.meta.calendarLocation
    };
  }

  function icsFor(kind, a, b) {
    var d = window.__OB_DATA__;
    if (kind === "event") {
      return { name: "open-bracket.ics", events: d.schedule.days.map(function (day) { return dayEvent(d, day); }) };
    }
    if (kind === "day") {
      var one = d.schedule.days[a];
      return { name: "open-bracket-" + one.id + ".ics", events: [dayEvent(d, one)] };
    }
    if (kind === "session") {
      var day = d.schedule.days[a], x = day.sessions[b];
      return { name: "open-bracket-" + day.id + "-" + x.code.toLowerCase() + ".ics", events: [sessionEvent(d, day, x)] };
    }
    if (kind === "registration") {
      var rec = loadCurrent(d);
      if (!rec) return null;
      var events;
      if (rec.type === "competitor") {
        var heat = findHeat(d, rec.heat), day1 = d.schedule.days[0], day2 = d.schedule.days[1];
        var ev = sessionEvent(d, day1, heat);
        ev.uid = "reg-" + rec.ticket.toLowerCase() + "-heat";
        ev.summary = "Open Bracket: " + heat.title + " (you are competing)";
        ev.description = "Check in at the tent on the Parade Ground by " + rangeText(new Date(isoMinus(heat.start, 30)), null, HOME_TZ) +
          ". Games: " + plain(heat.detail) + "\n\nTicket " + rec.ticket + ", handle @" + rec.handle + ".\n\n" + plain(d.logistics.lastFerryWarning);
        ev.alarms = ["-P1D", "-PT2H"];
        var span2 = dayBounds(day2);
        events = [ev, {
          uid: "reg-" + rec.ticket.toLowerCase() + "-" + day2.id,
          start: span2.start,
          end: span2.end,
          summary: "Open Bracket " + day2.label + ": " + day2.title,
          description: "If you qualify, check in at the green tent by " + rangeText(new Date(day2.sessions[0].end), null, HOME_TZ) +
            ". If not, your ticket gets you in to watch.\n\nTicket " + rec.ticket + ".",
          location: d.meta.calendarLocation,
          alarms: ["-P1D"]
        }];
      } else {
        events = recordDays(d, rec).map(function (day) {
          var span = dayBounds(day);
          return {
            uid: "reg-" + rec.ticket.toLowerCase() + "-" + day.id,
            start: span.start,
            end: span.end,
            summary: "Open Bracket " + day.label + ": " + day.title,
            description: plain(day.summary) + "\n\nTicket " + rec.ticket + ". Pick up your wristband at the check-in tent on the Parade Ground.\n\n" +
              plain(d.logistics.lastFerryWarning),
            location: d.meta.calendarLocation,
            alarms: ["-P1D"]
          };
        });
      }
      return { name: "open-bracket-" + rec.ticket.toLowerCase() + ".ics", events: events };
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
    n.classList.remove("is-error");
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
        '<div class="day-head"><span class="day-date">' + esc(day.date) + "</span>" +
          icsButton("day", i, null, "Add " + day.label + " to calendar", "Add " + day.label + ", " + day.title + ", to your calendar as one event with every session listed (.ics file)") +
        "</div>" +
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
      '<div class="cal-bar"><span class="cal-bar-label">Add to your calendar</span>' +
        icsButton("event", null, null, "Both days", "Add both days of Open Bracket to your calendar (.ics file)") +
        s.days.map(function (day, i) {
          return icsButton("day", i, null, day.label + " only", "Add " + day.label + ", " + day.title + ", to your calendar as one event (.ics file)");
        }).join("") +
      "</div>" +
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
  // Records live in localStorage under STORAGE_KEY (a list). CURRENT_KEY holds the ticket this
  // browser registered last, so a returning visitor sees their confirmation and can change it.
  var CURRENT_KEY = "openBracket.currentTicket";
  var memoryRecord = null; // used when storage is blocked

  function qualifierHeats(d) {
    return d.schedule.days[0].sessions.filter(function (s) { return s.track === "Qualifiers"; });
  }

  function findHeat(d, code) {
    return qualifierHeats(d).filter(function (s) { return s.code === code; })[0] || null;
  }

  function findSession(d, dayIndex, code) {
    return d.schedule.days[dayIndex].sessions.filter(function (s) { return s.code === code; })[0] || null;
  }

  // Which event days a record covers: competitors play Day 1 and their ticket includes Day 2.
  function recordDays(d, rec) {
    var ids = rec.type === "competitor" ? ["day1", "day2"] : rec.days === "both" ? ["day1", "day2"] : [rec.days];
    return d.schedule.days.filter(function (day) { return ids.indexOf(day.id) !== -1; });
  }

  function isValidRecord(d, rec) {
    if (!rec || !rec.ticket || !rec.name || !rec.email) return false;
    if (rec.type === "competitor") return !!(findHeat(d, rec.heat) && rec.handle && rec.emergencyName && rec.emergencyPhone);
    if (rec.type === "spectator") return ["day1", "day2", "both"].indexOf(rec.days) !== -1;
    return false;
  }

  function loadRecords() {
    try {
      var list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function loadCurrent(d) {
    var rec = memoryRecord;
    try {
      var ticket = localStorage.getItem(CURRENT_KEY);
      if (ticket) rec = loadRecords().filter(function (x) { return x.ticket === ticket; })[0] || rec;
    } catch (err) { /* storage blocked */ }
    return isValidRecord(d, rec) ? rec : null;
  }

  // replaces: the old ticket when a change also switched ticket type.
  function saveRecord(rec, replaces) {
    memoryRecord = rec;
    try {
      var list = loadRecords().filter(function (x) { return x.ticket !== rec.ticket && x.ticket !== replaces; });
      list.push(rec);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      localStorage.setItem(CURRENT_KEY, rec.ticket);
    } catch (err) {
      // Storage can be blocked (private mode). The confirmation still shows from memory.
    }
  }

  function newTicket(type) {
    return "OB-" + (type === "competitor" ? "C" : "S") + "-" + Math.floor(1000 + Math.random() * 9000);
  }

  function isoMinus(iso, minutes) {
    return new Date(new Date(iso).getTime() - minutes * 60000).toISOString();
  }

  function showRegistration(d) {
    var rec = loadCurrent(d);
    if (rec) showConfirmation(rec, d, false);
    else renderRegistration(d, null);
  }

  // prefill: an existing record when changing a registration, otherwise null.
  function renderRegistration(d, prefill) {
    var r = d.registration;
    var p = prefill || {};
    var type = p.type || "competitor";
    function val(k) { return esc(p[k] || ""); }

    var typeOptions = r.types.map(function (t) {
      return '<div class="type-option">' +
        '<input type="radio" name="type" id="type-' + t.id + '" value="' + t.id + '"' + (t.id === type ? " checked" : "") + ">" +
        '<label for="type-' + t.id + '"><span class="t-name">' + esc(t.label) + '</span><span class="t-price">' + copy(t.price) +
        '</span><span class="t-desc">' + copy(t.desc) + "</span></label></div>";
    }).join("");

    var heatOptions = qualifierHeats(d).map(function (h) {
      return '<label class="heat-option"><input type="radio" name="heat" value="' + esc(h.code) + '"' +
        (p.heat === h.code ? " checked" : "") + ">" +
        '<span class="heat-body"><span class="heat-num" aria-hidden="true">' + esc(h.code.replace(/\D/g, "").padStart(2, "0")) + "</span>" +
        '<span class="heat-name">' + esc(h.title) + "</span>" +
        timeEl(h.start, h.end, "block") +
        '<span class="heat-games">' + copy(h.detail) + "</span></span></label>";
    }).join("");

    var dayOptions = r.spectatorDays.map(function (x) {
      return '<label class="check"><input type="radio" name="days" value="' + esc(x.id) + '"' +
        (p.days === x.id ? " checked" : "") + "><span>" + esc(x.label) + "</span></label>";
    }).join("");

    $("register-body").innerHTML =
      sectionHead("07", "Registration", r.heading, "register-title") +
      '<p class="lede">' + copy(r.intro) + "</p>" +
      '<p class="demo-notice" role="note">' + esc(r.demoNotice) + "</p>" +
      '<div id="reg-output">' +
      '<form class="reg-form" id="reg-form" novalidate' + (prefill ? ' data-ticket="' + esc(p.ticket) + '"' : "") + ">" +
        (prefill
          ? '<div class="edit-banner" role="note"><p>Changing registration <strong>' + esc(p.ticket) + "</strong>. " +
            "Your ticket number stays the same.</p>" +
            '<button type="button" class="link-btn" id="reg-cancel-edit">Cancel and keep my registration</button></div>'
          : "") +
        '<fieldset><legend>How do you want to take part?</legend><div class="type-options">' + typeOptions + "</div></fieldset>" +
        '<div class="two-col">' +
          '<div class="field"><label class="field-label" for="f-name">Full name</label>' +
            '<input type="text" id="f-name" name="name" autocomplete="name" required maxlength="80" value="' + val("name") + '" aria-describedby="e-name">' +
            '<span class="error" id="e-name"></span></div>' +
          '<div class="field"><label class="field-label" for="f-email">Email</label>' +
            '<input type="email" id="f-email" name="email" autocomplete="email" required maxlength="120" value="' + val("email") + '" aria-describedby="h-email e-email">' +
            '<span class="hint" id="h-email">Your ticket, QR code, and reminders go here.</span>' +
            '<span class="error" id="e-email"></span></div>' +
        "</div>" +

        '<div class="type-fields reg-group" data-for="competitor">' +
          '<div class="field"><label class="field-label" for="f-handle">Handle</label>' +
            '<input type="text" id="f-handle" name="handle" autocomplete="nickname" maxlength="30" value="' + val("handle") + '" aria-describedby="h-handle e-handle">' +
            '<span class="hint" id="h-handle">The name we show on the heat board and the stream. Letters, numbers, dots, dashes, and underscores.</span>' +
            '<span class="error" id="e-handle"></span></div>' +
          '<fieldset aria-describedby="h-heat e-heat"><legend>Qualifier heat</legend>' +
            '<p class="hint" id="h-heat">All heats are on ' + esc(d.schedule.days[0].date) + ". Each heat has 50 spots. " +
              "Times show in your zone with Eastern alongside.</p>" +
            tzToggle(qualifierHeats(d)[0].start) +
            '<div class="heat-options">' + heatOptions + "</div>" +
            '<span class="error" id="e-heat"></span>' +
          "</fieldset>" +
          '<fieldset><legend>Emergency contact</legend>' +
            '<p class="hint" id="h-emergency">Someone we can call if you get hurt on the day. They don\'t need to be on the island.</p>' +
            '<div class="two-col">' +
              '<div class="field"><label class="field-label" for="f-em-name">Contact name</label>' +
                '<input type="text" id="f-em-name" name="emergencyName" autocomplete="off" maxlength="80" value="' + val("emergencyName") + '" aria-describedby="h-emergency e-em-name">' +
                '<span class="error" id="e-em-name"></span></div>' +
              '<div class="field"><label class="field-label" for="f-em-phone">Contact phone</label>' +
                '<input type="tel" id="f-em-phone" name="emergencyPhone" autocomplete="off" maxlength="30" value="' + val("emergencyPhone") + '" aria-describedby="h-emergency e-em-phone">' +
                '<span class="error" id="e-em-phone"></span></div>' +
            "</div>" +
          "</fieldset>" +
        "</div>" +

        '<fieldset class="type-fields" data-for="spectator" hidden aria-describedby="e-days">' +
          "<legend>Which day are you coming?</legend>" +
          '<div class="checks">' + dayOptions + "</div>" +
          '<span class="error" id="e-days"></span>' +
        "</fieldset>" +

        '<div class="field"><label class="field-label" for="f-access">Accessibility needs (optional)</label>' +
          '<textarea id="f-access" name="access" maxlength="500" aria-describedby="h-access">' + val("access") + "</textarea>" +
          '<span class="hint" id="h-access">Mobility, sensory, dietary, anything that helps us plan for you. We read every one.</span></div>' +
        '<div><button type="submit" class="btn btn-red" id="reg-submit"></button></div>' +
      "</form></div>";

    wireForm(d, prefill);
  }

  function currentType(form) {
    var el = form.querySelector('input[name="type"]:checked');
    return el ? el.value : "competitor";
  }

  function syncType(form) {
    if (!form) return;
    var type = currentType(form);
    Array.prototype.forEach.call(form.querySelectorAll(".type-fields"), function (fs) {
      fs.hidden = fs.getAttribute("data-for") !== type;
    });
    var btn = form.querySelector("#reg-submit");
    btn.className = "btn " + (type === "competitor" ? "btn-red" : "btn-blue");
    btn.innerHTML = (form.getAttribute("data-ticket") ? "Save changes" : type === "competitor" ? "Register to compete" : "Register to spectate") +
      ' <span class="arrow" aria-hidden="true">&rarr;</span>';
  }

  function setError(field, msgEl, msg) {
    if (field) field.setAttribute("aria-invalid", msg ? "true" : "false");
    msgEl.textContent = msg || "";
  }

  function wireForm(d, prefill) {
    var form = $("reg-form");
    if (!form) return;
    form.addEventListener("change", function (e) {
      if (e.target.name === "type") syncType(form);
      if (e.target.name === "heat" || e.target.name === "days") {
        var group = e.target.closest(".heat-options, .checks");
        if (group) group.classList.remove("is-invalid");
        $(e.target.name === "heat" ? "e-heat" : "e-days").textContent = "";
      }
    });
    syncType(form);

    var cancel = $("reg-cancel-edit");
    if (cancel) cancel.addEventListener("click", function () { showConfirmation(prefill, d, true); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var type = currentType(form);
      var el = form.elements;
      var firstInvalid = null;
      function check(field, msgEl, msg) {
        setError(field, msgEl, msg);
        if (msg && !firstInvalid) firstInvalid = field;
      }
      function checked(name) {
        var c = form.querySelector('input[name="' + name + '"]:checked');
        return c ? c.value : "";
      }

      var name = el.name.value.trim();
      check(el.name, $("e-name"), name ? "" : "Enter your name.");
      var email = el.email.value.trim();
      check(el.email, $("e-email"), !email ? "Enter your email." :
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Check the email format, for example name@example.com.");

      var rec = {
        ticket: prefill && prefill.type === type ? prefill.ticket : newTicket(type),
        type: type,
        name: name,
        email: email,
        access: el.access.value.trim(),
        createdAt: prefill ? prefill.createdAt : new Date().toISOString()
      };
      if (prefill) rec.updatedAt = new Date().toISOString();

      if (type === "competitor") {
        var handle = el.handle.value.trim();
        check(el.handle, $("e-handle"), !handle ? "Enter the handle you want on the heat board." :
          /^@?[A-Za-z0-9._-]{2,30}$/.test(handle) ? "" : "Use 2 to 30 letters, numbers, dots, dashes, or underscores.");
        var heat = checked("heat");
        check(heat ? null : form.querySelector('input[name="heat"]'), $("e-heat"), heat ? "" : "Pick a qualifier heat.");
        form.querySelector(".heat-options").classList.toggle("is-invalid", !heat);
        var emName = el.emergencyName.value.trim();
        check(el.emergencyName, $("e-em-name"), emName ? "" : "Enter an emergency contact name.");
        var emPhone = el.emergencyPhone.value.trim();
        check(el.emergencyPhone, $("e-em-phone"), !emPhone ? "Enter an emergency contact phone number." :
          /^\+?[0-9 ().-]{7,30}$/.test(emPhone) && emPhone.replace(/\D/g, "").length >= 7 ? "" : "Check the phone number. Include the area code.");
        rec.handle = handle.replace(/^@/, "");
        rec.heat = heat;
        rec.emergencyName = emName;
        rec.emergencyPhone = emPhone;
      } else {
        var days = checked("days");
        check(days ? null : form.querySelector('input[name="days"]'), $("e-days"), days ? "" : "Pick a day, or both.");
        form.querySelector('[data-for="spectator"] .checks').classList.toggle("is-invalid", !days);
        rec.days = days;
      }

      if (firstInvalid) { firstInvalid.focus(); return; }
      saveRecord(rec, prefill && prefill.ticket);
      showConfirmation(rec, d, true);
    });
  }

  function dayLabel(d, id) {
    return d.registration.spectatorDays.filter(function (x) { return x.id === id; })[0].label;
  }

  function showConfirmation(rec, d, focus) {
    var r = d.registration;
    var isComp = rec.type === "competitor";
    var days = recordDays(d, rec);
    var first = days[0];
    var firstStart = isComp ? findHeat(d, rec.heat).start : dayBounds(first).start;
    var rows = [];

    if (isComp) {
      var heat = findHeat(d, rec.heat);
      var reveal = findSession(d, 0, "BK");
      rows.push(["Your heat", esc(heat.title) + ", " + esc(d.schedule.days[0].date), timeEl(heat.start, heat.end, "block")]);
      rows.push(["Check in by", "Check-in tent, Parade Ground", timeEl(isoMinus(heat.start, 30), null, "block")]);
      if (reveal) rows.push(["Bracket reveal", "Find out if you made the finals", timeEl(reveal.start, reveal.end, "block")]);
      var d2 = dayBounds(d.schedule.days[1]);
      rows.push(["Finals", esc(d.schedule.days[1].date) + ". Qualifiers play. Your ticket also gets you in to watch.", timeEl(d2.start, d2.end, "block")]);
    } else {
      days.forEach(function (day) {
        var span = dayBounds(day);
        rows.push([day.label + " - " + day.title, esc(day.date), timeEl(span.start, span.end, "block")]);
      });
    }

    var streams = d.watch.channels.filter(function (c, i) {
      return c.start && days.some(function (day) { return c.start.slice(0, 10) === day.isoDate; });
    });

    var next = [
      "<strong>Confirmation email, right away.</strong> Your ticket number and the QR code you show at check-in go to " + esc(rec.email) + ".",
      "<strong>Ferry and check-in reminder, 24 hours before:</strong> " + timeEl(isoMinus(firstStart, 24 * 60), null, "inline", true) + ". " +
        "Ferry times from Manhattan and Brooklyn, the last boat back, and where the check-in tent is."
    ];
    if (isComp) {
      next.push("<strong>Heat reminder, 2 hours before your heat:</strong> " + timeEl(isoMinus(firstStart, 120), null, "inline", true) + ". " +
        "Your heat number and the time to be at check-in.");
    }
    next.push("<strong>Watching from home instead?</strong> The stream link is emailed the morning of " +
      (streams.length > 1 ? "each day" : "your day") + " and posted in the <a href=\"#watch\">Watch</a> section. " +
      streams.map(function (c) { return esc(c.name) + ": " + timeEl(c.start, c.end, "inline"); }).join(". ") + ".");

    var details = [["Name", esc(rec.name)], ["Email", esc(rec.email)]];
    if (isComp) {
      details.push(["Handle", "@" + esc(rec.handle)]);
      details.push(["Emergency contact", esc(rec.emergencyName) + ", " + esc(rec.emergencyPhone)]);
    } else {
      details.push(["Coming", esc(dayLabel(d, rec.days))]);
    }
    details.push(["Accessibility", rec.access ? esc(rec.access) : "None given"]);

    $("register-body").innerHTML =
      sectionHead("07", "Registration", r.heading, "register-title") +
      '<p class="demo-notice" role="note">' + esc(r.demoNotice) + "</p>" +
      '<div id="reg-output">' +
      '<div class="confirm' + (isComp ? "" : " is-spectator") + '" role="status" tabindex="-1" id="reg-confirm">' +
        '<div class="confirm-head"><p class="section-kicker">' + (isComp ? "Competitor" : "Spectator") + " ticket " + esc(rec.ticket) + "</p>" +
          "<h3>" + (isComp ? "You're in the bracket." : "See you on the island.") + "</h3></div>" +
        '<div class="confirm-body">' +
          '<h4 class="confirm-sub">Your dates and times</h4>' +
          tzToggle(firstStart) +
          '<ul class="confirm-times">' + rows.map(function (x) {
            return '<li><span class="ct-label">' + esc(x[0]) + '</span><span class="ct-note">' + x[1] + '</span><span class="ct-time">' + x[2] + "</span></li>";
          }).join("") + "</ul>" +
          icsButton("registration", null, null, "Add my schedule to calendar", "Add your Open Bracket schedule to your calendar (.ics file)") +
          '<h4 class="confirm-sub">What happens next</h4>' +
          '<ol class="confirm-next">' + next.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ol>" +
          '<h4 class="confirm-sub">Your details</h4>' +
          "<dl>" + details.map(function (x) { return "<dt>" + esc(x[0]) + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>" +
          '<div class="confirm-actions">' +
            '<button type="button" class="link-btn" id="reg-change">Change my registration</button>' +
            '<button type="button" class="link-btn" id="reg-again">Register someone else</button>' +
          "</div>" +
        "</div>" +
      "</div></div>";

    $("reg-change").addEventListener("click", function () {
      renderRegistration(d, rec);
      $("f-name").focus();
    });
    $("reg-again").addEventListener("click", function () {
      renderRegistration(d, null);
      $("f-name").focus();
    });
    if (focus) $("reg-confirm").focus();
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
      showRegistration(data);
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

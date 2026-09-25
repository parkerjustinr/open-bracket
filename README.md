# Open Bracket

A single-page site for **Open Bracket**, a fictional two-day outdoor creator games event on Governors Island, New York, on Sat, Oct 17 and Sun, Oct 18, 2026. I made it for the Happily Design Jam.

## What it is

Open Bracket is a games event where the audience can compete. Day 1 is open qualifiers: anyone 18 or older buys a competitor ticket, picks one of six heats, and plays four short solo games (Paper Ball Shootout, Musical Chairs, Sack Sprint, Simon Says) for placement points. The top 3 in each heat qualify, 18 people in total. At the end of Day 1, six invited creators draft those qualifiers onto teams, and Day 2 is the finals: six teams of four play eight team and duo games, nobody is eliminated, and the team with the most points wins.

## Why the open qualifier matters

Most creator events put the talent on a stage and the audience behind a barrier. The open qualifier is the reason this one is different. A viewer who has watched these creators for years can end up on their team the next day, and everyone watching knows that could have been them. That only works if entering is simple and the day runs on time, so the page spends most of its effort on the practical questions: when, where, how to get there, and what to bring.

## Five things that go wrong at events like this, and what catches them

1. **Stream times in the wrong time zone.** Remote viewers read "11 AM" in their own zone and show up hours early or late. Every time on the page is stored as ISO 8601 with an offset and rendered in the visitor's zone with New York time (ET) next to it. A switch flips which comes first. Calendar files store UTC, so any calendar app shows the right local time.
2. **Nobody can drive to check-in.** Governors Island is ferry only. Getting there lists all three routes (Manhattan, Brooklyn Bridge Park Pier 6, Red Hook) with first and last boats, fares and the free boats before 11 AM. Heat 1 check-in closes at 10:45 AM, after the first Brooklyn and Red Hook boats land.
3. **Competitors and spectators get mixed up.** Registration has two paths, Compete and Spectate, with different fields. The confirmation restates your heat or your days, your check-in time and what happens next. The FAQ is grouped into Competing, Watching and Day 2, and Getting there.
4. **People pack for a city day.** It's mid-October on the water. The packing list, the clear bag policy, the water refill stations and the cold and windy FAQ answer all say it before anyone gets on a boat.
5. **The last ferry.** Missing it strands people on the island. Every route card shows the last boat back in red, the red warning block repeats all three, and both days finish competing at least an hour before the earliest last boat (5:30 PM to Red Hook).

## What is faked with localStorage, and why

The site is static: plain HTML, CSS and JavaScript on GitHub Pages, with no server. To show the full registration flow anyway, submissions are saved only in the visitor's browser:

- `openBracket.registrations` holds the list of registrations made in this browser.
- `openBracket.currentTicket` holds the ticket this browser registered last, so a returning visitor sees their confirmation and can change it.
- `openBracket.tzMode` remembers the time zone switch.

No emails are sent, heat capacity isn't enforced, and nothing leaves the browser. If storage is blocked, as in some private windows, the confirmation still shows for that visit.

## What would connect to Arrived in a real build

The site wasn't built on Arrived. In a real build, these are the pieces that would move to Arrived:

- **Forms.** The Compete and Spectate forms would post to Arrived's forms instead of localStorage. Heat capacity (50 per heat), the standby line and the "change my registration" edits would be driven by those records.
- **Check-in.** The ticket number and QR code promised in the confirmation would be the ones Arrived's check-in scans at the tent on the Parade Ground. That's also where the 30-minute heat cutoff and the standby handoff would be enforced.
- **Badge printing.** Check-in would print the badge or wristband: name, handle and heat number for competitors, and day for spectators. Emergency contacts and accessibility notes would stay in the record for staff and never print.
- **Reminders.** The confirmation email, the 24-hour ferry and check-in reminder and the 2-hour heat reminder would be sent from the same records instead of being described on the page.

## How the site works

- **No build step.** `index.html`, `styles.css`, `app.js` and `data/event.json`. There's no framework.
- **All copy lives in `data/event.json`.** Edit that file to change the copy; you don't need to touch the markup.
- **Times.** Stored as ISO 8601 with an offset. `meta.timezone` (America/New_York) is the home zone. Times inside sentences are written as `{{t:2026-10-17T16:30:00-04:00}}` so they convert too.
- **Headings.** One colored phrase per heading, written as `[[red:...]]`, `[[blue:...]]` or `[[yellow:...]]`. Bold key numbers in copy with `**...**`.
- **Calendar files.** Built in the browser for both days, each day, each session, each stream, and each visitor's own registration (with reminder alarms).
- **Countdown.** Counts to the first heat or game of the next day, with split-flap digits.
- **Creator photos.** Add `img/creators/01.jpg` to `06.jpg` and they get a print treatment (grayscale, multiplied into the section blue, halftone on top). Missing files fall back to a numeral tile.
- **Color has a job.** Red means Day 1, solo or competing. Blue means Day 2, duo and team, or watching. Sun yellow is only ever a background with ink on it, for the champion, crowns, the Day 2 finale and highlight marks.
- **Resilient rendering.** Each section renders on its own, so one failure doesn't blank the page.
- **Accessibility.** Skip link, visible focus, keyboard-operable tabs, `prefers-reduced-motion` respected, and text contrast at WCAG AA.

## Run locally

The page loads its content with `fetch`, so opening `index.html` straight from disk won't work. Serve the folder instead:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

GitHub Pages: in Settings, open Pages and choose "Deploy from a branch" with `main` and `/ (root)`. The empty `.nojekyll` file makes Pages serve the files as they are.

`index.html` loads `styles.css` and `app.js` with a `?v=` version so browsers fetch fresh copies after a deploy. Bump it whenever you change either file. Copy-only edits to `data/event.json` don't need a bump.

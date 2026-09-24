# Open Bracket

A single-page site for **Open Bracket**, a fictional two-day outdoor creator games festival on Governors Island, New York. Built for the Happily Design Jam, September 2026.

- Plain HTML, CSS and vanilla JS. There's no framework and no build step.
- All copy lives in `data/event.json`. To change the copy, edit that file. You don't need to touch the markup.
- Any line marked `[PLACEHOLDER]` is draft copy and gets a visible "Placeholder" tag on the page.
- Times are ISO 8601 with an offset, and `meta.timezone` (America/New_York) is the home zone. The page renders every time in the visitor's zone with Eastern alongside, and a switch flips which comes first (remembered in `localStorage`, key `openBracket.tzMode`). Times inside copy are written as `{{t:2026-10-17T16:30:00-04:00}}` so they convert too.
- The hero countdown and the calendar buttons run entirely in the browser. Calendar files (.ics) are built on the client, for both days, for each session, and for each stream. Times in them are UTC, so calendar apps show them in the viewer's zone.
- Registration is a demo. Submissions are saved only in the visitor's browser (`localStorage`, key `openBracket.registrations`). Nothing is sent anywhere.

## Run locally

The page loads its content with `fetch`, so opening `index.html` straight from disk won't work. Serve the folder instead:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

GitHub Pages: in Settings, open Pages and choose "Deploy from a branch" with `main` and `/ (root)`. `.nojekyll` is included so Pages serves the files as they are.

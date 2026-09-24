# Open Bracket

A single-page site for **Open Bracket**, a fictional two-day outdoor creator games festival on Governors Island, New York. Built for the Happily Design Jam, September 2026.

- Plain HTML, CSS and vanilla JS. There's no framework and no build step.
- All copy lives in `data/event.json`. To change the copy, edit that file. You don't need to touch the markup.
- Any line marked `[PLACEHOLDER]` is draft copy and gets a visible "Placeholder" tag on the page.
- Registration is a demo. Submissions are saved only in the visitor's browser (`localStorage`, key `openBracket.registrations`). Nothing is sent anywhere.

## Run locally

The page loads its content with `fetch`, so opening `index.html` straight from disk won't work. Serve the folder instead:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

GitHub Pages: in Settings, open Pages and choose "Deploy from a branch" with `main` and `/ (root)`. `.nojekyll` is included so Pages serves the files as they are.

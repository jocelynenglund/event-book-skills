# Event Book (snapshot)

A copy of [Event Book](https://eventpad.itsybit.se) as it was on 2026-10-29 (eventpad commit `4de08e2`), for anyone who'd rather run it themselves. It's a static web app with no build step.

## Run it

ES modules need a web server (opening `index.html` as a file won't work):

```
cd event-book
python3 -m http.server 8080
```

Then open http://localhost:8080 and use ☰ → Import to open a plan or a build file.

## What works offline

Everything you do on your own device: sketching on the board and in the outline, importing plans and builds, comparing them, sharing pictures, and exporting. Your books stay in your browser.

The library, sign-in and share links talk to itsybit's server. They won't work in a local copy, and you don't need them.

This snapshot isn't kept in step with the live app.

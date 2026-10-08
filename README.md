# Suryansh's portfolio

A static portfolio published at [suryansh.lol](https://suryansh.lol). No build step or backend is required.

## Local development

Serve the repository over HTTP so the browser can load JavaScript modules:

```sh
python -m http.server 4173
```

Open `http://localhost:4173`.

## Files

- `index.html`: biography, signature, and accessible project window markup.
- `styles.css`: introduction, work viewer, responsive layout, and reduced-motion styles.
- `script.js`: the project metadata array and introduction/details state.
- `js/preview.js`: selected iframe, frame loading indicator, and automatic details fallback.
- `js/dock.js`: project selection, tooltips, magnification, and click motion.
- `js/motion.js`: shared motion preference, entrance animation, and WebGL pixel wipe.
- `js/signature.js`: signature drawing and replay.
- `assets/`: locally hosted portrait, project icons, and fonts with their licenses.

Edit the `projects` array in `script.js` to update a project's content, icon, or live URL. Use `url: null` for a project with no public website.

Only the selected website is embedded. A missing URL, reported iframe error, or 12-second loading timeout displays the project's details instead. Opening About this project preserves the iframe and keeps the dock available. Browsers can hide cross-origin iframe failures, so a `load` event alone cannot guarantee that an external website rendered successfully.

## Validation

Check JavaScript syntax with `node --check` for `script.js` and each file in `js/`. Run `git diff --check` before committing. In the browser, check desktop and mobile layouts, Show/Hide work, all dock selections, persistent dock in details, Escape/focus restoration, signature replay, reduced motion, and automatic preview fallback.

## Deployment

GitHub Pages publishes the repository root from `main`. Pushing to `main` triggers the Pages deployment; `CNAME` retains the custom domain. `.nojekyll` keeps publishing as a plain static site. No generated screenshots or local review artifacts need to be committed.

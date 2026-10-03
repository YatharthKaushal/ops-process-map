# Ops Tracker · Process map

Static, zero-dependency page: `index.html` + `style.css` + `data.js` + `app.js` + `fonts/`.
No build step. All graph content is in `data.js`.

## Run locally
    python -m http.server 8080          # then open http://localhost:8080
(or just double-click `index.html`)

## Deploy
The site root is this folder. There is nothing to build.

**Vercel**: import the repo, Framework Preset = *Other*, Root Directory = this folder, leave build and output empty
(`vercel.json` already sets them). Or `vercel --prod` from this folder.

**Render**: New > Static Site (or Blueprint using `render.yaml`), Publish Directory = `.`, Build Command empty.

Both serve over HTTPS with a free URL and add a `noindex` header. The page names real customers, vendors and
client sheet names, so treat the URL as private: share it only with the people who need it.

## Document page
`doc.html` is a read-only rendering of `docs/automation-suggestions.md` (the raw markdown is not hosted).
Regenerate after editing the markdown: `python docs/build_doc_page.py` (run from the repo that holds `docs/`).

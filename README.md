# Toner Ledger — Printer Toner Inventory (Web Edition)

A browser-based version of the printer toner inventory tool — same core
features as the desktop apps (add toners, restock, record usage, low-stock
alerts, search, CSV reports), but running entirely as a static web page you
can host for free on GitHub Pages.

**No server, no database to set up, no Python required to run it.** Just
three files: `index.html`, `style.css`, `app.js`.

## How it stores data

Everything is saved in your browser's `localStorage`, scoped to whichever
device/browser you're using it from. There's no backend — nothing is sent
anywhere. That means:

- ✅ Works completely offline once the page has loaded
- ✅ Nothing to install, no accounts, free to host
- ✅ **Survives closing the browser, restarting, or a full power loss** —
  `localStorage` is written to disk, not kept in memory
- ⚠️ Data stays on that one device/browser — it won't sync between your
  phone and your laptop, or between different browsers on the same PC
- ⚠️ Clearing your browser's site data/cache for this page will erase it
- ⚠️ Private/incognito windows usually don't persist `localStorage` after
  you close them

### Backing up and restoring

Use the **Download backup** / **Restore backup…** buttons (top of the All
Stock tab) to protect against the scenarios above, or to move your data to
a different computer:

- **Download backup** saves a `.json` file containing your entire
  ledger — every toner and the full transaction history — byte-for-byte.
- **Restore backup…** loads a `.json` file back in. It shows you what's in
  the file (how many toners/transactions, and when it was saved) and asks
  you to confirm before replacing what's currently in the browser, since
  restoring overwrites the current data.

To move your data to a new PC: click **Download backup** on the old one,
copy the `.json` file over (USB drive, email, cloud storage — anything),
open the app on the new PC, and click **Restore backup…** and pick that
file.

The CSV exports (inventory / low-stock / history) are still there too —
those are for reporting and sharing with others in a spreadsheet-friendly
format, not for restoring the app's internal state, so use the JSON
backup for actual backup/restore purposes.

If you outgrow this and want data that syncs across devices or multiple
people automatically (without manual backup files), that would need a
small backend + real database (happy to build that version too if you
want it later).

## Deploying to GitHub Pages (free hosting)

1. **Create a new repository** on GitHub (e.g. `toner-ledger`) — public
   repos get free Pages hosting; a private repo needs GitHub Pro/Team/Enterprise.
2. **Add these three files** to the repository root:
   - `index.html`
   - `style.css`
   - `app.js`

   Either drag-and-drop them in the GitHub web UI ("Add file → Upload
   files"), or from your computer:
   ```bash
   git init
   git add index.html style.css app.js
   git commit -m "Add Toner Ledger web app"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/toner-ledger.git
   git push -u origin main
   ```
3. **Turn on Pages:** in the repo, go to **Settings → Pages**. Under
   "Build and deployment", set **Source** to "Deploy from a branch", pick
   the **`main`** branch and the **`/ (root)`** folder, then **Save**.
4. Wait about a minute, then refresh that Settings → Pages screen — it'll
   show your live URL, something like:
   ```
   https://YOUR-USERNAME.github.io/toner-ledger/
   ```
5. Open that link — that's your working app. Bookmark it, add it to your
   phone's home screen, share the link with anyone else who should use it
   (keeping in mind each person/device keeps its own separate data, per
   the storage notes above).

Any time you edit `index.html`, `style.css`, or `app.js` and push the
change to the `main` branch, GitHub Pages redeploys automatically within a
minute or two.

## Running it locally (without GitHub, for testing)

You don't strictly need a server — double-clicking `index.html` opens it
directly in your browser and it works (Chrome/Edge/Firefox all handle
`localStorage` fine from a local file). If you'd rather serve it locally
(closer to how it'll behave once deployed):

```bash
# from the folder containing index.html
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

## Features

- **Add toners** — name, brand, model/SKU, color, compatible printer(s),
  starting quantity, reorder threshold, unit price, supplier, location
- **Restock** and **Use/Reduce** — quantity updates instantly, with a full
  transaction log kept underneath
- **Automatic low-stock highlighting** — rows shift into an amber/red
  accent the moment they cross the reorder threshold; a dedicated Low
  Stock tab lists them all
- **Live search** — by name, brand, model, printer, or color
- **Edit** and **Remove** (soft-delete; history is preserved) any toner
- **Usage/Restock History tab** — filterable by toner and date range
- **CSV exports** — full inventory, low-stock/reorder list, and usage
  history, each downloadable with one click
- **Full backup / restore (JSON)** — one-click download of everything, and
  a restore flow (with confirmation) to load it back in on this computer
  or a different one
- Responsive layout — works on a phone or tablet as well as desktop

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure and modal markup |
| `style.css` | All styling (self-contained, no build step) |
| `app.js` | Data layer (localStorage), rendering, and event wiring |

No dependencies to install, no build/bundle step — edit any file and
refresh the page to see the change.

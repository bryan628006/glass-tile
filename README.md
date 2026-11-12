# Glass Tile

Overlay soft, glossy rounded glass tiles over a glowing color field (WebGL2).

**Live site:** https://bryan628006.github.io/glass-tile/

## Saving settings

The **Save settings** button in the top bar saves the current tile settings, and they are restored the next time the page opens.

- **With the local backend running**, settings are saved to `server/data/settings.json` by a small Node server ([server/index.js](server/index.js)). It has no dependencies.
- **Without a backend** (e.g. the GitHub Pages site, which is static hosting only), the button falls back to saving in the browser's `localStorage`, and reads "Saved in browser".

### API

| Method | Path            | Description                                      |
| ------ | --------------- | ------------------------------------------------ |
| GET    | `/api/settings` | Returns `{ settings, savedAt }` (`null` if none) |
| POST   | `/api/settings` | Saves the JSON body as the settings              |

## Running locally

```bash
npm install

# Option A: one command. Builds the app, then serves it + the API at http://localhost:3001
npm start

# Option B: development with hot reload (two terminals)
npm run server   # backend on :3001
npm run dev      # Vite dev server; /api is proxied to :3001
```

## Deploying

Pushing to `main` builds the app and publishes `dist/` to GitHub Pages via [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

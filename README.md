# Ayurmuni Website

React 19 + Vite single-page app for Ayurmuni (consultations, medicines, products, diet, yoga). The backend API lives at `https://ayurmuni.aimantra.info/`.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
```

## Configuration

The API base URL is read at build time from `VITE_API_BASE` (defaults to `https://ayurmuni.aimantra.info/`). The chat WebSocket uses the same host over `wss://`. To point a build at another backend, copy `.env.example` to `.env.production` and edit it before building.

## Production build

```bash
npm ci
npm run build      # outputs dist/
npm run preview    # optional: serve dist/ on http://localhost:4173 to check it
```

Upload the **contents** of `dist/` to the server. Every deep link (for example `/profile/orders`) must fall back to `index.html`, otherwise refreshing a page returns a 404. Configs for each host are included:

| Host | What to do |
| --- | --- |
| Apache / cPanel / Hostinger | Upload `dist/*` into `public_html/`. `dist/.htaccess` (from `public/.htaccess`) already handles routing and caching. Make sure hidden files are uploaded. |
| Nginx (VPS) | Copy `dist/` to `/var/www/ayurmuni` and use `deploy/nginx.conf`. |
| Vercel | Push the repo; `vercel.json` handles routing and caching. |

### Before going live

- **HTTPS is required.** Browsers only allow camera/microphone (video consultations) and geolocation on HTTPS.
- **CORS:** the browser calls the API directly, so the backend must allow your production domain as an origin (REST and the `/ws` WebSocket).
- **Razorpay:** add the production domain in the Razorpay dashboard if domain whitelisting is enabled.
- After each deploy, users with an old tab open are reloaded onto the new build automatically when they navigate.

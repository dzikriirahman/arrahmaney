# AR-Rahmaney Cloudflare deployment

The production target is the Cloudflare Worker named `arrahman`. The app continues to use Supabase for data and authentication; receipt OCR is served by `worker.js`.

## Access model

- Visitors without an account can view the app's shared financial data.
- Only `dzikrii.rahman@gmail.com` can edit data or use receipt OCR.
- Anyone who obtains the public URL can view the data. Do not use this mode for information that must remain confidential.
- Supabase Row Level Security is the actual data boundary. Apply `supabase-public-viewer.sql` to the correct Supabase project before making the app public. Review its public-read scope first.

## Cloudflare setup

1. Connect the existing `arrahman` Worker to the `dzikriirahman/arrahmaney` GitHub repository and production branch.
2. Configure dependency installation as `npm install` and the deployment command as `npm run deploy`. Wrangler runs `npm run build` from `wrangler.jsonc` to produce the static assets.
3. Add `GEMINI_API_KEY` as a Worker secret. Never commit it or put it in a browser variable. Optionally add `GEMINI_MODEL` as a Worker variable to override the fallback model list.
4. Confirm the production build succeeds before changing the public URL or disabling Netlify.

The build copies only the browser application and icons into `dist`; SQL setup files and the original Netlify function are not published as static files. The Worker routes the existing `/.netlify/functions/gemini-receipt-ocr` URL to an owner-authenticated Cloudflare handler.
The Worker is configured to use its `workers.dev` URL; attach a custom domain later if one is desired and available in this Cloudflare account.

## Local verification

```sh
npm install
npm run build
npx wrangler deploy --dry-run
```

Before deploying, run the Supabase migration, configure the Worker secret, and verify both anonymous read-only access and owner write access against the production URL.

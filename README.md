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

## Kulakan calculations and Excel import

- Purchase quantity, purchase price, and selling price must use the same unit (for example, buy and sell per `dus`). Total modal is `quantity × purchase price + freight`; gross profit is `quantity × selling price − total modal`; gross margin is gross profit divided by sales value. Rows without a selling price are excluded from profit/margin totals. A negative margin is a real below-cost price unless the source row mixes units.
- The `Detail Kulakan` sheet is the source of truth. The importer reads `Total Modal (Rp)` (column K) and `HPP Modal / Unit (Rp)` (column L) directly, and derives the unit purchase price as `(Total Modal − freight) ÷ quantity`. `Jumlah (Qty)` (column G) is the quantity as written; the `Pcs/Kg` column (N) is the content multiplier and is never multiplied into the quantity.
- Column reconciliation is enforced on import: `(HPP/unit ÷ Pcs/Kg) × Pcs/Kg × quantity` must equal `Total Modal` (column K). This holds for every row of the reference sheet, so rows that fail the check abort the import with a message naming the offending item and a half-updated sheet can never reach the ledger.
- Importing the `Detail Kulakan` and `Master Supplier` sheets replaces the kulakan rows and updates suppliers. It also stores one `[DETAIL_STRUK]` expense per supplier, date, and invoice in `transactions`, including product lines and freight. Receipt IDs are derived from a SHA-256 hash of `tanggal|supplier|no_nota` and are prefixed `KULAKAN-`, so re-importing the same invoice updates the existing record instead of duplicating it.
- Every import first deletes the previous `kulakan` rows and the previously imported `KULAKAN-` receipt archives, then inserts the new set. The result always mirrors the uploaded Excel file and never accumulates across uploads. Receipts created by photo OCR (`source: photo_ocr`) are not touched by this cleanup.
- Supplier names are upper-cased and a small alias map merges the same shop appearing under different names in the file (`SALES BOWO` → `GUDANG GARAM`, `PLASTIK PASAR JTB` → `TOKO PLASTIK`, `SALES PANDEMAS` → `PANDEMAS`). Distinct shops such as `TOKO FALURIS` and `TOKO FALURIS MAJU` stay separate.
- The import cannot safely infer whether an existing, manually entered expense is already represented by the Excel file. Check for any such manual entries before importing to avoid counting that purchase twice in the financial ledger.
- In the `Buku Kulakan` tab, the owner can edit or delete an individual row. Deleting a row does not remove the associated expense receipt archive.
- The `Buku Kulakan` list can be narrowed by supplier, date range, category, and item/invoice search. Editing opens in a dialog so the list position is preserved.

## Local verification

```sh
npm install
npm run build
npx wrangler deploy --dry-run
```

Before deploying, run the Supabase migration, configure the Worker secret, and verify both anonymous read-only access and owner write access against the production URL.

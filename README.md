# Affairs \u00d7 UPSC

Press-release digest for UPSC current affairs.

**Sources:** PIB, MEA, Bilaterals, News on Air.
Pick a day / week / month / custom range, filter by ministry, open the reader, export PDFs (images + tables).

Repo: https://github.com/caffinated-coder/affairs-upsc

## Deploy on Vercel (next steps)

1. Open https://github.com/apps/vercel and **Configure**.
2. Under Repository access, include **affairs-upsc** (or All repositories) \u2192 Save.
3. Open https://vercel.com/new \u2192 Import **affairs-upsc**.
4. Settings:
   - Framework Preset: **Other**
   - Build Command: `npm run build`
   - Output: leave default (Nitro writes `.vercel/output`)
   - Node.js: **22.x**
5. Environment variables:
   - `VITE_AUTH_ENABLED` = `false`
6. Deploy. First build takes a few minutes.

If the repo is missing from the import list, the GitHub App cannot see the private repo \u2014 go back to step 1.

Hobby functions time out around 10s. A full PIB month scrape can need **Vercel Pro**. Day / week views are fine on Hobby.

## Local

```bash
npm install
npm run dev
```

Opens at http://localhost:8080

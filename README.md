# MathDocs CAS public website

The public product, support and legal site for MathDocs CAS, built by Aaccount.

Source of truth: `docs/site/` and `scripts/build-publisher-site.cjs` in the MathDocs-CAS application repository. Run `npm run build:site`, validate with `npm run test:site`, then copy the explicit `dist/publisher-site/` output here. The GitHub Pages main branch publishes the site.

The public demo loads bundled mathematics libraries on demand and calculates in browser memory. It does not connect to Google documents, collect analytics or accept payments. Library notices are in `demo/THIRD_PARTY_NOTICES.txt` and the bundled vendor directories.

Keep `google4608931ff44089a2.html` unchanged: it is used for existing domain verification. No custom-domain redirect is active. The planned `mathdocscas.skaybase.com` address requires the owner’s DNS and GitHub Pages settings first.

Store installation links remain unavailable until the actual public listings are verified. Review status is separate from approval. The existing English/Danish support, privacy and terms URLs are preserved.

# Strive Nutrition — Submission Notes

## 1. Metafield & metaobject definitions created

Created in Admin → Settings → Metafields and metaobjects, all with storefront
access enabled so the theme sections can read them.

### Metaobject: `review` (Strive Reviews section)
| Field | Key | Type |
|---|---|---|
| Rating | `rating` | Integer |
| Title | `title` | Single line text |
| Body | `body` | Multi-line text |
| Author name | `author_name` | Single line text |
| Product context | `product_context` | Single line text |

### Metaobject: `combo` (Strive Combos section)
| Field | Key | Type |
|---|---|---|
| Title | `title` | Single line text |
| Description | `description` | Multi-line text |
| Products | `products` | Product reference — **list** |
| Captions | `captions` | Single line text — **list** (one per product, same order) |
| Badge | `badge` | Single line text |
| Featured | `featured` | Boolean |
| Flat price | `flat_price` | Integer |
| CTA link | `cta_link` | URL |

### Metaobject: `bundle_tier` (Strive Bundles section)
| Field | Key | Type |
|---|---|---|
| Tag | `tag` | Single line text |
| Quantity | `quantity` | Integer |
| Price | `price` | Integer |
| Compare at | `compare_at` | Integer |
| Features | `features` | Single line text — **list** |
| Featured | `featured` | Boolean |
| Sample products | `sample_products` | Product reference — **list** |
| CTA link | `cta_link` | URL |

### Product metafields (Strive Shop grid + product card)
| Field | Namespace/key | Type |
|---|---|---|
| Review rating | `reviews.rating` | Decimal |
| Review count | `reviews.count` | Integer |

Namespaced `reviews.*` deliberately, since that's the convention review apps
(Judge.me, Loox, Air Reviews) already write to — if one gets installed later,
star ratings populate with zero code changes. Left blank for now; the card
hides the rating row rather than faking a number.

**Why metaobjects instead of section blocks:** combos, tiers and reviews are
content a marketing person needs to edit without opening the theme editor.
Metaobjects show up in Admin → Content, which is the actual "run it without
a developer" bar the brief set.

---

## 2. Build notes

### What I'd flag about the original file
- The whole visual system — tokens, the ocean/water cinematic background,
  every "product" — was hand-built as inline base64 SVG in one 150KB HTML
  file. No price, title, or availability existed behind any of it, so all of
  that had to be re-modeled against real Shopify objects or metaobjects from
  scratch.
- The reveal-on-scroll / marquee / carousel behavior ran once on
  `DOMContentLoaded` in a single closure. That breaks the moment the theme
  editor adds, removes, or reorders a section, since none of those actions
  re-fire that event.
- Combo savings and bundle per-unit pricing were hardcoded numbers in
  markup — correct on day one, wrong the first time a merchant changes a
  product's price.

### What I changed and why
- Extracted CSS/JS into theme assets loaded once via `asset_url`, rather
  than inlined per section — required for Shopify, and better performance
  regardless.
- Prefixed every class `sv-` and scoped it under `.sv-scope`, so it can't
  collide with Dawn's own classes or another app's.
- Computed combo/tier pricing live from real product data instead of typed-in
  numbers, so it can't go stale after a price change.
- Built the product card as one reusable snippet used by the shop grid
  (and reusable anywhere else a tile is needed later).
- Modeled reviews, combos, and bundle tiers as metaobjects rather than
  hardcoded section blocks, so a marketing person edits them from
  Content → Metaobjects with no Liquid or theme-editor access needed.
- Rewrote the JS into small idempotent functions keyed off
  `shopify:section:load`, so sections survive add/remove/reorder in the
  editor — this turned out to matter a lot in practice (see AI workflow
  notes below).
- Retinted the prototype's purple/teal palette to a warmer espresso/brass
  supplement palette, keeping the exact spacing scale, glass-morphism
  system, and motion curves — while avoiding the generic "black background +
  neon accent" gym-brand cliché.

### What I deliberately scoped out
- The full ocean/water cinematic background — explicitly flagged as "bonus"
  in the brief, not content a merchant edits, would have doubled build time
  for no editability gain.
- Actual flat-price enforcement for bundle tiers at checkout. The tier cards
  are fully built and editable, but making "pick any 3 for a flat price"
  actually charge that price regardless of which 3 are picked needs a
  Shopify Bundles/selling-plan setup or a Cart Transform Function — that's
  checkout logic, not a homepage section, and deserves its own scoped piece
  of work.
- The hero's staggered, offset multi-product artwork — simplified to a
  single fade transition rather than reverse-engineering the prototype's
  exact per-image transform choreography.
- Locale extraction — strings are hardcoded English, correct for a
  single-market homepage, wrong the moment a second storefront language is
  needed.

### What I'd do with more time
- Wire the checkout-side bundle pricing properly (Cart Transform Function).
- Set up `shopify theme check` and a Lighthouse budget in CI, since "Core
  Web Vitals as a requirement" implies an ongoing enforcement mechanism, not
  a one-time check.
- Reproduce the hero's layered product artwork choreography properly instead
  of the simplified fade.
- Extract strings to locale files.

---

## 3. AI workflow notes

### What I delegated
Reading and mapping the ~1,700-line prototype — finding section boundaries,
extracting design tokens, separating core UI from decorative background —
was the biggest time save. First-draft generation of each Liquid section,
the metaobject field tables, and the product seed data was also delegated
wholesale, then corrected by hand.

### Where it failed me — and where the real friction was
The code-level bugs were the easy part to catch:
- A Liquid filter chain (`| plus: x | default: y`) applied `default` to the
  *result* of the addition instead of to `x` before adding it — a product
  missing a compare-at price would silently zero out a whole combo's savings
  calculation instead of falling back to its regular price. Caught by
  tracing the chain by hand, not by trusting valid syntax.
- The hero's product-stage width math assumed equal-width flex children from
  a percentage division that didn't hold once images were missing.

The bigger friction was entirely on the **Shopify platform/tooling side**,
not the code, and cost far more time than the bugs above:
- **CSV import failures from unescaped commas.** Product descriptions had
  commas inside unquoted CSV fields, which shifted every column after them —
  `"deny"` (an inventory policy value) ended up parsed as a price. Not
  caught until the actual import attempt threw a real error; should have
  been caught by validating column counts against the header before ever
  handing the file over.
- **Local/remote theme state drift.** `shopify theme dev` pushes local files
  to a remote draft theme, but changes made *in the browser editor* (adding
  sections, reordering) only exist remotely until a `theme theme pull` is
  run. Several rounds of "my sections disappeared" were actually this sync
  gap, not data loss — restarting `theme dev` kept re-pushing the stale
  local copy over the correct remote one.
- **Dev themes vs. listed themes are different things.** A theme created by
  `shopify theme dev` is a session-scoped draft that never appears in
  Admin's Themes list — it only exists via the CLI's own preview links.
  Getting something publishable required `theme push --unpublished`
  instead, which was not the obvious next step from inside the dev
  workflow.
- **Published vs. draft confusion.** The plain store URL always resolves to
  whichever theme is marked Active — Horizon, by default — regardless of
  which theme was actually being worked on. Several "it's not showing my
  changes" moments were this, not a build failure.
- **GitHub's plain web uploader doesn't accept folders**, only individual
  files, which broke on a project with 8+ subfolders. Routing through a
  Codespace (a full VS Code + terminal in-browser) solved it with a real
  `git add / commit / push`, entirely without installing anything locally —
  useful to know as a no-install fallback when a contributor won't install
  Git.

### What I'd systematize for twenty more of these
- **A pre-flight data-modeling checklist** before generating any section:
  for each piece of dynamic content, decide up front whether it maps to a
  native Shopify field, a metafield, or a metaobject — this was done
  correctly in this build but reactively, section by section, rather than
  as a single pass before writing any Liquid.
- **A CSV validator step before handing off any product import file** —
  parse it back and confirm every row's column count matches the header,
  rather than discovering a quoting bug at import time on a live store.
- **A one-page "theme dev vs. theme push vs. publish" cheat sheet** handed
  over alongside the code, since this is where almost all of the
  non-coding time went. The distinction between a session-scoped dev theme,
  a pushed draft theme, and the published theme isn't obvious from the CLI's
  own success messages, and caused most of the back-and-forth in this build.
- **A running snippet library** across builds — icon system, product card,
  and the reveal-on-scroll/section-editor-safe JS pattern are near-identical
  requirements on every prototype-to-Shopify job; rebuilding them from
  scratch each time is wasted motion.
- **A tiny local Liquid math test harness**, run once outside of Shopify,
  for any section involving price arithmetic — the filter-chain bug above
  would have been caught in seconds by a unit test instead of a manual
  trace through the template.

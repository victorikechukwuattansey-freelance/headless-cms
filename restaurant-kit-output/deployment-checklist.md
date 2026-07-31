# Deployment Checklist — Restaurant Social Media Kit

## Prerequisites

- [ ] **Selar account** — best for Africa (NGN, GHS, KES, ZAR support). Sign up at selar.co
- [ ] **Paystack Storefront** — best for direct payments (card, bank transfer, mobile money). Create at paystack.com → Storefront
- [ ] **Gumroad account** — best for global USD sales. Sign up at gumroad.com
- [ ] Product ZIP ready: `Restaurant-Social-Media-Kit-v1.0.zip` (4.7 MB)
- [ ] Product images ready (all in `restaurant-kit-output/`):
  - `restaurant-kit-etsy-preview.png` — main cover
  - `restaurant-kit-preview-full.png` — 40-template grid
  - `restaurant-kit-phone-mockup.png` — phone device mockup
  - `restaurant-kit-laptop-mockup.png` — laptop device mockup
  - `restaurant-kit-instagram-grid.png` — feed grid preview
  - `restaurant-kit-instruction.png` — instruction page preview
- [ ] 40 individual template PNGs in `restaurant-kit-output/template-pngs/` (for listing galleries)
- [ ] Instruction PDF ready: `restaurant-kit-output/restaurant-kit-instruction.pdf`
- [ ] **Onboarding destination ready** — where buyers land after purchase. Options:
  - WhatsApp group (`https://chat.whatsapp.com/XXXX`)
  - Telegram channel (`https://t.me/XXXX`)
  - Welcome page (hosted HTML with download link + setup guide)
  - Google Form to collect feedback

## Selar Setup

1. Go to selar.co → **Create Product**
2. **Product Name:** Restaurant Social Media Kit — 40 Canva Templates
3. **Description:** Paste from `gumroad-listing.md` (rewrite in your own words for Selar's editor)
4. **Pricing:**
   - Use **Variants** feature for 3-tier pricing:
     - Basic — $19 (40 templates + instruction PDF)
     - Standard — $27 (+ setup guide + brand kit)
     - Bundle — $37 (templates + menu pack + brand kit + seasonal pack)
   - If variants not available, create 3 separate products
5. **Upload:** `Restaurant-Social-Media-Kit-v1.0.zip`
6. **Product Images** (upload in this order):
   - `restaurant-kit-etsy-preview.png` — main cover
   - `restaurant-kit-preview-full.png` — all 40 templates grid
   - `restaurant-kit-phone-mockup.png` — device demo
   - `restaurant-kit-laptop-mockup.png` — device demo
   - `restaurant-kit-instagram-grid.png` — feed preview
7. **Custom Page** (optional): Paste a simple HTML sales page or link to a hosted page
8. **Enable Affiliate Marketplace:** Toggle on "Show product on Affiliate Network" — set 30-40% commission. Restaurant influencers and food bloggers will promote for you.
9. **Post-Purchase Redirect:** Settings → "Custom Success URL" → paste your onboarding link. Append `?tier={{variant}}` to tailor the page per tier.
10. Set payment methods: card, bank transfer, mobile money (M-Pesa, Airtel Money)
11. **Preview and publish**

## Paystack Storefront Setup

1. Go to paystack.com → **Storefront** → **Create Storefront**
2. **Store name:** Your brand or business name (e.g. "YourBrand Restaurant Kits")
3. **Product Name:** Restaurant Social Media Kit
4. **Description:** Paste short version from `gumroad-listing.md` — 2-3 paragraphs max
5. **Pricing:**
   - Paystack Storefront supports multiple variants/options
   - Set up 3 tiers:
     - Basic — ₦15,000 (or $19 equivalent) — 40 Templates + PDF
     - Standard — ₦22,000 (or $27) — 40 Templates + PDF + Setup Guide + Brand Kit
     - Bundle — ₦30,000 (or $37) — Full Pack (templates + menu pack + brand kit + seasonal)
   - *Ng: prices above are suggestions — adjust to your local market*
6. **Digital Product File:** Upload `Restaurant-Social-Media-Kit-v1.0.zip`
   - Buyers will receive a download link after payment
7. **Product Images:**
   - Cover: `restaurant-kit-etsy-preview.png`
   - Gallery: all images from restaurant-kit-output (mockups, grid, previews)
8. **Post-Purchase Flow:** Paystack Storefront can send automated download links via email — no custom URL needed unless you want onboarding. If you do:
   - Enable "Custom Redirect URL" → paste your welcome page / WhatsApp group link
9. **Enable Paystack Checkout:**
   - Card payments (Visa, Mastercard, Verve)
   - Bank transfer (Paystack's built-in bank transfer)
   - Mobile money (if available in your country)
   - USSD
10. **Preview and publish**
11. **Share storefront link** — Paystack gives you a clean URL like `storefront.paystack.com/yourstore`

> **Tip:** Paystack Storefront is ideal for African customers paying in local currency. No monthly fees — Paystack charges 1.5% + ₦100 per transaction (or 3.9% + $0.20 for international cards).

## Gumroad Setup

1. Go to gumroad.com → **New Product**
2. **Product Name:** Restaurant Social Media Kit — 40 Editable Templates for Cafes, Bakeries & Bars
3. **Description:** Paste **full** content from `restaurant-kit-output/gumroad-listing.md`
4. **Pricing:**
   - Use Gumroad's **Multiple Versions** feature:
     - Basic — $19 (templates + instruction PDF)
     - Standard — $27 (Recommended — includes setup guide + brand kit)
     - Bundle — $37 (full pack: templates + menu pack + brand kit + seasonal)
   - Mark "Standard" as the default/pre-selected tier
5. **Upload:** `Restaurant-Social-Media-Kit-v1.0.zip`
6. **Cover Image (2048×1152px):** Upload `restaurant-kit-etsy-preview.png`
   - Gumroad crops to 2048×1152 automatically — ensure the image's key content is centered
7. **Preview Images** (upload 4-6):
   - `restaurant-kit-preview-full.png` — template grid overview
   - `restaurant-kit-phone-mockup.png` — device mockup
   - `restaurant-kit-laptop-mockup.png` — laptop demo
   - `restaurant-kit-instagram-grid.png` — 3x3 feed preview
   - Optionally upload a few individual template PNGs from `template-pngs/`
8. **Tags:** restaurant, social media, templates, canva, instagram, marketing, food, cafe, bakery, small business
9. **Post-Purchase Redirect:** Product → Settings → "Enable Custom Redirect URL" → paste your onboarding link (WhatsApp group, Telegram, or welcome page)
   - Gumroad supports `{sale_id}` parameter for personalized pages
10. **License Keys:** Optional — skip unless you want per-customer tracking
11. **Preview and publish**

## After Publishing

- [ ] Test checkout flow for all 3 tiers on Selar
- [ ] Test checkout flow for all 3 tiers on Paystack Storefront
- [ ] Test checkout flow for all 3 tiers on Gumroad
- [ ] Verify download link delivers the ZIP correctly on each platform
- [ ] Check thank-you page / onboarding destination renders correctly
- [ ] Test email delivery sequence (if configured)
- [ ] Set up abandoned checkout recovery:
  - **Selar:** Built-in abandoned checkout emails — enable them in settings
  - **Paystack:** Manual follow-up via email/WhatsApp for incomplete payments
  - **Gumroad:** Built-in abandoned checkout emails — enable in settings
- [ ] Share product links on social media (Instagram, Twitter/X, LinkedIn)
- [ ] Post in restaurant/cafe/bakery Facebook groups
- [ ] Share with food bloggers and food influencers for affiliate promotion
- [ ] Monitor sales dashboard daily in the first week

## Platform Comparison

| Feature | Selar | Paystack Storefront | Gumroad |
|---------|-------|-------------------|---------|
| Best for | Africa (NGN, GHS, KES) | Africa (local currencies) | Global (USD) |
| Fees | 5% + ₦100 | 1.5% + ₦100 (local) | 3.9% + $0.30 (free tier: 9%) |
| Affiliates | Built-in marketplace | Not built-in | Gumroad Discover |
| File delivery | Download link | Email download link | Download link |
| Post-purchase redirect | Yes (Custom Success URL) | Via email + optional redirect | Yes (Custom Redirect URL) |
| Variants/tiers | Yes (variants) | Yes (product options) | Yes (Multiple Versions) |
| Monthly fee | None | None | $10/month (or 9% per sale on free) |
| Payout | Weekly (NGN), on-demand | Daily (NGN, GHS, ZAR, USD) | 7-day rolling |

## Notes

- ZIP is 4.7 MB — well under Selar (100 MB), Paystack (no explicit limit), and Gumroad (20 GB) limits
- All templates are editable in **Canva Free** — no paid Canva account required
- Instructions are in English, optimised for restaurant owners globally
- Buyers get lifetime access and all future template updates
- 30-day money-back guarantee recommended
- If selling in Nigeria, pricing in Naira (₦) converts roughly: ₦15K Basic / ₦22K Standard / ₦30K Bundle (adjust based on current exchange rate)

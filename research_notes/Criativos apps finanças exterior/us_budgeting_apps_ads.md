# Paid ad creatives of US budgeting / personal-finance organization apps (2024–2026)

Scope: YNAB, Monarch Money, Copilot Money, EveryDollar (Ramsey), Goodbudget, PocketGuard, Simplifi by Quicken, Quicken Classic, Tiller, Lunch Money, Fudget, Honeydue, Zeta, Buddy, Spendee US. Rocket Money is out of scope.

**Method limits (read first).** Research date: 2026-10-10. The sandbox's egress proxy blocked direct access to Meta Ad Library (facebook.com), Google Ads Transparency Center (adstransparency.google.com), the TikTok Ad Library (library.tiktok.com) and Foreplay; each returned "CONNECT tunnel failed, 403 / connect_rejected". WebFetch also failed DNS for brand sites (ynab.com, monarch.com, revenuecat.com). So **nothing here was checked directly in an ad library.** No active-ad counts, start dates or "running 90+ days" claims could be verified. Everything below comes from web-search result snippets: brand landing pages, iSpot.tv TV-spot listings, coupon and affiliate pages, press and podcast summaries. Because full pages couldn't be fetched, quotes are from snippets and should be spot-checked. A human with a normal browser should open the Meta Ad Library and Google ATC links to fill the per-ad catalog.

## Q1. Ads active now in Meta Ad Library / Google Ads Transparency Center, and which have run longest

### Takeaway
Could not be verified. Both libraries were unreachable from this environment, and no third-party mirror (Foreplay, MagicBrief, Motion, adlibrary-type blogs) has published a teardown of these brands in search results. Indirect evidence did turn up for a few brands: Monarch runs Google Search ads to a "Mint alternative" comparison page, YNAB uses Facebook ads that land on campaign pages, and Monarch has run national TV in 2025–2026.

### Cited Findings
- **Monarch on Google Search, verified indirectly:** a search result for Monarch's Mint-alternative comparison page carried Google Ads tracking parameters: `wpsrc=Google+AdWords`, `wpkwn=personal+finance+app`, `wpcid=530755382`, `utm_subcampaign=1358998875455466`. Monarch is bidding on the generic keyword "personal finance app" and sending that traffic to `/compare/mint-alternative`. — [Monarch compare page URL with AdWords params](https://www.monarch.com/compare/mint-alternative?utm_subcampaign=1358998875455466&wpcid=530755382&wpkmatch=b&wpkwid=kwd-84938572286233%3Aloc-190&wpkwn=personal+finance+app&wpscid=1358998875455466&wpsnetn=o&wpsrc=Google+AdWords)
- **YNAB campaign landing pages:** YNAB keeps paid-campaign pages under `ynab.com/campaign/...`. One is "YNAB vs Spreadsheets: Budget Better & Stop Money Stress"; per the snippet, its copy references a user who saw "An ad for YNAB showed up on my Facebook feed" and shows a mobile screenshot of August 2025 spending categories. — [YNAB /campaign/ynab-versus](https://www.ynab.com/campaign/ynab-versus)
- **YNAB ADHD campaign page:** headline "Have ADHD? Worried about money?"; stat "92% report feeling less money stress since using YNAB*", where the asterisk marks a survey-based figure. — [YNAB /campaign/adhd](https://www.ynab.com/campaign/adhd)
- **YNAB homepage (2025):** "worried about money?" / "get good at money" framing, a "Best Budgeting App 2025" badge, and "over 53,000 reviews on the App Store" as social proof. — [ynab.com](https://www.ynab.com/)
- **Monarch national TV (iSpot):** listed spots are "One in Four Couples", "Mark and Sarah" (:30), "Lucy", "Tracking", "Real Control" and "The Most Satisfying Way to Understand Your Money" (:15, dated Feb 2026). iSpot shows about 3,253 national airings in its window, with data running to mid-August 2026. No agency is credited. — [iSpot Monarch brand page](https://www.ispot.tv/brands/D7J/monarch-money); [One in Four Couples](https://www.ispot.tv/ad/BvmQ/monarch-money-one-in-four-couples); [Mark and Sarah](https://www.ispot.tv/ad/B40l/monarch-money-mark-and-sarah); [Real Control](https://www.ispot.tv/ad/B41S/monarch-money-real-control); [Most Satisfying Way](https://www.ispot.tv/ad/g1LA/monarch-money-the-most-satisfying-way-to-understand-your-money)
- **Other brands on TV:** a search for iSpot spots from YNAB, Quicken Simplifi, EveryDollar, Copilot Money and PocketGuard returned none. — [iSpot search context](https://www.ispot.tv/ad/top-spenders)
- **Longevity as a signal (general, not brand-specific):** practitioner guides call longevity in Meta Ad Library "your best proxy for what's actually profitable". — [adlibrary.com DTC Meta ads](https://adlibrary.com/posts/best-dtc-meta-ads-examples-2026)

### Inferences
- Monarch is the only brand with confirmed multi-channel paid media in 2025–2026: Google Search, national linear TV and a large creator program (see Q4). It is the most likely "big spender" in Meta too, but that is unverified.
- YNAB's `/campaign/<angle>` URL pattern (versus spreadsheets, ADHD) suggests angle-specific paid social funnels, with one landing page per creative angle. That is a common Meta pattern.

### Gaps
- Per-ad Meta Ad Library data (copy, start date, variant count, platforms) for every brand. The library was blocked, so a manual pull is needed: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=<brand>`.
- Google ATC creatives for each advertiser (blocked).
- TikTok Creative Center top ads in the finance category (blocked).
- No information found on paid creatives from Goodbudget, Tiller, Lunch Money, Fudget, Zeta, Buddy, Spendee or Quicken Classic. These are likely small spenders or organic/SEO-led, but that is unverified.

## Q2. Recurring hooks and angles in the winning ads

### Takeaway
From landing pages, TV spot titles and offers, five angles recur:
1. **"Mint alternative / Mint is shutting down" migration.** Biggest documented spike in 2023–2024; Monarch still bids on it in Google Search.
2. **Couples / shared finances.** Monarch's main TV theme in 2025–2026.
3. **Money anxiety: "worried about money?", "get good at money".** YNAB.
4. **Versus spreadsheets / niche audiences such as ADHD.** YNAB.
5. **Privacy and no-ads positioning: "you never see an ad", "we never sell your data".** Monarch and Copilot.

The "most satisfying way to understand your money" line shows Monarch moving toward a product-visual / "oddly satisfying" angle in 2026.

### Cited Findings
- **Mint shutdown as a demand shock:** Monarch's signups rose "20 times since the announcement" (CEO in Fast Company). Monarch shipped an open-source Chrome extension to export Mint data, and competitors announced tools and discounts aimed at Mint users. — [Fast Company](https://www.fastcompany.com/90984918/how-the-upstart-financial-tracker-monarch-swooped-in-when-mint-announced-it-was-shutting-down); [TechCrunch Nov 2023](https://techcrunch.com/2023/11/02/personal-finance-monarch-intuit-mint/)
- **Copilot and the Mint news:** founder Andrés Ugarte said they saw "5x the daily signups we get on a normal day", and the announcement day was Copilot's "biggest day ever". — [Ugarte LinkedIn via search](https://www.linkedin.com/posts/andresugarte_copilot-money-as-seen-on-the-new-york-times-activity-7129145421616025600-heVI); [TechCrunch](https://techcrunch.com/?p=2681495)
- **Monarch blog as migration content:** "Mint is shutting down. What should Mint users do now? Thoughts from Mint's first product manager and CEO of Monarch." This is founder-authority framing, since Val Agostino was on Mint's early team. — [Monarch blog](https://www.monarch.com/blog/mint-shutting-down)
- **Monarch's no-ads / privacy line:** "Monarch makes money through a subscription… you never see an ad." It contrasts this with Mint's undismissable "special partner" offers. App Store copy: never sells personal or financial info. — [Monarch Mint-alternative page](https://www.monarch.com/compare/mint-alternative); [App Store](https://apps.apple.com/app/id1459319842)
- **Monarch couples angle:** TV titles "One in Four Couples" and "Mark and Sarah". Landing page positions the app "for couples and professionals to manage spending and investments together", with a warm lifestyle hero photo. — [iSpot](https://www.ispot.tv/ad/BvmQ/monarch-money-one-in-four-couples); [Siiimple landing-page capture](https://siiimple.com/monarch-money/)
- **Monarch control / tracking angle:** TV titles "Real Control" and "Tracking". — [iSpot Real Control](https://www.ispot.tv/ad/B41S/monarch-money-real-control)
- **Copilot positioning:** "No ads. No data resale. A subscription, and nothing else for sale"; machine-learning categorization of every transaction; "Your money, beautifully organized" (site title). — [YesPress profile](https://yespress.io/andres-ugarte); [copilot.money](https://www.copilot.money/)
- **YNAB angles:** money stress ("Worried about money?"), ADHD ("Have ADHD? Worried about money?" plus the 92% stat), versus spreadsheets. — [YNAB ADHD](https://www.ynab.com/campaign/adhd); [YNAB versus](https://www.ynab.com/campaign/ynab-versus)
- **PocketGuard's core hook:** the "In My Pocket" safe-to-spend number, which does the math after bills and goals. Its own comparison content frames it for "anyone who wants to break the habit of overspending". This is a secondary source; no ad was found. — [checkthat.ai](https://checkthat.ai/brands/pocketguard); [PocketGuard blog](https://pocketguard.com/blog/pocketguard-vs-quicken-simplifi/)
- **Honeydue:** couples money app (YC S17). Over 500k registered users when acquired by Mission Lane in 2021; divested into Moneydue, Inc. in 2024. No ad data found. — [Retail Banker Intl](https://www.retailbankerinternational.com/news/mission-lane-buys-honeydue/); [Honeydue About](https://www.honeydue.com/about)

### Inferences
- **The migration angle was the clearest documented "winner" (2023–2024).** It produced 5–20x signup spikes, per founder claims. By 2025–2026 Monarch has moved it into evergreen Search ("personal finance app" leads to the Mint-alternative page) and turned to brand and couples messaging on TV.
- **"No ads / we don't sell your data"** is both product positioning and ad copy for the premium paid apps (Monarch, Copilot, Simplifi). It probably carries over to any paid app competing with free, bank-owned tools.
- **Hooks we were asked about but found no specific ad for:** "I paid off $X debt", zero-based budgeting, AI categorization (beyond Copilot's ML claim), and net-worth tracking. They may exist in Meta, but none could be verified.

### Gaps
- Exact first-3-second hooks and scripts of the video ads. iSpot pages weren't fetched; only titles were seen.
- Variant counts and run length per angle.

## Q3. What the static ads and offers look like

### Takeaway
No static ad images could be viewed. The offers that likely appear in ad copy and on landing pages are well documented:
- **YNAB:** 34-day free trial, no credit card.
- **Monarch:** 7-day trial, plus recurring 50%-off-first-year codes (creator and seasonal), with WELCOME at 30% off on site.
- **Copilot:** 1-month trial, plus referral-extended trials.
- **EveryDollar:** 14-day Premium trial.
- **PocketGuard:** 7-day trial.
- **Simplifi:** 50% off the first year.

### Cited Findings
- **YNAB:** 34-day free trial, no credit card; the rationale is that months have 31 days. Pricing is $14.99/mo, and the annual price is reported as $99 or $109 depending on source and date. — [YNAB trial page](https://www.ynab.com/our-free-34-day-trial); [NerdWallet](https://www.nerdwallet.com/finance/learn/ynab-app-review); [Investor Junkie](https://investorjunkie.com/promotions/ynab/)
- **Monarch codes:**
  - Creator/affiliate codes give 50% off the first year after a 7-day trial: ROB50 (Rob Berger) and WSS50 (Wall Street Survivor).
  - MONARCHVIP takes the annual plan from $99.99 to $49.99.
  - The site itself promoted 30% off with code WELCOME.
  - Seasonal: NEWYEAR2025 ($49.99 first year, Jan 2025, described as returning after a summer run). Aggregators say a New Year 50%-off promo is typical.
  - These sources are coupon/affiliate sites and conflict in places.
  - — [Rob Berger](https://robberger.com/monarch-money-50-discount/); [Wall Street Survivor](https://www.wallstreetsurvivor.com/monarch-money-discounts-promo-codes/); [Slickdeals Jan 2025](https://slickdeals.net/f/18052164-get-50-off-monarch-money-for-first-year-and-7-day-free-trial-49-99); [Slickdeals "Mint alternative 50% off"](https://slickdeals.net/f/17110357-monarch-money-mint-alternative-50-off-first-year-50); [SimplyCodes](https://simplycodes.com/store/monarch.com)
- **Copilot:** "Start your 1-month free trial today". Third-party pricing is about $95/yr or $13/mo. No official discount code; referral codes extend the trial (third-party, low reliability). — [copilot.money](https://www.copilot.money/); [FinCompareLab](https://www.fincomparelab.com/guides/copilot-money-referral-code/)
- **EveryDollar:** "$0.00 today" with a 14-day Premium trial (new US users). Premium is $17.99/mo or $79.99/yr. One anecdotal $59.99 first-year promo. — [Ramsey help](https://everydollar.help.ramseysolutions.com/hc/en-us/articles/21544207900685-EveryDollar-Premium-Subscription-Cost); [Ramsey EveryDollar page](https://www.ramseysolutions.com/ramseyplus/everydollar)
- **PocketGuard:** 7-day trial, then $74.99/yr. **Simplifi:** $3.49/mo for the first year (50% off), then $6.99/mo annual. Pricing conflicts across sources. — [FinCompareLab Simplifi](https://www.fincomparelab.com/reviews/quicken-simplifi-review/); [Marriage Kids and Money](https://marriagekidsandmoney.com/pocketguard-review/)
- **YNAB static/landing visuals:** an in-app screenshot of a month's spending categories (August 2025) and review-count badges. — [YNAB versus](https://www.ynab.com/campaign/ynab-versus)

### Inferences
- "50% off your first year" is Monarch's discount mechanic across channels (creator codes, seasonal and probably paid social). A first-year-half-off anchor next to a short trial looks like the category norm for premium apps. YNAB is the exception: it competes on trial length (34 days) instead of discount.
- Static ads in this category probably lean on app screenshots, review and badge social proof, and price/discount callouts. This is inferred from landing pages; no image was seen.

### Gaps
- Actual static creatives: carousel cards, comparison charts, review-quote images. These need a Meta Ad Library pull.

## Q4. Public case studies, interviews and teardowns of their creative strategy

### Takeaway
No ad-teardown article (Foreplay, MagicBrief, Motion, Marketing Examples, etc.) on these brands surfaced. What's public is founder and strategy material:
- **Monarch:** subscription and no-ads philosophy, Reddit community engagement, Mint-shutdown playbook, and an always-on YouTube creator program of about 319 creators (third-party estimate). Plus national TV in 2025–2026 and a $75M Series B at an $850M valuation in May 2025 to accelerate growth.
- **YNAB:** "Teach, don't sell". Education and content marketing (email course, daily webinars) plus word of mouth have historically been its main engine.
- **Copilot:** mostly organic. Apple featuring, MKBHD coverage and the Mint news drove growth; profitable with over 100k paying subscribers (third-party profile).

### Cited Findings
- **Monarch on Sub Club (RevenueCat):** Val Agostino discusses Mint, why ad-funded products erode user experience, choosing subscription, recommending talking with users on forums like Reddit, and what happened when Mint shut down. — [RevenueCat blog](https://www.revenuecat.com/blog/growth/val-agostino-sub-club-podcast); [Sub Club episode](https://subclub.com/episode/learning-and-profiting-from-black-swan-events-val-agostino-monarch-money)
- **Monarch's creator program:** CreatorDB estimates 319 sponsored creators, with an always-on YouTube program that favors integrated in-content reads. Spend figures are modeled, not billed. — [CreatorDB](https://creatordb.app/brands/monarchmoney.com)
- **Monarch funding:** $75M Series B (Forerunner, FPV) at $850M, to accelerate subscriber growth that "took off" after the Mint shutdown. — [CNBC May 2025](https://www.cnbc.com/2025/05/23/personal-finance-app-monarch-raises-75-million.html); [TechFundingNews](https://techfundingnews.com/personal-finance-app-monarch-rises-with-75m-after-mints-meltdown-a-soonicorn-on-cards/)
- **YNAB / Jesse Mecham:** "Teach, don't sell. That's been the most effective marketing strategy for us." Word of mouth is "our most valuable and cost-effective marketing". — [Adam Mendler interview](https://www.adammendler.com/jesse-mecham/)
- **YNAB early growth:** early Google AdWords for the $9.95 spreadsheet didn't sell. Sales doubled after the landing page was rewritten to teach the method; a 9-day email course followed, then daily webinars (about 5,000 people a month). This is a secondary podcast summary. — [SaaS Club](https://saasclub.io/podcast/jesse-mecham-ynab/)
- **YNAB hiring:** a Senior Growth Marketing Manager posting signals an in-house growth/paid function; details weren't fetched. — [BuiltIn job](https://builtin.com/job/senior-growth-marketing-manager/7114698)
- **Copilot:** the Apple Developer Spotlight says early users asked for no ads and no data selling, which led to the subscription model. Growth came from MKBHD, Apple featuring and the Mint news. — [Apple Developer](https://developer.apple.com/news/?id=m1mmw99d); [YesPress](https://yespress.io/andres-ugarte)

### Inferences
- **Monarch's playbook:** an event-driven migration spike (Mint), captured with founder authority and tools (the export extension), then a scale-up into paid with the Series B: TV, Search on generic and competitor terms, creators with 50%-off codes. Couples and "satisfying" product visuals are the 2026 brand angles.
- **YNAB's playbook:** education-led, with angle-specific campaign landing pages for Meta (anxiety, ADHD, versus spreadsheets) and a generous trial instead of discounts.
- **Copilot's playbook:** product and design-led organic, with Apple and tech-reviewer leverage. It doesn't appear to be a large paid advertiser, though that is unverified.

### Gaps
- Full Sub Club transcript details on Monarch's paid channels, CAC and ROAS (fetch blocked).
- No ROAS, CPI or CAC case studies found for any brand.
- No growth-marketer threads (X/LinkedIn) analyzing these brands' Meta creatives were found.
- No data for Goodbudget, Tiller, Lunch Money, Fudget, Zeta, Buddy, Spendee, Quicken Classic or Simplifi paid creatives.

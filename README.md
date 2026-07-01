# Cycle Care 💗

A gentle period tracker **for a boyfriend who wants to show up and care.**

Most cycle apps are built for the person having the period. This one is built for
*you* — so you know where she is in her cycle, how she might be feeling, and
exactly how to prepare: the right comfort food, warmth, and things she loves,
at the right time of the month.

It's a **Progressive Web App (PWA)**: it runs in the browser, installs to your
iPhone home screen with its own icon, works fully offline, and keeps all data
**private on your device** — nothing is ever uploaded.

---

## ✨ Features

- **Today dashboard** — cycle day, current phase, a live progress ring, a plain-language
  note on how she may be feeling, and a **daily care checklist** tailored to her phase.
- **Calendar** — her whole cycle visualised: period days, predicted next period,
  fertile window, ovulation, and PMS. Predictions get smarter every time you log a period.
- **Care hub**
  - *Phase guide* — what's happening in each phase and how to show up.
  - *Her favourites* — save her comfort foods, cravings, drinks, what helps her feel
    better, and things she loves to do. They surface as 💗 items in the daily plan.
- **Settings** — her name, cycle/period length, an Apple Shortcuts & Calendar reminder
  guide, and one-tap **backup / restore** of your data.
- **Liquid-Glass design** — Apple-style frosted glass, soft animated gradients,
  light & dark mode, and smooth motion. Respects *Reduce Motion*.

On first open, tap the **Calendar** tab and log her most recent period start
date — from then on the Today screen shows her current cycle day, phase, and care
plan. No personal data is stored in the code.

---

## 📱 Put it on your iPhone (2 minutes)

The easiest way is free hosting with **GitHub Pages**:

1. Push this repo to GitHub (already done if you're reading this there).
2. On GitHub: **Settings → Pages → Build and deployment → Source: `Deploy from a branch`**,
   pick your branch and `/ (root)`, then **Save**.
3. Wait ~1 minute. GitHub gives you a URL like
   `https://<your-username>.github.io/health-tracker/`.
4. Open that URL in **Safari** on your iPhone.
5. Tap the **Share** button ⬆️ → **Add to Home Screen**.

Now "Cycle Care" is an app icon on your phone — full-screen, offline, no browser bars.

> Want your own private link instead? [Netlify Drop](https://app.netlify.com/drop) or
> [Vercel](https://vercel.com) both host a static site for free — just drag the folder in.

### Run it locally first (optional)

```bash
# from the project folder
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## 🔔 Reminders (bonus — the Apple Shortcuts idea you asked about)

iPhone limits notifications for home-screen web apps, so the most reliable nudges come
from Apple's own apps. Both take a minute to set up (also shown in the app's Settings tab):

**Option A — Calendar (simplest & most reliable)**
1. Check the app's **Calendar** tab for her *next predicted period* date.
2. In Apple **Calendar**, create an event on that day.
3. Set **Repeat → every 28 days** (or her real average, shown in Settings).
4. Add an **Alert → 2 days before**.
5. Name it: *"Prep for her 💗 — supplies, snacks, heating pad"*.

**Option B — Shortcuts automation (smart)**
1. Open **Shortcuts → Automation → Time of Day**.
2. Add a *Show Notification* / *Send Message to myself* action containing your care
   checklist (e.g. "Fill the hot water bottle, grab her chocolate, plan a cozy night").
3. Point it at the dates from the Calendar tab.

---

## 🗂 Project structure

```
index.html            # app shell + iOS-style glass tab bar
css/styles.css        # the Liquid-Glass design system
js/app.js             # cycle math, phase-aware care plans, all views, storage
sw.js                 # service worker (offline caching)
manifest.webmanifest  # PWA manifest (installable app)
icons/                # app icons  (regenerate: python3 icons/make_icons.py)
```

No build step, no dependencies, no server — just static files.

## 🔒 Privacy

All data (her cycle, your notes, her favourites) is stored only in this browser
via `localStorage`. It never leaves the device. Use **Settings → Export backup**
to keep a copy, and **Import** to move it to another device.

## ⚠️ A note

Cycle Care is a personal companion to help you support your partner — it is **not
medical advice, a diagnostic tool, or a method of contraception**. Every body is
different and predictions are estimates. If she ever has concerns about her health,
please see a doctor.

Made with 💗

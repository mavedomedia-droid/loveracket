# loveracket.com

Static site for A Love Racket, 29 December 2026, Queen's Park, Lagos.
Hosted on Netlify, no build step. Push and it deploys.

## Going live

Everything configurable is in `js/config.js`. Nothing else needs editing.

| Key | What it is |
|---|---|
| `API_URL` | The Apps Script web app `/exec` URL. **Empty means demo mode**, scores stay in the player's browser and nothing reaches the Sheet |
| `TICKET_URL` | The real ticket link. Empty means the Get tickets buttons scroll to the tickets block instead |
| `TROY_URL` | theriskofyou.com, with its UTMs |
| `CUTOFF` | Leaderboard close. Must match `CFG.LR_CUTOFF` in Code.gs |
| `EVENT` | Date, venue, doors, contact email. Used in the footer and the hero |
| `GTM_ID` | GTM container. Loaded from here, not from any HTML file |
| `PIXEL_FROM_PAGE` | `false` means GTM owns the Meta events. `true` means the page fires them itself |
| `SOCIAL` | Footer links. An empty value hides that link rather than breaking it |

## Pages

| Path | File |
|---|---|
| `/` | `index.html` Hero, side attractions, the game, The Risk of You, newsletter, tickets |
| `/play/` | `play/index.html` The game on its own page, with the rules |
| `/privacy/` | `privacy/index.html` Required by Meta for pixel use and by Zoho for the list |
| 404 | `404.html` Served by Netlify from any bad path |

## Scripts

Loaded in the `<head>`: `js/config.js`, which also starts the GTM container.
Loaded before `</body>`: `js/partials.js` then `js/game.js`, in that order.

- `js/config.js` Config, plus the GTM loader
- `js/partials.js` Nav and footer injection, conversion tracking, the newsletter form and the event layer
- `js/game.js` The rally game, the leaderboard and score logging

Nav and footer are injected into `#nav` and `#foot` on every page, so they are
edited once in `partials.js` and never in the HTML.

## Tracking

Conversions are URL based. Each milestone pushes its path into the address bar
with `history.pushState` and puts it straight back, so GA4 counts a page_view
and the visitor sees nothing. Every action also pushes a dataLayer event for
triggers in GTM.

| dataLayer event | Virtual path | Fires when |
|---|---|---|
| `lr_GameStart` | `/played/` | First game of the session |
| `lr_ScoreLogged` | `/played/logged/` | A score is logged. Carries `rank`, `score`, `newBest` |
| `lr_Signup` | `/signed-up/` | Newsletter submitted |
| `lr_TicketClick` | `/out/tickets` | Any Get tickets button |
| `lr_CrossToTroy` | `/out/troy` | Watch the series |

## Backend

One Apps Script web app bound to the Love Racket Google Sheet, answering four
actions: `token`, `board`, `submit`, `signup`. Four tabs: `LR Players`,
`LR Game Log`, `Email Queue`, `LR Contacts`.

The game posts with no `Content-Type` header on purpose. That makes the browser
send `text/plain`, which is CORS safelisted and skips the preflight Apps Script
cannot answer. **Adding a JSON content type breaks it in production** and it
will look like a server fault.

After any edit to `Code.gs`, deploy again: Manage deployments, edit the existing
one, Version: New version. The `/exec` URL keeps serving the old code otherwise.

## Assets

In the repo already:

| File | Used by |
|---|---|
| `logo.webp` | Nav, hero, footer, tickets block, and the game's court watermark |
| `favicon.png` | All four pages |
| `troy-logo.png` | The Risk of You block |
| `logo-email.png` | `Emails.gs` only. PNG because Outlook will not render webp |

Still to add:

| File | Size | Without it |
|---|---|---|
| `og.jpg` | 1200x630 | Every WhatsApp paste of the homepage shows no preview image |
| `og-play.jpg` | 1200x630 | Same for `/play/` |
| `troy-still.jpg` | 3:4 or taller | The series block shows a dashed slot |

Any element with `data-slot` names the file it is waiting for and fills itself
the moment that file exists. No code change when you add one.

After adding the OG images, force a re-scrape at
`developers.facebook.com/tools/debug/` for both URLs. Facebook and WhatsApp
cache a blank preview hard once they have seen one.

## Still outstanding

- `assets/og.jpg` at 1200x630 does not exist yet. Until it does, every WhatsApp
  paste of the link shows no preview image
- `TICKET_URL` is empty, pending the ticketing provider
- The prize is referenced four times on the page and never named

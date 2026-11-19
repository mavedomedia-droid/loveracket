/* Love Racket config.
   This is the only file you edit to take the site live. Paste the Apps Script
   web app URL into API_URL and everything below it starts working.
   Names mirror CFG in Code.gs so the two stay readable side by side. */
window.LR_CONFIG = {

  /* ---- the one required value ---- */
  API_URL: 'https://script.google.com/macros/s/AKfycbzPG_tZ1clC4H-hQ1zlRvQzPjFyAtjeyd6GRY80ycXhDuz_gsbBR3pnOWNfFT-p-OCU/exec',

  /* ---- links ---- */
  TICKET_URL: '',       // the real ticket link. Empty = the Get tickets buttons scroll to #tickets instead
  TROY_URL:   'https://theriskofyou.com/?utm_source=loveracket&utm_medium=site&utm_campaign=cross',

  /* ---- the event. Must match CFG.LR_CUTOFF and CFG.LR_EVENT in Code.gs ---- */
  CUTOFF: '2026-12-27T12:00:00+01:00',   // leaderboard closes
  EVENT: {
    date:  '29 December 2026',
    venue: "Queen's Park, Lagos",
    doors: 'From 2PM',
    email: 'info@loveracket.com'
  },

  /* ---- tracking ---- */
  GTM_ID: 'GTM-WGDXSF63',   // Love Racket container. Empty = no container loads. GA4 and the Meta pixel live inside it
  PIXEL_FROM_PAGE: false,   // false = GTM fires the Meta events off the dataLayer. true = the page fires them itself

  /* ---- social, shown in the footer. Leave a value empty to hide that icon ---- */
  SOCIAL: {
    instagram: '',
    tiktok:    '',
    x:         ''
  },

  /* ---- the game court on phones. All four are pixels; null keeps the CSS default ---- */
  COURT: {
    side:     8,    // how close the court gets to each screen edge
    gapBelow: 18,   // breathing room between the court bottom and the fold
    navH:     54,   // the sticky nav's height
    hudH:     52    // the score / chemistry / lives row
  },

  /* ---- internal ---- */
  POLL_MS: 20000,                                      // leaderboard refresh
  LOGO: (window.LR_BASE || '') + 'assets/logo.webp'
};

/* Loads the GTM container from GTM_ID above. This file sits in the <head> of every
   page, so the container still loads early, before the rest of the site scripts.
   dataLayer is created here first, so nothing pushed later is lost. */
(function (w, d, i) {
  w.dataLayer = w.dataLayer || [];
  if (!i) return;
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  var f = d.getElementsByTagName('script')[0], j = d.createElement('script');
  j.async = true;
  j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
  f.parentNode.insertBefore(j, f);
})(window, document, window.LR_CONFIG.GTM_ID);

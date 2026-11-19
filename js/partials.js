/* Love Racket site shell. Nav and footer partials, tracking, newsletter layer.
   Loads before game.js, which calls LR.track(). */
window.LR = (function () {
  var B = window.LR_BASE || '';
  var C = window.LR_CONFIG;

  /* ---------- tracking ----------
     Conversions stay URL based. Each milestone pushes its own path into the
     address bar so GA4 counts a page_view on the history change, then puts the
     path back so the visitor never sees it. Meta does not read pushState, so a
     standard event goes alongside it. Both are one call here. */
  var FB = { Signup: 'Lead', TicketClick: 'InitiateCheckout', ScoreLogged: 'SubmitApplication',
             GameStart: 'ViewContent', CrossToTroy: 'ViewContent' };

  /* Three independent sends. Each gets its own try, so one failing never
     silences the other two. pushState throws on file:// and in some embedded
     webviews, and that must not take the dataLayer event down with it. */
  function track(name, path, params) {
    /* 1. the path. Pushed in, counted, pulled straight back, so the visitor
          never sees it and GA4 still logs a page_view at the conversion URL. */
    if (path) {
      try {
        var back = location.pathname + location.search;
        history.pushState({ lr: name }, '', path);
        if (window.gtag) gtag('event', 'page_view', { page_path: path });
        history.replaceState({}, '', back);
      } catch (e) {
        if (window.gtag) try { gtag('event', 'page_view', { page_path: path }); } catch (e2) {}
      }
    }
    /* 2. the dataLayer event, for your own triggers in GTM. Named lr_<Action>,
          carrying lr_path plus whatever that action knows about itself. */
    try {
      (window.dataLayer = window.dataLayer || []).push(
        Object.assign({ event: 'lr_' + name, lr_path: path || '' }, params || {}));
    } catch (e) {}
    /* 3. Meta. Off by default, because GTM should own which standard event
          each action maps to. Flip PIXEL_FROM_PAGE to fire it here instead. */
    try {
      if (C.PIXEL_FROM_PAGE && window.fbq && FB[name]) fbq('track', FB[name], params || {});
    } catch (e) {}
  }

  /* ---------- partials ---------- */
  var LINKS = [
    { href: B + 'index.html#attractions', label: 'Attractions' },
    { href: B + 'play/index.html',        label: 'Play', play: true },
    { href: B + 'index.html#series',      label: 'The series' }
  ];

  function navHTML() {
    var l = LINKS.map(function (x) {
      return '<a href="' + x.href + '"' + (x.play ? ' class="np"' : '') + '>' + x.label + '</a>';
    }).join('');
    return '<div class="wrap">' +
      '<a href="' + B + 'index.html" aria-label="Love Racket home"><img class="lg" alt="Love Racket" src="' + C.LOGO + '"></a>' +
      '<nav class="navlinks" aria-label="Main">' + l + '</nav>' +
      '<a class="btn y tix-link" href="#">Get tickets</a>' +
      '</div>';
  }

  function social() {
    var S = C.SOCIAL || {}, out = '';
    if (S.instagram) out += '<a href="' + S.instagram + '" rel="noopener">Instagram</a>';
    if (S.tiktok)    out += '<a href="' + S.tiktok + '" rel="noopener">TikTok</a>';
    if (S.x)         out += '<a href="' + S.x + '" rel="noopener">X</a>';
    return out;
  }

  function footHTML() {
    var l = LINKS.map(function (x) { return '<a href="' + x.href + '">' + x.label + '</a>'; }).join('');
    return '<img class="lgf" alt="Love Racket" src="' + C.LOGO + '">' +
      '<div class="fnav">' + l + '</div>' +
      '<p>' + C.EVENT.date + ' · ' + C.EVENT.venue + ' · Doors ' + C.EVENT.doors + '</p>' +
      '<p style="margin-top:6px">A Boxonia Blueprint experience. Event management by Downtown Promotions.</p>' +
      '<div class="fl"><a href="mailto:' + C.EVENT.email + '">' + C.EVENT.email + '</a>' +
      '<a href="' + B + 'privacy/index.html">Privacy</a>' +
      '<a href="' + B + 'index.html#series">The Risk of You</a>' + social() + '</div>';
  }

  function mount() {
    var n = document.getElementById('nav'), f = document.getElementById('foot');
    if (n) n.innerHTML = navHTML();
    if (f) f.innerHTML = footHTML();
    document.querySelectorAll('.tix-link').forEach(function (a) {
      a.href = C.TICKET_URL || (B + 'index.html#tickets');
      a.addEventListener('click', function () { track('TicketClick', '/out/tickets'); });
    });
    document.querySelectorAll('.troy-link').forEach(function (a) {
      a.href = C.TROY_URL;
      a.addEventListener('click', function () { track('CrossToTroy', '/out/troy'); });
    });
  }

  /* ---------- event layer ---------- */
  function layer(title, body, cta) {
    var el = document.getElementById('layer');
    el.querySelector('h3').textContent = title;
    el.querySelector('p').textContent = body;
    el.querySelector('.btn').textContent = cta || 'Close';
    el.classList.add('on');
    el.querySelector('.btn').focus({ preventScroll: true });
  }
  function closeLayer() { document.getElementById('layer').classList.remove('on'); }

  /* ---------- newsletter ---------- */
  function wireSignup() {
    var f = document.getElementById('news');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = f.email, v = em.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { em.style.borderColor = 'var(--red)'; em.focus(); return; }
      if (f.company && f.company.value) return;           // honeypot
      em.style.borderColor = '';
      var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Sending';
      var payload = { action: 'signup', email: v.toLowerCase(), cross: !!(f.cross && f.cross.checked), src: location.pathname };
      var done = function () {
        btn.disabled = false; btn.textContent = 'Keep me posted'; f.reset();
        track('Signup', '/signed-up/');
        layer('You are on the list', 'Updates, lineup reveals and other fun stuff are on their way. Nothing else.', 'Back to the party');
      };
      /* Same web app as the game. Code.gs needs one more case in its switch:
         case 'signup': return json_(signup_(d));  until then this runs in demo mode. */
      if (!C.API_URL) { setTimeout(done, 450); return; }
      var fail = function (msg) {
        btn.disabled = false; btn.textContent = 'Keep me posted';
        layer('That did not send', msg || ('Check your connection and try again, or email ' + C.EVENT.email + '.'), 'Close');
      };
      /* Apps Script answers 200 even for an action it does not know, so a resolved
         fetch is not success. Read ok off the body before telling anyone they are in. */
      fetch(C.API_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (r) { if (r && r.ok) done(); else fail(r && r.error); })
        .catch(function () { fail(); });
    });
  }

  function boot() {
    mount(); wireSignup();
    var el = document.getElementById('layer');
    if (el) {
      el.querySelector('.btn').addEventListener('click', closeLayer);
      el.querySelector('.x').addEventListener('click', closeLayer);
      el.addEventListener('click', function (e) { if (e.target === el) closeLayer(); });
      addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLayer(); });
    }
    /* lineup photos are optional. Drop a file into assets/lineup/ and it shows,
       otherwise the card falls back to its initial. Images can finish failing
       before this runs, so check the already-loaded state as well as the event. */
    document.querySelectorAll('[data-slot] img, .act .ph img').forEach(function (i) {
      var drop = function () { i.remove(); };
      i.addEventListener('error', drop);
      if (i.complete && !i.naturalWidth) drop();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { track: track, layer: layer, close: closeLayer };
})();

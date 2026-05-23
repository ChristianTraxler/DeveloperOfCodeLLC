/* ──────────────────────────────────────────────────────────────
   PWA standalone behaviors — only active when the site is launched
   from the home screen (installed PWA), never in a normal browser tab.

   1. Keep internal navigations inside the app's own webview, instead
      of iOS popping an in-app Safari sheet (the one with a Done/X).
   2. Swipe the slide-in sidebar: left-edge swipe-right opens it,
      swipe-left closes it (snap on threshold).
   ────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var standalone =
        window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

    if (!standalone) return;

    /* ── 1. Keep internal links inside the standalone web app ──
       A normal <a> navigation in an iOS home-screen app opens an in-app
       Safari sheet. Routing same-origin navigations through location.href
       keeps them in the app's own view. External / new-window / native
       links are left untouched so they still open where they should. */
    document.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;

        if (a.target === '_blank') return;                  // explicit new window
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#') return;        // in-page anchor
        if (/^(mailto:|tel:|sms:)/i.test(href)) return;     // native handlers
        if (a.protocol !== 'http:' && a.protocol !== 'https:') return;
        if (a.origin !== window.location.origin) return;    // external → Safari

        e.preventDefault();
        window.location.href = a.href;
    }, false);

    /* ── 2. Swipe the slide-in sidebar (snap on threshold) ── */
    var sidebar = document.getElementById('navSidebar');
    var overlay = document.getElementById('navOverlay');
    if (!sidebar || !overlay) return;                       // page has no sidebar
    var toggle = document.getElementById('navToggle');

    var EDGE = 30;          // px from the left edge that starts an open-swipe
    var THRESHOLD = 60;     // px of horizontal travel needed to trigger
    var OFF_AXIS = 0.6;     // dy/dx ratio above which it's treated as a scroll
    var startX = 0, startY = 0, tracking = false, opening = false;

    function offCanvas() { return window.innerWidth <= 1280; }
    function isOpen() { return sidebar.classList.contains('open'); }

    function openNav() {
        sidebar.classList.add('open');
        if (toggle) toggle.classList.add('open');
        overlay.classList.add('active');
    }
    function closeNav() {
        sidebar.classList.remove('open');
        if (toggle) toggle.classList.remove('open');
        overlay.classList.remove('active');
    }

    document.addEventListener('touchstart', function (e) {
        if (!offCanvas() || e.touches.length !== 1) { tracking = false; return; }
        var t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        if (!isOpen() && startX <= EDGE) { tracking = true; opening = true; }
        else if (isOpen()) { tracking = true; opening = false; }
        else { tracking = false; }
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        if (Math.abs(dx) < THRESHOLD) return;               // not far enough
        if (Math.abs(dy) > Math.abs(dx) * OFF_AXIS) return; // mostly vertical
        if (opening && dx > 0) openNav();
        else if (!opening && dx < 0) closeNav();
    }, { passive: true });
})();

/* ──────────────────────────────────────────────────────────────
   Footer status badge.

   Builds the pill itself and appends it to the sidebar's .nav-footer,
   below the "Veteran Owned" badge, so the markup lives in one place
   instead of being copy-pasted across every page with a sidebar. The
   sidebar is persistent, so status is visible without scrolling to the
   bottom of the page. Purely additive: if this script never loads, the
   sidebar is exactly what it was before.

   State comes from /api/status (a same-origin proxy in front of the
   Better Stack status page — see api/status.mjs). Until that answers,
   and if it never does, the badge stays neutral: it never claims a
   health it hasn't confirmed.
   ────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var STATUS_URL = 'https://status.developerofcode.com';

    /* Visible text per state. The accessible name is built from the same
       words, so the dot's colour is never the only carrier of meaning. */
    var LABELS = {
        operational: 'All systems operational',
        degraded: 'Degraded performance',
        downtime: 'Service disruption',
        maintenance: 'Under maintenance',
        unknown: 'Status'
    };

    var navFooter = document.querySelector('.nav-footer');
    if (!navFooter) return;

    var badge = document.createElement('a');
    badge.className = 'status-badge';
    badge.target = '_blank';
    badge.rel = 'noopener noreferrer';

    var dot = document.createElement('span');
    dot.className = 'status-badge-dot';
    dot.setAttribute('aria-hidden', 'true');

    var label = document.createElement('span');
    label.className = 'status-badge-label';

    badge.appendChild(dot);
    badge.appendChild(label);

    function render(state, url) {
        var text = LABELS[state] || LABELS.unknown;
        badge.setAttribute('data-state', state);
        badge.href = url || STATUS_URL;
        label.textContent = text;
        badge.setAttribute(
            'aria-label',
            (state === 'unknown' ? 'Service status' : 'Service status: ' + text) +
                ' — opens the status page'
        );
    }

    /* Render neutral first so the badge is present and clickable even if
       the fetch is slow or fails outright. */
    render('unknown', STATUS_URL);

    /* Last item in the sidebar, centered under the copyright line. */
    navFooter.appendChild(badge);

    fetch('/api/status', { headers: { Accept: 'application/json' } })
        .then(function (res) {
            return res.ok ? res.json() : null;
        })
        .then(function (data) {
            if (!data || !data.state) return;
            render(data.state, data.url);
        })
        .catch(function () {
            /* Leave the neutral badge in place. */
        });
})();

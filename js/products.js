(function() {
    'use strict';

    // ── Mobile Navigation ──
    const toggle = document.getElementById('navToggle');
    const sidebar = document.getElementById('navSidebar');
    const overlay = document.getElementById('navOverlay');

    function openNav() {
        sidebar.classList.add('open');
        toggle.classList.add('open');
        overlay.classList.add('active');
    }

    function closeNav() {
        sidebar.classList.remove('open');
        toggle.classList.remove('open');
        overlay.classList.remove('active');
    }

    toggle.addEventListener('click', function() {
        sidebar.classList.contains('open') ? closeNav() : openNav();
    });

    overlay.addEventListener('click', closeNav);

    document.querySelectorAll('.nav-links a').forEach(function(link) {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) closeNav();
        });
    });

    // ── Scroll to Top Button ──
    var scrollTopBtn = document.getElementById('scrollTop');

    window.addEventListener('scroll', function() {
        if (window.scrollY > 400) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    }, { passive: true });

    scrollTopBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ── Product Filter Pills ──
    const pills = document.querySelectorAll('.filter-pill');
    const cards = document.querySelectorAll('.product-card');

    pills.forEach(function(pill) {
        pill.addEventListener('click', function() {
            pills.forEach(function(p) { p.classList.remove('active'); });
            pill.classList.add('active');
            const filter = pill.dataset.filter;
            cards.forEach(function(card) {
                if (filter === 'all' || card.dataset.category === filter) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
})();

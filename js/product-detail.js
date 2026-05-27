(function() {
    'use strict';

    // ── Mobile Navigation ──
    var toggle = document.getElementById('navToggle');
    var sidebar = document.getElementById('navSidebar');
    var overlay = document.getElementById('navOverlay');

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

    if (toggle && sidebar && overlay) {
        toggle.addEventListener('click', function() {
            sidebar.classList.contains('open') ? closeNav() : openNav();
        });
        overlay.addEventListener('click', closeNav);
        document.querySelectorAll('.nav-links a').forEach(function(link) {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) closeNav();
            });
        });
    }

    // ── Scroll to Top ──
    var scrollTopBtn = document.getElementById('scrollTop');
    if (scrollTopBtn) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        }, { passive: true });

        scrollTopBtn.addEventListener('click', function() {
            var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }

    // ── Scroll reveal animations ──
    var reveals = document.querySelectorAll('.pd-reveal');
    if ('IntersectionObserver' in window && reveals.length) {
        var io = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        reveals.forEach(function(el) { io.observe(el); });
    } else {
        reveals.forEach(function(el) { el.classList.add('in'); });
    }

    // ── Image lightbox ──
    var zoomables = document.querySelectorAll('.pd-shot img, .pd-visual-inner img');
    if (zoomables.length) {
        zoomables.forEach(function(img) {
            img.classList.add('pd-zoomable');
            img.setAttribute('tabindex', '0');
            img.setAttribute('role', 'button');
            img.setAttribute('aria-label', 'Open larger view of ' + (img.alt || 'image'));
        });

        // Build lightbox DOM once
        var lightbox = document.createElement('div');
        lightbox.className = 'pd-lightbox';
        lightbox.setAttribute('role', 'dialog');
        lightbox.setAttribute('aria-modal', 'true');
        lightbox.setAttribute('aria-label', 'Image preview');
        lightbox.innerHTML =
            '<button type="button" class="pd-lightbox-close" aria-label="Close preview">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
            '<img class="pd-lightbox-img" alt="">' +
            '<div class="pd-lightbox-caption" hidden></div>';
        document.body.appendChild(lightbox);

        var lbImg = lightbox.querySelector('.pd-lightbox-img');
        var lbCaption = lightbox.querySelector('.pd-lightbox-caption');
        var lbClose = lightbox.querySelector('.pd-lightbox-close');
        var lastFocus = null;

        function openLightbox(img) {
            lastFocus = document.activeElement;
            lbImg.src = img.currentSrc || img.src;
            lbImg.alt = img.alt || '';
            if (img.alt) {
                lbCaption.textContent = img.alt;
                lbCaption.hidden = false;
            } else {
                lbCaption.hidden = true;
            }
            lightbox.classList.add('open');
            document.body.classList.add('pd-lightbox-open');
            requestAnimationFrame(function() { lightbox.classList.add('visible'); });
            lbClose.focus();
        }

        function closeLightbox() {
            lightbox.classList.remove('visible');
            document.body.classList.remove('pd-lightbox-open');
            var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            var delay = reduceMotion ? 0 : 200;
            setTimeout(function() {
                lightbox.classList.remove('open');
                lbImg.src = '';
                if (lastFocus && typeof lastFocus.focus === 'function') {
                    lastFocus.focus();
                }
            }, delay);
        }

        zoomables.forEach(function(img) {
            img.addEventListener('click', function() { openLightbox(img); });
            img.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLightbox(img);
                }
            });
        });

        lbClose.addEventListener('click', closeLightbox);
        lbImg.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
        });
    }
})();

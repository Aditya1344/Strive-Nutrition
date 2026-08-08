/* ==========================================================================
   Strive Nutrition — section behavior
   Rewritten from the prototype's single inline <script> into small,
   idempotent, re-initializable modules so sections survive add/remove/
   reorder in the theme editor (Shopify fires shopify:section:load on every
   add + reorder, not just on first paint).
   ========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reveal on scroll ---------- */
  function initReveal(root) {
    var revs = root.querySelectorAll('.sv-rv:not([data-sv-observed])');
    if (!revs.length) return;
    if ('IntersectionObserver' in window && !reduce) {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('sv-in'); ro.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
      revs.forEach(function (el) { el.setAttribute('data-sv-observed', '1'); ro.observe(el); });
    } else {
      revs.forEach(function (el) { el.setAttribute('data-sv-observed', '1'); el.classList.add('sv-in'); });
    }
  }

  /* ---------- hero product stage: 1 -> 2 -> 3 SKU rotation ---------- */
  function initHeroStage(section) {
    var stage = section.querySelector('[data-sv-hstage]');
    if (!stage || stage.hasAttribute('data-sv-init')) return;
    stage.setAttribute('data-sv-init', '1');
    var slides = [].slice.call(stage.querySelectorAll('.sv-hslide'));
    var dots = [].slice.call(section.querySelectorAll('[data-sv-hdots] button'));
    var i = 0, timer = null;

    function go(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, idx) { s.classList.toggle('sv-on', idx === i); });
      dots.forEach(function (d, idx) { d.classList.toggle('sv-on', idx === i); });
    }
    function play() { if (!timer && !reduce && slides.length > 1) timer = setInterval(function () { go(i + 1); }, 3800); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach(function (d, idx) { d.addEventListener('click', function () { stop(); go(idx); play(); }); });
    stage.addEventListener('mouseenter', stop);
    stage.addEventListener('mouseleave', play);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? play() : stop(); });
      }, { threshold: 0.2 }).observe(stage);
    } else { play(); }
  }

  /* ---------- sticky mobile CTA: hide once its target section is on screen ---------- */
  function initSticky() {
    var sticky = document.querySelector('[data-sv-sticky]');
    if (!sticky || sticky.hasAttribute('data-sv-init')) return;
    sticky.setAttribute('data-sv-init', '1');
    var targetSel = sticky.getAttribute('data-sv-sticky-target');
    var target = targetSel ? document.querySelector(targetSel) : null;
    if (!target || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { sticky.style.display = e.isIntersecting ? 'none' : ''; });
    }, { threshold: 0.15 }).observe(target);
  }

  /* ---------- header shrink on scroll ---------- */
  function initHeaderScroll() {
    var hdr = document.querySelector('[data-sv-header]');
    if (!hdr) return;
    var raf = null;
    function frame() {
      raf = null;
      hdr.classList.toggle('sv-up', (window.scrollY || window.pageYOffset) > 90);
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    frame();
  }

  /* ---------- init a scope (whole doc on load, single section on editor events) ---------- */
  function initScope(scope) {
    initReveal(scope);
    (scope.matches && scope.matches('[data-sv-hero]') ? [scope] : scope.querySelectorAll('[data-sv-hero]'))
      .forEach && [].slice.call(scope.matches('[data-sv-hero]') ? [scope] : scope.querySelectorAll('[data-sv-hero]')).forEach(initHeroStage);
    initSticky();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initScope(document);
    initHeaderScroll();
  });

  /* Theme editor: re-init only the section that changed, and re-arm reveal
     immediately (no scroll needed) so edited content is visible right away. */
  document.addEventListener('shopify:section:load', function (evt) {
    initScope(evt.target);
    evt.target.querySelectorAll('.sv-rv').forEach(function (el) { el.classList.add('sv-in'); });
  });
  document.addEventListener('shopify:section:reorder', function () { initSticky(); });
  document.addEventListener('shopify:block:select', function (evt) {
    var card = evt.target.closest('.sv-combo, .sv-tier, .sv-card, .sv-rcard');
    if (card) card.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  });
})();

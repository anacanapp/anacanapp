/* Adds the Azerbaijani shop links (Kitablar, Tortlar) to the anacan.az header and footer navigation.
   Runs after hydration and re-adds the links if the header is re-rendered. Azerbaijani pages only. */
(function () {
  'use strict';
  if (!/^\/az\//.test(location.pathname)) return;
  var LINKS = [['/az/kitablar/', 'Kitablar'], ['/az/tortlar/', 'Tortlar']];
  function add() {
    var targets = document.querySelectorAll('.site-nav-links, .site-footer-top nav');
    for (var i = 0; i < targets.length; i++) {
      var nav = targets[i];
      if (nav.querySelector('[data-anacan-shop]')) continue;
      for (var j = 0; j < LINKS.length; j++) {
        var a = document.createElement('a');
        a.href = LINKS[j][0]; a.textContent = LINKS[j][1]; a.setAttribute('data-anacan-shop', '');
        if (location.pathname.indexOf(LINKS[j][0]) === 0) a.setAttribute('aria-current', 'page');
        nav.appendChild(a);
      }
    }
  }
  function start() {
    add();
    var header = document.querySelector('.site-nav-wrap');
    if (header && 'MutationObserver' in window) new MutationObserver(function () { add(); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 400); });
  else setTimeout(start, 400);
})();

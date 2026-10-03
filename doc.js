(function () {
  var links = [].slice.call(document.querySelectorAll('nav a'));
  var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var nav = document.querySelector('nav'), cur = -1, ticking = false;
  function update() {
    ticking = false;
    var y = 90, idx = 0;
    for (var i = 0; i < heads.length; i++) { if (heads[i] && heads[i].getBoundingClientRect().top <= y) idx = i; else if (heads[i]) break; }
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) idx = heads.length - 1;
    if (idx === cur) return;
    cur = idx;
    links.forEach(function (a, i) { a.classList.toggle('active', i === idx); });
    var a = links[idx], top = a.offsetTop, h = a.offsetHeight;
    if (top < nav.scrollTop + 8) nav.scrollTop = top - 24;
    else if (top + h > nav.scrollTop + nav.clientHeight - 8) nav.scrollTop = top + h - nav.clientHeight + 24;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

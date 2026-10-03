(function () {
  var links = [].slice.call(document.querySelectorAll('nav a'));
  var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var groups = [].slice.call(document.querySelectorAll('nav .grp'));
  var nav = document.querySelector('nav'), cur = -1, curGroup = null, ticking = false;

  function setOpen(g, open) { g.classList.toggle('open', open); }
  nav.addEventListener('click', function (e) {
    var t = e.target.closest('button.tg');
    if (t) setOpen(t.closest('.grp'), !t.closest('.grp').classList.contains('open'));
  });

  function update() {
    ticking = false;
    var y = 90, idx = 0;
    for (var i = 0; i < heads.length; i++) { if (heads[i] && heads[i].getBoundingClientRect().top <= y) idx = i; else if (heads[i]) break; }
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) idx = heads.length - 1;
    if (idx === cur) return;
    cur = idx;
    links.forEach(function (a, i) { a.classList.toggle('active', i === idx); });
    var a = links[idx], g = a.closest('.grp');
    if (g !== curGroup) { curGroup = g; groups.forEach(function (x) { setOpen(x, x === g); }); }
    // keep the active link in view once the open/close animation has settled
    setTimeout(function () {
      var top = a.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop, h = a.offsetHeight;
      if (top < nav.scrollTop + 8) nav.scrollTop = top - 24;
      else if (top + h > nav.scrollTop + nav.clientHeight - 8) nav.scrollTop = top + h - nav.clientHeight + 24;
    }, 230);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

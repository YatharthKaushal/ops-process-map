(function () {
  'use strict';
  var P = window.PROCESS;
  var CELL_W = 244, NODE_W = 200, LANE_H = 136, GUTTER = 230, BANNER_H = 52, HEAD_H = 84, GAP = 150, PAD = 60;
  var TOP_PAD = BANNER_H + HEAD_H; // lanes start this far below a section's top
  var SVGNS = 'http://www.w3.org/2000/svg';

  var $ = function (s) { return document.querySelector(s); };
  var view = $('#view'), world = $('#world'), nodesEl = $('#nodes'), edgesEl = $('#edges'), panel = $('#panel');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svg(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function div(cls, style, html) { var d = document.createElement('div'); d.className = cls; if (style) d.style.cssText = style; if (html != null) d.innerHTML = html; return d; }

  /* ------------------------------------------------------------ index */
  var byId = {}, nodes = P.nodes, edges = P.edges, laneLabels = [], banners = [];
  nodes.forEach(function (n) { byId[n.id] = n; });
  var edgeById = {};
  edges.forEach(function (e) { edgeById[e.id] = e; e.section = byId[e.from] ? byId[e.from].section : 'manual'; });
  var storeLabel = {};
  nodes.forEach(function (n) { if (n.type === 'store') storeLabel[n.id] = n.label; });

  /* ------------------------------------------------------------ integrity */
  function check() {
    var err = [], warn = [], cells = {}, ids = {};
    nodes.forEach(function (n) {
      if (ids[n.id]) err.push('duplicate node id ' + n.id); ids[n.id] = 1;
      if (!P.stages[n.stage]) err.push('bad stage ' + n.id);
      if (!P.lanes[n.lane]) err.push('bad lane ' + n.id);
      var key = n.section + ':' + n.stage + ':' + n.sub + ':' + n.lane;
      if (cells[key]) err.push('cell clash ' + n.id + ' / ' + cells[key]); else cells[key] = n.id;
      (n.pains || []).forEach(function (q) { if (!P.pains[q]) err.push('unknown pain ' + q + ' on ' + n.id); });
      (n.automations || []).forEach(function (a) { if (!P.automations[a]) err.push('unknown automation ' + a + ' on ' + n.id); });
      (n.replaces || []).forEach(function (r) { if (!byId[r] || byId[r].section !== 'manual' || n.section !== 'auto') err.push('bad replaces ' + r + ' on ' + n.id); });
      if (n.touch && !(byId[n.touch.doc] && byId[n.touch.doc].type === 'store')) err.push('bad touch doc on ' + n.id);
      (n.reads || []).forEach(function (r) { if (!(byId[r] && byId[r].type === 'store')) err.push('bad reads ' + r + ' on ' + n.id); });
      (n.features || []).forEach(function (f) { if (!(byId[f] && byId[f].type === 'feature')) err.push('bad feature ' + f + ' on ' + n.id); });
      (n.users || []).forEach(function (u) { if (!byId[u] || byId[u].section !== n.section) err.push('bad feature user ' + u + ' on ' + n.id); });
    });
    var seen = {};
    edges.forEach(function (e) {
      if (!byId[e.from] || !byId[e.to]) err.push('edge endpoint ' + e.id);
      else if (byId[e.from].section !== byId[e.to].section) err.push('edge crosses sections ' + e.id);
      if (seen[e.id]) err.push('dup edge ' + e.id); seen[e.id] = 1;
    });
    var replaced = {};
    nodes.forEach(function (n) { (n.replaces || []).forEach(function (r) { replaced[r] = true; }); });
    nodes.forEach(function (n) { if (n.section === 'manual' && !replaced[n.id]) warn.push('manual node with no automated replacement: ' + n.id); });
    return { errors: err, warnings: warn };
  }
  var integrity = check();
  window.__integrity = integrity;
  if (integrity.errors.length) console.error('Process data errors:\n' + integrity.errors.join('\n'));

  /* ------------------------------------------------------------ layout */
  var subs = P.stages.map(function () { return 1; });
  nodes.forEach(function (n) { subs[n.stage] = Math.max(subs[n.stage], n.sub + 1); });
  var stageX = [], x = GUTTER;
  P.stages.forEach(function (s, i) { stageX[i] = x; x += subs[i] * CELL_W; });
  var TOTAL_W = x + PAD;
  var SEC_H = TOP_PAD + P.lanes.length * LANE_H;
  var secTop = { manual: 0, auto: SEC_H + GAP };
  var TOTAL_H = secTop.auto + SEC_H;

  var SIZE = { feature: [NODE_W + 20, 72], decision: [232, 118], trigger: [NODE_W, 54], store: [NODE_W, 60] };
  nodes.forEach(function (n) {
    var s = SIZE[n.type] || [NODE_W, 72];
    n.w = s[0]; n.h = s[1];
    n.cx = stageX[n.stage] + (n.sub + 0.5) * CELL_W;
    n.cy = secTop[n.section] + TOP_PAD + (n.lane + 0.5) * LANE_H;
  });

  /* ------------------------------------------------------------ backdrop */
  function backdrop() {
    P.stages.forEach(function (s, i) {
      var b = div('band' + (i % 2 ? ' alt' : ''), 'left:' + stageX[i] + 'px;top:' + (BANNER_H + 4) + 'px;width:' + subs[i] * CELL_W + 'px;height:' + (TOTAL_H - BANNER_H - 4) + 'px');
      nodesEl.appendChild(b);
    });
    ['manual', 'auto'].forEach(function (sec) {
      var top = secTop[sec];
      var cnt = nodes.filter(function (n) { return n.section === sec && n.type !== 'store' && n.type !== 'feature'; }).length;
      var human = sec === 'manual' ? nodes.filter(function (n) { return n.section === sec && n.type === 'doc'; }).length : nodes.filter(function (n) { return n.section === sec && n.type === 'approve'; }).length;
      var ban = div('banner ' + sec, 'left:0;top:' + top + 'px;width:' + (TOTAL_W - PAD / 2) + 'px;height:' + BANNER_H + 'px',
        (sec === 'manual' ? 'Current state · manual' : 'Target state · automated') + ' <small>' + cnt + ' steps · ' + human + (sec === 'manual' ? ' human document edits' : ' human approvals / scans') + '</small>');
      banners.push(ban); nodesEl.appendChild(ban);
      P.stages.forEach(function (s, i) {
        nodesEl.appendChild(div('stage-h', 'left:' + (stageX[i] + 10) + 'px;top:' + (top + BANNER_H + 16) + 'px', '<i>' + (i + 1) + '</i>' + esc(s.label)));
      });
      nodesEl.appendChild(div('timearrow', 'left:' + GUTTER + 'px;top:' + (top + BANNER_H + 66) + 'px;width:' + (TOTAL_W - GUTTER - PAD) + 'px'));
      nodesEl.appendChild(div('timelbl', 'left:' + (GUTTER + 2) + 'px;top:' + (top + BANNER_H + 48) + 'px', 'time'));
      P.lanes.forEach(function (l, i) {
        var y = top + TOP_PAD + i * LANE_H;
        nodesEl.appendChild(div('lane-line', 'left:0;top:' + y + 'px;width:' + (TOTAL_W - PAD / 2) + 'px'));
        var lab = l;
        if (i === 8) lab = sec === 'manual' ? 'Docs: Google Sheets / Forms' : 'System of record: Ops Tracker';
        if (i === 9) lab = sec === 'manual' ? 'Screens: none (sheets only)' : 'Screens & portals (features)';
        var ll = div('lane-l', 'left:10px;top:' + y + 'px;height:' + LANE_H + 'px', '<span>' + esc(lab) + '</span>'); laneLabels.push(ll); nodesEl.appendChild(ll);
      });
    });
  }

  /* ------------------------------------------------------------ nodes */
  var VERB = { add: '✎ ADD', edit: '✎ EDIT', update: '✎ UPDATE', approve: '✓ APPROVE', scan: '✓ SCAN' };
  var nodeEl = {};
  function idsShort(ids) { return ids.length > 2 ? ids.slice(0, 2).join(' ') + ' +' + (ids.length - 2) : ids.join(' '); }
  function renderNodes() {
    nodes.forEach(function (n) {
      var el = div('node t-' + n.type + (n.assumed ? ' assumed' : ''), 'left:' + (n.cx - n.w / 2) + 'px;top:' + (n.cy - n.h / 2) + 'px;width:' + n.w + 'px;height:' + n.h + 'px');
      el.setAttribute('data-id', n.id);
      var html = '';
      if (n.type === 'decision') html += '<svg class="shape" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,1.5 98.5,50 50,98.5 1.5,50"/></svg>';
      else html += '<div class="shape"></div>';
      if (n.type === 'store') html += '<span class="bars l"></span><span class="bars r"></span>';
      if (n.type === 'feature') html += '<span class="bars l"></span>';
      html += '<span class="t">' + esc(n.label) + '</span>';
      if (n.touch) html += '<span class="tag">' + VERB[n.touch.verb] + ' · ' + esc(storeLabel[n.touch.doc] || '') + '</span>';
      else if (n.type === 'auto') html += '<span class="tag">⚡ AUTO</span>';
      else if (n.type === 'feature') html += '<span class="tag">▣ SCREEN</span>';
      else if (n.type === 'gap') html += '<span class="tag">✗ NOT RECORDED</span>';
      if (n.assumed) html += '<span class="tag a">ASSUMED</span>';
      if (n.pains && n.pains.length) html += '<span class="pain" title="Pain points">' + n.pains.length + '</span>';
      if (n.automations && n.automations.length && n.type !== 'store') html += '<span class="asm">' + esc(idsShort(n.automations)) + '</span>';
      el.innerHTML = html;
      nodesEl.appendChild(el);
      nodeEl[n.id] = el;
    });
  }

  /* ------------------------------------------------------------ edges */
  function geom(a, b) {
    var dx = b.cx - a.cx, dy = b.cy - a.cy, x0, y0, x1, y1, off;
    if (Math.abs(dx) < 24) {
      var down = dy > 0;
      x0 = a.cx; y0 = a.cy + (down ? a.h / 2 : -a.h / 2); x1 = b.cx; y1 = b.cy + (down ? -b.h / 2 : b.h / 2);
      off = Math.max(24, Math.abs(y1 - y0) / 2) * (down ? 1 : -1);
      return [x0, y0, x0, y0 + off, x1, y1 - off, x1, y1];
    }
    if (dx > 0) {
      x0 = a.cx + a.w / 2; y0 = a.cy; x1 = b.cx - b.w / 2; y1 = b.cy;
      off = Math.max(36, (x1 - x0) / 2);
      return [x0, y0, x0 + off, y0, x1 - off, y1, x1, y1];
    }
    x0 = a.cx; y0 = a.cy + a.h / 2; x1 = b.cx; y1 = b.cy + b.h / 2;
    var drop = Math.min(190, 56 + Math.abs(dx) * 0.1 + Math.abs(dy) * 0.15);
    return [x0, y0, x0, y0 + drop, x1, y1 + drop, x1, y1];
  }
  function bez(g, t) {
    var u = 1 - t;
    return [u * u * u * g[0] + 3 * u * u * t * g[2] + 3 * u * t * t * g[4] + t * t * t * g[6],
            u * u * u * g[1] + 3 * u * u * t * g[3] + 3 * u * t * t * g[5] + t * t * t * g[7]];
  }
  function d(g) { return 'M' + g[0] + ',' + g[1] + ' C' + g[2] + ',' + g[3] + ' ' + g[4] + ',' + g[5] + ' ' + g[6] + ',' + g[7]; }

  var edgeEl = {}, labelEl = {}, linkLayer, labelsEl = document.getElementById('labels');
  function renderEdges() {
    edgesEl.setAttribute('width', TOTAL_W); edgesEl.setAttribute('height', TOTAL_H); labelsEl.setAttribute('width', TOTAL_W); labelsEl.setAttribute('height', TOTAL_H);
    var defs = svg('defs', {});
    [['ar', 'ar'], ['ar-loop', 'ar-loop'], ['ar-on', 'ar-on']].forEach(function (m) {
      var mk = svg('marker', { id: m[0], viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '8', markerHeight: '8', orient: 'auto' });
      mk.appendChild(svg('path', { d: 'M0,1 L10,5 L0,9 z', 'class': m[1] }));
      defs.appendChild(mk);
    });
    edgesEl.appendChild(defs);
    edges.forEach(function (e) {
      var a = byId[e.from], b = byId[e.to], g = geom(a, b);
      var grp = svg('g', { 'class': 'edge' + (e.kind === 'loop' ? ' loop' : '') + (Math.abs(b.cx - a.cx) > 4 * CELL_W ? ' long' : ''), 'data-edge': e.id });
      grp.appendChild(svg('path', { 'class': 'v', d: d(g) }));
      grp.appendChild(svg('path', { 'class': 'hit', d: d(g) }));
      if (e.label) {
        var p = bez(g, a.type === 'decision' ? 0.22 : 0.5), w = e.label.length * 7.8 + 18;
        var lb = svg('g', { 'class': 'lb' + (e.kind === 'loop' ? ' loop' : ''), 'data-edge': e.id });
        lb.appendChild(svg('rect', { x: p[0] - w / 2, y: p[1] - 11, width: w, height: 22, rx: 6 }));
        var t = svg('text', { x: p[0], y: p[1] }); t.textContent = e.label; lb.appendChild(t);
        labelsEl.appendChild(lb); labelEl[e.id] = lb;
      }
      edgesEl.appendChild(grp);
      edgeEl[e.id] = grp;
    });
    linkLayer = svg('g', {}); edgesEl.appendChild(linkLayer);
  }

  /* ------------------------------------------------------------ pan / zoom */
  var T = { x: 0, y: 0, k: 1 }, MINK = 0.07, MAXK = 2.4;
  function apply() {
    world.style.transform = 'translate(' + T.x + 'px,' + T.y + 'px) scale(' + T.k + ')';
    var lx = Math.max(10, -T.x / T.k + 8);
    for (var i = 0; i < laneLabels.length; i++) laneLabels[i].style.left = lx + 'px';
    for (var j = 0; j < banners.length; j++) banners[j].style.paddingLeft = (lx + 8) + 'px';
  }
  function zoomAt(cx, cy, k2) {
    k2 = Math.max(MINK, Math.min(MAXK, k2));
    T.x = cx - (cx - T.x) * (k2 / T.k); T.y = cy - (cy - T.y) * (k2 / T.k); T.k = k2; apply();
  }
  function usable() { var r = view.getBoundingClientRect(); return { w: r.width - (panel.hidden ? 0 : 420), h: r.height }; }
  function fit(bx, by, bw, bh, maxK, animate) {
    var u = usable(), p = 30;
    var k = Math.min((u.w - 2 * p) / bw, (u.h - 2 * p) / bh, maxK || 1.2);
    k = Math.max(MINK, k);
    anim(animate);
    T.k = k; T.x = (u.w - bw * k) / 2 - bx * k; T.y = (u.h - bh * k) / 2 - by * k; apply();
  }
  function anim(on) { if (!on) return; world.classList.add('anim'); setTimeout(function () { world.classList.remove('anim'); }, 420); }
  function centerOn(n) {
    var u = usable(), k = Math.max(T.k, 0.85);
    anim(true);
    T.k = k; T.x = u.w / 2 - n.cx * k; T.y = u.h / 2 - n.cy * k; apply();
  }
  function frameSection(sec) {
    var u = usable(), k = Math.max(0.75, Math.min(1, (u.h - 40) / SEC_H)), cxw = (u.w / 2 - T.x) / T.k;
    anim(true); T.k = k; T.x = u.w / 2 - cxw * k; T.y = (u.h - SEC_H * k) / 2 - secTop[sec] * k; apply();
  }
  function gotoStage(i) {
    var u = usable(), k = T.k < 0.75 ? 0.75 : T.k, cyw = (u.h / 2 - T.y) / T.k;
    anim(true); T.k = k; T.x = 130 - (stageX[i] - 8) * k; T.y = u.h / 2 - cyw * k; apply();
  }
  var fits = {
    all: function () { fit(0, 0, TOTAL_W, TOTAL_H, 1, true); },
    manual: function () { frameSection('manual'); },
    auto: function () { frameSection('auto'); }
  };

  var drag = null, moved = false;
  view.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, tx: T.x, ty: T.y }; moved = false;
  });
  view.addEventListener('dragstart', function (e) { e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { if (drag || !e.target.closest || !e.target.closest('#panel')) e.preventDefault(); });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 4) { moved = true; view.classList.add('drag'); }
    if (moved) { T.x = drag.tx + dx; T.y = drag.ty + dy; apply(); }
  });
  window.addEventListener('pointerup', function () { drag = null; view.classList.remove('drag'); });
  window.addEventListener('pointercancel', function () { drag = null; view.classList.remove('drag'); });
  window.addEventListener('blur', function () { drag = null; view.classList.remove('drag'); });
  view.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = view.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, T.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
  }, { passive: false });

  /* ------------------------------------------------------------ selection */
  var sel = null;
  function clearSel() {
    sel = null; panel.hidden = true; document.body.classList.remove('has-panel');
    Array.prototype.forEach.call(document.querySelectorAll('.dim,.sel,.on,.hl-store'), function (el) { el.classList.remove('dim', 'sel', 'on', 'hl-store'); });
    while (linkLayer.firstChild) linkLayer.removeChild(linkLayer.firstChild);
  }
  function related(kind, id) {
    var ns = {}, es = {};
    if (kind === 'edge') { var e = edgeById[id]; ns[e.from] = ns[e.to] = 1; es[id] = 1; return { ns: ns, es: es }; }
    var n = byId[id]; ns[id] = 1;
    edges.forEach(function (e) { if (e.from === id || e.to === id) { es[e.id] = 1; ns[e.from] = ns[e.to] = 1; } });
    if (n.type === 'store') nodes.forEach(function (m) { if ((m.touch && m.touch.doc === id) || (m.reads && m.reads.indexOf(id) >= 0)) ns[m.id] = 1; });
    if (n.type === 'feature') (n.users || []).forEach(function (u) { ns[u] = 1; });
    (n.features || []).forEach(function (f) { ns[f] = 1; });
    return { ns: ns, es: es };
  }
  function dataLink(from, to) {
    var a = byId[from], b = byId[to], down = b.cy > a.cy;
    var x0 = a.cx, y0 = a.cy + (down ? a.h / 2 : -a.h / 2), x1 = b.cx, y1 = b.cy + (down ? -b.h / 2 : b.h / 2), off = Math.max(40, Math.abs(y1 - y0) / 2) * (down ? 1 : -1);
    linkLayer.appendChild(svg('path', { 'class': 'datalink', d: d([x0, y0, x0, y0 + off, x1, y1 - off, x1, y1]) }));
  }
  function select(kind, id, opts) {
    clearSel();
    sel = { kind: kind, id: id };
    var r = related(kind, id);
    Object.keys(nodeEl).forEach(function (k) { if (!r.ns[k]) nodeEl[k].classList.add('dim'); });
    Object.keys(edgeEl).forEach(function (k) { var on = !!r.es[k]; edgeEl[k].classList.add(on ? 'on' : 'dim'); if (labelEl[k]) labelEl[k].classList.add(on ? 'on' : 'dim'); });
    if (kind === 'node') {
      nodeEl[id].classList.add('sel');
      var n = byId[id];
      if (n.type === 'store') { nodeEl[id].classList.add('hl-store'); nodes.forEach(function (m) { if ((m.touch && m.touch.doc === id) || (m.reads && m.reads.indexOf(id) >= 0)) dataLink(m.id, id); }); }
      else if (n.type === 'feature') { nodeEl[id].classList.add('hl-store'); (n.users || []).forEach(function (u) { dataLink(u, id); }); }
      else { (n.features || []).forEach(function (f) { dataLink(id, f); }); if (n.touch) dataLink(id, n.touch.doc); (n.reads || []).forEach(function (s) { dataLink(id, s); }); }
    } else {
      edgeEl[id].classList.add('sel'); if (labelEl[id]) labelEl[id].classList.add('sel');
      nodeEl[edgeById[id].from].classList.add('sel'); nodeEl[edgeById[id].to].classList.add('sel');
    }
    panel.innerHTML = kind === 'node' ? nodePanel(byId[id]) : edgePanel(edgeById[id]);
    panel.hidden = false; panel.scrollTop = 0; document.body.classList.add('has-panel');
    if (opts && opts.center) centerOn(byId[opts.center]);
  }

  /* ------------------------------------------------------------ panel */
  var TYPE_NAME = { feature: 'Product feature (screen)', trigger: 'Start / end / event', action: 'Manual operation', doc: 'Human edits a tracking doc', decision: 'Decision', external: 'External party', gap: 'Tracking gap', auto: 'Automated operation', approve: 'Human in the loop', store: 'Document / table' };
  function nodeLink(id) { return '<button class="link" data-go="' + esc(id) + '">' + esc(byId[id].label) + '</button>'; }
  function edgeLink(e, other) { return '<button class="link" data-edge="' + esc(e.id) + '">' + (e.label ? '<b>' + esc(e.label) + '</b> · ' : '') + esc(byId[other].label) + '</button>'; }
  var ROLE = {
    trigger: 'Marks where a flow starts, ends or is set off by an event.',
    action: 'A manual step carried out by a person. It does not touch a tracking document.',
    doc: 'A manual step where a person has to add, edit or update a tracking document by hand.',
    external: 'A party outside the company. The flow waits on them.',
    gap: 'A step that happens, or should, but is recorded nowhere.',
    auto: 'An operation the system performs on its own, with no one typing.',
    approve: 'A checkpoint where a person confirms, scans or approves. The system does the rest.',
    store: 'Where the data lives: one sheet or table.',
    feature: 'A screen people open to see or act on the data.'
  };
  function outTargets(n) {
    return edges.filter(function (e) { return e.from === n.id; }).map(function (e) { return (e.label ? e.label + ' → ' : '') + byId[e.to].label; });
  }
  function respText(n) {
    var o = outTargets(n), who = n.actor || 'Not assigned', nxt = o.length ? ' Hands over to: ' + o.join('; ') + '.' : '';
    switch (n.type) {
      case 'decision': return (n.section === 'manual' ? who + ' decides' : 'The system decides, by rule,') + ' where the flow goes: ' + (o.join('; ') || 'end of flow') + '.';
      case 'doc': return who + ' must keep ' + (storeLabel[n.touch.doc] || 'the sheet') + ' correct by hand: ' + n.touch.fields.join(', ') + '.' + nxt;
      case 'approve': return who + ' confirms or corrects (' + n.touch.fields.join(', ') + ').' + nxt;
      case 'auto': return 'Runs without a person.' + nxt;
      case 'action': return who + ' carries this out.' + nxt;
      case 'gap': return 'Nobody owns this today. That is the problem.' + nxt;
      case 'external': return who + ' is responsible. We only control our side of the handoff.' + nxt;
      case 'trigger': return 'No owner: it is an event.' + nxt;
      case 'store': var w = nodes.filter(function (m) { return m.touch && m.touch.doc === n.id; }).length; return w + ' step' + (w === 1 ? '' : 's') + ' write to it' + (n.section === 'manual' ? ', all by hand.' : '.');
      case 'feature': return 'Gives ' + n.users.length + ' step' + (n.users.length === 1 ? '' : 's') + ' of the automated flow one place to be seen and acted on.';
    }
    return who;
  }
  function roleBlock(n) {
    var role = n.type === 'decision' ? (n.section === 'manual' ? 'A judgement call made by a person, usually by eye.' : 'A rule the system applies, so nobody has to judge it.') : ROLE[n.type];
    return '<h3>Role</h3><p>' + esc(role) + '</p><h3>Purpose</h3><p>' + esc(n.summary || '') + '</p><h3>Responsibility</h3><p>' + esc(respText(n)) + '</p>';
  }
  function solvesBlock(n) {
    if (n.section !== 'auto' || ['auto', 'approve', 'decision', 'feature'].indexOf(n.type) < 0) return '';
    var h = '<h3>What this solves vs manual</h3><div class="box solves">';
    if (n.type === 'feature') h += '<b>Manual today:</b> ' + esc(n.why);
    else {
      var rep = (n.replaces || []).map(function (r) { return byId[r]; }).filter(function (m) { return m && m.type !== 'store'; });
      if (!rep.length) h += '<b>New capability.</b> Nothing in the manual flow does this today.';
      else h += '<ul>' + rep.map(function (m) {
        var pn = (m.pains || []).map(function (q) { return '<span class="b bad">' + q + '</span> ' + esc(P.pains[q]); }).join('<br>');
        return '<li><b>Manual:</b> ' + nodeLink(m.id) + ' — ' + esc(m.summary || '') +
          (m.touch ? '<br><b>Typing removed:</b> hand-editing of ' + esc(storeLabel[m.touch.doc]) + '.' : '') + (pn ? '<br>' + pn : '') + '</li>';
      }).join('') + '</ul>';
    }
    return h + '</div>';
  }
  function nodePanel(n) {
    var h = '<button class="x" data-close>×</button><div class="badges">' +
      '<span class="b ' + (n.section === 'manual' ? 'warn' : 'acc') + '">' + (n.section === 'manual' ? 'Manual' : 'Automated') + '</span>' +
      '<span class="b">' + esc(TYPE_NAME[n.type]) + '</span>' + (n.assumed ? '<span class="b bad">Assumed</span>' : '') + '</div>';
    h += '<h2>' + esc(n.label) + '</h2>' + roleBlock(n) + solvesBlock(n);
    if (n.assumed) h += '<div class="box assumed">Not shown in any file the client shared. Drawn from how similar shops work; confirm with the client.</div>';
    h += '<dl class="kv"><dt>Who</dt><dd>' + esc(n.actor || '') + '</dd><dt>Stage</dt><dd>' + (n.stage + 1) + ' · ' + esc(P.stages[n.stage].label) + '</dd><dt>Lane</dt><dd>' + esc(P.lanes[n.lane]) + '</dd>' +
      (n.evidence ? '<dt>Evidence</dt><dd>' + esc(n.evidence) + '</dd>' : '') + '</dl>';
    if (n.touch) {
      var manual = n.section === 'manual';
      h += '<h3>' + (manual ? 'Human touch' : 'Human in the loop') + '</h3><div class="box touch' + (manual ? '' : ' ok') + '"><b>' + (manual ? 'A person must ' + esc(n.touch.verb) + ' data in ' : 'A person does ' + esc(n.touch.verb) + ' in ') + '</b>' + nodeLink(n.touch.doc) +
        '<ul>' + n.touch.fields.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
    }
    if (n.type === 'feature') {
      h += '<h3>Gap it closes</h3><p>' + esc(n.why) + '</p><h3>Steps that feed or use it (' + n.users.length + ')</h3><ul class="list">' + n.users.map(function (u) { return '<li>' + nodeLink(u) + '</li>'; }).join('') + '</ul>';
    }
    if (n.features && n.features.length) h += '<h3>Screens that show this</h3>' + n.features.map(function (f) { return '<span class="chip-l" data-go="' + esc(f) + '" data-center>' + esc(byId[f].label) + '</span>'; }).join('');
    if (n.type === 'store') {
      var w = nodes.filter(function (m) { return m.touch && m.touch.doc === n.id; }), rd = nodes.filter(function (m) { return m.reads && m.reads.indexOf(n.id) >= 0; });
      h += '<h3>Written by (' + w.length + ')</h3><ul class="list">' + (w.map(function (m) { return '<li>' + nodeLink(m.id) + ' <span class="b">' + esc(m.touch.verb) + '</span></li>'; }).join('') || '<li>—</li>') + '</ul>';
      if (rd.length) h += '<h3>Read by (' + rd.length + ')</h3><ul class="list">' + rd.map(function (m) { return '<li>' + nodeLink(m.id) + '</li>'; }).join('') + '</ul>';
      var rp = nodes.filter(function (m) { return (m.replaces || []).indexOf(n.id) >= 0; });
      if (rp.length) h += '<h3>Replaced by</h3>' + rp.map(function (m) { return '<span class="chip-l" data-go="' + esc(m.id) + '" data-center>' + esc(m.label) + '</span>'; }).join('');
      if (n.replaces && n.replaces.length) h += '<h3>Replaces</h3>' + n.replaces.map(function (r) { return '<span class="chip-l" data-go="' + esc(r) + '" data-center>' + esc(byId[r].label) + '</span>'; }).join('');
    }
    if (n.pains && n.pains.length) h += '<h3>Pain points</h3><ul class="list">' + n.pains.map(function (q) { return '<li><span class="b bad">' + q + '</span> ' + esc(P.pains[q]) + '</li>'; }).join('') + '</ul>';
    if (n.automations && n.automations.length) h += '<h3>' + (n.section === 'manual' ? 'Automations that address this' : 'Automations used') + '</h3><ul class="list">' + n.automations.map(function (a) { return '<li><span class="b acc">' + a + '</span> ' + esc(P.automations[a]) + '</li>'; }).join('') + '</ul>';
    if (n.section === 'manual' && n.type !== 'store' && n.type !== 'feature') {
      var rb = nodes.filter(function (m) { return (m.replaces || []).indexOf(n.id) >= 0; });
      h += '<h3>Replaced by (automated map)</h3>' + (rb.map(function (m) { return '<span class="chip-l" data-go="' + esc(m.id) + '" data-center>' + esc(m.label) + '</span>'; }).join('') || '<span class="b">No counterpart needed</span>');
    }
    if (n.section === 'auto' && n.replaces && n.replaces.length && n.type !== 'store') h += '<h3>Replaces (manual map)</h3>' + n.replaces.map(function (r) { return '<span class="chip-l" data-go="' + esc(r) + '" data-center>' + esc(byId[r].label) + '</span>'; }).join('');
    if (n.type !== 'store' && n.type !== 'feature') {
      var inn = edges.filter(function (e) { return e.to === n.id; }), out = edges.filter(function (e) { return e.from === n.id; });
      h += '<h3>Comes from</h3><ul class="list">' + (inn.map(function (e) { return '<li>' + edgeLink(e, e.from) + '</li>'; }).join('') || '<li>— start</li>') + '</ul>';
      h += '<h3>Leads to</h3><ul class="list">' + (out.map(function (e) { return '<li>' + edgeLink(e, e.to) + '</li>'; }).join('') || '<li>— end</li>') + '</ul>';
    }
    return h + glHtml(termsIn(nodeText(n)));
  }
  function edgePanel(e) {
    var h = '<button class="x" data-close>×</button><div class="badges"><span class="b ' + (e.section === 'manual' ? 'warn' : 'acc') + '">' + (e.section === 'manual' ? 'Manual' : 'Automated') + '</span><span class="b ' + (e.kind === 'loop' ? 'warn' : '') + '">' + (e.kind === 'loop' ? 'Loop / rework' : 'Flow') + '</span></div>';
    h += '<h2>' + esc(byId[e.from].label) + ' → ' + esc(byId[e.to].label) + '</h2>';
    h += '<dl class="kv"><dt>From</dt><dd>' + nodeLink(e.from) + '</dd><dt>To</dt><dd>' + nodeLink(e.to) + '</dd>' +
      (e.label ? '<dt>Label</dt><dd>' + esc(e.label) + '</dd>' : '') + (e.condition ? '<dt>When</dt><dd>' + esc(e.condition) + '</dd>' : '') +
      (e.handoff ? '<dt>Handed over</dt><dd>' + esc(e.handoff) + '</dd>' : '') + '</dl>';
    if (e.note) h += '<h3>Note</h3><p>' + esc(e.note) + '</p>';
    if (!e.handoff && !e.condition && !e.note) h += '<p>Next step in the sequence.</p>';
    return h + glHtml(termsIn([byId[e.from].label, byId[e.to].label, e.label, e.condition, e.handoff, e.note].join(' | ')));
  }

  /* ------------------------------------------------------------ glossary */
  function rx(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
  var GL = P.glossary.map(function (g) { return { t: g[0], full: g[1], note: g[2] || '', re: new RegExp('(^|[^A-Za-z0-9])' + rx(g[0]) + '(?![A-Za-z0-9])', g[3] ? 'i' : '') }; });
  function termsIn(text) { return GL.filter(function (g) { return g.re.test(text); }); }
  function glRows(list) { return '<dl class="gl">' + list.map(function (g) { return '<dt>' + esc(g.t) + '</dt><dd><b>' + esc(g.full) + '</b>' + (g.note ? '<br>' + esc(g.note) : '') + '</dd>'; }).join('') + '</dl>'; }
  function glHtml(list) { return list.length ? '<h3>Terms used</h3>' + glRows(list) : ''; }
  function nodeText(n) {
    var t = [n.label, n.summary, n.actor, n.evidence, (n.touch ? n.touch.fields.join(' ') + ' ' + storeLabel[n.touch.doc] : '')];
    (n.automations || []).forEach(function (x) { t.push(P.automations[x]); });
    (n.pains || []).forEach(function (q) { t.push(P.pains[q]); });
    return t.join(' | ');
  }
  function glossaryPanel() {
    clearSel();
    panel.innerHTML = '<button class="x" data-close>×</button><h2>Glossary</h2><p>Abbreviations and terms used on this map.</p>' +
      glRows(GL.slice().sort(function (x, y) { return x.t.toLowerCase() < y.t.toLowerCase() ? -1 : 1; }));
    panel.hidden = false; panel.scrollTop = 0; document.body.classList.add('has-panel');
  }

  /* ------------------------------------------------------------ events */
  view.addEventListener('click', function (ev) {
    if (moved) { moved = false; return; }
    var nEl = ev.target.closest('.node'), eEl = ev.target.closest('[data-edge]');
    if (nEl) select('node', nEl.getAttribute('data-id'));
    else if (eEl) select('edge', eEl.getAttribute('data-edge'));
    else clearSel();
  });
  panel.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-go],[data-edge],[data-close]');
    if (!t) return;
    if (t.hasAttribute('data-close')) clearSel();
    else if (t.hasAttribute('data-edge')) select('edge', t.getAttribute('data-edge'));
    else { var id = t.getAttribute('data-go'); select('node', id, { center: id }); }
  });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') clearSel(); });

  /* ------------------------------------------------------------ toolbar, stats, legend */
  document.querySelector('.tools').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var act = b.getAttribute('data-act'), st = b.getAttribute('data-stage'), u = usable();
    if (act === 'in') { anim(true); zoomAt(u.w / 2, u.h / 2, T.k * 1.3); }
    else if (act === 'out') { anim(true); zoomAt(u.w / 2, u.h / 2, T.k / 1.3); }
    else if (act === 'glossary') glossaryPanel();
    else if (fits[act]) fits[act]();
    else if (st != null) gotoStage(+st);
  });
  var stagesEl = $('#stages');
  P.stages.forEach(function (s, i) { var b = document.createElement('button'); b.textContent = i + 1; b.title = s.label; b.setAttribute('data-stage', i); stagesEl.appendChild(b); });

  var docEdits = nodes.filter(function (n) { return n.section === 'manual' && n.type === 'doc'; }).length;
  var humanAuto = nodes.filter(function (n) { return n.section === 'auto' && n.type === 'approve'; }).length;
  $('#stats').innerHTML = '<span class="chip warn">Manual · ' + docEdits + ' human document edits</span><span class="chip ok">Automated · ' + humanAuto + ' human approvals / scans</span><span class="chip info">' + nodes.filter(function (n) { return n.type === 'feature'; }).length + ' product screens</span>';

  var LEG = [
    ['pill', '--bd:var(--fg-faint);--bg:var(--sunken)', 'Start / end / event'], ['', '', 'Manual operation'],
    ['', '--bd:var(--warning-border);--bg:var(--warning-soft)', 'Human edits a tracking doc'], ['dia', '--bd:var(--info);--bg:var(--info-soft)', 'Decision'],
    ['dash', '--bd:var(--fg-subtle)', 'External party'], ['dash', '--bd:var(--danger);--bg:var(--danger-soft)', 'Not recorded (gap)'],
    ['', '--bd:var(--accent-border);--bg:var(--accent-soft)', 'Automated operation'], ['', '--bd:var(--success);--bg:var(--success-soft)', 'Human approves / scans'],
    ['', '--bd:var(--info);--bg:var(--info-soft)', 'Product screen / feature'], ['loop', '', 'Loop / rework']
  ];
  $('#legend').innerHTML = LEG.map(function (l) { return '<div><i class="' + l[0] + '" style="' + l[1] + '"></i>' + l[2] + '</div>'; }).join('');

  /* ------------------------------------------------------------ boot */
  backdrop(); renderNodes(); renderEdges();
  window.__canvas = { nodes: nodes.length, edges: edges.length, get T() { return T; }, fits: fits, select: select, TOTAL_W: TOTAL_W, TOTAL_H: TOTAL_H, stageX: stageX };
  var u0 = usable(); T.k = 0.75; T.x = 16; T.y = 8; apply();
})();

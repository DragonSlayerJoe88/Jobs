(function () {
  var CFG = window.JOB_BOARD_CONFIG || {};
  var SAMPLES = {
    flooring: [
      { title: 'LVP install', floor: 'Vinyl plank (LVP)', zip: '63134', size: '~420 sq ft', level: 'Main floor', stairs: 'No', timeline: 'Within a month', date: '2026-10-28' },
      { title: 'Laminate install', floor: 'Laminate', zip: '63031', size: '~650 sq ft', level: 'Upstairs', stairs: 'Yes', timeline: 'ASAP', date: '2026-10-26' },
      { title: 'Engineered hardwood install', floor: 'Engineered hardwood', zip: '62234', size: '~800 sq ft', level: 'Basement (concrete)', stairs: 'No', timeline: 'Just planning', date: '2026-10-24' }
    ],
    print: [
      { title: '4 replacement cabinet knobs (have measurements)', budget: '$20–$50', location: 'Ships anywhere', quantity: '4', date: '2026-10-29' },
      { title: 'Cosplay helmet, STL file ready', budget: '$100–$250', location: '63135 · local pickup', quantity: '1', date: '2026-10-27' },
      { title: 'Custom name keychains for a team', budget: '$50–$100', location: 'Ships anywhere', quantity: '15', date: '2026-10-25' }
    ]
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { return /^https:\/\//i.test(u || '') ? u : ''; }
  function fmtDate(d) {
    if (!d) return '';
    var t = new Date(d + 'T12:00:00');
    return isNaN(t) ? esc(d) : t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function card(kind, r, sample) {
    var photo = safeUrl(r.photo);
    var icon = kind === 'flooring' ? '&#9638;' : '&#9881;';
    var chips = kind === 'flooring'
      ? ['&#128205; ' + esc(r.zip || 'St. Louis'), r.size ? esc(r.size) : '', r.level ? esc(r.level) : '',
         r.stairs ? 'Stairs: ' + esc(r.stairs) : '', r.timeline ? esc(r.timeline) : '', 'Budget: free measure + quote']
      : ['&#128205; ' + esc(r.location || 'Ships anywhere'), r.budget ? 'Budget: ' + esc(r.budget) : '', r.quantity ? 'Qty ' + esc(r.quantity) : ''];
    return '<article class="card">' +
      '<div class="ph ' + (kind === 'flooring' ? 'floor' : 'print') + '"' + (photo ? ' style="background-image:url(\'' + esc(photo) + '\')"' : '') + '>' +
        (sample ? '<span class="badge">Example</span>' : '') + (photo ? '' : icon) + '</div>' +
      '<div class="body"><h3>' + (sample ? 'Example: ' : '') + esc(r.title) + '</h3>' +
      '<div class="meta">' + chips.filter(Boolean).map(function (c) { return '<span class="chip">' + c + '</span>'; }).join('') + '</div>' +
      '<div class="date">Posted ' + fmtDate(r.date) + '</div>' +
      '<a class="btn ' + (kind === 'flooring' ? 'floor' : 'print') + '" href="' + (kind === 'flooring' ? 'flooring.html' : 'print.html') + '">Request a quote</a>' +
      '</div></article>';
  }

  function render(kind, list, sample) {
    document.getElementById('grid-' + kind).innerHTML = list.map(function (r) { return card(kind, r, sample); }).join('');
    var note = document.getElementById('note-' + kind);
    if (sample) {
      note.hidden = false;
      note.textContent = 'These are example cards to show how requests will look. Real requests will appear here once they come in.';
    } else note.hidden = true;
  }

  function show(kind) {
    ['flooring', 'print'].forEach(function (k) {
      document.getElementById('tab-' + k).setAttribute('aria-selected', String(k === kind));
      document.getElementById('panel-' + k).hidden = k !== kind;
    });
    if (history.replaceState) history.replaceState(null, '', '#' + kind);
  }
  document.getElementById('tab-flooring').onclick = function () { show('flooring'); };
  document.getElementById('tab-print').onclick = function () { show('print'); };
  if (location.hash === '#print') show('print');

  render('flooring', SAMPLES.flooring, true);
  render('print', SAMPLES.print, true);

  if (CFG.SCRIPT_URL) {
    fetch(CFG.SCRIPT_URL).then(function (r) { return r.json(); }).then(function (feed) {
      if (feed.flooring && feed.flooring.length) render('flooring', feed.flooring, false);
      if (feed.print && feed.print.length) render('print', feed.print, false);
    }).catch(function () { /* keep examples */ });
  }
})();

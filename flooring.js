(function () {
  var CFG = window.JOB_BOARD_CONFIG || {};
  var form = document.getElementById('f');
  var steps = Array.prototype.slice.call(form.querySelectorAll('fieldset.step'));
  var cur = 0;
  var statusEl = document.getElementById('status');
  function $(id) { return document.getElementById(id); }
  function vals(name) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; }); }
  function one(name) { return vals(name)[0] || ''; }

  // ---- conditional fields & notes ----
  function refresh() {
    var email = one('contact') === 'Email';
    $('emailField').hidden = !email; $('email').required = email;
    var stairs = one('stairs') === 'Yes';
    $('stepsField').hidden = !stairs; $('steps').required = stairs;
    $('storeField').hidden = one('whoBuys') !== "I'll pick it out, you buy it";
    $('basementNote').hidden = !(vals('level').indexOf('Basement (concrete)') > -1 && vals('newFloor').indexOf('Solid hardwood') > -1);
    if (form.transitionsNotSure.checked) form.transitions.value = '';
  }
  // "Not sure" is exclusive in multi-select groups that mark it so
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'checkbox' && t.checked && t.name && form.querySelector('input[name="' + t.name + '"][data-exclusive]')) {
      form.querySelectorAll('input[name="' + t.name + '"]').forEach(function (o) {
        if (o !== t && (t.dataset.exclusive || o.dataset.exclusive)) o.checked = false;
      });
    }
    if (t.name === 'transitions' && t.value) form.transitionsNotSure.checked = false;
    var f = t.closest('.field'); if (f) f.classList.remove('bad');
    refresh();
  });
  form.addEventListener('input', function (e) { var f = e.target.closest('.field'); if (f) f.classList.remove('bad'); });

  $('photos').addEventListener('change', function () {
    var list = $('photos-list'); list.innerHTML = '';
    Array.prototype.slice.call(this.files, 0, 10).forEach(function (f) {
      var s = document.createElement('span'); s.textContent = f.name + ' (' + Math.round(f.size / 1024) + ' KB)'; list.appendChild(s);
    });
  });

  // ---- validation per step ----
  function zipCheck(zip) {
    if (!/^\d{5}$/.test(zip)) return 'Please enter a 5-digit zip code.';
    if (/^65[0-2]/.test(zip)) return "Sorry, we don't serve the Columbia, MO area anymore. House to a Vista works in the St. Louis / Berkeley area and Metro East.";
    if (!/^(630|631|633|620|622)/.test(zip)) return "Thanks for thinking of us! That zip is outside our service area (St. Louis / Berkeley, MO and Metro East IL), so we can't take this one.";
    return '';
  }
  function setBad(el, bad, msg) {
    var f = el.closest('.field'); if (!f) return false;
    f.classList.toggle('bad', bad);
    if (msg) { var e = f.querySelector('.err'); if (e) e.textContent = msg; }
    return bad;
  }
  function validateStep(i) {
    var fs = steps[i], ok = true, first = null;
    function fail(el, msg) { setBad(el, true, msg); ok = false; first = first || el; }
    fs.querySelectorAll('[required]').forEach(function (el) {
      if (el.closest('[hidden]')) return;
      if (el.type === 'radio' || el.type === 'checkbox') {
        if (!vals(el.name).length) fail(el); else setBad(el, false);
      } else if (!el.value.trim() || !el.validity.valid) fail(el); else setBad(el, false);
    });
    if (fs.contains(form.zip)) { var m = zipCheck(form.zip.value.trim()); if (m) fail(form.zip, m); }
    if (fs.contains(form.phone) && form.phone.value.replace(/\D/g, '').length < 10) fail(form.phone);
    if (fs.contains($('photos'))) { var p = $('photos'); if (p.files.length > 5) fail(p); else setBad(p, false); }
    if (first) first.focus({ preventScroll: true }), first.closest('.field').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return ok;
  }

  function go(i) {
    steps.forEach(function (s, j) { s.hidden = j !== i; });
    cur = i;
    $('progText').textContent = 'Step ' + (i + 1) + ' of ' + steps.length + ' · ' + steps[i].dataset.title;
    $('progBar').style.width = Math.round((i + 1) / steps.length * 100) + '%';
    form.scrollIntoView({ block: 'start' });
    statusEl.textContent = '';
  }
  form.addEventListener('click', function (e) {
    if (e.target.matches('[data-next]')) { if (validateStep(cur)) go(cur + 1); }
    else if (e.target.matches('[data-back]')) go(cur - 1);
  });
  // Enter key in a text box should move forward, not submit early
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && cur < steps.length - 1) { e.preventDefault(); if (validateStep(cur)) go(cur + 1); }
  });

  // ---- files ----
  function readB64(blob) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = rej; r.readAsDataURL(blob); });
  }
  function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp)/i.test(file.type) || !window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bmp) {
      var s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
      c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.82); });
    }).catch(function () { return file; });
  }
  function collectFiles() {
    return Promise.all(Array.prototype.slice.call($('photos').files, 0, 5).map(function (f) {
      return shrinkImage(f).then(function (b) {
        return readB64(b).then(function (d) { return { name: b === f ? f.name : f.name.replace(/\.\w+$/, '') + '.jpg', type: b.type || f.type, data: d }; });
      });
    }));
  }

  function payload() {
    return {
      kind: 'flooring', website: form.website.value,
      name: form.elements['name'].value, phone: form.phone.value, contact: one('contact'), email: $('emailField').hidden ? '' : form.email.value,
      zip: form.zip.value.trim(),
      newFloor: vals('newFloor').join(', '), rooms: form.rooms.value, currentFloor: vals('currentFloor').join(', '),
      tearOut: one('tearOut'), level: vals('level').join(', '), uneven: one('uneven'),
      stairs: one('stairs'), steps: $('stepsField').hidden ? '' : form.steps.value, nosing: one('nosing'),
      transitions: form.transitionsNotSure.checked ? 'Not sure' : form.transitions.value,
      baseboards: one('baseboards'), quarterRound: one('quarterRound'),
      whoBuys: one('whoBuys'), store: $('storeField').hidden ? '' : one('store'),
      furniture: form.furniture.value, appliances: one('appliances'),
      notes: form.notes.value, timeline: one('timeline')
    };
  }

  function thanks() {
    form.innerHTML = '<div class="thanks"><h2>Thanks, got it!</h2><p>I\'ll text you back within a day to set up your free measure.' +
      (CFG.TEXT_NUMBER ? ' Need me sooner? Text ' + CFG.TEXT_NUMBER + '.' : '') + '</p><p><a class="btn ghost" href="index.html">Back to the job board</a></p></div>';
    window.scrollTo(0, 0);
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    for (var i = 0; i < steps.length; i++) { if (!validateStep(i)) { go(i); validateStep(i); return; } }
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true; statusEl.textContent = 'Sending…';
    var data = payload();
    collectFiles().then(function (files) {
      data.files = files;
      if (!CFG.SCRIPT_URL) {
        console.log('Preview mode, would send:', JSON.stringify(Object.assign({}, data, { files: files.map(function (f) { return f.name; }) })));
        statusEl.textContent = 'Preview mode: the form is not connected yet, so nothing was sent.'; btn.disabled = false; return;
      }
      return fetch(CFG.SCRIPT_URL, { method: 'POST', body: JSON.stringify(data) }).then(function (r) { return r.json(); }).then(function (res) {
        if (res.ok) thanks(); else { statusEl.textContent = res.error || 'Something went wrong. Please try again.'; btn.disabled = false; }
      });
    }).catch(function () { statusEl.textContent = 'Could not send. Please check your connection and try again.'; btn.disabled = false; });
  });
  refresh();
})();

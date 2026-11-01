(function () {
  var CFG = window.JOB_BOARD_CONFIG || {};
  var form = document.getElementById('f');
  var kind = form.dataset.kind;
  var statusEl = document.getElementById('status');
  var MAX_TOTAL = 20 * 1024 * 1024;

  // "Other" job type text box
  var other = document.getElementById('otherJob');
  if (other) form.querySelectorAll('input[name=jobType]').forEach(function (r) {
    r.addEventListener('change', function () { other.hidden = form.jobType.value !== 'Other'; });
  });

  // File list previews
  form.querySelectorAll('input[type=file]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var list = document.getElementById(inp.id + '-list');
      list.innerHTML = '';
      Array.prototype.slice.call(inp.files, 0, 10).forEach(function (f) {
        var s = document.createElement('span'); s.textContent = f.name + ' (' + Math.round(f.size / 1024) + ' KB)'; list.appendChild(s);
      });
    });
  });

  function zipCheck(zip) {
    if (!/^\d{5}$/.test(zip)) return 'Please enter a 5-digit zip code.';
    if (/^65[0-2]/.test(zip)) return "Sorry, I don't serve the Columbia, MO area. House to a Vista works in the St. Louis metro only.";
    if (!/^(630|631|633|620|622)/.test(zip)) return 'Sorry, that zip looks outside the St. Louis metro area I serve.';
    return '';
  }

  function setBad(el, bad, msg) {
    var f = el.closest('.field'); if (!f) return;
    f.classList.toggle('bad', bad);
    if (msg) { var e = f.querySelector('.err'); if (e) e.textContent = msg; }
  }

  function validate() {
    var ok = true, first = null;
    form.querySelectorAll('[required]').forEach(function (el) {
      var bad;
      if (el.type === 'radio') bad = !form[el.name].value;
      else bad = !el.value.trim() || (el.validity && !el.validity.valid);
      if (el.type === 'radio' && el !== form.querySelector('input[name=' + el.name + ']')) return;
      setBad(el, bad);
      if (bad) { ok = false; first = first || el; }
    });
    if (kind === 'flooring') {
      var zipMsg = zipCheck(form.zip.value.trim());
      if (zipMsg) { setBad(form.zip, true, zipMsg); ok = false; first = first || form.zip; }
      if (form.phone.value.replace(/\D/g, '').length < 10) { setBad(form.phone, true); ok = false; first = first || form.phone; }
    }
    form.querySelectorAll('input[type=file]').forEach(function (inp) {
      var total = 0; Array.prototype.forEach.call(inp.files, function (f) { total += f.size; });
      var bad = inp.files.length > +inp.dataset.max || (kind === 'print' && total > MAX_TOTAL);
      setBad(inp, bad); if (bad) { ok = false; first = first || inp; }
    });
    if (first) first.focus();
    return ok;
  }

  function readB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1]); };
      r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  // Shrink phone photos (often 4-6 MB) to ~1600px JPEG before upload.
  function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp|heic)/i.test(file.type) || !window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bmp) {
      var scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      var c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.82); });
    }).catch(function () { return file; });
  }
  function collectFiles() {
    var inp = form.querySelector('input[type=file]');
    return Promise.all(Array.prototype.slice.call(inp.files, 0, +inp.dataset.max).map(function (f) {
      return shrinkImage(f).then(function (b) {
        var name = b === f ? f.name : f.name.replace(/\.\w+$/, '') + '.jpg';
        return readB64(b).then(function (data) { return { name: name, type: b.type || f.type || 'application/octet-stream', data: data }; });
      });
    }));
  }

  function thanks() {
    var msg = kind === 'flooring'
      ? "<h2>Thanks, got it!</h2><p>I'll text you back within a day to set up your free measure." + (CFG.TEXT_NUMBER ? ' Need me sooner? Text ' + CFG.TEXT_NUMBER + '.' : '') + '</p>'
      : "<h2>Thanks, got it!</h2><p>I'll look over your request and email you a quote, usually within a day.</p>";
    form.innerHTML = '<div class="thanks">' + msg + '<p><a class="btn ghost" href="index.html' + (kind === 'print' ? '#print' : '') + '">Back to the job board</a></p></div>';
    window.scrollTo(0, 0);
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!validate()) return;
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true; statusEl.textContent = 'Sending…';
    var data = { kind: kind };
    new FormData(form).forEach(function (v, k) { if (typeof v === 'string') data[k] = v; });
    collectFiles().then(function (files) {
      data.files = files;
      if (!CFG.SCRIPT_URL) {          // preview mode: nothing leaves the browser
        console.log('Preview mode, would send:', Object.assign({}, data, { files: files.map(function (f) { return f.name; }) }));
        statusEl.textContent = 'Preview mode: the form is not connected yet, so nothing was sent.';
        btn.disabled = false;
        return;
      }
      return fetch(CFG.SCRIPT_URL, { method: 'POST', body: JSON.stringify(data) })   // text/plain: no CORS preflight
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.ok) thanks();
          else { statusEl.textContent = res.error || 'Something went wrong. Please try again.'; btn.disabled = false; }
        });
    }).catch(function () {
      statusEl.textContent = 'Could not send. Please check your connection and try again.';
      btn.disabled = false;
    });
  });

  form.querySelectorAll('input,select,textarea').forEach(function (el) {
    el.addEventListener('input', function () { var f = el.closest('.field'); if (f) f.classList.remove('bad'); });
  });
})();

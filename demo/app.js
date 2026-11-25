(function () {
  var $ = function (id) { return document.getElementById(id); };
  var step = 1;

  function setErr(id, msg) {
    var el = $('e-' + id); if (el) el.textContent = msg || '';
    var inp = $(id); if (inp) { inp.classList.toggle('invalid', !!msg); if (msg) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); }
  }
  function val(id) { return ($(id).value || '').trim(); }
  function radio(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }

  var checks = {
    1: function () {
      var ok = true;
      if (!val('fullName') || val('fullName').length < 2) { setErr('fullName', 'Please enter your full name.'); ok = false; } else setErr('fullName');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val('email'))) { setErr('email', 'Enter a valid email address.'); ok = false; } else setErr('email');
      if (!/^[6-9]\d{9}$/.test(val('phone').replace(/[\s-]/g, ''))) { setErr('phone', 'Enter a valid 10-digit mobile number.'); ok = false; } else setErr('phone');
      var dob = val('dob');
      if (!dob) { setErr('dob', 'Date of birth is required.'); ok = false; }
      else if ((Date.now() - new Date(dob).getTime()) / 3.15576e10 < 18) { setErr('dob', 'You must be at least 18 years old.'); ok = false; } else setErr('dob');
      if (!val('city')) { setErr('city', 'City is required.'); ok = false; } else setErr('city');
      return ok;
    },
    2: function () {
      var ok = true;
      if (!val('education')) { setErr('education', 'Choose your highest education.'); ok = false; } else setErr('education');
      if (val('education') === 'other' && !val('eduOther')) { setErr('eduOther', 'Please specify your education.'); ok = false; } else setErr('eduOther');
      var y = val('years');
      if (y === '' || Number(y) < 0 || Number(y) > 50) { setErr('years', 'Enter years of experience (0–50).'); ok = false; } else setErr('years');
      if (!radio('mode')) { $('e-mode').textContent = 'Choose a work mode.'; ok = false; } else $('e-mode').textContent = '';
      return ok;
    },
    3: function () {
      var ok = true;
      if (val('why').length < 20) { setErr('why', 'Please write at least 20 characters.'); ok = false; } else setErr('why');
      if (!$('consent').checked) { $('e-consent').textContent = 'You must accept to continue.'; ok = false; } else $('e-consent').textContent = '';
      return ok;
    },
  };

  function show(n) {
    step = n;
    [1, 2, 3].forEach(function (i) { $('step-' + i).hidden = i !== n; $('ind-' + i).className = i === n ? 'on' : ''; });
    window.scrollTo(0, 0);
  }

  $('next-1').onclick = function () { if (checks[1]()) show(2); };
  $('next-2').onclick = function () { if (checks[2]()) show(3); };
  $('back-2').onclick = function () { show(1); };
  $('back-3').onclick = function () { show(2); };

  // Dynamic field: shown only when education = Other
  $('education').addEventListener('change', function () {
    var other = val('education') === 'other';
    $('edu-other-wrap').hidden = !other;
    $('eduOther').required = other;
  });

  $('apply').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!checks[3]()) return;
    // Demo only: nothing is sent anywhere.
    $('apply').hidden = true;
    var done = $('done'); done.hidden = false;
    done.textContent = 'Thank you, ' + val('fullName') + '. Your demo application was received (nothing was sent).';
  });
})();

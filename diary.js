/* Общее хранилище всех компонентов дневника.
   Данные никуда не отправляются: весь код статический, ни одного сетевого вызова. */
window.Diary = (function () {
  var NS = 'diary:v1:';
  var DAY = NS + 'day:';
  var CURSOR = NS + 'cursor';
  var LOCAL = 'diary-local-change';

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг',
    'Пятница', 'Суббота', 'Воскресенье'];

  var MOODS = [
    { id: 'hard',  label: 'Тяжело',   low: 'тяжело',   weight: 1 },
    { id: 'meh',   label: 'Не очень', low: 'не очень', weight: 2 },
    { id: 'calm',  label: 'Спокойно', low: 'спокойно', weight: 3 },
    { id: 'good',  label: 'Хорошо',   low: 'хорошо',   weight: 4 },
    { id: 'great', label: 'Отлично',  low: 'отлично',  weight: 5 }
  ];

  function raw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function put(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function iso(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function today() { return iso(new Date()); }

  function parse(date) {
    var p = date.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function shift(date, days) {
    var d = parse(date);
    d.setDate(d.getDate() + days);
    return iso(d);
  }

  function get(date) {
    var s = raw(DAY + date);
    if (!s) { return { mood: null, text: '' }; }
    try {
      var o = JSON.parse(s);
      return { mood: o.mood || null, text: o.text || '', u: o.u };
    } catch (e) {
      return { mood: null, text: '' };
    }
  }

  function set(date, patch) {
    var cur = get(date);
    if ('mood' in patch) { cur.mood = patch.mood; }
    if ('text' in patch) { cur.text = patch.text; }
    if (!cur.mood && !cur.text) {
      drop(DAY + date);
    } else {
      cur.u = new Date().toISOString();
      put(DAY + date, JSON.stringify(cur));
    }
    announce();
    return cur;
  }

  function days() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(DAY) === 0) { out.push(k.slice(DAY.length)); }
      }
    } catch (e) {}
    return out.sort();
  }

  function cursor() { return raw(CURSOR) || today(); }

  function setCursor(date) {
    put(CURSOR, date);
    announce();
  }

  /* Событие storage прилетает только в другие документы того же origin —
     соседние iframe'ы на странице Notion. Своему документу шлём вручную. */
  function announce() {
    window.dispatchEvent(new CustomEvent(LOCAL));
  }

  function onChange(fn) {
    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf(NS) === 0) { fn(); }
    });
    window.addEventListener(LOCAL, fn);
  }

  /* Перенос с первой версии виджета настроения (ключи mood:YYYY-MM-DD). */
  function migrate() {
    var old = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /^mood:\d{4}-\d{2}-\d{2}$/.test(k)) { old.push(k); }
      }
    } catch (e) { return; }
    old.forEach(function (k) {
      var date = k.slice(5);
      if (!raw(DAY + date)) { set(date, { mood: raw(k) }); }
      drop(k);
    });
  }

  function applyTheme() {
    var t = new URLSearchParams(location.search).get('theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    }
  }

  function longDate(date) {
    var d = parse(date);
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function weekday(date) {
    return WEEKDAYS[(parse(date).getDay() + 6) % 7];
  }

  function mood(id) {
    return MOODS.filter(function (m) { return m.id === id; })[0] || null;
  }

  /* Срабатывает при пересечении полуночи на открытой вкладке. */
  function watchMidnight(fn) {
    var known = today();
    setInterval(function () {
      var now = today();
      if (now !== known) { known = now; fn(now); }
    }, 60000);
  }

  applyTheme();
  migrate();

  return {
    MOODS: MOODS, MONTHS_NOM: MONTHS_NOM,
    iso: iso, today: today, parse: parse, shift: shift,
    get: get, set: set, days: days,
    cursor: cursor, setCursor: setCursor,
    onChange: onChange, longDate: longDate, weekday: weekday,
    mood: mood, watchMidnight: watchMidnight
  };
})();

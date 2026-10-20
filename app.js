(function () {
  "use strict";

  var CFG = window.DASHBOARD_CONFIG;
  var WATCHED_FILES = ["index.html", "style.css", "app.js", "config.js"];
  var STORAGE_KEY = "dashboard-weather";
  var startedAt = Date.now();
  var weather = null;

  // ---------- Tempo nel fuso configurato ----------

  var partsFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: CFG.timezone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  var dateFormatter = new Intl.DateTimeFormat(CFG.locale, {
    timeZone: CFG.timezone, weekday: "long", day: "numeric", month: "long",
  });
  var weekdayFormatter = new Intl.DateTimeFormat(CFG.locale, {
    timeZone: "UTC", weekday: "short",
  });

  // Ora locale come stringhe confrontabili con quelle di Open-Meteo ("YYYY-MM-DDTHH:MM").
  function localNow() {
    var p = {};
    partsFormatter.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return {
      hh: p.hour, mm: p.minute, ss: p.second,
      iso: p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute,
      hourIso: p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":00",
    };
  }

  function hhmm(isoLocal) { return isoLocal.slice(11, 16); }

  function addMinutes(isoLocal, minutes) {
    var d = new Date(isoLocal + ":00Z");
    d.setUTCMinutes(d.getUTCMinutes() + minutes);
    return d.toISOString().slice(0, 16);
  }

  // ---------- Icone ----------

  var SUN = '<circle class="i-sun" cx="32" cy="32" r="12"/>' +
    [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) {
      return '<line class="i-ray" x1="32" y1="9" x2="32" y2="14" transform="rotate(' + a + ' 32 32)"/>';
    }).join("");
  var MOON = '<path class="i-moon" d="M40 12a20 20 0 1 0 14 30A16 16 0 0 1 40 12z"/>';
  var CLOUD = '<path class="i-cloud" d="M20 50h26a11 11 0 0 0 1-22 15 15 0 0 0-28 4 9 9 0 0 0 1 18z"/>';
  var CLOUD_DARK = '<path class="i-cloud-dark" d="M20 44h26a11 11 0 0 0 1-22 15 15 0 0 0-28 4 9 9 0 0 0 1 18z"/>';

  function svg(body) { return '<svg viewBox="0 0 64 64" aria-hidden="true">' + body + "</svg>"; }
  function small(body) { return '<g transform="translate(-6 -8) scale(0.75)">' + body + "</g>"; }

  function icon(code, isDay) {
    var celestial = isDay ? SUN : MOON;
    if (code === 0) return svg(celestial);
    if (code === 1 || code === 2) return svg(small(celestial) + CLOUD);
    if (code === 3) return svg(CLOUD);
    if (code === 45 || code === 48) {
      return svg(CLOUD_DARK + [48, 54, 60].map(function (y, i) {
        return '<line class="i-fog" x1="' + (12 + i * 3) + '" y1="' + y + '" x2="' + (52 - i * 3) + '" y2="' + y + '"/>';
      }).join(""));
    }
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
      return svg(CLOUD_DARK + [20, 32, 44].map(function (x) {
        return '<circle class="i-snow" cx="' + x + '" cy="54" r="3"/>';
      }).join(""));
    }
    if (code >= 95) {
      return svg(CLOUD_DARK + '<path class="i-bolt" d="M34 40l-10 14h8l-4 10 12-16h-8l4-8z"/>');
    }
    if (code >= 51) {
      var heavy = code === 63 || code === 65 || code === 81 || code === 82;
      var xs = heavy ? [18, 28, 38, 48] : [22, 34, 46];
      return svg(CLOUD_DARK + xs.map(function (x) {
        return '<line class="i-drop" x1="' + x + '" y1="50" x2="' + (x - 4) + '" y2="58"/>';
      }).join(""));
    }
    return svg(CLOUD);
  }

  var SUNRISE_ICON = '<svg viewBox="0 0 32 32"><path class="i-line" d="M4 24h24M9 24a7 7 0 0 1 14 0M16 6v8M12 10l4-4 4 4"/></svg>';
  var SUNSET_ICON = '<svg viewBox="0 0 32 32"><path class="i-line" d="M4 24h24M9 24a7 7 0 0 1 14 0M16 6v8M12 10l4 4 4-4"/></svg>';

  var DESCRIPTIONS = {
    0: "Sereno", 1: "Prevalentemente sereno", 2: "Parzialmente nuvoloso", 3: "Coperto",
    45: "Nebbia", 48: "Nebbia con brina",
    51: "Pioviggine leggera", 53: "Pioviggine", 55: "Pioviggine intensa",
    56: "Pioviggine gelata", 57: "Pioviggine gelata intensa",
    61: "Pioggia debole", 63: "Pioggia", 65: "Pioggia forte",
    66: "Pioggia gelata", 67: "Pioggia gelata forte",
    71: "Neve debole", 73: "Neve", 75: "Neve forte", 77: "Granuli di neve",
    80: "Rovesci deboli", 81: "Rovesci", 82: "Rovesci violenti",
    85: "Rovesci di neve", 86: "Rovesci di neve forti",
    95: "Temporale", 96: "Temporale con grandine", 99: "Temporale con grandine forte",
  };

  // ---------- Rendering ----------

  var $ = function (id) { return document.getElementById(id); };

  function renderClock() {
    var now = localNow();
    $("hours").textContent = now.hh;
    $("minutes").textContent = now.mm;
    document.querySelector(".colon").classList.toggle("off", Number(now.ss) % 2 === 1);
    var date = dateFormatter.format(new Date());
    if ($("date").textContent !== date) $("date").textContent = date;
    renderPhase(now);
  }

  function renderPhase(now) {
    var phase;
    if (weather) {
      var rise = weather.daily.sunrise[0], set = weather.daily.sunset[0];
      if (now.iso < addMinutes(rise, -45)) phase = "night";
      else if (now.iso < addMinutes(rise, 45)) phase = "dawn";
      else if (now.iso < addMinutes(set, -45)) phase = "day";
      else if (now.iso < addMinutes(set, 45)) phase = "dusk";
      else phase = "night";
    } else {
      var h = Number(now.hh);
      phase = h >= 7 && h < 18 ? "day" : "night";
    }
    if (document.body.dataset.phase !== phase) document.body.dataset.phase = phase;
  }

  function renderWeather() {
    if (!weather) return;
    var c = weather.current, d = weather.daily, h = weather.hourly;

    $("now-icon").innerHTML = icon(c.weather_code, c.is_day === 1);
    $("now-temp").textContent = Math.round(c.temperature_2m) + "°";
    $("now-desc").textContent = DESCRIPTIONS[c.weather_code] || "—";
    $("now-meta").innerHTML =
      "Max " + Math.round(d.temperature_2m_max[0]) + "° · Min " + Math.round(d.temperature_2m_min[0]) + "°<br>" +
      "Percepita " + Math.round(c.apparent_temperature) + "° · Umidità " + c.relative_humidity_2m + "%<br>" +
      "Vento " + Math.round(c.wind_speed_10m) + " km/h";

    $("sun-times").innerHTML =
      "<span>" + SUNRISE_ICON + hhmm(d.sunrise[0]) + "</span>" +
      "<span>" + SUNSET_ICON + hhmm(d.sunset[0]) + "</span>";

    var start = h.time.indexOf(localNow().hourIso) + 1;
    if (start <= 0) start = 0;
    var hours = "";
    for (var i = start; i < Math.min(start + CFG.hourlyCount, h.time.length); i++) {
      var p = h.precipitation_probability[i];
      hours += '<div class="hour"><div class="h">' + hhmm(h.time[i]) + "</div>" +
        icon(h.weather_code[i], h.is_day[i] === 1) +
        '<div class="t">' + Math.round(h.temperature_2m[i]) + "°</div>" +
        '<div class="p">' + (p >= 20 ? p + "%" : "") + "</div></div>";
    }
    $("hourly").innerHTML = hours;
    $("hourly").style.setProperty("--count", CFG.hourlyCount);

    var days = "";
    for (var j = 1; j <= CFG.dailyCount && j < d.time.length; j++) {
      days += '<div class="day"><span class="d">' +
        weekdayFormatter.format(new Date(d.time[j] + "T12:00:00Z")).replace(".", "") + "</span>" +
        icon(d.weather_code[j], true) +
        '<span class="mx">' + Math.round(d.temperature_2m_max[j]) + "°</span>" +
        '<span class="mn">' + Math.round(d.temperature_2m_min[j]) + "°</span></div>";
    }
    $("daily").innerHTML = days;
    $("daily").style.setProperty("--count", CFG.dailyCount);
  }

  function setStatus(online) {
    $("net-dot").classList.toggle("offline", !online);
    var when = weather ? "Meteo delle " + hhmm(weather.current.time) : "Meteo non disponibile";
    $("updated").textContent = when + (online ? "" : " · offline, riprovo") +
      (window.DASHBOARD_VERSION ? " · versione " + window.DASHBOARD_VERSION : "");
  }

  // ---------- Dati meteo (Open-Meteo, nessuna chiave) ----------

  function weatherUrl() {
    return "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + CFG.latitude + "&longitude=" + CFG.longitude +
      "&timezone=" + encodeURIComponent(CFG.timezone) +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day" +
      "&hourly=temperature_2m,weather_code,precipitation_probability,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset" +
      "&forecast_days=" + (CFG.dailyCount + 2);
  }

  function loadWeather() {
    fetch(weatherUrl(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        weather = data;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
        renderWeather();
        setStatus(true);
      })
      .catch(function () {
        setStatus(false);
        setTimeout(loadWeather, 60 * 1000);
      });
  }

  function restoreWeather() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { weather = JSON.parse(saved); renderWeather(); }
    } catch (e) {}
  }

  // ---------- Aggiornamento automatico dopo un push su GitHub ----------

  function hash(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }

  var knownVersion = null;

  // GitHub Pages fa tenere i file in cache per 10 minuti: prima di ricaricare
  // li riscarica dalla rete, così la pagina riparte con la versione nuova.
  function reloadFresh() {
    Promise.all(WATCHED_FILES.map(function (f) {
      return fetch(f, { cache: "reload" }).catch(function () {});
    })).then(function () { location.reload(); });
  }

  function checkForUpdate() {
    // Ricarica comunque una volta al giorno per non accumulare memoria nella WebView.
    if (Date.now() - startedAt > 24 * 3600 * 1000) { reloadFresh(); return; }
    var stamp = Date.now();
    Promise.all(WATCHED_FILES.map(function (f) {
      return fetch(f + "?check=" + stamp, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      });
    })).then(function (texts) {
      var version = hash(texts.join("\u0000")).slice(0, 6);
      if (knownVersion === null) {
        knownVersion = version;
        window.DASHBOARD_VERSION = version;
        setStatus(!$("net-dot").classList.contains("offline"));
      } else if (version !== knownVersion) {
        reloadFresh();
      }
    }).catch(function () { /* rete assente: si riprova al prossimo giro */ });
  }

  // ---------- Avvio ----------

  $("city").textContent = CFG.city;
  restoreWeather();
  renderClock();
  setInterval(renderClock, 1000);
  loadWeather();
  setInterval(loadWeather, CFG.weatherRefreshMinutes * 60 * 1000);
  checkForUpdate();
  setInterval(checkForUpdate, CFG.updateCheckSeconds * 1000);
  // A mezzanotte cambiano giorno, alba e tramonto: aggiorna subito il meteo.
  setInterval(function () { if (localNow().iso.slice(11) === "00:00") loadWeather(); }, 60 * 1000);
})();

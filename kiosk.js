(function () {
  "use strict";

  var CFG = window.DASHBOARD_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var playlist = [
    { type: "weather", name: "A casa" },
    { type: "palermo", name: "Palermo" },
    { type: "nature", name: "Meraviglie del mondo", view: "gallery" },
    { type: "tech", name: "Segnali dal futuro" },
    { type: "space", name: "Oltre il nostro cielo", view: "gallery" },
    { type: "world", name: "Qui e altrove" },
    { type: "radar", name: "Mediterraneo" },
    { type: "nature", name: "Un altro paesaggio", view: "gallery" },
    { type: "weather", name: "Di nuovo a casa" },
    { type: "ambient", name: "Atmosfere" },
  ];
  var currentIndex = -1, activeEntry = null, started = 0, duration = 40000;
  var transitioning = false;
  var gallery = [], news = [], galleryCursors = { nature: 0, space: 0 };
  var newsCursor = 0, activeNews = [], newsStart = 0, newsPage = -1;
  var webcamCards = [], radarFrame = null, radarTimer = null, radarRetryAfter = 0;
  var canvasFrame = null, canvasLastFrame = 0;
  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var shortTime = new Intl.DateTimeFormat(CFG.locale, { timeZone: CFG.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  var newsDate = new Intl.DateTimeFormat(CFG.locale, { timeZone: CFG.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  function readCache(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (error) { return fallback; }
  }
  function saveCache(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (error) {}
  }
  function safeUrl(url) {
    try { return new URL(url).protocol === "https:" ? url : ""; } catch (error) { return ""; }
  }
  function fetchJSON(path) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 10000);
    return fetch(path + "?t=" + Date.now(), { cache: "no-store", signal: controller.signal })
      .then(function (response) { if (!response.ok) throw new Error(response.status); return response.json(); })
      .finally(function () { clearTimeout(timer); });
  }
  function validGallery(items) {
    return Array.isArray(items) ? items.filter(function (item) {
      return item && /^(nature|space|palermo)$/.test(item.group) &&
        /^assets\/gallery\/[a-z0-9-]+\.jpg$/.test(item.image) && typeof item.title === "string";
    }) : [];
  }
  function freshNews(items) {
    return Array.isArray(items) ? items.filter(function (item) {
      var age = Date.now() - Date.parse(item && item.publishedAt);
      return item && typeof item.title === "string" && item.title.length <= 240 &&
        safeUrl(item.url) && age >= -15 * 60000 && age < 72 * 3600000;
    }) : [];
  }
  function refreshContent() {
    fetchJSON("data/gallery.json").then(function (data) {
      var items = validGallery(data);
      if (items.length) { gallery = items; saveCache("kiosk-gallery", items); }
    }).catch(function () {});
    fetchJSON("data/news.json").then(function (data) {
      if (!data || !Array.isArray(data.items)) return;
      news = freshNews(data.items);
      saveCache("kiosk-news", news);
    }).catch(function () {});
  }

  function loadImage(url, timeout) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var timer = setTimeout(function () { finish(false); }, timeout || 8000);
      function finish(ok) {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (ok) resolve(image); else reject(new Error("Image unavailable"));
      }
      image.onload = function () { finish(true); };
      image.onerror = function () { finish(false); };
      image.src = url;
    });
  }

  // ---------- Galleria: le fotografie sono incluse nel sito ----------

  function prepareGallery(type) {
    var items = gallery.filter(function (item) { return item.group === type; });
    if (!items.length) return Promise.resolve(false);
    var item = items[galleryCursors[type]++ % items.length];
    return loadImage(item.image).then(function () {
      $("gallery-image").src = item.image;
      $("gallery-image").alt = item.caption;
      $("gallery-eyebrow").textContent = type === "space" ? "CARTOLINE DAL COSMO" : "IL MONDO, CON CALMA";
      $("gallery-title").textContent = item.title;
      $("gallery-caption").textContent = item.caption;
      $("gallery-number").textContent = (type === "space" ? "COSMO" : "ATLANTE") + " / " + String(items.indexOf(item) + 1).padStart(2, "0");
      var credit = $("gallery-credit");
      credit.textContent = "Foto: " + item.credit + " · ";
      var link = document.createElement("a");
      link.href = safeUrl(item.licenseUrl); link.textContent = item.license;
      credit.appendChild(link);
      credit.appendChild(document.createTextNode(" · "));
      var source = document.createElement("a");
      source.href = safeUrl(item.source); source.textContent = "Fonte originale";
      credit.appendChild(source);
      credit.appendChild(document.createElement("br"));
      credit.appendChild(document.createTextNode(item.note || "Fotografia d’archivio"));
      $("scene-gallery").style.setProperty("--gallery-seconds", (CFG.sceneSeconds[type] || 35) + "s");
      return true;
    }).catch(function () { return false; });
  }

  // ---------- Palermo: solo i widget ufficiali di condivisione ----------

  function createWebcams() {
    (CFG.webcams || []).forEach(function (cam) {
      var card = document.createElement("article");
      card.className = "webcam-card";
      var link = document.createElement("a");
      link.href = "https://www.skylinewebcams.com/it/webcam/italia/sicilia/palermo/" + cam.page + ".html";
      link.target = "_blank"; link.rel = "noopener"; link.tabIndex = -1;
      var fallback = document.createElement("div");
      fallback.className = "webcam-fallback"; fallback.textContent = "Uno sguardo su " + cam.name + "…";
      var label = document.createElement("div"); label.className = "webcam-label";
      var title = document.createElement("h2"); title.textContent = cam.name;
      var stamp = document.createElement("span"); stamp.textContent = "In attesa dello scatto";
      label.appendChild(title); label.appendChild(stamp); link.appendChild(fallback);
      card.appendChild(link); card.appendChild(label); $("webcam-grid").appendChild(card);
      webcamCards.push({ card: card, link: link, stamp: stamp, fallback: fallback, config: cam, loadedAt: 0, retryAfter: 0, pending: false });
    });
  }
  function refreshWebcams() {
    webcamCards.forEach(function (cam) {
      if (cam.pending || Date.now() < cam.retryAfter || Date.now() - cam.loadedAt < 5 * 60000) return;
      cam.pending = true;
      // The public embed endpoint, not the live stream or an extracted frame.
      var url = "https://embed.skylinewebcams.com/img/" + cam.config.id + ".jpg?t=" + Math.floor(Date.now() / 300000);
      loadImage(url, 10000).then(function (image) {
        var previous = cam.link.querySelector("img");
        image.alt = cam.config.name + " · widget fotografico SkylineWebcams";
        if (previous) previous.replaceWith(image); else cam.link.appendChild(image);
        cam.card.classList.remove("is-unavailable");
        cam.loadedAt = Date.now();
        cam.stamp.textContent = "Ricevuta " + shortTime.format(new Date(cam.loadedAt));
      }).catch(function () {
        cam.retryAfter = Date.now() + 60000;
        if (cam.loadedAt) cam.stamp.textContent = "Ultimo scatto " + shortTime.format(new Date(cam.loadedAt));
        else {
          cam.card.classList.add("is-unavailable");
          $("webcam-archive-credit").hidden = false;
          cam.fallback.textContent = "Scatto momentaneamente non disponibile";
          cam.stamp.textContent = "Riprovo al prossimo passaggio";
        }
      }).finally(function () { cam.pending = false; });
    });
  }

  // ---------- Notizie: un titolo ogni 15 secondi, fonti e date visibili ----------

  function renderNews(elapsed) {
    if (!activeNews.length) return;
    var seconds = Math.max(8, CFG.newsItemSeconds || 15);
    var page = Math.floor(elapsed / (seconds * 1000));
    if (page !== newsPage) {
      newsPage = page;
      var index = (newsStart + page) % activeNews.length;
      var story = activeNews[index];
      $("news-title").textContent = story.title;
      $("news-title").style.fontSize = (story.title.length > 130 ? 5.1 : story.title.length > 90 ? 5.8 : 6.5) + "vh";
      $("news-category").textContent = story.category || "Tecnologia";
      $("news-position").textContent = String(index + 1).padStart(2, "0") + " / " + String(activeNews.length).padStart(2, "0");
      $("news-byline").textContent = story.source + " · " + newsDate.format(new Date(story.publishedAt));
      [1, 2].forEach(function (offset) {
        var next = activeNews[(index + offset) % activeNews.length];
        $("news-next-source-" + offset).textContent = next.source;
        $("news-next-title-" + offset).textContent = next.title;
        $("news-next-title-" + offset).style.fontSize = (next.title.length > 130 ? 2.45 : 3) + "vh";
      });
      // Fit the full headline; do not hide the end of a long title.
      var feature = document.querySelector(".news-feature");
      var headline = $("news-title");
      var byline = $("news-byline");
      var size = parseFloat(headline.style.fontSize);
      while (byline.getBoundingClientRect().bottom > feature.getBoundingClientRect().bottom - innerHeight * .025 && size > 3.5) {
        size -= .15; headline.style.fontSize = size + "vh";
      }
    }
    $("news-reading-progress").style.transform = "scaleX(" + ((elapsed % (seconds * 1000)) / (seconds * 1000)) + ")";
  }

  // ---------- Un pianeta, quattro fusi orari ----------

  var cities = [
    ["Palermo", CFG.timezone], ["New York", "America/New_York"],
    ["Tokyo", "Asia/Tokyo"], ["Sydney", "Australia/Sydney"],
  ].map(function (city) {
    var card = document.createElement("article"); card.className = "world-clock";
    var name = document.createElement("h2"); name.textContent = city[0];
    var time = document.createElement("time"), date = document.createElement("p");
    card.appendChild(name); card.appendChild(time); card.appendChild(date); $("world-clocks").appendChild(card);
    return {
      time: time, date: date,
      clock: new Intl.DateTimeFormat(CFG.locale, { timeZone: city[1], hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      calendar: new Intl.DateTimeFormat(CFG.locale, { timeZone: city[1], weekday: "short", day: "numeric", month: "short" }),
    };
  });
  function renderWorld() {
    var now = new Date();
    cities.forEach(function (city) { city.time.textContent = city.clock.format(now); city.date.textContent = city.calendar.format(now); });
  }

  // ---------- Mappa esterna: solo durante la sua scena, con timeout ----------

  function startRadar() {
    var frame = document.createElement("iframe");
    radarFrame = frame;
    frame.title = "Mappa del vento sul Mediterraneo · Windy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.tabIndex = -1;
    frame.src = "https://embed.windy.com/embed.html?type=map&location=coordinates&metricWind=km%2Fh&metricTemp=%C2%B0C&zoom=6&overlay=wind&level=surface&lat=" + CFG.latitude + "&lon=" + CFG.longitude;
    frame.onload = function () { if (radarFrame === frame) { clearTimeout(radarTimer); frame.classList.add("is-ready"); } };
    function unavailable() {
      if (radarFrame !== frame) return;
      radarRetryAfter = Date.now() + 10 * 60000;
      enterScene(currentIndex + 1);
    }
    frame.onerror = unavailable;
    radarTimer = setTimeout(unavailable, 15000);
    $("radar-container").appendChild(frame);
  }

  // ---------- Stelle: canvas limitato a 960x540, attivo solo in Atmosfere ----------

  var canvas = $("ambient-canvas"), context = canvas.getContext("2d");
  canvas.width = 960; canvas.height = 540;
  var stars = Array.from({ length: 70 }, function (_, index) {
    // Deterministic positions prevent a flash of a new pattern on every visit.
    return { x: (index * 137.508) % 960, y: (index * 83.217) % 540, radius: index % 4 === 0 ? 1.2 : .6, phase: index * .7 };
  });
  function drawStars(timestamp) {
    if (!activeEntry || activeEntry.type !== "ambient" || document.hidden) { canvasFrame = null; return; }
    if (timestamp - canvasLastFrame >= 1000 / 24 || motionQuery.matches) {
      canvasLastFrame = timestamp;
      context.clearRect(0, 0, 960, 540);
      stars.forEach(function (star) {
        context.globalAlpha = motionQuery.matches ? .5 : .3 + .3 * Math.sin(timestamp / 3500 + star.phase);
        context.fillStyle = "#e6fff4";
        context.beginPath(); context.arc(star.x, star.y, star.radius, 0, Math.PI * 2); context.fill();
      });
    }
    canvasFrame = motionQuery.matches ? null : requestAnimationFrame(drawStars);
  }

  // ---------- Regia: una scena alla volta, nessuna interazione ----------

  function cleanup() {
    if (canvasFrame !== null) cancelAnimationFrame(canvasFrame);
    canvasFrame = null;
    if (radarFrame) { radarFrame.onload = radarFrame.onerror = null; radarFrame.remove(); radarFrame = null; }
    clearTimeout(radarTimer);
    if (activeEntry && activeEntry.type === "tech") newsCursor = newsStart + newsPage + 1;
  }
  function eligible(entry) {
    if (entry.type === "tech") return freshNews(news).length > 0;
    if (entry.view === "gallery") return gallery.some(function (item) { return item.group === entry.type; });
    if (entry.type === "radar") return navigator.onLine && Date.now() >= radarRetryAfter;
    if (entry.type === "palermo") return webcamCards.length > 0;
    return true;
  }
  function enterScene(index, attempts) {
    if (transitioning) return;
    attempts = attempts || 0;
    if (attempts >= playlist.length) return;
    index = index % playlist.length;
    var entry = playlist[index];
    if (!eligible(entry)) { enterScene(index + 1, attempts + 1); return; }
    transitioning = true;
    var ready = entry.view === "gallery" ? prepareGallery(entry.type) : Promise.resolve(true);
    ready.then(function (ok) {
      transitioning = false;
      if (!ok) { enterScene(index + 1, attempts + 1); return; }
      cleanup();
      currentIndex = index; activeEntry = entry; started = Date.now();
      duration = Math.max(8, Number(CFG.sceneSeconds[entry.type]) || 35) * 1000;
      document.querySelectorAll(".scene").forEach(function (scene) {
        var active = scene.id === "scene-" + (entry.view || entry.type);
        scene.classList.toggle("is-active", active);
        scene.setAttribute("aria-hidden", String(!active));
      });
      document.body.dataset.scene = entry.type;
      $("scene-number").textContent = String(index + 1).padStart(2, "0");
      $("scene-name").textContent = entry.name;
      var next = index + 1;
      while (!eligible(playlist[next % playlist.length])) next++;
      $("scene-next").textContent = playlist[next % playlist.length].name;
      document.querySelectorAll("#scene-dots span").forEach(function (dot, i) { dot.classList.toggle("is-current", i === index); });
      $("scene-progress-fill").style.transition = "none";
      $("scene-progress-fill").style.transform = "scaleX(0)";
      if (entry.type === "palermo") refreshWebcams();
      if (entry.type === "world") renderWorld();
      if (entry.type === "radar") startRadar();
      if (entry.type === "ambient") canvasFrame = requestAnimationFrame(drawStars);
      if (entry.type === "tech") {
        activeNews = freshNews(news); newsStart = newsCursor % activeNews.length; newsPage = -1;
        $("news-freshness").textContent = "Titoli dai feed originali · HDblog e Punto Informatico · " + activeNews.length + " notizie recenti";
        renderNews(0);
      }
    }).catch(function () { transitioning = false; enterScene(index + 1, attempts + 1); });
  }
  function tick() {
    if (!activeEntry || document.hidden) return;
    var elapsed = Date.now() - started;
    if (elapsed >= duration && !transitioning) { enterScene(currentIndex + 1); return; }
    $("scene-progress-fill").style.transition = "transform 1s linear";
    $("scene-progress-fill").style.transform = "scaleX(" + Math.min(1, elapsed / duration) + ")";
    if (activeEntry.type === "tech") renderNews(elapsed);
    if (activeEntry.type === "world") renderWorld();
    if (activeEntry.type === "palermo") refreshWebcams();
  }

  // Best effort: supported browsers keep the display awake while the page is visible.
  var wakeLock = null;
  function keepAwake() {
    if (!navigator.wakeLock || document.hidden || wakeLock) return;
    navigator.wakeLock.request("screen").then(function (lock) {
      wakeLock = lock;
      lock.addEventListener("release", function () { wakeLock = null; });
    }).catch(function () {});
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (canvasFrame !== null) cancelAnimationFrame(canvasFrame); canvasFrame = null; }
    else {
      keepAwake(); tick();
      if (activeEntry && activeEntry.type === "ambient" && canvasFrame === null) canvasFrame = requestAnimationFrame(drawStars);
    }
  });
  window.addEventListener("online", refreshContent);
  $("mini-city").textContent = CFG.city;
  gallery = validGallery(readCache("kiosk-gallery", []));
  news = freshNews(readCache("kiosk-news", []));
  playlist.forEach(function () { $("scene-dots").appendChild(document.createElement("span")); });
  createWebcams();
  refreshContent();
  enterScene(0);
  keepAwake();
  setInterval(tick, 1000);
  setInterval(refreshContent, Math.max(1, CFG.contentRefreshMinutes || 10) * 60000);
})();

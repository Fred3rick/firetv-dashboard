const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const results = path.join(root, 'test-results');
fs.mkdirSync(results, { recursive: true });
const now = new Date('2026-11-07T22:58:00+01:00');
const initialNews = JSON.parse(fs.readFileSync(path.join(root, 'data/news.json')));
const fixtureNews = { updatedAt: now.toISOString(), items: initialNews.items.map(item => ({ ...item, publishedAt: now.toISOString() })) };
assert(fixtureNews.items.length > 2, 'The initial feed should contain real headlines');
const weather = {
  current: { time: '2026-11-07T22:45', temperature_2m: 22, apparent_temperature: 20, relative_humidity_2m: 100, weather_code: 1, wind_speed_10m: 15, is_day: 0 },
  hourly: {
    time: Array.from({length:48}, (_, i) => new Date(Date.UTC(2026,10,7,i)).toISOString().slice(0,16)),
    temperature_2m: Array(48).fill(22), weather_code: Array(48).fill(1), precipitation_probability: Array(48).fill(100), is_day: Array(48).fill(0),
  },
  daily: {
    time: Array.from({length:7}, (_, i) => `2026-11-${String(7+i).padStart(2,'0')}`), sunrise: Array(7).fill('2026-11-07T06:45'), sunset: Array(7).fill('2026-11-07T17:00'),
    temperature_2m_max: Array(7).fill(25), temperature_2m_min: Array(7).fill(17), weather_code: Array(7).fill(1),
  },
};
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url,'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error,body) => {
    res.writeHead(error ? 404 : 200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
    res.end(error ? 'Not found' : body);
  });
});

async function geometry(page) {
  return page.evaluate(() => {
    const issues = [];
    const box = s => document.querySelector(s).getBoundingClientRect();
    const type = document.body.dataset.scene;
    const footer = box('.kiosk-footer');
    const within = selectors => selectors.forEach(s => {
      const r = box(s), el = document.querySelector(s);
      if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > footer.top - 2) issues.push(s + ' outside safe area');
      if (el.scrollWidth > el.clientWidth + 2) issues.push(s + ' horizontal overflow');
    });
    if (type === 'weather') {
      within(['.layout','.clock','.date','.now-block','.hourly','.daily','.status']);
      if (box('.now-block').bottom >= box('.hourly').top) issues.push('weather overlaps hours');
      if (box('.daily').bottom >= box('.status').top) issues.push('days overlap status');
    } else if (type === 'tech') {
      within(['#scene-tech .scene-heading','.news-feature','.news-next','#news-title','#news-byline','#news-next-title-1','#news-next-title-2']);
      if (box('#news-byline').bottom > box('.news-feature').bottom - 2) issues.push('headline runs into reading progress');
      if (document.querySelector('.news-next').scrollHeight > document.querySelector('.news-next').clientHeight + 2) issues.push('sidebar vertical overflow');
    } else if (type === 'palermo') within(['#scene-palermo .scene-heading','.webcam-grid','#scene-palermo .scene-credit']);
    else if (type === 'nature' || type === 'space') within(['.gallery-copy','.gallery-credit']);
    else if (type === 'world') within(['.world-copy','.world-clocks']);
    else if (type === 'ambient') within(['.ambient-copy']);
    return {type,issues};
  });
}

(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch(fs.existsSync(chrome) ? {executablePath:chrome,headless:true} : {headless:true});
  const errors = [];
  let checks = 0;
  try {
    for (const [width,height,fallback] of [[960,540,false],[1920,1080,false],[960,540,true]]) {
      const context = await browser.newContext({viewport:{width,height}});
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.clock.install({time:now});
      await page.route('https://api.open-meteo.com/**', r => r.fulfill({json:weather}));
      await page.route('**/data/news.json?*', r => r.fulfill({json:fixtureNews}));
      if (fallback) await page.route(/https:\/\/fonts\./, r => r.abort());
      if (!process.env.LIVE_SOURCES) {
        await page.route('https://embed.skylinewebcams.com/**', r => r.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(root,'assets/gallery/palermo.jpg'))}));
        await page.route('https://embed.windy.com/**', r => r.fulfill({contentType:'text/html',body:'<html><body style="background:#193642;color:white">Windy test fixture</body></html>'}));
      }
      const galleryResponse = page.waitForResponse('**/data/gallery.json?*');
      await page.goto(base);
      await page.waitForFunction(() => document.querySelector('#now-desc').textContent === 'Prevalentemente sereno' && document.body.dataset.scene === 'weather');
      await page.evaluate(() => document.fonts.ready);
      await galleryResponse;
      assert.equal(await page.locator('.day').count(),5,'Render all five daily forecasts');
      const sequence = [['weather',40],['palermo',45],['nature',35],['tech',60],['space',40],['world',40],['radar',40],['nature',35],['weather',40],['ambient',35]];
      for (let i=0;i<sequence.length;i++) {
        const [type,seconds] = sequence[i];
        await page.waitForFunction(t => document.body.dataset.scene === t, type);
        await page.clock.runFor(1100);
        assert.equal(await page.locator('.scene.is-active').count(),1);
        const nextLabels = ['Palermo','Meraviglie del mondo','Segnali dal futuro','Oltre il nostro cielo','Qui e altrove','Mediterraneo','Un altro paesaggio','Di nuovo a casa','Atmosfere','A casa'];
        assert.equal(await page.locator('#scene-next').textContent(),nextLabels[i]);
        if (type === 'palermo' && process.env.LIVE_SOURCES) await page.waitForTimeout(3000);
        if (type === 'radar' && process.env.LIVE_SOURCES) await page.waitForTimeout(5000);
        const result = await geometry(page);
        assert.deepEqual(result.issues,[],`${width}x${height} fallback=${fallback} ${type}: ${result.issues.join(', ')}`);
        await page.screenshot({path:path.join(results,`${width}-${fallback?'fallback':'outfit'}-${i}-${type}.png`),animations:'disabled'});
        if (type === 'tech') {
          const headline = await page.locator('#news-title').textContent();
          await page.clock.fastForward(16000);
          assert.notEqual(await page.locator('#news-title').textContent(),headline,'News should advance without input');
        }
        if (type !== 'radar') assert.equal(await page.locator('#radar-container iframe').count(),0,'Release external maps when hidden');
        checks++;
        await page.clock.fastForward(seconds*1000+1100);
      }
      await page.waitForFunction(() => document.body.dataset.scene === 'weather');
      // Loss of connectivity must not stop the clock or the carousel.
      const previousClock = await page.locator('#mini-clock').textContent();
      await context.setOffline(true);
      for (let i=0;i<8;i++) {
        await page.clock.fastForward(65000);
        await page.waitForTimeout(50);
      }
      assert.notEqual(await page.locator('#mini-clock').textContent(),previousClock);
      assert.equal(await page.locator('.scene.is-active').count(),1);
      assert.equal(await page.locator('#radar-container iframe').count(),0);
      checks++;
      await context.close();
    }
    // Stress cases are separate from the live-source visual checks.
    for (const variant of ['long-headlines','stale-news','unavailable-gallery','map-timeout']) {
      const context = await browser.newContext({viewport:{width:960,height:540}});
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.clock.install({time:now});
      await page.route('https://api.open-meteo.com/**', r => r.fulfill({json:weather}));
      await page.route('https://embed.skylinewebcams.com/**', r => r.abort());
      await page.route('https://embed.windy.com/**', r => {
        if (variant !== 'map-timeout') return r.fulfill({contentType:'text/html',body:'<html>map fixture</html>'});
        // Leave the request pending to exercise the 15-second escape hatch.
      });
      const items = fixtureNews.items.map(item => ({...item}));
      if (variant === 'stale-news') items.forEach(item => {item.publishedAt='2023-05-30T12:00:00Z';});
      if (variant === 'long-headlines') items.forEach(item => {item.title=('Un titolo molto lungo sulle nuove tecnologie e sulle scoperte scientifiche nel mondo ').repeat(3).slice(0,240);});
      await page.route('**/data/news.json?*', r => r.fulfill({json:{...fixtureNews,items}}));
      if (variant === 'unavailable-gallery') await page.route('**/data/gallery.json?*', r => r.fulfill({json:[]}));
      await page.goto(base);
      await page.waitForFunction(() => document.body.dataset.scene === 'weather');
      await page.clock.runFor(1200);
      await page.clock.fastForward(41000);
      await page.waitForFunction(() => document.body.dataset.scene === 'palermo');
      await page.clock.fastForward(46000);
      if (variant === 'unavailable-gallery') {
        await page.waitForFunction(() => document.body.dataset.scene === 'tech');
      } else {
        await page.waitForFunction(() => document.body.dataset.scene === 'nature');
        await page.clock.fastForward(36000);
        await page.waitForFunction(t => document.body.dataset.scene === t, variant === 'stale-news' ? 'space' : 'tech');
      }
      if (variant === 'long-headlines') assert.deepEqual((await geometry(page)).issues,[],'Long headlines must remain readable');
      if (variant === 'map-timeout') {
        await page.clock.fastForward(61000);
        await page.waitForFunction(() => document.body.dataset.scene === 'space');
        await page.clock.fastForward(41000);
        await page.waitForFunction(() => document.body.dataset.scene === 'world');
        await page.clock.fastForward(41000);
        await page.waitForFunction(() => document.body.dataset.scene === 'radar');
        await page.clock.fastForward(16000);
        await page.waitForFunction(() => document.body.dataset.scene === 'nature');
        assert.equal(await page.locator('#radar-container iframe').count(),0,'A stalled map must be removed');
      }
      checks++;
      await context.close();
    }
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log(`${checks} browser checks passed: rotation, layout, long/stale news, unavailable gallery, map timeout, offline clock. No page errors.`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode=1; });

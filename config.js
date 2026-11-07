// Impostazioni della dashboard: modifica qui e fai push, la TV si aggiorna da sola.
window.DASHBOARD_CONFIG = {
  city: "Palermo",
  latitude: 38.1157,
  longitude: 13.3615,
  timezone: "Europe/Rome",
  locale: "it-IT",
  // Ogni quanti minuti richiedere il meteo a Open-Meteo.
  weatherRefreshMinutes: 15,
  // Ogni quanti secondi controllare se su GitHub c'è una nuova versione del sito.
  updateCheckSeconds: 30,
  // Ore di previsione mostrate nella striscia oraria.
  hourlyCount: 8,
  // Giorni di previsione mostrati (oggi escluso).
  dailyCount: 5,
  // Kiosk: scene automatiche, nessun telecomando e nessun audio.
  contentRefreshMinutes: 10,
  newsItemSeconds: 15,
  sceneSeconds: {
    weather: 40,
    palermo: 45,
    nature: 35,
    tech: 60,
    space: 40,
    world: 40,
    radar: 40,
    ambient: 35,
  },
  // Widget fotografici ufficiali SkylineWebcams, aggiornati ogni 5 minuti.
  webcams: [
    { name: "Piazza Mondello", id: 574, page: "piazza-mondello" },
    { name: "La Cattedrale", id: 582, page: "cattedrale-di-palermo" },
    { name: "Punta Celesi", id: 234, page: "punta-celesi" },
  ],
};

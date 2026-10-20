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
};

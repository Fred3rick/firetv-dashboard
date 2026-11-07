# Casa · Fire TV Kiosk

Una finestra sul mondo, sempre accesa e completamente automatica.
Si apre sulla TV e continua a scorrere senza telecomando, login o audio.

**Sito:** https://fred3rick.github.io/firetv-dashboard/

## La rotazione

| Scena | Durata | Contenuto |
| --- | --- | --- |
| A casa | 40 s | Orologio, data, alba/tramonto, meteo e previsioni di Palermo |
| Palermo | 45 s | Mondello, Cattedrale e Punta Celesi in simultanea |
| Meraviglie del mondo | 35 s | Fotografie di paesaggi con movimento lento |
| Segnali dal futuro | 60 s | Quattro notizie tech, un titolo ogni 15 secondi |
| Oltre il nostro cielo | 40 s | Immagini NASA e James Webb |
| Qui e altrove | 40 s | La Terra e gli orari di Palermo, New York, Tokyo e Sydney |
| Mediterraneo | 40 s | Mappa animata del vento, fornita da Windy |
| Un altro paesaggio | 35 s | Una nuova fotografia dalla galleria |
| Di nuovo a casa | 40 s | Ritorno al meteo |
| Atmosfere | 35 s | Gradienti in movimento e stelle generate sul dispositivo |

Il giro dura circa sette minuti. Le fotografie e le notizie cambiano anche
tra un giro e l'altro. L'ora resta visibile in tutte le scene.
Le durate, la città e gli intervalli di aggiornamento sono in `config.js`.

## Dati e immagini

- **Meteo:** Open-Meteo, ogni 15 minuti, con ultimo dato salvato in caso di rete assente.
- **Palermo:** widget fotografici ufficiali [SkylineWebcams](https://www.skylinewebcams.com/it/support/faq.html).
  Sono immagini aggiornate ogni cinque minuti, non flussi video. Il simbolo play
  fa parte del widget originale; non serve premerlo per aggiornare le immagini.
  Si conserva l'ultimo scatto ricevuto quando una sorgente non risponde.
- **Tech:** titoli dai feed originali di [HDblog](https://www.hdblog.it/feed/) e
  [Punto Informatico](https://www.punto-informatico.it/feed/), con fonte e data.
  Niente articoli copiati o riassunti inventati. Il filtro esclude offerte e
  promozioni riconoscibili. Non vengono mostrate notizie più vecchie di 72 ore.
- **Galleria:** cinque paesaggi, un panorama di Palermo per il fallback e tre
  immagini spaziali incluse nel sito. Autori, licenze, URL originali e note sul
  ritaglio sono conservati in `data/gallery.json` e mostrati sulle fotografie.
  Le fotografie sono d'archivio; la Terra è un composito satellitare.
- **Mappa:** [widget ufficiale Windy](https://embed.windy.com/config/map), caricato
  solo durante la sua scena e rimosso alla fine. Se non carica entro 15 secondi,
  il kiosk passa avanti e riprova più tardi.

Le scene senza contenuti disponibili vengono saltate. La sequenza e l'orologio
continuano in caso di errori di rete. Il movimento rispetta `prefers-reduced-motion`.
La richiesta di mantenere acceso lo schermo viene effettuata nei browser che
supportano Screen Wake Lock; il risparmio energetico del dispositivo resta
gestito dalla Fire TV.

## Pubblicazione e aggiornamenti

Il workflow `.github/workflows/publish.yml` pubblica su GitHub Pages:

- a ogni push su `main`;
- ogni ora, aggiornando i titoli prima della pubblicazione;
- manualmente, tramite **Actions → Publish kiosk → Run workflow**.

In **Settings → Pages**, la sorgente deve essere **GitHub Actions**.
Non servono servizi di proxy RSS, chiavi API o segreti aggiuntivi.
Gli orari dei job pianificati dipendono da GitHub e possono subire ritardi.

La pagina cerca nuovi titoli ogni dieci minuti, senza riavviare il carosello.
Controlla le modifiche al codice ogni 30 secondi e ricarica i file aggiornati;
si ricarica anche una volta al giorno per limitare l'accumulo di memoria.
`data/news.json` nella repo è una fotografia iniziale: il workflow genera il feed
aggiornato direttamente nell'artefatto pubblicato, senza commit orari automatici.

## Sviluppo e verifica

Il sito è HTML/CSS/JavaScript statico e non ha dipendenze di runtime.

```sh
python3 -m http.server 8765
```

Apri `http://localhost:8765`. Per aggiornare le notizie localmente:

```sh
python3 scripts/update_news.py
```

Test del parser RSS (senza dipendenze) e test del carosello nel browser:

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
npm ci
npx playwright install chromium
npm run test:browser
```

Su macOS i test usano Google Chrome se già installato. Gli screenshot finiscono
in `test-results/`, ignorata da Git. `LIVE_SOURCES=1 npm run test:browser` verifica
anche i widget remoti reali; il test standard usa risposte ripetibili.

`scripts/prepare_gallery.py` ricostruisce la galleria curata e i relativi crediti;
è uno strumento manuale, non viene eseguito a ogni pubblicazione.

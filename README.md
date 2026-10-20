# Fire TV Dashboard

Dashboard sempre accesa per la TV: orologio, data e meteo (Open-Meteo).

- `config.js`: città, coordinate, intervalli di aggiornamento.
- `style.css`, `index.html`, `app.js`: aspetto e logica.

Dopo un `git push` GitHub Pages pubblica la nuova versione e la pagina
aperta sulla TV la rileva entro `updateCheckSeconds` e si ricarica da sola.

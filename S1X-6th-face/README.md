# S1X: Sixth Face

Kokeellinen haara, joka perustuu S1X-pelin toimivaan versioon.

## Uusi ominaisuus

Pelaaja voi valita omalta laitteeltaan kuvan kuution kuudenneksi eli `bottom`-sivuksi.

- Kuva rajataan automaattisesti keskeltä neliöksi.
- Kuva pienennetään selaimessa 1200 × 1200 pikseliin.
- Kuva tallennetaan IndexedDB-tietokantaan vain kyseiselle laitteelle.
- Kuvaa ei lähetetä palvelimelle.
- Selain jakaa kuvan automaattisesti yhdeksäksi palaksi.
- Pelin voi aloittaa myös ilman omaa kuvaa.
- Nollaus poistaa myös tallennetun oman kuvan.

## Julkaiseminen

Vie koko kansio GitHub Pagesiin. `index.html`, `images.json` ja `images/` säilytetään samassa rakenteessa.

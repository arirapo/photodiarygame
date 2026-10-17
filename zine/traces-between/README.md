# TRACES BETWEEN — dokumentaation zine-pohja

Avaa `index.html` selaimessa. Sama HTML ja CSS palvelevat verkkoa ja myöhempää PDF-/printtiversiota. Ei rakennusvaihetta tai ulkoisia riippuvuuksia.

## Rakenne

- `index.html`: 16 sivua, prologi (1–3), osa 1 (4–8), osa 2 (9–13), epilogi (14–16).
- `styles.css`: verkkonäkymä, mobiili ja A4-vaakatulostus.
- `assets/images/`: originaalikuvat, screenshotit, kaaviot ja niiden verkkoversiot.
- `assets/qr/`: lopullisiin osoitteisiin johtavat, testatut QR-kuvat.

Harmaat aineistopaikat ja hakasulkeissa olevat tekstit ovat toimituksellisia paikkoja. Päiväkirjaotteita tai henkilökohtaisia muistoja ei ole keksitty. Korvaa paikat omalla aineistolla; lisää kuville alt-teksti, kuvateksti, tekijä ja lähde. Nykyiset QR-paikat eivät ole skannattavia koodeja.

Kuvapaikan korvaaminen:

```html
<figure>
  <img src="assets/images/oma-kuva.jpg" alt="Konkreettinen kuvaus kuvasta" style="max-width:100%;max-height:75mm;object-fit:contain">
  <figcaption>Kuvan nimi, vuosi. Kuva: Ari Rapo.</figcaption>
</figure>
```

## Verkko

GitHub Pagesin nykyisen juurijulkaisun alla osoite on `/zine/traces-between/`. Linkki aikajanaan on suhteellinen: `../../T1M3L1N3/tekijyyden_jaljet_v9.html`. Päivitä linkki ja QR-hakemisto, jos aikajanan versio vaihtuu. Aikajana avataan linkistä; näin sen laaja sisältö ei kuormita mobiili- tai tulostesivuja. Älä korvaa projektin pääsivua.

## PDF ja kierresidonta

Valitse selaimessa Tulosta / tallenna PDF, paperi A4, vaaka, mittakaava 100 %, ei selaimen ylä-/alatunnisteita ja ei lisämarginaaleja. Tarkista esikatselusta 16 sivua. CSS:n sivukoko on 297 × 210 mm; vasemmalla 23 mm sidontavaraa. Pohja olettaa yksipuolisen vasemmalta sidottavan vedoksen. Kaksipuoliseen painoon suunnittele peilautuvat sidontamarginaalit painon kanssa.

Sivu on kiinteän kokoinen printissä: tarkista jokaisen sisältömuutoksen jälkeen sivumäärä ja mahdollinen ylivuoto. Pohja ei leikkaa ylipitkää sisältöä piiloon. Tämä ei vielä ole painovalmis aineisto. Kuvat, resoluutio, fontit, värit, leikkuuvarat ja sidonta tarkistetaan lopullisesta PDF:stä ja fyysisestä vedoksesta.

Kuultopaperi ja 3D-fragmentti ovat CSS:llä tehtyjä materiaaliviitteitä. Varsinaiset kuultopaperilehdet ja fyysiset liitteet lisätään printin tuotantosuunnitelmaan erikseen. Testaa lopulliset QR-koodit sekä näytöltä että paperivedoksesta.

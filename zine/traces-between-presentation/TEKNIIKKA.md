# Offline ja iPad

## Paikallisverkossa, ilman internetiä

1. Pura ZIP Macille ja avaa `Avaa-esikatselu.command`.
2. Yhdistä iPad samaan Wi-Fi-verkkoon. Avaa Safarissa `http://MACIN-IP:8773/`. Macin IP näkyy Järjestelmäasetukset → Wi-Fi → Tiedot → TCP/IP.
3. Katkaise internet mutta säilytä Macin ja iPadin välinen Wi-Fi-yhteys. Lataa julkaisu uudelleen ja käy kaikki yhdeksän sivua. Katso Aika-timelapsen koko noin 41 sekunnin kierros sekä 200-animaation kokonainen kuvasarja.
4. Macin on pysyttävä päällä, hereillä ja palvelimen käynnissä. Tämä reitti tarvitsee paikallisverkon mutta ei internetiä.

## iPad yksin ja kokonaan lentotilassa

Tämä versio ei ole vielä verkossa. Kun hakemisto myöhemmin julkaistaan HTTPS-osoitteessa:

1. Avaa HTTPS-julkaisu iPadin Safarissa ja lisää Koti-valikkoon.
2. Avaa julkaisu Koti-valikosta. Asetukset → Valmistele offline. Odota vahvistusta kaikkien 237 tiedoston tallennuksesta.
3. Sulje julkaisu, sammuta Mac, kytke iPad lentotilaan ja varmista Wi-Fin ja mobiilidatan olevan pois päältä.
4. Avaa julkaisu uudelleen Koti-valikosta ja lataa se uudelleen. Kokeile kaikkia sivuja ja tiloja sekä molempien liikkuvien sisältöjen kokonainen kierros.
5. Vasta onnistunut uudelleenavaus ja koko aineiston toistuminen lentotilassa vahvistaa käytännön offline-toiminnan. Tee sama koe ennen käyttötilannetta ja aina version päivityksen jälkeen.

HTTP-osoite Macin paikallisverkossa ei salli service worker -tallennusta iPadilla. HTTPS tarvitaan ensilataukseen; asennettu ja testattu julkaisu toimii sitten ilman verkkoa. Safari voi poistaa tallennettuja sivustotietoja tilan käydessä vähiin.

## Yhden tiedoston versiot

`traces-between-offline.html` sisältää myös panoraamatimelapsen ja 200-animaation. Macin selaimessa se voidaan avata paikallisesti. iPadin Tiedostot-esikatselussa JavaScript ei välttämättä toimi: älä käytä sitä varmistettuna esitysreittinä ennen oikean laitteen testiä. iPadille edellä kuvattu paikallisverkko- tai HTTPS-reitti on ensisijainen.

`traces-between-still-offline.html` sisältää vain still-kuvat ja tekstit. Still-versiossa ei ole kumpaakaan liikkuvaa sisältöä.

## Animaation rakenne

Upotuksessa ei ole omia painikkeita, aikaleimoja tai valikoita. Vanhan 200-teoksen käyttöliittymä säilyy alkuperäisessä julkaisussa.

Canvas-piirto, kuvan sovitus ja RGB-värikiekot pohjautuvat alkuperäiseen Random Rhythm -toteutukseen. Uudessa versiossa on pienempi kuvavälimuisti, 1024 px:n esityskuvat sekä zinen lähettämä käynnistys-/pysäytysviesti. Sivun ja upotuksen viestit hyväksytään vain samasta alkuperästä ja oikeasta ikkunasta. Yhden tiedoston version paikallinen srcdoc-upotus sisältää myös kuvat dataosoitteina. Animaatioversio rajaa ulkoiset lataukset sisältöturvakäytännöllä.

## Tulostus

Valmis `traces-between-A4-2026.pdf` sisältää yhdeksän A4-vaakasivua. PDF ja zinen Tulosta-toiminnon SVG-sivut tuotetaan samoista mitatuista sommitteluista. Tulostussivuilla liikkuvat sisällöt korvataan pysäytyskuvilla. `print.html` näyttää tulostussivut erikseen.

Valitse A4, vaaka, 100 %, ei selaimen ylä- ja alatunnisteita ja taustagrafiikka käyttöön. PDF on tarkistettu renderöimällä; selaimen tulostusikkunaa ja fyysistä iPad-tulostusta ei ole tarkistettu tässä ympäristössä.

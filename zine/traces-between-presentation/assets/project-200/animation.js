
    /*
      PROJECT 200 — RANDOM RHYTHM

      Tämä versio käyttää samaa JSON-tiedostoa kuin
      alkuperäinen Project 200:

      data/image2.json

      Kuvatiedostojen polut ovat JSONissa, esimerkiksi:

      images/IMG_1009.jpeg
    */

const JSON_URL = "data/images2.json";


    /*
      --------------------------------------------------
      SATUNNAISEN RYTMIN ASETUKSET
      --------------------------------------------------
    */

    const ENABLE_RANDOM_RHYTHM = true;

    /*
      Perusnopeus.

      Tätä voi vaihtaa myös sivun nopeusvalikosta.
    */

    let baseFps = 8;


    /*
      Hitaan jakson nopeus suhteessa perusnopeuteen.

      0.5:
      12 fps muuttuu hitaassa kohdassa 6 fps:ksi.

      0.33:
      12 fps muuttuu noin 4 fps:ksi.
    */

    const SLOW_MULTIPLIER = 0.75;


    /*
      Nopean jakson satunnainen pituus kuvina.

      Esimerkiksi 30–100 kuvaa normaalinopeudella,
      jonka jälkeen voi alkaa hidas jakso.
    */

    const FAST_SEGMENT_MIN = 30;
    const FAST_SEGMENT_MAX = 100;


    /*
      Hitaan jakson satunnainen pituus kuvina.
    */

    const SLOW_SEGMENT_MIN = 5;
    const SLOW_SEGMENT_MAX = 14;


    /*
      Aktiivinen nopeus ja rytmitila.
    */

    let fps = baseFps;
    let frameDuration = 1000 / fps;

    let rhythmMode = "fast";
    let framesUntilRhythmChange = 0;


    /*
      --------------------------------------------------
      RGB-VÄLÄHDYSTEN ASETUKSET
      --------------------------------------------------

      Vaihda false → true, jos haluat värivälähdykset.
    */

    const ENABLE_COLOR_FLASHES = true;

    const COLOR_FLASH_INTERVAL = 10;
    const COLOR_FLASH_DURATION = 90;

    const RGB_COLORS = [
      "rgb(255, 0, 0)",
      "rgb(0, 255, 0)",
      "rgb(0, 0, 255)"
    ];


    /*
      --------------------------------------------------
      KUVAMUISTIN JA ESIKÄSITTELYN ASETUKSET
      --------------------------------------------------
    */

    const CACHE_BEHIND = 2;
    const CACHE_AHEAD = 10;

    const INITIAL_PRELOAD = 8;
    const MAX_CONCURRENT_LOADS = 5;


    /*
      --------------------------------------------------
      HTML-ELEMENTIT
      --------------------------------------------------
    */

    const canvas =
      document.getElementById("canvas");

    const ctx =
      canvas.getContext("2d", {
        alpha: false
      });

    const stage =
      document.getElementById("stage");

    let items = [];

    /*
      Ladatut kuvat:

      Map<index, HTMLImageElement>
    */

    const cache = new Map();


    /*
      Parhaillaan latautuvat kuvat:

      Map<index, Promise>
    */

    const loading = new Map();


    /*
      Epäonnistuneet kuvat.
    */

    const failed = new Set();


    let currentIndex = 0;

    let isPlaying = true;
    let hasStarted = false;
    let isBuffering = false;

    let lastFrameTime = 0;
    let transitionCount = 0;


    /*
      RGB-välähdyksen tila.
    */

    let flashActive = false;
    let flashUntil = 0;
    let flashColor = RGB_COLORS[0];


    /*
      --------------------------------------------------
      YLEISET APUFUNKTIOT
      --------------------------------------------------
    */

    function setStatus(message, isError = false) {
      if (window.parent !== window) window.parent.postMessage({type:'project-200-status',message,error:isError}, location.origin==='null'?'*':location.origin);
      if (isError) document.getElementById('error').textContent = message;
    }

    function randomInt(min, max) {
      return Math.floor(
        Math.random() * (max - min + 1)
      ) + min;
    }


    function circularIndex(index) {
      if (!items.length) {
        return 0;
      }

      return (
        (index + items.length) %
        items.length
      );
    }


    function formatDayNumber(number) {
      return String(number).padStart(3, "0");
    }


    function formatDate(dateString) {
      if (!dateString) {
        return "";
      }

      const date =
        new Date(`${dateString}T12:00:00`);

      if (Number.isNaN(date.getTime())) {
        return dateString;
      }

      return new Intl.DateTimeFormat(
        "en-GB",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }
      ).format(date);
    }


    /*
      --------------------------------------------------
      JSONIN KÄSITTELY
      --------------------------------------------------
    */

    function normalizeItems(jsonData) {
      if (!Array.isArray(jsonData)) {
        throw new Error(
          "JSON root must be an array."
        );
      }

      return jsonData.map(
        (entry, index) => {

          /*
            Vanha yksinkertainen JSON-muoto:

            "images/example.jpeg"
          */

          if (typeof entry === "string") {
            return {
              number: index + 1,
              date: "",
              image: entry.replace(/^images\//, "frames/")
            };
          }


          /*
            Nykyinen objektimuoto:

            {
              "number": 1,
              "date": "2026-01-01",
              "image": "images/IMG_1009.jpeg"
            }
          */

          if (
            entry &&
            typeof entry === "object" &&
            typeof entry.image === "string"
          ) {
            return {
              number:
                Number.isFinite(
                  Number(entry.number)
                )
                  ? Number(entry.number)
                  : index + 1,

              date:
                typeof entry.date === "string"
                  ? entry.date
                  : "",

              image: entry.image.replace(/^images\//, "frames/")
            };
          }

          throw new Error(
            `Invalid JSON entry at position ${index + 1}.`
          );
        }
      );
    }


    /*
      --------------------------------------------------
      NÄYTÖN TEKSTIT
      --------------------------------------------------
    */

    function updateInfo() {}
    function updatePlaybackStatus() {}

    function setRhythmMode(mode) {
      rhythmMode = mode;

      if (
        ENABLE_RANDOM_RHYTHM &&
        mode === "slow"
      ) {
        fps = Math.max(
          1,
          Math.round(
            baseFps * SLOW_MULTIPLIER
          )
        );
      } else {
        fps = baseFps;
      }

      frameDuration = 1000 / fps;

      updatePlaybackStatus();
    }


    function resetRandomRhythm() {
      setRhythmMode("fast");

      framesUntilRhythmChange =
        randomInt(
          FAST_SEGMENT_MIN,
          FAST_SEGMENT_MAX
        );
    }


    function updateRandomRhythm() {
      if (!ENABLE_RANDOM_RHYTHM) {
        return;
      }

      framesUntilRhythmChange -= 1;

      if (framesUntilRhythmChange > 0) {
        return;
      }

      if (rhythmMode === "fast") {
        setRhythmMode("slow");

        framesUntilRhythmChange =
          randomInt(
            SLOW_SEGMENT_MIN,
            SLOW_SEGMENT_MAX
          );
      } else {
        setRhythmMode("fast");

        framesUntilRhythmChange =
          randomInt(
            FAST_SEGMENT_MIN,
            FAST_SEGMENT_MAX
          );
      }
    }


    /*
      --------------------------------------------------
      CANVASIN KOKO
      --------------------------------------------------
    */

    function resizeCanvas() {
      const rect =
        stage.getBoundingClientRect();

      const cssWidth =
        Math.max(
          1,
          Math.floor(rect.width)
        );

      const cssHeight =
        Math.max(
          1,
          Math.floor(rect.height)
        );

      /*
        Rajataan DPR kahteen, jotta erittäin
        korkearesoluutioinen näyttö ei kuormita
        selainta tarpeettomasti.
      */

      const dpr =
        Math.max(
          1,
          Math.min(
            2,
            window.devicePixelRatio || 1
          )
        );

      canvas.width =
        Math.floor(cssWidth * dpr);

      canvas.height =
        Math.floor(cssHeight * dpr);

      canvas.style.width =
        `${cssWidth}px`;

      canvas.style.height =
        `${cssHeight}px`;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      drawCurrentFrame(
        performance.now()
      );
    }


    /*
      --------------------------------------------------
      PIIRTÄMINEN
      --------------------------------------------------
    */

    function clearCanvas() {
      const width =
        canvas.clientWidth;

      const height =
        canvas.clientHeight;

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      ctx.fillStyle = "#000";

      ctx.fillRect(
        0,
        0,
        width,
        height
      );
    }


    function getContainedRect(
      imageWidth,
      imageHeight,
      canvasWidth,
      canvasHeight
    ) {
      const scale =
        Math.min(
          canvasWidth / imageWidth,
          canvasHeight / imageHeight
        );

      const width =
        imageWidth * scale;

      const height =
        imageHeight * scale;

      return {
        x: (canvasWidth - width) / 2,
        y: (canvasHeight - height) / 2,
        width,
        height
      };
    }


    function drawImageContained(image) {
      clearCanvas();

      const canvasWidth =
        canvas.clientWidth;

      const canvasHeight =
        canvas.clientHeight;

      const imageWidth =
        image.naturalWidth;

      const imageHeight =
        image.naturalHeight;

      if (!imageWidth || !imageHeight) {
        return;
      }

      const rect =
        getContainedRect(
          imageWidth,
          imageHeight,
          canvasWidth,
          canvasHeight
        );

      ctx.drawImage(
        image,
        rect.x,
        rect.y,
        rect.width,
        rect.height
      );
    }


    function drawColorCircle(color) {
      clearCanvas();

      const width =
        canvas.clientWidth;

      const height =
        canvas.clientHeight;

      const diameter =
        Math.min(width, height) * 0.72;

      const radius =
        diameter / 2;

      ctx.beginPath();

      ctx.arc(
        width / 2,
        height / 2,
        radius,
        0,
        Math.PI * 2
      );

      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
    }


    function drawCurrentFrame(
      now = performance.now()
    ) {
      if (
        ENABLE_COLOR_FLASHES &&
        flashActive &&
        now < flashUntil
      ) {
        drawColorCircle(flashColor);
        return;
      }

      if (
        ENABLE_COLOR_FLASHES &&
        flashActive &&
        now >= flashUntil
      ) {
        flashActive = false;
      }

      const image =
        cache.get(currentIndex);

      if (!image) {
        /*
          Vanha kuva jätetään näkyviin,
          jos uusi kuva ei ole vielä latautunut.
        */

        return;
      }

      drawImageContained(image);
    }


    /*
      --------------------------------------------------
      KUVAN LATAUS
      --------------------------------------------------
    */

    function loadImage(index) {
      index = circularIndex(index);

      if (cache.has(index)) {
        return Promise.resolve(
          cache.get(index)
        );
      }

      if (failed.has(index)) {
        return Promise.resolve(null);
      }

      if (loading.has(index)) {
        return loading.get(index);
      }

      const promise =
        new Promise((resolve) => {

          const image =
            new Image();

          image.decoding = "async";

          image.onload = async () => {
            try {
              if (
                typeof image.decode ===
                "function"
              ) {
                await image.decode();
              }
            } catch {
              /*
                Joissain selaimissa decode voi
                epäonnistua, vaikka kuva toimii.
              */
            }

            cache.set(index, image);
            loading.delete(index);

            resolve(image);
          };

          image.onerror = () => {
            console.error(
              `Image failed to load: ${items[index].image}`
            );

            failed.add(index);
            loading.delete(index);

            resolve(null);
          };

          image.src =
            items[index].image;
        });

      loading.set(index, promise);

      return promise;
    }


    async function preloadIndexes(indexes) {
      let cursor = 0;

      async function worker() {
        while (cursor < indexes.length) {
          const index =
            indexes[cursor];

          cursor += 1;

          await loadImage(index);
        }
      }

      const workers = [];

      const workerCount =
        Math.min(
          MAX_CONCURRENT_LOADS,
          indexes.length
        );

      for (
        let i = 0;
        i < workerCount;
        i++
      ) {
        workers.push(worker());
      }

      await Promise.all(workers);
    }


    function createWindowIndexes(
      centerIndex
    ) {
      const indexes = [];

      for (
        let offset = -CACHE_BEHIND;
        offset <= CACHE_AHEAD;
        offset++
      ) {
        indexes.push(
          circularIndex(
            centerIndex + offset
          )
        );
      }

      return [...new Set(indexes)];
    }


    function cleanCache(centerIndex) {
      const allowed =
        new Set(
          createWindowIndexes(
            centerIndex
          )
        );

      for (const index of cache.keys()) {
        if (!allowed.has(index)) {
          cache.delete(index);
        }
      }
    }


    async function ensureCurrentWindow() {
      const indexes =
        createWindowIndexes(
          currentIndex
        );

      await preloadIndexes(indexes);

      cleanCache(currentIndex);
    }


    async function preloadInitialImages() {
      const indexes = [];

      for (
        let i = 0;
        i < Math.min(
          INITIAL_PRELOAD,
          items.length
        );
        i++
      ) {
        indexes.push(i);
      }

      await preloadIndexes(indexes);
    }


    /*
      --------------------------------------------------
      RGB-VÄLÄHDYS
      --------------------------------------------------
    */

    function chooseRandomColor() {
      return RGB_COLORS[
        Math.floor(
          Math.random() *
          RGB_COLORS.length
        )
      ];
    }


    function triggerColorFlash(now) {
      flashColor =
        chooseRandomColor();

      flashActive = true;

      flashUntil =
        now + COLOR_FLASH_DURATION;

      drawCurrentFrame(now);
    }


    /*
      --------------------------------------------------
      SIIRTYMINEN SEURAAVAAN KUVAAN
      --------------------------------------------------
    */

    async function moveToNextFrame(
      timestamp
    ) {
      const nextIndex =
        circularIndex(
          currentIndex + 1
        );

      /*
        Jos seuraava kuva ei ole vielä
        muistissa, odotetaan sitä.
      */

      if (!cache.has(nextIndex)) {
        if (!isBuffering) {
          isBuffering = true;
          updatePlaybackStatus();
        }

        await loadImage(nextIndex);

        isBuffering = false;
        updatePlaybackStatus();

        /*
          Jos kuva ei latautunut,
          ohitetaan se.
        */

        if (!cache.has(nextIndex)) {
          currentIndex =
            nextIndex;

          updateInfo();

          ensureCurrentWindow();

          return;
        }
      }

      transitionCount += 1;

      /*
        RGB-välähdys voidaan kytkeä
        päälle sivun alun asetuksesta.
      */

      if (
        ENABLE_COLOR_FLASHES &&
        transitionCount %
          COLOR_FLASH_INTERVAL === 0
      ) {
        triggerColorFlash(timestamp);
      }

      currentIndex =
        nextIndex;

      updateInfo();

      drawCurrentFrame(timestamp);

      /*
        Päivitetään satunnainen rytmi
        yhden kuvanvaihdon jälkeen.
      */

      updateRandomRhythm();

      /*
        Ladataan lähialueen kuvia
        taustalla.
      */

      ensureCurrentWindow();
    }


    /*
      --------------------------------------------------
      ANIMAATIOSILMUKKA
      --------------------------------------------------
    */

    function animationLoop(timestamp) {
      if (!hasStarted) {
        requestAnimationFrame(
          animationLoop
        );

        return;
      }

      if (!lastFrameTime) {
        lastFrameTime = timestamp;
      }

      if (
        ENABLE_COLOR_FLASHES &&
        flashActive
      ) {
        drawCurrentFrame(timestamp);
      }

      if (
        isPlaying &&
        !isBuffering &&
        !flashActive &&
        timestamp - lastFrameTime >=
          frameDuration
      ) {
        lastFrameTime = timestamp;

        moveToNextFrame(timestamp);
      }

      requestAnimationFrame(
        animationLoop
      );
    }


    /*
      --------------------------------------------------
      FULLSCREEN
      --------------------------------------------------
    */

    async function init() {
      try {
        setStatus(
          "Loading image list…"
        );

        const response =
          await fetch(
            JSON_URL,
            {
              cache: "no-store"
            }
          );

        if (!response.ok) {
          throw new Error(
            `Could not load ${JSON_URL} (${response.status})`
          );
        }

        const jsonData =
          await response.json();

        items =
          normalizeItems(jsonData);

        if (!items.length) {
          throw new Error(
            "The image list is empty."
          );
        }

        updateInfo();
        resizeCanvas();

        setStatus("Preloading…");

        await preloadInitialImages();

        if (!cache.has(0)) {
          throw new Error(
            "The first image could not be loaded."
          );
        }

        resetRandomRhythm();

        hasStarted = true;

        updatePlaybackStatus();

        drawCurrentFrame(
          performance.now()
        );

        /*
          Ladataan lisää kuvia
          taustalla.
        */

        ensureCurrentWindow();

        requestAnimationFrame(
          animationLoop
        );

      } catch (error) {
        console.error(error);

        setStatus(
          error.message ||
          "Initialization failed",
          true
        );

        clearCanvas();
      }
    }



    let parentPaused = false;
    function updateVisibility() { isPlaying = !parentPaused && !document.hidden; lastFrameTime = performance.now(); }
    window.addEventListener('message', event => {
      if(event.source !== window.parent || event.origin !== location.origin) return;
      if(event.data?.type === 'project-200-playback') { parentPaused = !event.data.playing; updateVisibility(); }
    });
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('resize', resizeCanvas);
    new ResizeObserver(resizeCanvas).observe(stage);
    init();

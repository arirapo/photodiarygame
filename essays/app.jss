
/*
 * VISUAL ESSAY ENGINE
 * Version 0.1
 * app.js
 *
 * Sisältö ladataan tiedostosta story.json.
 */

(() => {
  "use strict";

  const $ = (selector) =>
    document.querySelector(selector);

  const storyContainer = $("#sections");
  const progressbar = $("#progressbar");
  const motionButton = $("#motion");

  let revealObserver = null;

  // ----------------------------------
  // APUTOIMINNOT
  // ----------------------------------

  function element(tag, className, text) {
    const el = document.createElement(tag);

    if (className) {
      el.className = className;
    }

    if (text !== undefined && text !== null) {
      el.textContent = text;
    }

    return el;
  }

  function imagePath(path) {
    return String(path || "");
  }

  function setBackground(el, path) {
    if (!path) return;

    // Estetään CSS-arvon rikkoutuminen
    // rajaamalla polku tavallisiin
    // suhteellisiin tai HTTPS-osoitteisiin.
    const url = imagePath(path);

    if (
      url.startsWith("javascript:") ||
      url.startsWith("data:")
    ) {
      return;
    }

    el.style.backgroundImage =
      `url(${JSON.stringify(url)})`;
  }

  function addText(parent, tag, className, text) {
    if (!text) return null;

    const el = element(tag, className, text);
    parent.appendChild(el);
    return el;
  }

  // ----------------------------------
  // HERO
  // ----------------------------------

  function renderHero(data) {
    const hero = data.hero || {};

    $("#heroLabel").textContent =
      hero.label || "VISUAL ESSAY";

    $("#heroTitle").textContent =
      hero.title || data.title || "Jälkiä";

    $("#heroSub").textContent =
      hero.subtitle || "";

    setBackground(
      $("#heroVisual"),
      hero.image || ""
    );

    document.title =
      `${data.title || "Visual Essay"} — Visual Essay Engine`;

    $("#chapter").textContent =
      data.chapter || "ESSEE 01 / DEMO";
  }

  // ----------------------------------
  // TEKSTIOSIO
  // ----------------------------------

  function renderText(section) {
    const wrapper =
      element("section", "text-section");

    if (section.label) {
      addText(
        wrapper,
        "p",
        "eyebrow reveal",
        section.label
      );
    }

    addText(
      wrapper,
      "h2",
      "reveal",
      section.title
    );

    const paragraphs =
      Array.isArray(section.paragraphs)
        ? section.paragraphs
        : section.text
          ? [section.text]
          : [];

    paragraphs.forEach((paragraph) => {
      addText(
        wrapper,
        "p",
        "reveal",
        paragraph
      );
    });

    return wrapper;
  }

  // ----------------------------------
  // KOKO RUUDUN KUVA
  // ----------------------------------

  function renderFullscreen(section) {
    const wrapper =
      element("section", "fullscreen-image");

    const background =
      element("div", "image-bg");

    setBackground(background, section.image);

    wrapper.appendChild(background);

    const caption =
      element("div", "image-caption");

    addText(
      caption,
      "p",
      "eyebrow reveal",
      section.label
    );

    addText(
      caption,
      "h2",
      "reveal",
      section.title || section.text
    );

    wrapper.appendChild(caption);

    return wrapper;
  }

  // ----------------------------------
  // STICKY IMAGE
  // ----------------------------------

  function renderSticky(section) {
    const wrapper =
      element("section", "sticky-story");

    const visual =
      element("div", "sticky-visual");

    const background =
      element("div", "sticky-bg");

    setBackground(background, section.image);

    visual.appendChild(background);

    const content =
      element("div", "sticky-content");

    const card =
      element("div", "story-card reveal");

    addText(
      card,
      "p",
      "eyebrow",
      section.label
    );

    addText(
      card,
      "h2",
      "",
      section.title
    );

    addText(
      card,
      "p",
      "",
      section.text
    );

    content.appendChild(card);
    visual.appendChild(content);
    wrapper.appendChild(visual);

    return wrapper;
  }

  // ----------------------------------
  // VIDEO
  // ----------------------------------

  function renderVideo(section) {
    const wrapper =
      element("section", "media-section");

    const inner =
      element("div", "media-inner");

    addText(
      inner,
      "p",
      "eyebrow reveal",
      section.label || "VIDEO"
    );

    addText(
      inner,
      "h2",
      "reveal",
      section.title
    );

    addText(
      inner,
      "p",
      "reveal",
      section.text
    );

    if (section.src) {
      const video =
        document.createElement("video");

      video.src = section.src;
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;

      if (section.poster) {
        video.poster = section.poster;
      }

      if (section.captionSrc) {
        const track =
          document.createElement("track");

        track.kind = "captions";
        track.src = section.captionSrc;
        track.srclang = "fi";
        track.label = "Suomi";

        video.appendChild(track);
      }

      inner.appendChild(video);
    }

    wrapper.appendChild(inner);

    return wrapper;
  }

  // ----------------------------------
  // AUDIO
  // ----------------------------------

  function renderAudio(section) {
    const wrapper =
      element("section", "media-section");

    const inner =
      element("div", "media-inner");

    addText(
      inner,
      "p",
      "eyebrow reveal",
      section.label || "ÄÄNI"
    );

    addText(
      inner,
      "h2",
      "reveal",
      section.title
    );

    addText(
      inner,
      "p",
      "reveal",
      section.text
    );

    if (section.src) {
      const audio =
        document.createElement("audio");

      audio.src = section.src;
      audio.controls = true;
      audio.preload = "none";

      inner.appendChild(audio);
    }

    wrapper.appendChild(inner);

    return wrapper;
  }

  // ----------------------------------
  // OSIOIDEN RAKENTAMINEN
  // ----------------------------------

  function renderSections(data) {
    storyContainer.replaceChildren();

    const sections =
      Array.isArray(data.sections)
        ? data.sections
        : [];

    const renderers = {
      text: renderText,
      "fullscreen-image": renderFullscreen,
      "sticky-image": renderSticky,
      video: renderVideo,
      audio: renderAudio
    };

    sections.forEach((section, index) => {
      const render = renderers[section.type];

      if (!render) {
        console.warn(
          "Tuntematon osiotyyppi:",
          section.type
        );
        return;
      }

      const node = render(section);

      if (index === 0) {
        node.id = "story-start";
      }

      storyContainer.appendChild(node);
    });

    initReveals();
  }

  // ----------------------------------
  // ILMESTYMISANIMAATIOT
  // ----------------------------------

  function initReveals() {
    if (revealObserver) {
      revealObserver.disconnect();
    }

    const items =
      document.querySelectorAll(".reveal");

    const reduced =
      document.documentElement.classList
        .contains("reduce-motion") ||
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (
      reduced ||
      !("IntersectionObserver" in window)
    ) {
      items.forEach((item) => {
        item.classList.add("visible");
      });
      return;
    }

    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(
              "visible"
            );

            observer.unobserve(
              entry.target
            );
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -5% 0px"
      }
    );

    items.forEach((item) => {
      revealObserver.observe(item);
    });
  }

  // ----------------------------------
  // VIERITYKSEN ETENEMINEN
  // ----------------------------------

  function updateProgress() {
    const root = document.documentElement;

    const available =
      root.scrollHeight - window.innerHeight;

    const percentage =
      available > 0
        ? (window.scrollY / available) * 100
        : 0;

    progressbar.style.width =
      `${Math.max(0, Math.min(100, percentage))}%`;
  }

  let progressScheduled = false;

  window.addEventListener(
    "scroll",
    () => {
      if (progressScheduled) return;

      progressScheduled = true;

      requestAnimationFrame(() => {
        updateProgress();
        progressScheduled = false;
      });
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    updateProgress
  );

  // ----------------------------------
  // LIIKKEEN VÄHENTÄMINEN
  // ----------------------------------

  let manualMotionOverride = false;
  let reducedMotion = false;

  const motionPreference =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

  function setReducedMotion(value) {
    reducedMotion = value;

    document.documentElement.classList
      .toggle("reduce-motion", value);

    motionButton.textContent =
      value ? "Liike: pois" : "Liike: päällä";

    motionButton.setAttribute(
      "aria-pressed",
      String(value)
    );

    initReveals();
  }

  setReducedMotion(motionPreference.matches);

  motionButton.addEventListener(
    "click",
    () => {
      manualMotionOverride = true;
      setReducedMotion(!reducedMotion);
    }
  );

  motionPreference.addEventListener?.(
    "change",
    (event) => {
      if (!manualMotionOverride) {
        setReducedMotion(event.matches);
      }
    }
  );

  // ----------------------------------
  // SISÄLLÖN LATAAMINEN
  // ----------------------------------

  async function loadStory() {
    try {
      const response =
        await fetch("./story.json", {
          cache: "no-cache"
        });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      renderHero(data);
      renderSections(data);
      updateProgress();

    } catch (error) {
      console.error(
        "Esseen lataaminen epäonnistui:",
        error
      );

      storyContainer.replaceChildren();

      const errorSection =
        element("section", "text-section");

      addText(
        errorSection,
        "h2",
        "",
        "Esseen lataaminen epäonnistui"
      );

      addText(
        errorSection,
        "p",
        "",
        "Tarkista, että story.json on " +
        "samassa hakemistossa kuin index.html."
      );

      storyContainer.appendChild(
        errorSection
      );

      updateProgress();
    }
  }

  // ----------------------------------
  // KÄYNNISTYS
  // ----------------------------------

  loadStory();

})();

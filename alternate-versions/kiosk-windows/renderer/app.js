(() => {
  const statusEl = document.getElementById("status");
  const bannerImg = document.getElementById("centerBanner");

  let REFRESH_SECONDS = 60;
  let MIRROR = false;
  let REQUIRE_AT_LEAST = 10;
  let CENTER_IMAGE = "./static-center-banner.png";
  let lastRoundIds = new Set();
  const PLACEHOLDER_SRC = "./placeholder.png";

  const mediaId = (item) =>
    item.id ?? item.filename ?? item.url ?? JSON.stringify(item);

  async function fetchList() {
    const res = await fetch(
      (window.API_BASE || "") + "/api/videos?ts=" + Date.now(),
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();

    REFRESH_SECONDS = data.refreshSeconds ?? REFRESH_SECONDS;
    MIRROR = !!data.mirrorVideos;
    REQUIRE_AT_LEAST = data.requireAtLeast ?? REQUIRE_AT_LEAST;
    CENTER_IMAGE = data.staticCenterImage || CENTER_IMAGE;

    // defensive newest-first
    const items = (data.media || [])
      .slice()
      .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0));
    return items;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickTenNew(items, n = 10) {
    const byId = new Map();
    for (const it of items) byId.set(mediaId(it), it);
    const unique = Array.from(byId.values());

    const excluded = lastRoundIds;
    const freshPool = unique.filter((it) => !excluded.has(mediaId(it)));

    const picked = shuffle(freshPool).slice(0, n);

    if (picked.length < n) {
      const need = n - picked.length;
      const pickedIds = new Set(picked.map(mediaId));
      const remainder = unique.filter((it) => !pickedIds.has(mediaId(it)));
      picked.push(...shuffle(remainder).slice(0, need));
    }

    lastRoundIds = new Set(picked.map(mediaId));
    return picked;
  }

  function clearCells() {
    document.querySelectorAll(".cell").forEach((c) => {
      if (!c.classList.contains("center-banner")) c.innerHTML = "";
    });
  }

  function mountVideoWithPlaceholder(container, src) {
    const wrapper = document.createElement("div");
    wrapper.className = "video-wrapper";
    Object.assign(wrapper.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "#000",
    });

    const ph = document.createElement("img");
    ph.src = PLACEHOLDER_SRC;
    ph.alt = "";
    ph.className = "placeholder";
    wrapper.appendChild(ph);

    const video = document.createElement("video");
    video.src = src + "#t=0.001";
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("poster", PLACEHOLDER_SRC);
    Object.assign(video.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transformOrigin: "center center",
    });

    const hidePH = () => {
      ph.classList.add("hidden");
    };
    video.addEventListener("loadeddata", hidePH, { once: true });
    video.addEventListener("canplay", hidePH, { once: true });

    const applyTransform = () =>
      autoRotateToPortraitIfLandscape(video, wrapper, MIRROR);
    if (video.readyState >= 1) applyTransform();
    else
      video.addEventListener("loadedmetadata", applyTransform, { once: true });
    new ResizeObserver(applyTransform).observe(wrapper);

    wrapper.appendChild(video);
    container.appendChild(wrapper);
    requestAnimationFrame(() => {
      video.play().catch(() => {});
    });
  }

  function mountImageWithPlaceholder(container, src) {
    const wrapper = document.createElement("div");
    wrapper.className = "image-wrapper";
    Object.assign(wrapper.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "#000",
    });

    const ph = document.createElement("img");
    ph.src = PLACEHOLDER_SRC;
    ph.alt = "";
    ph.className = "placeholder";
    wrapper.appendChild(ph);

    const img = document.createElement("img");
    img.src = src;
    img.alt = "Image";
    Object.assign(img.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: MIRROR ? "scaleX(-1)" : "none",
    });
    img.addEventListener("load", () => ph.classList.add("hidden"), {
      once: true,
    });

    wrapper.appendChild(img);
    container.appendChild(wrapper);
  }

  function autoRotateToPortraitIfLandscape(videoEl, wrapperEl, mirror) {
    if (!videoEl.videoWidth || !videoEl.videoHeight) return;
    const vw = videoEl.videoWidth,
      vh = videoEl.videoHeight;

    const rect = wrapperEl.getBoundingClientRect();
    const cw = rect.width || wrapperEl.clientWidth;
    const ch = rect.height || wrapperEl.clientHeight;

    let transforms = ["translate(-50%, -50%)"];
    if (vw > vh) {
      const scale = Math.max(cw / vh, ch / vw);
      transforms.push("rotate(90deg)");
      if (mirror) transforms.push("scaleX(-1)");
      transforms.push(`scale(${scale})`);
      videoEl.style.width = `${vw}px`;
      videoEl.style.height = `${vh}px`;
    } else {
      const scale = Math.max(cw / vw, ch / vh);
      if (mirror) transforms.push("scaleX(-1)");
      transforms.push(`scale(${scale})`);
      videoEl.style.width = `${vw}px`;
      videoEl.style.height = `${vh}px`;
    }
    Object.assign(videoEl.style, {
      top: "50%",
      left: "50%",
      transformOrigin: "center center",
      transform: transforms.join(" "),
    });
  }

  function mountMedia(cellSelector, item) {
    const container = document.querySelector(`[data-cell="${cellSelector}"]`);
    if (!container) return;
    container.innerHTML = "";
    if (!item) {
      // always show placeholder
      const img = document.createElement("img");
      img.src = PLACEHOLDER_SRC;
      img.alt = "";
      container.appendChild(img);
      return;
    }
    if (item.kind === "image") {
      mountImageWithPlaceholder(container, item.url);
    } else {
      mountVideoWithPlaceholder(container, item.url);
    }
  }

  function layout(items) {
    const slots = [
      "r1c1",
      "r1c2",
      "r1c3",
      "r1c4",
      "r2c1",
      "r2c4",
      "r3c1",
      "r3c2",
      "r3c3",
      "r3c4",
    ];
    bannerImg.src = CENTER_IMAGE;
    clearCells();
    items.forEach((item, i) => {
      const slot = slots[i % slots.length];
      mountMedia(slot, item);
    });
  }

  async function refresh() {
    try {
      const items = await fetchList();
      //statusEl.textContent = `${items.length} media file(s) — refresh every ${REFRESH_SECONDS}s`;
      const chosen = pickTenNew(items, 10);
      layout(chosen);
    } catch (e) {
      console.error(e);
      //statusEl.textContent = "Error loading media. Retrying…";
    }
  }

  refresh();
  setInterval(refresh, REFRESH_SECONDS * 1000);
})();

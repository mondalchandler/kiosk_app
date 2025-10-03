// /public/app.js
(async () => {
  const statusEl = document.getElementById("status");
  const bannerImg = document.getElementById("centerBanner");

  let REFRESH_SECONDS = 60;
  let MIRROR = false;
  let REQUIRE_AT_LEAST = 10;
  let CENTER_IMAGE = "/static-center-banner.png";
  let lastRoundIds = new Set();

  function mediaId(item) {
    // Prefer a stable identifier if your API returns one; fall back to URL.
    return item.id ?? item.filename ?? item.url ?? JSON.stringify(item);
  }

  const PLACEHOLDER_SRC = "/placeholder.png";

  // mount a plain placeholder in a cell
  function mountPlaceholder(container) {
    const wrapper = document.createElement("div");
    wrapper.className = "placeholder-wrapper";
    Object.assign(wrapper.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "#000"
    });

    const ph = document.createElement("img");
    ph.src = PLACEHOLDER_SRC;
    ph.alt = "";
    Object.assign(ph.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      pointerEvents: "none",
    });

    wrapper.appendChild(ph);
    container.appendChild(wrapper);
  }

  async function fetchList() {
    const res = await fetch("/api/videos?ts=" + Date.now(), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();

    REFRESH_SECONDS = data.refreshSeconds ?? REFRESH_SECONDS;
    MIRROR = !!data.mirrorVideos;
    REQUIRE_AT_LEAST = data.requireAtLeast ?? REQUIRE_AT_LEAST;
    CENTER_IMAGE = data.staticCenterImage || CENTER_IMAGE;

    // Ensure newest-first here as well (defensive)
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
    // (a) Deduplicate by id to be safe
    const byId = new Map();
    for (const it of items) byId.set(mediaId(it), it);
    const unique = Array.from(byId.values());

    // (b) Pool of items not shown last round
    const excluded = lastRoundIds;
    const freshPool = unique.filter((it) => !excluded.has(mediaId(it)));

    // (c) Shuffle helpers (uses your existing shuffle)
    const shuffledFresh = shuffle(freshPool);
    const picked = shuffledFresh.slice(0, n);

    // (d) If we couldn’t reach n, top up from the remaining items (including last round)
    if (picked.length < n) {
      const need = n - picked.length;
      const pickedIds = new Set(picked.map(mediaId));
      const remainder = unique.filter((it) => !pickedIds.has(mediaId(it)));
      const topUp = shuffle(remainder).slice(0, need);
      picked.push(...topUp);
    }

    // (e) Update lastRoundIds to exactly this new round
    lastRoundIds = new Set(picked.map(mediaId));

    return picked;
  }

  function clearCells() {
    document.querySelectorAll(".cell").forEach((c) => {
      if (!c.classList.contains("center-banner")) c.innerHTML = "";
    });
  }

  // seed placeholders into all non-banner cells
  function fillAllPlaceholders() {
    document.querySelectorAll(".cell:not(.center-banner)").forEach((c) => {
      c.innerHTML = "";
      mountPlaceholder(c);
    });
  }

  // --- Helpers for rotation & placeholder ---

  function mountVideoWithPlaceholder(container, src) {
    const wrapper = document.createElement("div");
    wrapper.className = "video-wrapper"; // rely on .cell { overflow:hidden }; wrapper keeps transforms contained
    Object.assign(wrapper.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      backgroundImage: "url('/placeholder.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundColor: "#000"
    });

    const ph = document.createElement("img");
    ph.src = PLACEHOLDER_SRC;
    ph.alt = "";
    ph.className = "placeholder";
    Object.assign(ph.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transition: "opacity .25s ease-out",
      opacity: "1",
      pointerEvents: "none",
    });

    const video = document.createElement("video");
    video.src = src + "#t=0.001";
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("poster", PLACEHOLDER_SRC);
    // We manage mirroring inside the transform; don't add a class that could override transform.

    // Place video above placeholder (we’ll fade placeholder once ready)
    Object.assign(video.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transformOrigin: "center center",
    });

    const hidePH = () => {
      ph.style.opacity = "0";
    };
    video.addEventListener("loadeddata", hidePH, { once: true });
    video.addEventListener("canplay", hidePH, { once: true });

    // Compute rotation & scaling when metadata is available and on resize
    const applyTransform = () =>
      autoRotateToPortraitIfLandscape(video, wrapper, MIRROR);
    if (video.readyState >= 1) {
      applyTransform();
    } else {
      video.addEventListener("loadedmetadata", applyTransform, { once: true });
    }

    // Recompute on resize
    const ro = new ResizeObserver(applyTransform);
    ro.observe(wrapper);

    wrapper.appendChild(video);
    wrapper.appendChild(ph);
    container.appendChild(wrapper);

    // Nudge some devices to start playing
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
      backgroundImage: "url('/placeholder.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundColor: "#000"
    });

    const ph = document.createElement("img");
    ph.src = PLACEHOLDER_SRC;
    ph.alt = "";
    Object.assign(ph.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transition: "opacity .25s ease-out",
      opacity: "1",
      pointerEvents: "none",
    });

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

    img.addEventListener(
      "load",
      () => {
        ph.style.opacity = "0";
      },
      { once: true }
    );

    wrapper.appendChild(img);
    wrapper.appendChild(ph);
    container.appendChild(wrapper);
  }

  // Core: rotate landscape videos 90° clockwise, scale to cover the portrait cell, center
  function autoRotateToPortraitIfLandscape(videoEl, wrapperEl, mirror) {
    if (!videoEl.videoWidth || !videoEl.videoHeight) return;

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;

    const rect = wrapperEl.getBoundingClientRect();
    const cw = rect.width || wrapperEl.clientWidth;
    const ch = rect.height || wrapperEl.clientHeight;

    // Base transform components we’ll compose
    let transforms = ["translate(-50%, -50%)"];

    if (vw > vh) {
      // Landscape: rotate 90deg clockwise
      // After rotation, effective content size is (vh, vw)
      const scale = Math.max(cw / vh, ch / vw);
      transforms.push("rotate(90deg)");
      if (mirror) transforms.push("scaleX(-1)");
      transforms.push(`scale(${scale})`);

      // Use intrinsic pixel size and let transform scale it
      videoEl.style.width = `${vw}px`;
      videoEl.style.height = `${vh}px`;
    } else {
      // Portrait (or square): no rotation, simple cover
      const scale = Math.max(cw / vw, ch / vh);
      if (mirror) transforms.push("scaleX(-1)");
      transforms.push(`scale(${scale})`);

      // Intrinsic px, transform scales to fit
      videoEl.style.width = `${vw}px`;
      videoEl.style.height = `${vh}px`;
    }

    videoEl.style.top = "50%";
    videoEl.style.left = "50%";
    videoEl.style.transformOrigin = "center center";
    videoEl.style.transform = transforms.join(" ");
  }

  function mountMedia(cellSelector, item) {
    const container = document.querySelector(`[data-cell="${cellSelector}"]`);
    if (!container || !item) return;
    container.innerHTML = "";

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

    // Clear and seed placeholders so empty cells NEVER look blank
    clearCells();
    fillAllPlaceholders();

    // Overwrite placeholders with actual media where available
    items.forEach((item, i) => {
      const slot = slots[i % slots.length];
      mountMedia(slot, item);
    });
  }

  async function refresh() {
    try {
      const items = await fetchList();
      statusEl.textContent = `${items.length} media file(s) — refresh every ${REFRESH_SECONDS}s`;
      {
        const chosen = pickTenNew(items, 10);
        layout(chosen);
      }
    } catch (e) {
      console.error(e);
      statusEl.textContent = "Error loading media. Retrying…";
    }
  }

  await refresh();
  setInterval(refresh, REFRESH_SECONDS * 1000);
})();

// /app.nodeless.js
(() => {
  const statusEl = document.getElementById("status");
  const bannerImg = document.getElementById("centerBanner");
  const root = document.body;

  // Config (defaults) — can be overridden via #kioskConfig or data-* attrs
  let REFRESH_SECONDS = 60;
  let MIRROR = false;
  let CENTER_IMAGE =
    root.getAttribute("data-center-image") || "./static-center-banner.png";
  const MEDIA_BASE =
    (root.getAttribute("data-media-base") || "./media/").replace(/\/+$/, "") +
    "/";
  const PLACEHOLDER_SRC = "./placeholder.png";

  // Optional JSON config
  try {
    const cfgText = document.getElementById("kioskConfig")?.textContent?.trim();
    if (cfgText) {
      const cfg = JSON.parse(cfgText);
      if (typeof cfg.refreshSeconds === "number")
        REFRESH_SECONDS = cfg.refreshSeconds;
      if (typeof cfg.mirrorVideos === "boolean") MIRROR = cfg.mirrorVideos;
      if (cfg.centerImage) CENTER_IMAGE = cfg.centerImage;
    }
  } catch (e) {
    console.warn("Bad kioskConfig JSON:", e);
  }

  // Parse file list (1 per line)
  function parseFileList() {
    const raw = (document.getElementById("fileList")?.textContent || "")
      // Normalize line endings and weird whitespace
      .replace(/\r\n?/g, "\n")
      .replace(/\u00A0/g, " "); // NBSP → normal space

    const files = [];

    // Strategy:
    // 1) Split into physical lines (for readability).
    // 2) For each line, split on *tabs* or *runs of 2+ spaces* (column separators).
    //    Single spaces are preserved so "Proto Video.mp4" stays together.
    // 3) Trim, unquote, and collect tokens.
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      // Split on: any \t, or 2+ spaces (but not a single space)
      const tokens = trimmed.split(/(?:\t+| {2,})/);

      tokens.forEach((tok) => {
        const t = tok.trim().replace(/^["']|["']$/g, ""); // remove surrounding quotes if any
        if (!t) return;
        if (t === "." || t === "..") return;

        files.push(t);
      });
    });

    // Deduplicate while preserving order
    const seen = new Set();
    return files.filter((f) => {
      if (seen.has(f)) return false;
      seen.add(f);
      return true;
    });
  }

  function toItem(filename) {
    const lower = filename.toLowerCase();
    const isVideo = /\.(mp4|mov|webm|m4v|ogg)$/i.test(lower);
    const isImage = /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(lower);
    return {
      id: filename,
      filename,
      url: MEDIA_BASE + encodeURIComponent(filename),
      kind: isVideo ? "video" : isImage ? "image" : "unknown",
    };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let lastRoundIds = new Set();
  const mediaId = (it) => it.id;

  function pickTenNew(items, n = 10) {
    // keep only known kinds
    const usable = items.filter(
      (it) => it.kind === "video" || it.kind === "image"
    );
    const freshPool = usable.filter((it) => !lastRoundIds.has(mediaId(it)));
    const picked = shuffle(freshPool).slice(0, n);

    if (picked.length < n) {
      const need = n - picked.length;
      const pickedIds = new Set(picked.map(mediaId));
      const remainder = usable.filter((it) => !pickedIds.has(mediaId(it)));
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

  function mountImageWithPlaceholder(container, src) {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "#000",
    });

    const ph = document.createElement("img");
    Object.assign(ph, { src: PLACEHOLDER_SRC, alt: "" });
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
    Object.assign(img, { src, alt: "" });
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

  function autoRotateToPortraitIfLandscape(videoEl, wrapperEl, mirror) {
    if (!videoEl.videoWidth || !videoEl.videoHeight) return;

    const vw = videoEl.videoWidth,
      vh = videoEl.videoHeight;
    const rect = wrapperEl.getBoundingClientRect();
    const cw = rect.width || wrapperEl.clientWidth;
    const ch = rect.height || wrapperEl.clientHeight;

    const transforms = ["translate(-50%, -50%)"];

    if (vw > vh) {
      // landscape: rotate 90° clockwise so it’s upright in portrait
      const scale = Math.max(cw / vh, ch / vw);
      transforms.push("rotate(90deg)");
      if (mirror) transforms.push("scaleX(-1)");
      transforms.push(`scale(${scale})`);
      videoEl.style.width = `${vw}px`;
      videoEl.style.height = `${vh}px`;
    } else {
      // portrait/square: no rotation
      const scale = Math.max(cw / vw, ch / vh);
      if (mirror) transforms.push("scaleX(-1)");
      transforms.push(`scale(${scale})`);
      videoEl.style.width = `${vw}px`;
      videoEl.style.height = `${vh}px`;
    }

    Object.assign(videoEl.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transformOrigin: "center center",
      transform: transforms.join(" "),
    });
  }

  function mountVideoWithPlaceholder(container, src) {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "#000",
    });

    const ph = document.createElement("img");
    Object.assign(ph, { src: PLACEHOLDER_SRC, alt: "" });
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
    Object.assign(video, {
      src: src + "#t=0.001",
      autoplay: true,
      muted: true,
      loop: true,
      playsInline: true,
    });
    video.preload = "auto";
    video.setAttribute("poster", PLACEHOLDER_SRC);
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

    const applyTransform = () =>
      autoRotateToPortraitIfLandscape(video, wrapper, MIRROR);
    if (video.readyState >= 1) applyTransform();
    else
      video.addEventListener("loadedmetadata", applyTransform, { once: true });

    const ro = new ResizeObserver(applyTransform);
    ro.observe(wrapper);

    wrapper.appendChild(video);
    wrapper.appendChild(ph);
    container.appendChild(wrapper);

    requestAnimationFrame(() => {
      video.play().catch(() => {});
    });
  }

  function mountPlaceholder(container) {
    container.innerHTML = "";
    const wrapper = document.createElement("div");
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
    Object.assign(ph.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      opacity: "1",
      transition: "opacity .25s ease-out",
      pointerEvents: "none",
    });

    wrapper.appendChild(ph);
    container.appendChild(wrapper);
  }

  function mountMedia(cellSelector, item) {
    const container = document.querySelector(`[data-cell="${cellSelector}"]`);
    if (!container) return;
    container.innerHTML = "";

    // No item? Show placeholder.
    if (!item) {
      mountPlaceholder(container);
      return;
    }

    if (item.kind === "image") {
      mountImageWithPlaceholder(container, item.url);
    } else if (item.kind === "video") {
      mountVideoWithPlaceholder(container, item.url);
    } else {
      // Unknown type → placeholder
      mountPlaceholder(container);
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

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const item = items[i]; // may be undefined if fewer than 10
      mountMedia(slot, item);
    }
  }

  function refreshOnce(allItems) {
    const chosen = pickTenNew(allItems, 10);
    layout(chosen);
    statusEl.textContent = `${allItems.length} media file(s) — refresh every ${REFRESH_SECONDS}s`;
  }

  // Boot
  const files = parseFileList();
  const items = files.map(toItem);
  refreshOnce(items);
  setInterval(() => refreshOnce(items), REFRESH_SECONDS * 1000);
})();

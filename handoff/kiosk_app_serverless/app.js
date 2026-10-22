(async () => {
  const statusEl = document.getElementById("status");
  const bannerImg = document.getElementById("centerBanner");
  const promptEl = document.getElementById("folderPrompt");
  const messageEl = document.getElementById("folderMessage");
  const chooseButton = document.getElementById("chooseFolder");
  const bundledButton = document.getElementById("useBundled");
  const bundledNames = JSON.parse(document.getElementById("bundledMedia").textContent);
  const imageTypes = /\.(png|jpe?g|gif|webp|avif)$/i;
  const videoTypes = /\.(mp4|mov|webm|m4v)$/i;
  let folderHandle = null;
  let objectUrls = new Map();

  let REFRESH_SECONDS = 10;
  let MIRROR = false;
  let REQUIRE_AT_LEAST = 10;
  let CENTER_IMAGE = "./static-center-banner.png";
  let lastRoundIds = new Set();
  let lastLayoutAt = 0;
  let lastMediaSignature = "";
  let refreshing = false;
  let layoutSerial = 0;

  function mediaId(item) {
    // Prefer a stable identifier if your API returns one; fall back to URL.
    return item.id ?? item.filename ?? item.url ?? JSON.stringify(item);
  }

  const PLACEHOLDER_SRC = "./placeholder.png";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("kiosk-media-folder", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("settings");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function savedFolder(value) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction("settings", value === undefined ? "readonly" : "readwrite");
        const request = value === undefined
          ? transaction.objectStore("settings").get("media")
          : transaction.objectStore("settings").put(value, "media");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }

  function includedMedia() {
    return bundledNames.filter(name => imageTypes.test(name) || videoTypes.test(name)).map(name => ({
      filename: name,
      kind: videoTypes.test(name) ? "video" : "image",
      url: "./media/" + encodeURIComponent(name)
    }));
  }

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
    if (!folderHandle) return includedMedia();
    const nextUrls = new Map();
    const items = [];
    for await (const [name, handle] of folderHandle.entries()) {
      if (handle.kind !== "file" || !(imageTypes.test(name) || videoTypes.test(name))) continue;
      try {
        const file = await handle.getFile();
        const key = `${name}:${file.size}:${file.lastModified}`;
        const url = objectUrls.get(key) || URL.createObjectURL(file);
        nextUrls.set(key, url);
        items.push({ filename: name, kind: videoTypes.test(name) ? "video" : "image", url, sortKey: file.lastModified });
      } catch (error) { console.warn("Skipping media file", name, error); }
    }
    items.sort((a, b) => b.sortKey - a.sortKey);
    // Wait until the new layout is mounted before releasing URLs from the old one.
    return { items, nextUrls };
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
      backgroundImage: "url('./placeholder.png')",
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
    video.preload = "metadata";
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
    video.resizeObserver = ro;

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
      backgroundImage: "url('./placeholder.png')",
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
    if (!container) return;
    const key = item ? `${item.kind}:${item.url}` : "placeholder";
    if (container.dataset.pendingKey === key) return;

    for (const pending of container.querySelectorAll(".media-layer:not(.active)")) {
      pending.querySelectorAll("video").forEach(video => video.resizeObserver?.disconnect());
      pending.remove();
    }
    if (container.dataset.mediaKey === key) { delete container.dataset.pendingKey; return; }
    if (!container.querySelector(".media-layer.active")) {
      const first = document.createElement("div");
      first.className = "media-layer active visible";
      mountPlaceholder(first);
      container.appendChild(first);
      container.dataset.mediaKey = "placeholder";
      if (!item) return;
    }

    const layer = document.createElement("div");
    layer.className = "media-layer";
    container.dataset.pendingKey = key;
    if (!item) mountPlaceholder(layer);
    else if (item.kind === "image") mountImageWithPlaceholder(layer, item.url);
    else mountVideoWithPlaceholder(layer, item.url);
    container.appendChild(layer);

    let revealed = false;
    const reveal = (loaded = true) => {
      if (revealed || container.dataset.pendingKey !== key || !layer.isConnected) return;
      revealed = true;
      if (loaded) {
        const overlay = layer.querySelector(".placeholder, .image-wrapper img:last-child");
        if (overlay) { overlay.style.transition = "none"; overlay.style.opacity = "0"; }
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!layer.isConnected || container.dataset.pendingKey !== key) return;
        layer.classList.add("visible");
        const finish = () => {
          if (!layer.isConnected || container.dataset.pendingKey !== key) return;
          for (const old of container.querySelectorAll(".media-layer")) {
            if (old === layer) continue;
            old.querySelectorAll("video").forEach(video => video.resizeObserver?.disconnect());
            old.remove();
          }
          layer.classList.add("active");
          container.dataset.mediaKey = key;
          delete container.dataset.pendingKey;
        };
        layer.addEventListener("transitionend", finish, { once: true });
        setTimeout(finish, 900);
      }));
    };
    if (!item) reveal();
    else if (item.kind === "image") {
      const image = layer.querySelector(".image-wrapper img:first-child");
      const showImage = () => {
        if (image.decode) image.decode().then(() => reveal(true), () => reveal(image.naturalWidth > 0));
        else reveal(true);
      };
      image.addEventListener("load", showImage, { once: true });
      image.addEventListener("error", () => reveal(false), { once: true });
      if (image.complete) image.naturalWidth > 0 ? showImage() : reveal(false);
    } else {
      const video = layer.querySelector("video");
      video.addEventListener("loadeddata", () => reveal(true), { once: true });
      video.addEventListener("error", () => reveal(false), { once: true });
      if (video.readyState >= 2) reveal(true);
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

    const serial = ++layoutSerial;
    slots.forEach(slot => {
      const cell = document.querySelector(`[data-cell="${slot}"]`);
      if (!cell.querySelector(".media-layer.active")) mountMedia(slot, undefined);
    });
    slots.forEach((slot, i) => setTimeout(() => {
      if (serial === layoutSerial) mountMedia(slot, items[i]);
    }, i * 180));
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const result = await fetchList();
      const items = Array.isArray(result) ? result : result.items;
      const signature = items.map(item => `${item.filename}:${item.sortKey ?? ""}`).join("|");
      if (signature !== lastMediaSignature || Date.now() - lastLayoutAt >= 60000) {
        layout(pickTenNew(items, 10));
        lastMediaSignature = signature;
        lastLayoutAt = Date.now();
      }
      if (!Array.isArray(result)) {
        for (const [key, url] of objectUrls) if (!result.nextUrls.has(key)) setTimeout(() => URL.revokeObjectURL(url), 1000);
        objectUrls = result.nextUrls;
      }
      statusEl.textContent = `${items.length} media files`;
    } catch (e) {
      console.error(e);
      messageEl.textContent = "Folder access was lost. Choose the media folder again.";
      promptEl.hidden = false;
      folderHandle = null;
      layout(pickTenNew(includedMedia(), 10));
      statusEl.textContent = `${bundledNames.length} included media files`;
    } finally { refreshing = false; }
  }

  chooseButton.addEventListener("click", async () => {
    try {
      folderHandle = await window.showDirectoryPicker({ mode: "read" });
      for (const url of objectUrls.values()) setTimeout(() => URL.revokeObjectURL(url), 2000);
      objectUrls.clear();
      try { await savedFolder(folderHandle); } catch (error) { console.warn("Could not remember folder", error); }
      lastRoundIds.clear();
      lastMediaSignature = "";
      promptEl.hidden = true;
      await refresh();
    } catch (error) {
      if (error.name !== "AbortError") messageEl.textContent = "Could not open the folder. Show the empty kiosk or try again.";
    }
  });
  bundledButton.addEventListener("click", async () => {
    folderHandle = null;
    for (const url of objectUrls.values()) setTimeout(() => URL.revokeObjectURL(url), 1000);
    objectUrls.clear();
    lastRoundIds.clear();
    lastMediaSignature = "";
    try { await savedFolder(null); } catch (error) { console.warn("Could not clear remembered folder", error); }
    promptEl.hidden = true;
    await refresh();
  });
  document.addEventListener("keydown", event => { if (event.key === "F2") promptEl.hidden = false; });
  if (typeof window.showDirectoryPicker !== "function") {
    chooseButton.disabled = true;
    messageEl.textContent = "This browser cannot watch a folder. Use Chrome or Edge to connect media.";
  } else {
    try {
      const saved = await savedFolder();
      if (saved && await saved.queryPermission({ mode: "read" }) === "granted") {
        folderHandle = saved;
        promptEl.hidden = true;
      }
    } catch (error) { console.warn("Could not restore folder access", error); }
  }
  await refresh();
  setInterval(refresh, REFRESH_SECONDS * 1000);
})();

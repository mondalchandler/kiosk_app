(async () => {
  const statusEl = document.getElementById("status");
  const bannerImg = document.getElementById("centerBanner");

  let REFRESH_SECONDS = 60;
  let MIRROR = false;
  let REQUIRE_AT_LEAST = 10;
  let CENTER_IMAGE = "/static-center-banner.png";
  async function fetchList() {
    const res = await fetch("/api/videos?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();

    REFRESH_SECONDS = data.refreshSeconds ?? REFRESH_SECONDS;
    MIRROR = !!data.mirrorVideos;
    REQUIRE_AT_LEAST = data.requireAtLeast ?? REQUIRE_AT_LEAST;
    CENTER_IMAGE = data.staticCenterImage || CENTER_IMAGE;

    // Ensure newest-first here as well (defensive)
    const items = (data.media || []).slice().sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0));
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

  function pickTen(items) {
    if (!items.length) return [];

    // Always keep the three newest items from the *sorted* list
    const newest3 = items.slice(0, 3);

    if (items.length <= 3) {
      return newest3; // nothing else to pick
    }

    const rest = items.slice(3);
    // Pick up to 7 at random from the remainder
    const random7 = shuffle(rest).slice(0, Math.min(7, rest.length));

    // Shuffle final set *positions* but keep membership (newest 3 are guaranteed included)
    return shuffle([...newest3, ...random7]).slice(0, 10);
  }

  
  function clearCells() {
    document.querySelectorAll(".cell").forEach(c => {
      if (!c.classList.contains("center-banner")) c.innerHTML = "";
    });
  }

  function mountMedia(cellSelector, item) {
    const container = document.querySelector(`[data-cell="${cellSelector}"]`);
    if (!container || !item) return;
    container.innerHTML = "";

    if (item.kind === "image") {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = "Image";
      if (MIRROR) img.classList.add("mirror");
      container.appendChild(img);
    } else {
      const el = document.createElement("video");
      el.src = item.url + "#t=0.001";
      el.autoplay = true;
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      if (MIRROR) el.classList.add("mirror");
      container.appendChild(el);
    }
  }

  function layout(items) {
    const slots = ["r1c1","r1c2","r1c3","r1c4","r2c1","r2c4","r3c1","r3c2","r3c3","r3c4"];
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
      statusEl.textContent = `${items.length} media file(s) — refresh every ${REFRESH_SECONDS}s`;
      {
        const chosen = pickTen(items);
        layout(chosen.slice(0,10));
      }
    } catch (e) {
      console.error(e);
      statusEl.textContent = "Error loading media. Retrying…";
    }
  }

  await refresh();
  setInterval(refresh, REFRESH_SECONDS * 1000);
})();
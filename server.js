// server.js (ensure 3 newest really are newest)
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));

const MEDIA_DIR = path.resolve(cfg.mediaRoot, cfg.folder);

app.use(express.static(path.join(__dirname, "public"), { maxAge: "1m" }));

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm"]);

function getKind(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  return "unknown";
}

function numericFromFilename(name) {
  const m = String(name).match(/(\d+(?:\.\d+)*)/g);
  if (!m) return NaN;
  // take the last numeric run (e.g., video_000123.mp4 -> 123)
  const last = m[m.length - 1];
  return Number(last);
}

function getSortKey(stat, file) {
  const strat = (cfg.recentStrategy || "birthtime").toLowerCase();
  if (strat === "filenameNumeric") {
    const n = numericFromFilename(file);
    if (!Number.isNaN(n)) return n;
    // fallback if no number found
  }
  if (strat === "birthtime") {
    // prefer true creation time if available, else ctime/mtime
    return stat.birthtimeMs || stat.ctimeMs || stat.mtimeMs || 0;
  }
  // "mtime"
  return stat.mtimeMs || stat.birthtimeMs || stat.ctimeMs || 0;
}

function listMedia() {
  if (!fs.existsSync(MEDIA_DIR)) return [];
  const files = fs.readdirSync(MEDIA_DIR);
  const items = files
    .filter(f => cfg.extensions.some(ext => f.toLowerCase().endsWith(ext)))
    .map(filename => {
      const full = path.join(MEDIA_DIR, filename);
      const stat = fs.statSync(full);
      const kind = getKind(filename);
      const sortKey = getSortKey(stat, filename);
      return {
        filename,
        kind,
        mtimeMs: stat.mtimeMs,
        birthtimeMs: stat.birthtimeMs,
        size: stat.size,
        sortKey
      };
    })
    // newest first by chosen sortKey
    .sort((a, b) => b.sortKey - a.sortKey);
  return items;
}

app.get("/api/videos", (req, res) => {
  const base = `/media/${cfg.folder}/`;
  const debug = String(req.query.debug || "") === "1";
  const media = listMedia().map(v => ({
    url: base + encodeURIComponent(v.filename),
    kind: v.kind,
    mtimeMs: v.mtimeMs,
    birthtimeMs: v.birthtimeMs,
    sortKey: v.sortKey
  }));
  res.json({
    ok: true,
    count: media.length,
    requireAtLeast: cfg.requireAtLeast,
    refreshSeconds: cfg.refreshSeconds,
    mirrorVideos: !!cfg.mirrorVideos,
    staticCenterImage: cfg.staticCenterImage,
    recentStrategy: cfg.recentStrategy || "birthtime",
    media: debug ? media.slice(0, 20) : media
  });
});

// serve media
app.use("/media", express.static(path.resolve(cfg.mediaRoot), {
  setHeaders(res) { res.set("Cache-Control", "no-store"); }
}));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Kiosk running at http://localhost:${port}`);
  console.log(`Watching media in: ${MEDIA_DIR}`);
});

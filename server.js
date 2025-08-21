// server.js (mixed video + image support)
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

function listMedia() {
  if (!fs.existsSync(MEDIA_DIR)) return [];
  const files = fs.readdirSync(MEDIA_DIR);
  const items = files
    .filter(f => cfg.extensions.some(ext => f.toLowerCase().endsWith(ext)))
    .map(filename => {
      const full = path.join(MEDIA_DIR, filename);
      const stat = fs.statSync(full);
      const kind = getKind(filename);
      return { filename, mtimeMs: stat.mtimeMs, size: stat.size, kind };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return items;
}

app.get("/api/videos", (req, res) => {
  const base = `/media/${cfg.folder}/`;
  const media = listMedia().map(v => ({
    url: base + encodeURIComponent(v.filename),
    mtimeMs: v.mtimeMs,
    size: v.size,
    kind: v.kind
  }));
  res.json({
    ok: true,
    count: media.length,
    requireAtLeast: cfg.requireAtLeast,
    refreshSeconds: cfg.refreshSeconds,
    mirrorVideos: !!cfg.mirrorVideos,
    staticCenterImage: cfg.staticCenterImage,
    media
  });
});

app.use("/media", express.static(path.resolve(cfg.mediaRoot), {
  setHeaders(res) { res.set("Cache-Control", "no-store"); }
}));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Kiosk running at http://localhost:${port}`);
  console.log(`Watching media in: ${MEDIA_DIR}`);
});
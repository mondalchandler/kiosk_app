# Kiosk App (Serverless Version)

This version does **not** run a server. You open `index.html` directly in the browser or with a simple “Live Server” extension. You’ll **manually list** your media file names in `index.html`.

---

## What you’ll do (quick summary)
1) Put your media files into the **media/** folder.
2) Use the Terminal to list the exact filenames.
3) Copy those names into the `index.html` script (so the page knows what to show).
4) Open `index.html` in your browser.

> The page shows a placeholder image in empty cells automatically. If you see a blank/black cell, check the troubleshooting at the end.

---

## 1) Add files to `media/`
- Place your videos and images into the **media** folder inside this project.
  - Supported examples: `.mp4`, `.mov`, `.webm`, `.jpg`, `.png`
- Keep filenames simple (letters, numbers, dashes/underscores).

---

## 2) Open the Terminal and go to the folder
**macOS**
1) Open **Terminal** (Press `⌘ + Space`, type “Terminal”, press Enter).
2) Change directory (cd) to your project folder (replace the path with yours):
   ```bash
   cd /path/to/kiosk_app_serverless
   ```

**Windows**
1) Open **Command Prompt** (Press Start, type “cmd”, press Enter) or **PowerShell**.
2) Change directory to your project folder. A quick way:
   - Right‑click the project folder in File Explorer → **Copy as path**.
   - Paste after `cd` (include the quotes if Windows added them):
     ```bash
     cd "C:\Users\YourName\Downloads\kiosk_app_serverless"
     ```

---

## 3) Go into the media folder and list filenames
From inside your project folder, type:
```bash
cd media
ls
```
- This prints the exact file names. Example output:
  ```
  my_video_01.mp4
  portrait_clip.mov
  booth_image.jpg
  ```
- **Select the text and copy** it (these are the names you’ll paste into `index.html`).

> Tip (Windows): if `ls` doesn’t work in Command Prompt, use `dir` instead:
> ```
> dir
> ```

To go back up to the project folder:
```bash
cd ..
```

---

## 4) Add these file names to `index.html`
1) Open `index.html` in any text editor (Notepad, TextEdit, VS Code).
2) Find the comment or section that looks like this (or similar). If it’s not there, add it inside a `<script>` tag near the end of the file, before the closing `</body>`:
   ```html
    <!-- PASTE YOU FILENAMES HERE. Can include .mp4/.mov/.jpg/.png/.webp, etc. -->
    <script type="text/plain" id="fileList">
      my_video_01.mp4
      portrait_clip.mov
      booth_image.jpg
   </script>
   ```
   - Paste your filenames from the Terminal output and prefix each with `media/`.
   - Put each file name in quotes, separated by commas.
3) Save the file.

---

## 5) Open the page
**Simplest way:** Double‑click `index.html` to open it in your default browser.

**Recommended (avoids some browser file‑access limits):**
- Install the “Live Server” extension in VS Code, right‑click `index.html`, choose **Open with Live Server**.
- Or run a very simple local server (optional):
  - **macOS/Linux (if Python is installed):**
    ```bash
    python3 -m http.server 8080
    ```
    Then visit http://localhost:8080 in your browser.
  - **Windows (PowerShell, if Python is installed):**
    ```powershell
    py -m http.server 8080
    ```

---

## How to add more files later
1) Drop new files into `media/`.
2) Open Terminal → `cd /path/to/kiosk_app_serverless/media` → `ls` (or `dir` on Windows) to see the new names.
3) Add those new `"media/…"` entries into the `window.STATIC_MEDIA` list in `index.html` and save.
4) Refresh the page in your browser.

---

## Placeholder & Center banner
- **Placeholder**: Make sure **`/placeholder.png`** exists in the project (usually next to `index.html` or in `public/`). The page uses it automatically when a cell has no media.
- **Center banner**: If your `index.html` supports a center banner image, set its `<img id="centerBanner">` `src` attribute to your file (e.g., `static-center-banner.png`).

---

## What’s inside (for reference)
- `index.html` – the page layout and where you list your media (`window.STATIC_MEDIA`)
- `styles.css` – the grid/cell styles
- `app.js` – the display logic (picks media, handles placeholder, rotation)
- `media/` – put your images/videos here

---

## Testing the Program at 960 × 1280

For best results, set your browser window to **960 pixels wide by 1280 pixels tall** (portrait orientation).

1. Open the app in your browser (either `http://localhost:3000` for the Node version, or by double-clicking `index.html` for the serverless version).
2. Resize the browser window:
   - On **Windows**: drag the window edges, or press `Alt + Space`, then choose **Size**, and use the arrow keys.
   - On **macOS**: drag the bottom-right corner of the window to resize.
3. To set the window to the exact size:
   - Press **F12** (Windows) or **⌥⌘I** (macOS) to open Developer Tools.
   - Click the small **device toolbar icon** (a phone/tablet symbol).
   - At the top of the page, type `960` for width and `1280` for height.
   - Press Enter. The page will now display in the kiosk’s intended dimensions.

> Tip: If you plan to always run the kiosk this way, keep Developer Tools open and lock the dimensions to 960 × 1280 for consistency.
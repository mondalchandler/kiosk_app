# Kiosk App (Node Version)

This version runs a small local web server. It’s the easiest way to make videos/images play reliably in the grid.

---

## What you’ll do (quick summary)
1) Install Node.js (only once).
2) Put your media files (videos/images) into the **media/** folder.
3) Start the app from the Terminal.
4) Open the link it prints (usually http://localhost:3000).

> The app shows a placeholder image in empty cells automatically. If you see a blank/black cell, check the troubleshooting at the end.

---

## 1) Install Node.js (one-time)
- Go to https://nodejs.org and download the **LTS** version.
- Install it with the default options.

To confirm installation:
- Open **Terminal** (macOS) or **Command Prompt** (Windows).
- Type:
  ```bash
  node -v
  ```
  You should see a version number (e.g., v20.x.x).

---

## 2) Put your media into `media/`
- Place your videos and images into the **media** folder inside this project.
  - Supported examples: `.mp4`, `.mov`, `.webm`, `.jpg`, `.png`
- Keep filenames simple (letters, numbers, dashes/underscores).

> Tip: You can add/remove files at any time. The app refreshes on its own and will rotate through what’s available.

---

## 3) Start the app
1) Open **Terminal** (macOS) or **Command Prompt / PowerShell** (Windows).
2) Go to the project folder:
   - Example (replace with your actual path):
     ```bash
     cd /path/to/kiosk_app
     ```
     On Windows you can right‑click the folder and choose “Copy as path,” then paste after `cd`.
3) Install the app dependencies (first time only):
   ```bash
   npm install
   ```
4) Start the app:
   ```bash
   npm start
   ```

You’ll see a message with a local address like:
```
Server running on http://localhost:3000
```
Open that link in your browser.

---

## 4) How to add files (later on)
- Drop more files into the `media/` folder.
- The app will pick them up on its next refresh (about once a minute by default).

---

## Center banner image
- The middle banner (wide image) uses the setting the app provides. If your setup supports a static banner, place the image file in the project (e.g. `/static-center-banner.png`). Ask your developer if you want to change the path.

---

## Stopping the app
- In the Terminal window where it’s running, press **Ctrl + C** once.

---

## Troubleshooting
**I only see a black/blank cell before anything shows.**
- The app includes a placeholder image. Make sure **`/placeholder.png`** exists in the project (often in the project root or `public/`).

**I get “command not found: npm” or “node is not recognized”.**
- Reinstall Node.js from https://nodejs.org and reopen your Terminal/Command Prompt.

**It says the port is already in use.**
- Close other apps using the same port, or run the app on another port:
  ```bash
  PORT=3001 npm start     # macOS/Linux
  set PORT=3001 && npm start   # Windows (CMD)
  $env:PORT=3001; npm start    # Windows (PowerShell)
  ```

**My videos are sideways.**
- The app automatically rotates landscape videos to fit portrait cells. If a video looks wrong, try re-exporting it as upright portrait, or remove unexpected rotation metadata.

---

## What’s inside (for reference)
- `index.html` – the page layout (3x4 grid with a center banner)
- `styles.css` – the grid/cell styles
- `public/app.js` – the display logic (picks media, handles placeholder, rotation)
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
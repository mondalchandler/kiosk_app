WINDOWS KIOSK HANDOFF

1. Double-click Start Kiosk.cmd. The local server starts and the kiosk opens in your default browser. Windows PowerShell is included with Windows; no Node.js, npm, or installation is needed.
2. Add or remove images and videos in the media folder beside this file. The kiosk checks the folder every 10 seconds and rotates the available files through the 10 media cells about once a minute. Empty cells show the placeholder.
3. Leave the launcher window open while the kiosk runs. Close that window to stop the server.

The page scales to fit the browser viewport while preserving the portrait 3:4 kiosk layout. For a borderless display, use your browser's full screen mode (usually F11).

Supported files: PNG, JPG, JPEG, GIF, WebP, AVIF, MP4, MOV, WebM, M4V. The browser must support the codec inside a video file to play it.

The index.html file is the kiosk page served by the launcher. Opening it directly as a file cannot start a server or discover new files in media because browsers prohibit local process launches and folder enumeration. If you open it directly, it shows a launch reminder.

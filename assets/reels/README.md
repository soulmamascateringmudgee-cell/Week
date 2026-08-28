# Reels videos

Drop your short-form videos (vertical **9:16** works best) in this folder, then
point the site at them.

## Add a reel

1. Export the clip as an **.mp4** (H.264 / AAC plays everywhere). Keep it short and
   web-sized — aim for under ~15 MB so the page stays fast.
2. Save it here, e.g. `assets/reels/ringwalk.mp4`.
3. Open `script.js`, find the `REELS` list near the bottom, and add or edit an entry:

   ```js
   { tag: "Fight Night", title: "Ringwalk", poster: "/assets/victory.jpg", src: "/assets/reels/ringwalk.mp4" },
   ```

   - **tag** — the little red label (e.g. Fight Night, Training, Sparring).
   - **title** — the caption shown on the card.
   - **poster** — the thumbnail image (any file in `assets/`).
   - **src** — the video path in this folder.

The reels grid on the site builds itself from that list, so add as many as you like.

Until a video file exists, its card still shows (using the poster). Tapping it
opens a "Watch on Instagram" fallback instead of a broken player.

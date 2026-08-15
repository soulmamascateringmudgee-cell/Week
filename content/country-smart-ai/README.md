# Country Smart AI — social content

Vertical reel cut from phone footage shot in the kitchen: catering a job, finishing a
client's website and ordering stock for the weekend in the same shift.

## Files

```
country-smart-ai-catering-website-reel.mp4   the finished reel (25s, 1080x1920, silent)
build-reel.sh                                rebuilds the reel from a source clip
make-cards.py                                draws the caption overlays and brand card
post-copy.md                                 caption, hashtags and alternate hooks
```

## Rebuilding

```bash
./build-reel.sh /path/to/clip.mov
```

Needs `ffmpeg` on the path (or `FFMPEG=/path/to/ffmpeg`) and Pillow (`pip install pillow`).

The source clip was only about 3.5 seconds, so the build slows it to half speed and
ping-pongs it (forward, reverse, forward) to fill a 21 second run, then cross-fades to the
brand card. Captions are drawn as transparent PNGs rather than burned in with `drawtext`,
so the text and its background pill fade together as one piece.

## Editing the captions

The four caption pairs live in the `CAPS` list in `make-cards.py`. Timings live in the
`filter_complex` in `build-reel.sh` (`fade` start times, roughly 5 seconds per pair). Keep
each line under about 850 pixels wide at 54pt, which `make-cards.py` prints when it runs.

## Brand

Charcoal `#11100E` with an ochre accent `#E0A63B`. Captions are white Liberation Sans Bold
on a dark rounded pill. Text sits above y=1500 so the platform UI does not cover it.

## Posting

The reel is deliberately silent so a trending audio can be added in-app. The burned-in
captions carry it with sound off.

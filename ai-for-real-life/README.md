# AI for Real Life — interactive workbook

The Country Smart AI workbook, as a single self-contained page. Publish this folder
and you get a link that opens on any phone or laptop, no download required.

```
ai-for-real-life/
  index.html    # the whole workbook — one file, nothing else needed
  README.md     # this guide
```

---

## Why the downloaded file "wouldn't open"

The file was never broken. It renders fine — logo, 53 fill-in fields, progress bar,
Print/PDF, and answers that save and survive a refresh.

The workbook is an interactive page, so it needs JavaScript to run. Preview panes do
not run JavaScript — they strip it out for safety. So if you tap the file inside any
of these, you get the green splash screen with the logo and nothing after it:

- iPhone/iPad Files app (Quick Look preview)
- Gmail or Outlook "preview attachment"
- Google Drive or Dropbox preview
- Notion, Slack or Messenger file previews

That splash screen *is* the "won't open" symptom. It is the page waiting for
JavaScript it is never going to get.

## Opening the downloaded file

Save it to disk first, then open it **in a browser** rather than previewing it:

- **Mac** — right-click the file → Open With → Chrome or Safari
- **Windows** — right-click → Open with → Chrome or Edge
- **iPhone** — Files → tap and hold the file → Share → Chrome (preview alone won't do it)

If it opens in a text editor and shows code, the file lost its `.html` ending on the
way down. Rename it to `AI_for_Real_Life_Workbook.html` and try again.

## The better fix: publish it

Sending a 660 KB HTML attachment to a subscriber list means every one of them hits the
same preview problem. A link doesn't have that problem, and it's free to host.

**Vercel or Netlify** — same as the other folders in this repo. Import the repo, no
build command, no output directory. The workbook lands at `/ai-for-real-life/`.

Then put that link in the welcome email or the Instagram bio instead of the file.

## Good to know

- **Answers save automatically** in the reader's own browser, on their own device.
  Nothing is sent anywhere and you never see what they typed.
- **Answers are per-device.** Someone who starts on their phone won't see it on their
  laptop. **Print / PDF** is how they keep a copy.
- **Reset** clears everything on that device. It cannot be undone.
- The page carries its own fonts, logo and code, so it works offline once loaded.

## Editing it

`index.html` is a packed build exported from Claude — the readable source isn't in
here. To change wording, edit the workbook in Claude, export it again, and replace
this file.

# Country Smart AI — client process

The system behind every client: how you work out what they need, what you ask them up front, what you tick off while you build, and how you keep revisions from dribbling in all week.

## What's here

| File | What it's for |
|---|---|
| [`onboarding-form.md`](onboarding-form.md) | New client onboarding — the diagnostic that finds where they need the most support, plus how to read the answers |
| [`create-onboarding-form.gs`](create-onboarding-form.gs) | Apps Script that builds the onboarding form |
| [`intake-form.md`](intake-form.md) | Every question in the website intake form, section by section, with help text |
| [`revision-request-form.md`](revision-request-form.md) | The revision request form, plus the wording to send with the preview link |
| [`create-forms.gs`](create-forms.gs) | Google Apps Script that builds **both** forms for you in about 30 seconds |
| [`build-checklist.md`](build-checklist.md) | The full SOP — enquiry through to the 7-day post-launch check |
| [`checklist.html`](checklist.html) | The same checklist, tickable, saves per client, prints to PDF |

Workshop registration forms live in [`../workshop-forms/`](../workshop-forms/README.md).

**Which form when.** Onboarding comes first and asks *what do you need* — run it on any new client, whatever they've approached you about. The website intake form comes later and asks *what do I need from you to build it*, once a website is the agreed answer. A client who only wants help with their social media never sees the intake form at all.

## Setting up the forms

Two scripts, each its own Apps Script project: `create-forms.gs` builds the intake and revision forms, `create-onboarding-form.gs` builds the onboarding form (function name `createOnboardingForm`, and no file-upload fix-ups needed afterwards).

**The fast way** — open [script.google.com](https://script.google.com), start a new project, paste in `create-forms.gs`, choose `createBothForms` from the function dropdown and hit Run. Approve the permission prompt (it's your own script, so the "unverified app" warning is expected — click Advanced, then go through). The execution log gives you the edit and share links for both forms.

Google's script API can't create **File upload** questions, so the script leaves three clearly marked placeholders — two in the intake form, one in the revision form. Open each form, switch those questions to File upload, and delete the `[CHANGE THIS TO A FILE UPLOAD QUESTION]` note from the help text. Takes a minute.

**The manual way** — work down `intake-form.md` in the Google Forms editor. Every "Section N" heading is an **Add section** click, so it arrives one page at a time rather than one intimidating scroll.

Either way, once the forms exist:

- Turn on **Link to Sheets** on both, so responses land in a spreadsheet you can work from.
- Turn on response receipts for the intake form, so the client keeps a copy of what they sent.
- Save both share links somewhere you can grab them fast — they get sent on every job.

## Running the checklist

Open `checklist.html` in any browser (double-click it, or [view it live](https://soulmamascateringmudgee-cell.github.io/week/client-process/checklist.html) if the repo is published). Type the client's name at the top and start ticking — progress saves in that browser, keyed to the client name, so you can run several jobs side by side by switching the name.

If you'd rather keep it in Notion, Trello, ClickUp or a Google Sheet, `build-checklist.md` is the source list to copy in. Duplicate it per client.

## The three rules that make it work

1. **Nothing starts until the deposit is paid.** The intake form goes out *after* the deposit, not before.
2. **Don't build until content collection is mostly done.** Building around placeholder content means building twice.
3. **One revision round, one place to submit it.** The revision form is the only channel. Say so when you send the preview, not the first time someone texts you a change.

## On passwords

The intake form asks about domains and hosting but never asks for a password, and says so on the page. Passwords get arranged separately and securely — a proper user invite where the platform supports it, never typed into a form, a text or an email.

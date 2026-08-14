# Setup — read this first

You've bought a **skill**: a set of instructions and reference tables that
teach Claude how to build order lists and prep plans for a food business. It
takes about 15 minutes to set up, and you only do it once.

You don't need to be technical. There's no software to install on your
computer, nothing to update, nothing that can break.

---

## What you need

1. **A Claude account** at [claude.ai](https://claude.ai) — a paid plan. This
   is your own subscription, paid to Anthropic, not to us. Roughly AU$30/month
   at the time of writing.
2. **The pack you were sent** — a folder or zip containing `SKILL.md`, a
   `references` folder, and this file.

---

## Step 1 — Install the skill

In Claude, open **Settings → Capabilities → Skills**, choose to add or upload a
skill, and give it the pack folder (zipped, if it asks for a zip).

Menu names move around between updates. If the wording doesn't match exactly,
look for **Skills** or **Capabilities** in Settings — that's the place.

You'll know it worked when `prep-and-ordering` appears in your skills list and
is switched on.

**If you can't find a Skills section at all**, your plan may not include them.
Fall back to Step 1b — it works just as well, it's just less automatic.

### Step 1b — the fallback

Start a new chat. Paste in the full contents of `SKILL.md`, then the contents
of the reference file you need (`event-quantities.md` for functions,
`par-levels.md` for weekly service). Then ask your question in the same chat.

Keep that chat and reuse it. Everything below works the same way.

---

## Step 2 — Try it once with a job you already know

Do **not** start with next week's real order. Start with a job you've already
done, where you know what you actually used.

Type something like:

> I've got a wedding on 14 March, 80 guests, shared table, standard dinner.
> Menu is slow-cooked brisket, chicken thigh skewers, barramundi, three salads,
> roast potatoes, bread, and a shared dessert. Two vegetarians, one coeliac.
> What do I need to order?

You'll get back an order list split by supplier, a packaging list, a countdown
with real dates, the risks, and a list of what it still needs to know.

For a cafe, restaurant, kiosk or canteen, tell it that instead:

> I run a cafe, open Tue–Sun. About 90 customers a day midweek, 160 Saturday
> and Sunday. Deliveries Tuesday and Friday. Here's the menu: [list it].
> Set my par levels and build Friday's order.

**Now compare it to what you actually used.** This is the important part.

---

## Step 3 — Make the numbers yours

The tables in `references/` are solid industry starting points. They are not
your numbers. Your regulars might eat more than average. Your brisket supplier
might trim harder than most.

Open `references/event-quantities.md` or `references/par-levels.md` in any text
editor (Notepad, TextEdit, Notes — it's plain text) and change the figures to
match what you actually use. Save it, re-upload the pack, and every future
order list uses your numbers.

The two worth checking first:

- **Yield factors.** Weigh one raw and one cooked, once, for your top three
  proteins. It takes five minutes and it's the number that matters most.
- **Sales mix** (service mode). One week of item-level sales from your POS
  beats every default in the file.

A pack tuned to your own operation after a month is worth several times what
you paid for it. An untuned one is a good estimate.

---

## Step 4 — Working habits that make it reliable

- **Tell it what you actually used last time.** "Last time we did this menu for
  60 we used 11 kg of brisket" will beat the tables every time, and it will use
  your number and say so.
- **Give it your real constraints** — fridge space, bump-in time, how many
  hands you've got. It will flag when the plan doesn't fit them.
- **Never skip the on-hand count** in service mode. The order is always par
  minus what's in the fridge.
- **Ask it to show its working** if a number looks wrong. It will give you the
  served weight and yield it came from, and you can argue with it.

---

## What it won't do

- It won't place orders or email suppliers by itself. It will draft the emails
  if you ask.
- It won't know your supplier prices unless you tell it.
- It won't know your local seasonality, your regulars, or that the Smiths
  always send half the platter back. You know that; tell it.
- **It won't guarantee quantities.** It's a planning tool built on standard
  yields. Check its numbers against your own records before you order —
  especially on your first few jobs, and especially on anything big.

---

## Getting help

Questions about the pack, or a number that looks wrong, go to whoever sold it
to you. Include what you asked and what it gave back — that's usually enough to
spot the problem.

Questions about Claude itself — billing, logins, the app — go to Anthropic.

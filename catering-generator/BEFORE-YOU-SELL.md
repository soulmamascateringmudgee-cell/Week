# Before you sell it

Everything between "it's built" and "the money's in". About half an hour, once.

---

## 1. Fill in the blanks

Six things, and only you know them. Open the two files and replace every
`[PLACEHOLDER]`.

### `pack/LICENCE.md` — this one goes to the buyer

| Placeholder | What goes in it |
|---|---|
| `[YOUR BUSINESS NAME]` | The legal entity that's licensing it. Whatever name is on the invoice. |
| `[YOUR ABN]` | Your ABN. |
| `[YOUR EMAIL]` | The address you want support questions to land at. |
| `[YOUR PHONE]` | Optional — delete the placeholder and the ` · ` before it if you'd rather not give a number. |

The licensor has to be the entity taking the money. If you're selling under a
different name from the catering business, use that one.

### `pack/SALES-SHEET.md` — this one goes to prospects

| Placeholder | What goes in it |
|---|---|
| `[YEARS]` `[YOUR BUSINESS]` | "12 years of running Soul Mamas Catering", or whatever's true. |
| `[XXX]` × 3 | Your three prices. See below. |
| `[MINUTES]` | How long the setup session runs. 60 is a sensible default. |
| `[N]` | How many founding operators you'll take at the reduced rate. Three to five. |
| `[YOUR NAME]` `[YOUR EMAIL]` `[YOUR PHONE]` `[YOUR ABN]` | Your details. |

Cut any line that isn't true for you. A short honest sheet beats a long one.

---

## 2. Set your prices

My recommendation, and the reasoning, so you can argue with it:

| | Price | Why |
|---|---|---|
| **Pack, one-off** | **$450 + GST** | Cheap enough that a caterer doing $80k a year doesn't need to think hard, dear enough that it reads as a professional tool rather than a template. |
| **Pack + setup session** | **$750 + GST** | The hour is where they tune it to their own yields, which is where it stops being a guess. This is the one to push. |
| **Founding operator** | **$300 + GST** | For the first three to five, in exchange for feedback and a testimonial you can name. |

The caterer who already asked should get the founding rate — she came to you,
which is worth more than the $150 difference.

**GST:** if you're registered, the price is plus GST and the invoice has to show
it. If you're not, don't write "+ GST" anywhere.

---

## 3. Build the buyer's zip

```bash
cd catering-generator/pack
./build-pack.sh
```

It refuses to build while any `[PLACEHOLDER]` is unfilled, so a licence with no
ABN on it can't go out by accident.

You get `pack/dist/prep-and-ordering.zip`, containing the skill, the three
reference files, the setup guide and the licence. **It deliberately leaves out
your sales sheet** — that's got your pricing and your margin on it.

---

## 4. Take the money

Invoice first, send the zip once it's paid. You already know this; it's the same
as a catering deposit.

**Square** is the path of least resistance — you've already got it, the invoice
is emailed and paid by card, and it reconciles itself. It costs you a percentage.
**Bank transfer** costs nothing and takes a day.

Either way, put the licence terms in front of them before they pay, not after.
Attaching `LICENCE.md` to the invoice email is enough.

### Invoice wording

> **Prep & Ordering — single-business licence**
>
> Licence to use the Prep & Ordering pack in one business, across any number of
> your own sites. Includes 12 months of updates and email support.
>
> Supplied under the terms attached. Quantities produced by the pack are a
> planning guide, not a guarantee.
>
> 1 × Prep & Ordering pack ......... $XXX.00
> GST ............................. $XX.00
> **Total** ....................... $XXX.00

---

## 5. Hand it over

Send the zip and this, or something like it:

> Hi [NAME],
>
> Here's the pack. The zip has everything — the skill itself, the quantity
> tables, and a setup guide.
>
> Start with SETUP.md. It takes about 15 minutes and you don't need to be
> technical. The one thing I'd say: don't start with next week's real order.
> Start with a job you've already done, where you know what you actually used,
> and see how close it gets. That'll tell you more than anything I can.
>
> Once you've run it a few times, open the reference files and change the yield
> factors to match your own. Weigh one raw and one cooked for your top three
> proteins — five minutes, and it's the number that matters most. A pack tuned
> to your own kitchen is worth several times an untuned one.
>
> The licence is in there too. Short version: use it in your business across as
> many sites as you like, change the numbers however you want, just don't pass
> the files on to another operator.
>
> Any questions, or a number that looks wrong, send it to me with what you asked
> and what it gave back. Usually enough to spot the problem.
>
> [YOUR NAME]

---

## 6. After the sale

You've promised 12 months of email support and updates. In practice that means:

- **A number looks wrong.** Ask what they typed and what came back. Nine times
  out of ten it's a portion size or a yield that doesn't match their operation,
  and the fix is editing their copy of the reference file.
- **They can't find the Skills section.** Point them at Step 1b in SETUP.md —
  the fallback works just as well.
- **Anything about Claude itself** — billing, logins, the app — is Anthropic's,
  not yours. Say so kindly.

Keep a note of every correction. Two or three buyers in, the pattern in those
questions is the next version.

---

## What you're NOT promising

Worth being clear in your own head before the first sale:

- Not a guarantee of quantities. It's a planning guide built on standard yields,
  and that's in the output, the licence and the setup guide. Don't soften it.
- Not food safety or allergen advice. That stays theirs.
- Not their Claude subscription. They pay Anthropic directly.
- Not unlimited hand-holding. Twelve months of email about the pack.

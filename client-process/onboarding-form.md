# Country Smart AI New Client Onboarding Form

The form that works out where a new client actually needs the most help. Different job from the [website intake form](intake-form.md) — that one collects the material to build a site, this one diagnoses the problem before you've decided what to sell them.

Build it by running [`create-onboarding-form.gs`](create-onboarding-form.gs), or by hand from the questions below.

## The design problem

You asked for detailed but not overwhelming. Those pull against each other, so the form resolves it by changing the *kind* of question rather than the number:

- **28 questions, but only 6 need writing.** Everything else is a tap.
- **One grid does the work of eleven questions.** Section 3 rates 11 areas of the business on a single screen in about 30 seconds. Asking those separately would be exhausting and would tell you less.
- **Sections are short and get shorter.** Five sections, none longer than eight questions, with the heavy thinking in the middle rather than at the end when people are flagging.
- **The free-text questions are the ones you'll actually read.** Six of them, each earning its place.

**Form title:** Country Smart AI New Client Onboarding

**Description:**

> Welcome aboard, and thanks for trusting me with this.
>
> This form is how I work out where you need the most help, so we spend your money on the things that will actually make a difference rather than the things that sound impressive.
>
> It takes about 10 minutes and most of it is tapping options rather than writing. There are no wrong answers and nothing here is a test — the more honest you are about what is not working, the more useful I can be.

---

## Section 1 — The basics

*About 1 minute.*

| # | Question | Type | Required |
|---|---|---|---|
| 1 | Your name | Short answer | Yes |
| 2 | Email | Short answer (email validation) | Yes |
| 3 | Mobile number | Short answer | Yes |
| 4 | Business name | Short answer | Yes |
| 5 | What does your business do? | Paragraph | Yes |
| 6 | Where are you based? | Short answer | No |
| 7 | How long have you been going? | Short answer | No |
| 8 | How many people work in the business? | Multiple choice | Yes |

**Q8 options:** Just me / Me plus casual help / 2 to 5 / 6 to 20 / More than 20

---

## Section 2 — How you work now

*So I can build on what you already have instead of piling more on top.*

| # | Question | Type | Required |
|---|---|---|---|
| 9 | What software and apps do you use day to day? | Paragraph | Yes |
| 10 | Roughly how many hours a week go on admin and repetitive jobs? | Multiple choice | Yes |
| 11 | When does that work usually get done? | Multiple choice | Yes |
| 12 | How much have you used AI tools? | Multiple choice | Yes |
| 13 | How comfortable are you with technology generally? | Linear scale 1–5 | Yes |

**Q9 help text:** Include the pen-and-paper bits too — that's useful to know.

**Q10 options:** Under 2 hours / 2 to 5 / 5 to 10 / 10 to 20 / More than 20 / Honestly no idea

**Q11 options:** During business hours, it's under control / Evenings / Weekends / Whenever I can grab a minute / It mostly doesn't get done

**Q12** uses the same options as the workshop forms, so you can compare across everything.

---

## Section 3 — Where you need support

**The one that matters.** One grid and three questions.

### Q14 — the grid

*How is each of these going at the moment?*

Rows:

- Social media and content
- Website
- Email and answering enquiries
- Quotes and invoices
- General admin and paperwork
- Customer follow-up and reviews
- Bookkeeping and receipts
- Scheduling, bookings and rosters
- Getting found on Google
- Photos, graphics and design
- Keeping files and information organised

Columns:

| I've got this handled | Works, but could be better | This is a real pain point | Not relevant to me |
|---|---|---|---|

Required. The "Not relevant to me" column is what makes requiring it fair — nobody gets stuck on a row that doesn't apply.

| # | Question | Type | Required |
|---|---|---|---|
| 15 | If you could only fix ONE of those, which would make the biggest difference? | Multiple choice (same 11 options) + Other | Yes |
| 16 | Tell me what is happening with that one at the moment | Paragraph | Yes |
| 17 | Is there anything you have already tried that did not work? | Paragraph | No |

**Q15 is the forced choice.** The grid tells you what's broken; this tells you what to do first. Without it you get eight pain points and no priority.

**Q16 help text:** What does it look like on a bad week? What have you tried? What goes wrong? This is the most useful thing you'll write on this form.

**Q17** saves you proposing something they already bought and abandoned.

---

## Section 4 — How you want to be helped

*Two people with the same problem often want completely different things done about it.*

| # | Question | Type | Required |
|---|---|---|---|
| 18 | Which of these sounds most like you? | Multiple choice | Yes |
| 19 | What would you like from working together? | Checkboxes + Other | Yes |
| 20 | If we talk in three months and it has gone well, what is different? | Paragraph | Yes |
| 21 | Is anyone else involved in decisions about this? | Multiple choice | Yes |

**Q18 options:**

- Show me how and I'll do it myself
- Set it up for me, then teach me to run it
- Just do it for me — I don't want to learn it
- Not sure yet, talk me through the options

**Q19 options:** Save me time · Save me money · Bring in more customers · Make the business look more professional · Take the stress out of the admin · Help me keep up with what everyone else is doing · Free me up to do the part of the job I actually like · Other

**Q21 options:** No, it's my call / Yes, I'll need to run things past someone / Yes, and they should be in the conversations too

---

## Section 5 — Practical bits

| # | Question | Type | Required |
|---|---|---|---|
| 22 | How soon would you like to get started? | Multiple choice | Yes |
| 23 | Do you have a budget in mind? | Multiple choice | Yes |
| 24 | Is there anything coming up that this needs to be ready for? | Multiple choice + Other | No |
| 25 | Best way to get hold of you? | Checkboxes + Other | Yes |
| 26 | Best time of day to reach you? | Short answer | No |
| 27 | Would you like to hear about workshops and AI tips by email? | Multiple choice | Yes |
| 28 | Anything else I should know? | Paragraph | No |

**Q22 options:** As soon as you can fit me in / Within the next month / In the next few months / Just gathering information for now

**Q23 options:** Under $500 / $500–$1,500 / $1,500–$3,000 / $3,000–$5,000 / More than $5,000 / An ongoing monthly amount rather than a one-off / No idea — tell me what things cost

**Q23 help text:** No pressure and no judgement. It stops me proposing something that was never going to fit.

---

## How to read a completed form

Read it in this order. It takes about five minutes and you'll have the proposal in your head by the end.

**1. Q15 and Q16 first.** The one thing they'd fix, and why. This is the job. Everything else is context for it.

**2. Q18 — how they want helping.** This decides *what you sell*, not just what you do:

| Answer | What that means for you |
|---|---|
| Show me how and I'll do it myself | Training or a workshop seat. Low revenue per client, but they'll refer people. |
| Set it up, then teach me | Setup fee plus a short handover. The sweet spot for most small businesses. |
| Just do it for me | An ongoing arrangement, priced monthly. Your best clients live here. |
| Not sure yet | A conversation. Don't send a quote until you've had it. |

Getting this wrong is the most common way to lose a client you'd already won.

**3. Q13 against Q18.** Someone at 1 or 2 on tech confidence who says "show me how and I'll do it myself" needs more hand-holding than they think. Price for the reality, and say so kindly up front.

**4. Q10 with Q11.** Ten hours a week, done on weekends, is a different conversation from ten hours a week done on a Tuesday afternoon. The second is inefficiency. The first is someone losing their weekends, and they'll pay to get them back.

**5. The grid, last.** Not as a to-do list — as a map. Anything marked "real pain point" that they *didn't* pick in Q15 is your second and third conversation, three months from now. Note it and leave it alone.

**6. Q23 and Q22 together.** Budget with no timeframe is a maybe. Timeframe with no budget is worth a phone call. Both present is a client.

**7. Q20 is what you write on the invoice.** Quote their own words back to them in your proposal, and again when you finish. People buy the outcome they described, not the service you named.

**Q17 is the trap-avoider.** Read it before you propose anything, every time.

---

## Settings

- **Progress bar:** on
- **Link responses to a spreadsheet:** yes — one row per client, and the grid columns make a genuinely useful picture of what small businesses around you are struggling with
- **Response receipts:** on
- **Confirmation message:** *"Thanks — that's exactly what I needed. I'll go through it properly and come back to you within 2 business days with what I think we should tackle first and why."*

That promise is in the confirmation message, so keep it. Two business days, with a real opinion about what to do first, is most of why someone picks you over a bigger outfit.

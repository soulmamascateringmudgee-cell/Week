# Country Smart AI — workshop forms

Registration forms for the two workshops. Same build method as the [client intake forms](../client-process/README.md): paste one script, run it once, get both forms.

| File | What it is |
|---|---|
| [`create-workshop-forms.gs`](create-workshop-forms.gs) | Apps Script that builds both forms |
| [`free-workshop-form.md`](free-workshop-form.md) | The free workshop form, question by question, plus what to do with the answers |
| [`paid-workshop-form.md`](paid-workshop-form.md) | The paid workshop form, same |

## Running it

1. [script.google.com](https://script.google.com) → **New project**
2. Delete the sample code, paste in `create-workshop-forms.gs`
3. Save, pick **createBothWorkshopForms** from the function dropdown, **Run**
4. Approve the permission prompt, then read the Execution log for the four links

**No fix-ups afterwards.** Neither form uses file uploads, so unlike the client intake form there's nothing to convert by hand once it's built.

### Before you run it

Near the top of the script there's a `WORKSHOP` block with three settings:

- `freeDetails` and `paidDetails` — the date, time and venue lines that appear in each form's description
- `inPerson` — leave it `true` for an in-person workshop, change it to `false` for an online one

`inPerson: false` swaps the "what will you bring" question for "what will you join on", and drops the dietary question. If editing code on a phone is a pain, ignore the whole block and type the date and venue straight into the form description afterwards.

## Why the two forms are different lengths

The free form is three minutes. A free workshop lives or dies on how easy it is to sign up, so it asks only what's needed to get someone in the room and pitch the session at the right level.

The paid form is eight minutes and goes much deeper. Someone who's paid will happily tell you what they want, and every answer is something you can build the day around.

Both use the **same wording and the same options** for the AI experience questions. That's deliberate — it lets you compare the two rooms, and spot the people who came to the free session and then booked the paid one.

## The questions that do the most work

**Free form:** "What is the one job you would love to take off your plate?" Pick the three or four answers that repeat and make them your live demos. Watching your own problem get solved is what sells the paid workshop, and you don't have to pitch at all.

**Paid form:** "What are the two or three things you want to walk out able to do?" Read every answer a week out and rebuild the running order around what people actually asked for.

## A note on payment and email

Neither form asks for card details, and the paid one says so up front — same rule as the client intake form and passwords. If someone hasn't paid, they tick the box and you send an invoice.

Both forms ask permission before adding anyone to an email list. Under Australian spam rules a registration isn't consent to market to them, so it's worth the extra question. Only the people who tick "Yes please" go on the list.

## After each workshop

Link both forms to a spreadsheet (**Responses → Link to Sheets**) so you've got a record. Between the two sheets you'll build a picture over time of who in the district is interested, what they're stuck on, and who's ready to spend money — which is worth more than the workshop fee.

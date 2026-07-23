# Setting up Fresha bookings for Restore

The website is already wired for online booking. Once Lauren has a Fresha
"Book Now" link, adding it takes **one line** — see step 4.

## 1. Create the Fresha account (Lauren)

1. Go to **https://www.fresha.com** → *For business* → **Sign up** (it's free for the business).
2. Enter the business details:
   - **Business name:** Restore Massage and Beauty
   - **Address:** 85 Market Street (upstairs of Mixi Blu), Mudgee NSW 2850
   - **Phone:** 0422 668 217
   - **Email:** hello@restorebeautyandmassage.com.au
3. Follow the prompts to verify email and (for taking payments/deposits) add
   bank/payout details. You can skip payments at first and just take bookings.

## 2. Add the services (copy straight from the menu below)

In Fresha: **Catalogue → Services → Add**. Create the categories, then add each
service with its duration and price.

### Massage
| Service | Duration | Price |
|---|---|---|
| 45 Minute Massage | 45 min | $90 |
| 60 Minute Massage | 60 min | $120 |
| 90 Minute Massage | 90 min | $150 |
| Lomi Lomi Massage | 90 min | $165 |
| Brazilian Lymphatic Drainage | 60 min | $150 |

### Facial Waxing
| Service | Duration | Price |
|---|---|---|
| Brow Wax | 20 min | $30 |
| Lip Wax | 15 min | $18 |
| Chin Wax | 15 min | $15 |
| Nose Wax | 15 min | $10 |
| Brow, Lip & Chin Wax | 30 min | $60 |
| Full Face Wax | 40 min | $75 |

### Body Waxing
| Service | Duration | Price |
|---|---|---|
| Full Leg Wax | 40 min | $50 |
| ½ Leg Wax | 20 min | $30 |
| Arm Wax | 20 min | $30 |
| Full Leg & Bikini Line | 45 min | $80 |
| Brazilian | 30 min | $60 |
| Bikini Line | 20 min | $35 |

### Tinting
| Service | Duration | Price |
|---|---|---|
| Lash Tint | 20 min | $25 |
| Brow Tint | 20 min | $30 |
| Eye Trio (lash tint, brow tint & shape) | 40 min | $80 |
| Henna Only Tint | 20 min | $40 |

### Wax & Tint
| Service | Duration | Price |
|---|---|---|
| Brow Wax & Tint | 30 min | $50 |
| Henna Wax & Tint | 30 min | $60 |

### Lash Lift (Effortless Eyes)
| Service | Duration | Price |
|---|---|---|
| Lash Lift & Tint | 60 min | $95 |
| Lash Lift & Tint + FREE Brow Tint | 60 min | $95 |

## 3. Set opening hours

In Fresha: **Settings → Business hours**. (Confirm Lauren's real hours — the
website currently shows Mon closed · Tue–Fri 9:00–5:00 · Sat 9:00–1:00 · Sun closed.)

## 4. Get the booking link and add it to the site

1. In Fresha: **Marketing → Online booking** (or **Profile → Share**) and copy the
   **"Book Now" / online booking link**. It looks like:
   `https://www.fresha.com/a/restore-massage-and-beauty-mudgee-xxxx`
2. Open `script.js` and paste it between the quotes near the top:
   ```js
   var BOOKING_URL = "https://www.fresha.com/a/restore-massage-and-beauty-mudgee-xxxx";
   ```
3. Save. Every "Book Now / Book an Appointment / Book a Treatment" button now
   opens Fresha in a new tab. (Send it to me and I'll paste it in for you.)

## 5. Optional — embed booking on the page

Fresha also offers a "Book Now" **embed widget** (a `<place-widget>` snippet).
If you'd prefer clients book without leaving the site, send me the widget code
and I'll drop it into a booking section instead of linking out.

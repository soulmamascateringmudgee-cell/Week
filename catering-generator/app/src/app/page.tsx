import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="hero">
        <p className="eyebrow">For caterers</p>
        <h1>What are you ordering for?</h1>
        <p className="lede">
          Put in the people, the menu and the dates. You get back the order list
          split by supplier, in raw weights, with the packaging, the countdown
          and the risks specific to that job.
        </p>
      </div>

      <div className="choice-list">
        <Link href="/event" className="choice">
          <strong>A one-off event</strong>
          <span>
            A date and a guest count. Weddings, functions, private chef work, a
            van on a booking. Anchored on T-7, seven days out.
          </span>
          <span className="go">Start a job</span>
        </Link>
        <Link href="/service" className="choice">
          <strong>Ongoing weekly service</strong>
          <span>
            Repeating covers. Restaurants, cafes, kiosks, canteens, a van on a
            regular pitch. Anchored on the delivery cycle.
          </span>
          <span className="go">Set up a week</span>
        </Link>
      </div>

      <h2>What it works out</h2>
      <ul className="features">
        <li>
          <strong>Raw weight, not served weight.</strong> Brisket loses half its
          weight on the way to the plate. Ordering to the served figure
          under-orders by half.
        </li>
        <li>
          <strong>Buffer that scales with the count.</strong> One big eater
          moves the average much further at 20 guests than at 200, so smaller
          jobs carry a bigger percentage.
        </li>
        <li>
          <strong>Two crew meals, every time.</strong> Nobody costs them in, and
          nobody wants to be short at seven o&rsquo;clock.
        </li>
        <li>
          <strong>The things that aren&rsquo;t food.</strong> Chafing fuel, ice,
          gas and gloves don&rsquo;t make the food order, then they&rsquo;re
          missing.
        </li>
        <li>
          <strong>Throughput as a constraint.</strong> If the people can&rsquo;t
          be fed inside the window, it says so instead of just ordering more
          food.
        </li>
      </ul>

      <p className="disclaimer">
        These quantities are a planning guide based on standard yields. Check
        them against your own service records before ordering.
      </p>
    </>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your data — Prep & Ordering",
  description:
    "What this app stores, who can see it, and how to get it back or have it deleted.",
};

/**
 * The privacy note.
 *
 * A caterer's recipes are the business. Asking someone to type theirs into a
 * stranger's website is a big ask, and "we take your privacy seriously" is not
 * an answer to it. This page says what is stored, who can read it, what it is
 * never used for, and how to get it back — in the same plain words as the rest
 * of the app.
 *
 * Every claim here has to stay true of the code. The isolation described is
 * enforced by row-level security in the database, not by the app being polite
 * about it; if that ever changes, this page changes first.
 */
export default function PrivacyPage() {
  return (
    <>
      <h1>Your recipes are yours</h1>
      <p className="lede">
        You&rsquo;re being asked to type your recipes into someone else&rsquo;s
        website. That deserves a straight answer about what happens to them, so
        here it is, without the legal fog.
      </p>

      <div className="card">
        <h2>What&rsquo;s stored</h2>
        <ul className="plain">
          <li>
            <strong>Your email address.</strong> It&rsquo;s how you sign in and
            how you get told about anything that matters.
          </li>
          <li>
            <strong>Your recipes</strong> — names, courses, ingredients,
            quantities, method and notes, exactly as you typed them.
          </li>
          <li>
            <strong>Your ingredient prices</strong>, if you enter them.
          </li>
          <li>
            <strong>The jobs you save</strong> — guest counts, dates, dietaries
            and the settings you chose.
          </li>
        </ul>
        <p className="basis">
          Your password is never stored. What&rsquo;s kept is a one-way hash of
          it, which is why nobody can tell you what your password is if you
          forget it — it can only be replaced.
        </p>
      </div>

      <div className="card">
        <h2>Who can see it</h2>
        <p>
          <strong>You.</strong> That&rsquo;s the list.
        </p>
        <p>
          Every recipe, price and job is tied to your login and fenced off in
          the database itself, not just hidden in the app. Another caterer using
          this app can&rsquo;t reach your rows even if they go looking, and
          neither can a signed-in account that isn&rsquo;t on the invite list.
        </p>
        <p>
          Jessmyn, who built this, holds the keys to the server — the same as
          any small software business. She can see that you have an account and
          that you&rsquo;ve been using it. She does not read your recipes, and
          she won&rsquo;t open your data to work out a problem unless you ask
          her to.
        </p>
      </div>

      <div className="card">
        <h2>What it is never used for</h2>
        <ul className="plain">
          <li>Your recipes are not sold, shared or licensed to anyone.</li>
          <li>
            They are not pooled, averaged or turned into anyone else&rsquo;s
            menu suggestions.
          </li>
          <li>
            They are not used to train an AI model. The quantity maths in this
            app is ordinary arithmetic on standard yield tables — there is no
            model learning from what you type.
          </li>
          <li>
            Your email isn&rsquo;t sold, and it isn&rsquo;t added to a marketing
            list you didn&rsquo;t ask for.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Where it lives</h2>
        <p>
          The app runs on Vercel and the database is Supabase — two standard,
          reputable hosts. Data is stored and backed up on their servers, which
          may be outside Australia. If you paste a recipe URL for the app to
          read, that page is fetched by the server; the address you paste
          isn&rsquo;t kept.
        </p>
      </div>

      <div className="card">
        <h2>Getting it back, or getting rid of it</h2>
        <p>
          Ask and you&rsquo;ll get everything you&rsquo;ve entered, in a file
          you can open, at no charge. Ask for it deleted and it&rsquo;s deleted
          — recipes, prices, jobs and account.
        </p>
        <p>
          If your access is switched off — you stop subscribing, say — your
          saved work isn&rsquo;t deleted straight away. It sits out of reach in
          case you come back. Tell her you want it gone and it goes.
        </p>
        <p className="basis">
          Email <strong>jessmyn.toovey@hotmail.com</strong>. It&rsquo;s a small
          business, so it&rsquo;s a real person answering, usually within a few
          days.
        </p>
      </div>

      <div className="card">
        <h2>Two honest limits</h2>
        <p>
          <strong>This is early software.</strong> Keep your recipes somewhere
          else as well while you&rsquo;re trying it. Not because anything is
          expected to go wrong, but because &ldquo;my only copy was in an app I
          was trialling&rdquo; is a bad afternoon and an easy one to avoid.
        </p>
        <p>
          <strong>The quantities are a guide.</strong> They&rsquo;re standard
          yields and your own recipe amounts, scaled. Check them against what
          you actually used last time before you place a big order.
        </p>
      </div>

      <p className="disclaimer">
        If any of this stops being true, this page changes before the code does.
      </p>
    </>
  );
}

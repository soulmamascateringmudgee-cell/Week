/**
 * Sending email, via Resend's REST API.
 *
 * Deliberately not Supabase's built-in sender. That one is capped at a couple
 * of messages an hour across the whole project, which is fine for one operator
 * and useless the moment three people sign up in an afternoon. This path has
 * its own quota and doesn't touch the auth cap at all.
 *
 * Plain text, no HTML template. A short text email from a real person lands in
 * the inbox; a styled one with a logo lands in Promotions, and the whole point
 * is that the person reads it.
 *
 * Nothing here ever throws. An invite that saved but didn't email is a much
 * better outcome than an invite that failed because the email did — but the
 * caller is always told which happened, because "invited" and "invited and
 * told" are different states and only one of them means the person can get in.
 */

export type EmailOutcome = { sent: true } | { sent: false; reason: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<EmailOutcome> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!key || !from) {
    return {
      sent: false,
      reason:
        "No email sender is set up on this deployment, so nothing was sent.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      // An email that hasn't sent in ten seconds isn't going to, and the
      // person clicking "Add to the list" is standing there waiting.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Resend's own message is more useful than anything invented here —
      // an unverified sending domain says so in as many words.
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      return {
        sent: false,
        reason: body.message ?? `The email service returned ${response.status}.`,
      };
    }

    return { sent: true };
  } catch {
    return { sent: false, reason: "Couldn't reach the email service." };
  }
}

/**
 * The message a new operator gets when they're added to the invite list.
 *
 * Written as Jessmyn would write it, because it is from her. It has one job:
 * get them to the page where they set a password. Everything else can wait
 * until they're inside.
 */
export function inviteEmail(options: {
  signupUrl: string;
  fromName: string;
}): { subject: string; text: string } {
  return {
    subject: `You're in - here's how to set your password`,
    text: `Hi,

You're on the list for Prep & Ordering - the app that turns your own recipes and a headcount into one order list, costed against a budget.

Set your password here and you're in:

${options.signupUrl}

Use this same email address when you do. That's the one that's been invited.

A few things worth knowing before you start:

- Put your recipes in first. Your amounts, written for however many people you wrote them for. The app scales from those, not from a generic table.
- Your recipes are yours. They're locked to your login - nobody else can see them, including me.
- Prices are optional, but the food cost only means something once they're in.

Anything that doesn't make sense, just reply to this email and tell me. That's what this round is for.

Thanks
${options.fromName}
`,
  };
}

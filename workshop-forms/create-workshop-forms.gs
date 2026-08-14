/**
 * Country Smart AI — workshop form builder
 *
 * Creates both workshop forms in one go:
 *   1. Country Smart AI Free Workshop Registration
 *   2. Country Smart AI Workshop Booking (paid)
 *
 * HOW TO RUN — same as the client intake script
 *   1. https://script.google.com → New project
 *   2. Delete the sample code, paste this whole file in
 *   3. Save (the disk icon), then pick "createBothWorkshopForms" from the
 *      function dropdown and click Run
 *   4. Approve the permission prompt, then read the Execution log for the links
 *
 * No manual fix-ups needed afterwards — neither of these forms uses file
 * uploads, so what the script builds is what you send out.
 *
 * EDIT THE SETTINGS BELOW FIRST if you already know your dates and venue.
 * If you do not, leave them as they are and type the details straight into
 * the form description afterwards — that is often easier than editing code.
 */

// ---------------------------------------------------------------------------
// SETTINGS — change these, then run
// ---------------------------------------------------------------------------

var WORKSHOP = {

  // Shown near the top of the free workshop form.
  freeDetails: 'Date, time and venue: to be confirmed.',

  // Shown near the top of the paid workshop form.
  paidDetails: 'Date, time and venue: to be confirmed.',

  // true  = in person (asks about dietary needs, parking, what to bring)
  // false = online (asks about their setup instead, skips the catering questions)
  inPerson: true
};

// ---------------------------------------------------------------------------

function createBothWorkshopForms() {
  var free = createFreeWorkshopForm();
  var paid = createPaidWorkshopForm();

  Logger.log('=====================================================');
  Logger.log('DONE. Two workshop forms created.');
  Logger.log('');
  Logger.log('FREE WORKSHOP REGISTRATION');
  Logger.log('  Edit:  ' + free.getEditUrl());
  Logger.log('  Share: ' + free.getPublishedUrl());
  Logger.log('');
  Logger.log('PAID WORKSHOP BOOKING');
  Logger.log('  Edit:  ' + paid.getEditUrl());
  Logger.log('  Share: ' + paid.getPublishedUrl());
  Logger.log('');
  Logger.log('Send the Share links. Keep the Edit links for yourself.');
  Logger.log('=====================================================');

  emailTheLinks_('Your Country Smart AI workshop forms', [
    'Both workshop forms have been created. Here are the links - keep this email.',
    '',
    'FREE WORKSHOP REGISTRATION',
    '  Edit (yours):    ' + free.getEditUrl(),
    '  Share (public):  ' + free.getPublishedUrl(),
    '',
    'PAID WORKSHOP BOOKING',
    '  Edit (yours):    ' + paid.getEditUrl(),
    '  Share (public):  ' + paid.getPublishedUrl(),
    '',
    'Remember to add the date, time and venue to each form description.',
    '',
    'The forms live in the Google account this email arrived in.',
    'Find them any time at https://forms.google.com'
  ].join('\n'));
}

/**
 * Emails the links to whoever ran the script.
 *
 * The execution log disappears the moment you close the tab, which is a good
 * way to lose track of a form. This puts the links somewhere permanent, and
 * the account the email lands in is proof of where the forms were created.
 */
function emailTheLinks_(subject, body) {
  try {
    var address = Session.getEffectiveUser().getEmail();
    if (!address) {
      Logger.log('Could not work out your email address, so no email sent.');
      return;
    }
    MailApp.sendEmail(address, subject, body);
    Logger.log('These links have also been emailed to ' + address);
  } catch (err) {
    Logger.log('Could not send the email: ' + err.message);
    Logger.log('The links above still work - copy them out of this log.');
  }
}

/** Shared answer options, so the free and paid forms stay comparable. */
var AI_EXPERIENCE = [
  'Never used it',
  'Tried it once or twice',
  'Use it now and then',
  'Use it most weeks',
  'Use it most days'
];

var AI_TOOLS = [
  'ChatGPT',
  'Claude',
  'Google Gemini',
  'Microsoft Copilot',
  'Canva AI / Magic Studio',
  'Meta AI (Facebook, Instagram, WhatsApp)',
  'AI built into software I already use',
  'I am not sure what I have used',
  'None yet'
];

var HEARD_ABOUT = [
  'Instagram',
  'Facebook',
  'Word of mouth',
  'A friend or colleague told me',
  'Local paper or radio',
  'Google search',
  'I know Jess'
];

// ---------------------------------------------------------------------------
// Form 1 — free workshop registration
// ---------------------------------------------------------------------------

function createFreeWorkshopForm() {
  var form = FormApp.create('Country Smart AI Free Workshop Registration');

  form.setDescription(
    'Come and find out what AI can actually do for a small country business - ' +
    'in plain English, no jargon, no assumed knowledge.\n\n' +
    WORKSHOP.freeDetails + '\n\n' +
    'This takes about 3 minutes. The questions about your experience are so I ' +
    'can pitch the session at the right level for the room. There is no wrong ' +
    'answer, and "never touched it" is a very common one.'
  );
  form.setProgressBar(true);
  form.setConfirmationMessage(
    'You are registered - thanks. I will email you the details closer to the ' +
    'date. If anything changes and you cannot make it, just reply to that email ' +
    'so I can offer your spot to someone else.'
  );

  // --- Section 1: Your details --------------------------------------------
  form.addSectionHeaderItem()
    .setTitle('Your details')
    .setHelpText('So I know who is coming and can send you the details.');

  form.addTextItem().setTitle('Name').setRequired(true);

  form.addTextItem()
    .setTitle('Email')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());

  form.addTextItem()
    .setTitle('Mobile number')
    .setHelpText('Only used if something changes at the last minute.')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Business name')
    .setHelpText('Leave blank if you are not in business yet - you are still very welcome.');

  form.addTextItem()
    .setTitle('What does your business do?')
    .setHelpText('One line is plenty. For example: "hairdresser", "sheep and cattle", "bookkeeping".');

  form.addTextItem().setTitle('What town or area are you in?');

  // --- Section 2: Your experience with AI ---------------------------------
  form.addPageBreakItem()
    .setTitle('Your experience with AI')
    .setHelpText(
      'Be honest here rather than generous. If most of the room has never used ' +
      'it, I will slow right down and start from scratch. If most of you are ' +
      'already using it, we can skip the basics and get into the good stuff.'
    );

  form.addMultipleChoiceItem()
    .setTitle('How much have you used AI tools?')
    .setChoiceValues(AI_EXPERIENCE)
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Which of these have you tried?')
    .setHelpText('Tick as many as apply.')
    .setChoiceValues(AI_TOOLS)
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How do you feel about AI at the moment?')
    .setChoiceValues([
      'Curious, but a bit nervous',
      'Excited and want to get started',
      'Sceptical - needs to prove itself to me',
      'Overwhelmed by how much there is',
      'Fairly confident, want to go deeper'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What is the one job you would love to take off your plate?')
    .setHelpText('The task you put off, or the one that eats your evenings. This is what I build the examples around.')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Is there anything about AI that worries you?')
    .setHelpText('Cost, privacy, it sounding fake, putting people out of work, not knowing where to start - all fair. I would rather talk about it openly on the day.');

  // --- Section 3: On the day ----------------------------------------------
  form.addPageBreakItem()
    .setTitle('On the day')
    .setHelpText('Last few, then you are done.');

  if (WORKSHOP.inPerson) {
    form.addMultipleChoiceItem()
      .setTitle('What will you bring to work on?')
      .setHelpText('A laptop is ideal, but a phone is absolutely fine - plenty of people run their whole business off one.')
      .setChoiceValues(['Laptop', 'Tablet or iPad', 'Phone only', 'Nothing, I will just watch and listen'])
      .setRequired(true);

    form.addTextItem()
      .setTitle('Any dietary requirements?')
      .setHelpText('There will be something to eat and drink. Tell me about allergies, intolerances or anything you avoid.');

    form.addTextItem()
      .setTitle('Any accessibility needs I should know about?')
      .setHelpText('Seating, hearing, mobility, anything at all - just say and I will sort it.');
  } else {
    form.addMultipleChoiceItem()
      .setTitle('What will you join on?')
      .setChoiceValues(['Laptop', 'Tablet or iPad', 'Phone'])
      .setRequired(true);

    form.addTextItem()
      .setTitle('Any accessibility needs I should know about?')
      .setHelpText('Captions, a recording afterwards, anything at all - just say.');
  }

  form.addCheckboxItem()
    .setTitle('How did you hear about this workshop?')
    .setChoiceValues(HEARD_ABOUT)
    .showOtherOption(true);

  form.addMultipleChoiceItem()
    .setTitle('Would you like to hear about future workshops and AI tips by email?')
    .setHelpText('Occasional and genuinely useful. No spam, and you can unsubscribe any time.')
    .setChoiceValues(['Yes please', 'No thanks'])
    .setRequired(true);

  form.addParagraphTextItem().setTitle('Anything else you would like me to know?');

  return form;
}

// ---------------------------------------------------------------------------
// Form 2 — paid workshop booking
// ---------------------------------------------------------------------------

function createPaidWorkshopForm() {
  var form = FormApp.create('Country Smart AI Workshop Booking');

  form.setDescription(
    'Thanks for booking in. This form tells me what you want to get out of the ' +
    'day so I can prepare properly - the session gets built around the answers.\n\n' +
    WORKSHOP.paidDetails + '\n\n' +
    'It takes about 8 minutes. Worth doing properly: the more I know about your ' +
    'business, the more of the day is spent on your actual work rather than ' +
    'general examples.\n\n' +
    'Please do not enter card details anywhere in this form.'
  );
  form.setProgressBar(true);
  form.setConfirmationMessage(
    'Beauty - all received. I will be in touch before the day with everything ' +
    'you need. If you think of something else you want covered, just email me ' +
    'and I will work it in.'
  );

  // --- Section 1: Your details --------------------------------------------
  form.addSectionHeaderItem()
    .setTitle('Your details');

  form.addTextItem().setTitle('Name').setRequired(true);

  form.addTextItem()
    .setTitle('Email')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());

  form.addTextItem().setTitle('Mobile number').setRequired(true);

  form.addTextItem().setTitle('Business name').setRequired(true);

  form.addTextItem()
    .setTitle('Business name and email for your receipt')
    .setHelpText('Only if it is different from above. Leave blank otherwise.');

  form.addMultipleChoiceItem()
    .setTitle('Have you paid yet?')
    .setHelpText('Never enter card details in a form. If you still need to pay, I will send an invoice.')
    .setChoiceValues([
      'Yes, paid in full',
      'Yes, paid a deposit',
      'Not yet - please send me an invoice'
    ])
    .setRequired(true);

  // --- Section 2: Your business -------------------------------------------
  form.addPageBreakItem()
    .setTitle('Your business')
    .setHelpText('So the examples on the day are about work you actually do.');

  form.addParagraphTextItem()
    .setTitle('What does your business do?')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How many people work in the business?')
    .setChoiceValues(['Just me', '2 to 5', '6 to 20', 'More than 20'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Which of these eat the most of your time?')
    .setHelpText('Tick your worst three or four.')
    .setChoiceValues([
      'Writing social media posts',
      'Answering emails and enquiries',
      'Quotes and invoices',
      'General admin and paperwork',
      'Scheduling and rosters',
      'Coming up with marketing ideas',
      'Following up customers',
      'Writing website or menu copy',
      'Research and looking things up',
      'Bookkeeping and receipts'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What are the two or three things you want to walk out able to do?')
    .setHelpText('The most useful question on this form. Be specific if you can - "write a week of Instagram captions in half an hour" beats "learn about AI".')
    .setRequired(true);

  // --- Section 3: Your setup ----------------------------------------------
  form.addPageBreakItem()
    .setTitle('Your experience and setup')
    .setHelpText('No wrong answers. This just tells me where to start.');

  form.addMultipleChoiceItem()
    .setTitle('How much have you used AI tools?')
    .setChoiceValues(AI_EXPERIENCE)
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Which of these have you tried?')
    .setChoiceValues(AI_TOOLS)
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Do you pay for any AI tools at the moment?')
    .setHelpText('Worth knowing - the paid versions can do a fair bit more, and I will show both.')
    .setChoiceValues([
      'Yes, a paid plan',
      'No, only free versions',
      'Not sure'
    ])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What software do you use day to day?')
    .setHelpText('For example Xero, MYOB, Square, Canva, Gmail, Outlook, Shopify, Facebook, Instagram. I will show you where AI fits into what you already have rather than adding more.')
    .setRequired(true);

  form.addScaleItem()
    .setTitle('How comfortable are you with technology generally?')
    .setBounds(1, 5)
    .setLabels('Not comfortable at all', 'Very comfortable')
    .setRequired(true);

  // --- Section 4: On the day ----------------------------------------------
  form.addPageBreakItem()
    .setTitle('On the day');

  if (WORKSHOP.inPerson) {
    form.addMultipleChoiceItem()
      .setTitle('What will you bring to work on?')
      .setHelpText('A laptop is best for this one - we will be doing the work, not just watching. Tell me if that is a problem and I will sort something out.')
      .setChoiceValues(['Laptop', 'Tablet or iPad', 'Phone only'])
      .setRequired(true);

    form.addTextItem()
      .setTitle('Any dietary requirements?')
      .setHelpText('Allergies, intolerances, anything you avoid. Be specific and I will look after you.');

    form.addTextItem()
      .setTitle('Any accessibility needs I should know about?')
      .setHelpText('Seating, hearing, mobility, anything at all.');
  } else {
    form.addMultipleChoiceItem()
      .setTitle('What will you join on?')
      .setHelpText('A laptop is best for this one - we will be doing the work, not just watching.')
      .setChoiceValues(['Laptop', 'Tablet or iPad', 'Phone'])
      .setRequired(true);

    form.addTextItem()
      .setTitle('Any accessibility needs I should know about?')
      .setHelpText('Captions, a recording afterwards, anything at all.');
  }

  form.addCheckboxItem()
    .setTitle('How did you hear about this workshop?')
    .setChoiceValues(HEARD_ABOUT)
    .showOtherOption(true);

  form.addMultipleChoiceItem()
    .setTitle('Would you like to hear about future workshops and AI tips by email?')
    .setChoiceValues(['Yes please', 'No thanks'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Anything else you would like me to know?')
    .setHelpText('Something specific you are stuck on, a project you are in the middle of, anything you are worried about.');

  return form;
}

// ---------------------------------------------------------------------------
// End of file.
//
// These trailing comment lines are here on purpose. Pasting a long file into
// the script editor on a phone sometimes drops the last line, which breaks the
// code. With comments at the bottom, a dropped line costs you nothing.
// ---------------------------------------------------------------------------

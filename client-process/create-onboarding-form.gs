/**
 * Country Smart AI — new client onboarding form
 *
 * Builds one Google Form: Country Smart AI New Client Onboarding.
 *
 * The job of this form is to work out where someone actually needs the most
 * support, without making them fill in a wall of text boxes. Most of it is
 * one-tap: a rating grid, some multiple choice, a couple of scales. Only six
 * questions ask them to write anything, and those six are the ones worth
 * reading properly.
 *
 * HOW TO RUN
 *   1. https://script.google.com → New project
 *   2. Delete the sample code, paste this whole file in
 *   3. Save (the disk icon), pick "createOnboardingForm" from the function
 *      dropdown, click Run
 *   4. Approve the permission prompt, then read the Execution log for the links
 *
 * No manual fix-ups afterwards — this form has no file upload questions.
 */

function createOnboardingForm() {
  var form = FormApp.create('Country Smart AI New Client Onboarding');

  form.setDescription(
    'Welcome aboard, and thanks for trusting me with this.\n\n' +
    'This form is how I work out where you need the most help, so we spend your ' +
    'money on the things that will actually make a difference rather than the ' +
    'things that sound impressive.\n\n' +
    'It takes about 10 minutes and most of it is tapping options rather than ' +
    'writing. There are no wrong answers and nothing here is a test - the more ' +
    'honest you are about what is not working, the more useful I can be.'
  );
  form.setProgressBar(true);
  form.setConfirmationMessage(
    'Thanks - that is exactly what I needed. I will go through it properly and ' +
    'come back to you within 2 business days with what I think we should tackle ' +
    'first and why. If anything changes in the meantime, just email me.'
  );

  // -------------------------------------------------------------------------
  // Section 1 — The basics
  // -------------------------------------------------------------------------
  form.addSectionHeaderItem()
    .setTitle('Section 1 - The basics')
    .setHelpText('Quick one to start. About 1 minute.');

  form.addTextItem().setTitle('Your name').setRequired(true);

  form.addTextItem()
    .setTitle('Email')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());

  form.addTextItem().setTitle('Mobile number').setRequired(true);

  form.addTextItem().setTitle('Business name').setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What does your business do?')
    .setHelpText('A few lines is plenty. Write it how you would say it out loud.')
    .setRequired(true);

  form.addTextItem()
    .setTitle('Where are you based?')
    .setHelpText('Town or area. If you are mobile, say the area you cover.');

  form.addTextItem()
    .setTitle('How long have you been going?');

  form.addMultipleChoiceItem()
    .setTitle('How many people work in the business?')
    .setChoiceValues([
      'Just me',
      'Me plus casual help',
      '2 to 5',
      '6 to 20',
      'More than 20'
    ])
    .setRequired(true);

  // -------------------------------------------------------------------------
  // Section 2 — How you work now
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 2 - How you work now')
    .setHelpText('So I can build on what you already have instead of piling more on top.');

  form.addParagraphTextItem()
    .setTitle('What software and apps do you use day to day?')
    .setHelpText('For example Xero, MYOB, Square, Canva, Gmail, Outlook, Shopify, Facebook, Instagram, a booking system, a spreadsheet. Include the pen-and-paper bits too - that is useful to know.')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Roughly how many hours a week go on admin and repetitive jobs?')
    .setHelpText('Best guess is fine. Most people underestimate this one.')
    .setChoiceValues([
      'Under 2 hours',
      '2 to 5 hours',
      '5 to 10 hours',
      '10 to 20 hours',
      'More than 20 hours',
      'Honestly no idea'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('When does that work usually get done?')
    .setHelpText('Not a trick question. It tells me how urgent this is.')
    .setChoiceValues([
      'During business hours, it is under control',
      'Evenings',
      'Weekends',
      'Whenever I can grab a minute',
      'It mostly does not get done'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How much have you used AI tools?')
    .setChoiceValues([
      'Never used it',
      'Tried it once or twice',
      'Use it now and then',
      'Use it most weeks',
      'Use it most days'
    ])
    .setRequired(true);

  form.addScaleItem()
    .setTitle('How comfortable are you with technology generally?')
    .setBounds(1, 5)
    .setLabels('Not comfortable at all', 'Very comfortable')
    .setRequired(true);

  // -------------------------------------------------------------------------
  // Section 3 — Where you need support (the important one)
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 3 - Where you need support')
    .setHelpText(
      'This is the section that shapes everything else, so it is worth slowing ' +
      'down for. It is one grid and three questions.'
    );

  var AREAS = [
    'Social media and content',
    'Website',
    'Email and answering enquiries',
    'Quotes and invoices',
    'General admin and paperwork',
    'Customer follow-up and reviews',
    'Bookkeeping and receipts',
    'Scheduling, bookings and rosters',
    'Getting found on Google',
    'Photos, graphics and design',
    'Keeping files and information organised'
  ];

  form.addGridItem()
    .setTitle('How is each of these going at the moment?')
    .setHelpText('One tap per row. Be honest rather than generous - "real pain point" is what I am looking for.')
    .setRows(AREAS)
    .setColumns([
      'I have got this handled',
      'Works, but could be better',
      'This is a real pain point',
      'Not relevant to me'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('If you could only fix ONE of those, which would make the biggest difference?')
    .setHelpText('Pick one. I know several matter - I want to know where to start.')
    .setChoiceValues(AREAS)
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Tell me what is happening with that one at the moment')
    .setHelpText('What does it look like on a bad week? What have you tried? What goes wrong? This is the most useful thing you will write on this form.')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Is there anything you have already tried that did not work?')
    .setHelpText('Software you bought and never used, someone you hired, a system that lasted three weeks. Saves me suggesting the same thing again.');

  // -------------------------------------------------------------------------
  // Section 4 — How you want to be helped
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 4 - How you want to be helped')
    .setHelpText('Two people with the same problem often want completely different things done about it.');

  form.addMultipleChoiceItem()
    .setTitle('Which of these sounds most like you?')
    .setChoiceValues([
      'Show me how and I will do it myself',
      'Set it up for me, then teach me to run it',
      'Just do it for me - I do not want to learn it',
      'Not sure yet, talk me through the options'
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('What would you like from working together?')
    .setHelpText('Tick anything that appeals.')
    .setChoiceValues([
      'Save me time',
      'Save me money',
      'Bring in more customers',
      'Make the business look more professional',
      'Take the stress out of the admin',
      'Help me keep up with what everyone else is doing',
      'Free me up to do the part of the job I actually like'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('If we talk in three months and it has gone well, what is different?')
    .setHelpText('Describe the good version of a normal week. This is what I will measure the work against.')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Is anyone else involved in decisions about this?')
    .setHelpText('A partner, a business partner, an accountant, an office manager. Better to know now.')
    .setChoiceValues([
      'No, it is my call',
      'Yes, I will need to run things past someone',
      'Yes, and they should be in the conversations too'
    ])
    .setRequired(true);

  // -------------------------------------------------------------------------
  // Section 5 — Practical bits
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 5 - Practical bits')
    .setHelpText('Last section, and it is a short one.');

  form.addMultipleChoiceItem()
    .setTitle('How soon would you like to get started?')
    .setChoiceValues([
      'As soon as you can fit me in',
      'Within the next month',
      'In the next few months',
      'Just gathering information for now'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Do you have a budget in mind?')
    .setHelpText('No pressure and no judgement. It stops me proposing something that was never going to fit.')
    .setChoiceValues([
      'Under $500',
      '$500 to $1,500',
      '$1,500 to $3,000',
      '$3,000 to $5,000',
      'More than $5,000',
      'An ongoing monthly amount rather than a one-off',
      'No idea - tell me what things cost'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Is there anything coming up that this needs to be ready for?')
    .setHelpText('A busy season, an event, a launch, a big job.')
    .setChoiceValues(['Yes', 'No'])
    .showOtherOption(true);

  form.addCheckboxItem()
    .setTitle('Best way to get hold of you?')
    .setChoiceValues(['Phone call', 'Text message', 'Email', 'Facebook or Instagram message'])
    .showOtherOption(true)
    .setRequired(true);

  form.addTextItem()
    .setTitle('Best time of day to reach you?')
    .setHelpText('For example "before 9am", "not during school pick-up", "any time after 7".');

  form.addMultipleChoiceItem()
    .setTitle('Would you like to hear about workshops and AI tips by email?')
    .setHelpText('Occasional and genuinely useful. Unsubscribe any time.')
    .setChoiceValues(['Yes please', 'No thanks'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Anything else I should know?')
    .setHelpText('Something you are worried about, something you have been putting off, or something you are quietly proud of. All useful.');

  Logger.log('=====================================================');
  Logger.log('DONE. Onboarding form created.');
  Logger.log('');
  Logger.log('  Edit:  ' + form.getEditUrl());
  Logger.log('  Share: ' + form.getPublishedUrl());
  Logger.log('');
  Logger.log('Send the Share link. Keep the Edit link for yourself.');
  Logger.log('=====================================================');

  return form;
}

// ---------------------------------------------------------------------------
// End of file.
//
// These trailing comment lines are here on purpose. Pasting a long file into
// the script editor on a phone sometimes drops the last line, which breaks the
// code. With comments at the bottom, a dropped line costs you nothing.
// ---------------------------------------------------------------------------

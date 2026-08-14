/**
 * Country Smart AI — form builder
 *
 * Creates both Google Forms in one go:
 *   1. Country Smart AI Website Client Intake Form
 *   2. Country Smart AI Website Revision Request
 *
 * HOW TO RUN
 *   1. Go to https://script.google.com and click "New project".
 *   2. Delete whatever is in the editor and paste this whole file in.
 *   3. Rename the project to "Country Smart AI forms" (optional).
 *   4. In the function dropdown at the top, choose "createBothForms".
 *   5. Click Run. Google will ask for permission the first time — approve it.
 *      (If you see "Google hasn't verified this app", click Advanced,
 *       then "Go to Country Smart AI forms (unsafe)". It's your own script.)
 *   6. Open View > Logs (or the Execution log panel) to get the edit links.
 *
 * ONE THING YOU HAVE TO ADD BY HAND
 *   Google's script API can't create "File upload" questions. The script adds a
 *   clearly labelled marker where each one goes, so open the form afterwards,
 *   change those questions to File upload, then delete the marker text.
 *   There are 3 of them in total and it takes about a minute. Search the logs
 *   for "FILE UPLOAD" and you'll see exactly where.
 */

function createBothForms() {
  var intake = createIntakeForm();
  var revision = createRevisionForm();

  Logger.log('=====================================================');
  Logger.log('DONE. Two forms created.');
  Logger.log('');
  Logger.log('INTAKE FORM');
  Logger.log('  Edit:  ' + intake.getEditUrl());
  Logger.log('  Share: ' + intake.getPublishedUrl());
  Logger.log('');
  Logger.log('REVISION REQUEST FORM');
  Logger.log('  Edit:  ' + revision.getEditUrl());
  Logger.log('  Share: ' + revision.getPublishedUrl());
  Logger.log('');
  Logger.log('NEXT: open each form and convert the 3 questions marked');
  Logger.log('"[CHANGE THIS TO A FILE UPLOAD QUESTION]" into File upload');
  Logger.log('questions, then clear that note out of the help text.');
  Logger.log('=====================================================');

  emailTheLinks_('Your Country Smart AI client forms', [
    'Both forms have been created. Here are the links - keep this email.',
    '',
    'INTAKE FORM',
    '  Edit (yours):    ' + intake.getEditUrl(),
    '  Share (clients): ' + intake.getPublishedUrl(),
    '',
    'REVISION REQUEST FORM',
    '  Edit (yours):    ' + revision.getEditUrl(),
    '  Share (clients): ' + revision.getPublishedUrl(),
    '',
    'STILL TO DO: open each form and change the 3 questions marked',
    '"[CHANGE THIS TO A FILE UPLOAD QUESTION]" to File upload questions,',
    'then clear that note out of the help text.',
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

/** Marker text used where a File upload question needs to be added by hand. */
var FILE_UPLOAD_NOTE = '[CHANGE THIS TO A FILE UPLOAD QUESTION] ';

// ---------------------------------------------------------------------------
// Form 1 — client intake
// ---------------------------------------------------------------------------

function createIntakeForm() {
  var form = FormApp.create('Country Smart AI Website Client Intake Form');

  form.setDescription(
    'Thanks for choosing Country Smart AI. This form gathers everything I need to ' +
    'build your website. It takes about 15-20 minutes.\n\n' +
    'Rough notes are completely fine - you do not need polished wording. You can ' +
    'come back to it later if you need to gather photos or details.'
  );
  form.setProgressBar(true);
  form.setConfirmationMessage(
    'Thanks - got it. I will review everything and get back to you within 2 business ' +
    'days if I need anything else. If you have photos or files still to send, email ' +
    'them through whenever you are ready.'
  );

  // --- Section 1: Business basics -----------------------------------------
  form.addSectionHeaderItem()
    .setTitle('Section 1 - Business basics')
    .setHelpText('Just the essentials so I know who I am building for and how to reach you.');

  form.addTextItem().setTitle('Business name').setRequired(true);
  form.addTextItem().setTitle('Contact person').setRequired(true);

  form.addTextItem()
    .setTitle('Email')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());

  form.addTextItem().setTitle('Phone number').setRequired(true);

  form.addTextItem()
    .setTitle('Business address')
    .setHelpText('If you are mobile or home-based and do not want an address published, say so here.');

  form.addTextItem()
    .setTitle('Do you already have a website or domain? If so, what is the address?');

  form.addParagraphTextItem()
    .setTitle('Social media links')
    .setHelpText('Facebook, Instagram, TikTok, LinkedIn - paste whatever you have.');

  // --- Section 2: About the business --------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 2 - About the business')
    .setHelpText(
      'This is the part that shapes the whole website. Write like you would explain ' +
      'it to someone at the pub - I will turn it into website wording.'
    );

  form.addParagraphTextItem().setTitle('What does your business do?').setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Who is your ideal customer?')
    .setHelpText('Age, location, what they are worried about, what they are looking for. Be as specific as you can.')
    .setRequired(true);

  form.addParagraphTextItem().setTitle('What are your main services or products?').setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What makes you different from others doing the same thing?')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('What do you want people to do after visiting the website?')
    .setHelpText('Pick the single most important one. If there are two, put the second in "Other".')
    .setChoiceValues([
      'Call me',
      'Send an enquiry',
      'Book online',
      'Buy online',
      'Visit in person',
      'Follow me on social media'
    ])
    .showOtherOption(true)
    .setRequired(true);

  // --- Section 3: Website pages -------------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 3 - Website pages')
    .setHelpText('A rough idea of what pages you want. Nothing locked in - we will confirm the final structure together.');

  form.addCheckboxItem()
    .setTitle('Which pages do you want?')
    .setChoiceValues([
      'Home', 'About', 'Services', 'Menu', 'Contact',
      'Gallery', 'Testimonials', 'FAQs'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Are there any specific sections or information you want included?')
    .setHelpText('For example: opening hours, a delivery area map, a specific award, a note about dietary requirements, staff bios.');

  // --- Section 4: Branding and style --------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 4 - Branding and style')
    .setHelpText('If you do not have any of this yet, that is completely fine - just say no and I will work with what we have got.');

  form.addMultipleChoiceItem()
    .setTitle('Do you have a logo?')
    .setChoiceValues([
      'Yes, and I will upload it below',
      'Yes, but I need it recreated or tidied up',
      'No, I do not have one'
    ])
    .setRequired(true);

  form.addTextItem().setTitle('Do you have brand colours? If so, what are they?');
  form.addTextItem().setTitle('Do you have fonts you use?');

  form.addMultipleChoiceItem()
    .setTitle('Do you have brand guidelines or a style guide?')
    .setChoiceValues(['Yes', 'No', 'Not sure']);

  form.addParagraphTextItem()
    .setTitle('Upload your logo and any brand files')
    .setHelpText(FILE_UPLOAD_NOTE +
      'PNG, JPG, PDF, SVG or AI files all work. If you only have your logo on Facebook, just say so and I will grab it.');

  form.addCheckboxItem()
    .setTitle('What style do you like?')
    .setHelpText('Pick one or two.')
    .setChoiceValues([
      'Clean and minimal',
      'Warm and welcoming',
      'Bold and colourful',
      'Modern and professional',
      'Rustic / country',
      'Luxury',
      'Fun and playful'
    ])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Share 2-3 websites you like. What do you like about them?')
    .setHelpText(
      'They do not have to be in your industry. Paste the links and tell me what ' +
      'caught your eye - the colours, the layout, how easy it was to find things. ' +
      'This one question saves a huge amount of guesswork, so it is worth two minutes.'
    )
    .setRequired(true);

  // --- Section 5: Photos and content --------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 5 - Photos and content')
    .setHelpText(
      'Rough notes are completely fine. You do not need to write polished website ' +
      'copy - I can help turn your information into website-ready wording.'
    );

  form.addMultipleChoiceItem()
    .setTitle('Do you have professional photos?')
    .setChoiceValues([
      'Yes, professional photos',
      'Some professional, some phone photos',
      'Phone photos only',
      'No photos yet'
    ])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Upload your photos')
    .setHelpText(FILE_UPLOAD_NOTE +
      'Upload as many as you like - I will pick the strongest ones and optimise them. ' +
      'Originals are better than screenshots. If they are in a Google Drive or Dropbox ' +
      'folder, paste the link here instead.');

  form.addMultipleChoiceItem()
    .setTitle('Do you already have website copy written?')
    .setChoiceValues([
      'Yes, it is written and ready',
      'I have some rough notes',
      'No, nothing yet'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Would you like me to help write the copy?')
    .setChoiceValues(['Yes please', 'No, I will write it myself', 'Not sure yet'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Do you have testimonials or reviews you would like included?')
    .setHelpText('Paste them here, or tell me where to find them (Google reviews, Facebook page).');

  form.addParagraphTextItem()
    .setTitle('Do you have pricing you want displayed on the site?')
    .setHelpText('Some businesses prefer "from $X" or no prices at all. Whatever you are comfortable with.');

  // --- Section 6: Features -------------------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 6 - Features')
    .setHelpText('What the website needs to actually do.');

  form.addCheckboxItem()
    .setTitle('Which features do you need?')
    .setChoiceValues([
      'Contact form',
      'Google Maps',
      'Booking link',
      'Social links',
      'Email sign-up',
      'Menu / downloadable PDF',
      'Gallery',
      'Google reviews'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Does your website need anything outside the package we discussed?')
    .setHelpText(
      'For example: online payments, a members-only area, a shop, multiple languages, ' +
      'an events calendar. Anything extra is quoted separately - better to flag it now ' +
      'than halfway through.'
    );

  // --- Section 7: Domain and access ---------------------------------------
  form.addPageBreakItem()
    .setTitle('Section 7 - Domain and access')
    .setHelpText(
      'PLEASE DO NOT ENTER PASSWORDS IN THIS FORM. If I need access to anything, I will ' +
      'arrange it securely and separately.\n\n' +
      'This is the technical housekeeping. If you do not know the answers, "not sure" is ' +
      'a perfectly good response - I will help you find out.'
    );

  form.addMultipleChoiceItem()
    .setTitle('Do you already own a domain name?')
    .setChoiceValues(['Yes', 'No', 'Not sure'])
    .setRequired(true);

  form.addTextItem()
    .setTitle('Who is your domain registered with?')
    .setHelpText('For example GoDaddy, Crazy Domains, VentraIP, Squarespace, Wix, Google Domains. If you are not sure, just put "not sure" - I can look it up.');

  form.addMultipleChoiceItem()
    .setTitle('Do you already have website hosting?')
    .setChoiceValues(['Yes', 'No', 'Not sure'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('If access to your domain or hosting is needed, are you comfortable arranging that with me separately?')
    .setHelpText('Reminder: never send passwords by form, text or email. I will set up secure access or walk you through adding me as a user.')
    .setChoiceValues(['Yes, happy to', 'I would like to talk it through first', 'Not sure'])
    .setRequired(true);

  form.addParagraphTextItem().setTitle('Anything else I should know?');

  return form;
}

// ---------------------------------------------------------------------------
// Form 2 — revision requests
// ---------------------------------------------------------------------------

function createRevisionForm() {
  var form = FormApp.create('Country Smart AI Website Revision Request');

  form.setDescription(
    'Your package includes one revision round. Please review the entire website - on ' +
    'your phone and on a computer - and send all your requested changes together ' +
    'through this form.\n\n' +
    'Submit one entry per change. There is no limit on how many entries you send, as ' +
    'long as they all come through in this round.\n\n' +
    'Have a look with anyone whose opinion matters to you before you submit, so we can ' +
    'get it all done in one go.'
  );

  form.setConfirmationMessage(
    'Got it. Add another change using the link below, or if that is everything, sit ' +
    'tight - I will work through the list and send you the updated site.'
  );
  form.setShowLinkToRespondAgain(true);
  form.setAllowResponseEdits(false);

  form.addTextItem().setTitle('Your name').setRequired(true);
  form.addTextItem().setTitle('Business name').setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Which page?')
    .setChoiceValues([
      'Home', 'About', 'Services', 'Menu', 'Contact',
      'Gallery', 'Testimonials', 'FAQs', 'Applies to the whole site'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addTextItem()
    .setTitle('Which section of the page?')
    .setHelpText('For example: the top banner, the third box down, the footer, the contact form.')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Current text or content')
    .setHelpText('Copy and paste what is on the site now, so I know exactly which bit you mean.');

  form.addParagraphTextItem()
    .setTitle('What would you like it changed to?')
    .setHelpText('Be as specific as you can. "Change the phone number to 0400 000 000" is easier to action than "the contact bit is wrong".')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Screenshot')
    .setHelpText(FILE_UPLOAD_NOTE +
      'A screenshot with a circle or arrow on it is the fastest way to show me something. Optional, but it helps.');

  form.addParagraphTextItem().setTitle('Other notes');

  return form;
}

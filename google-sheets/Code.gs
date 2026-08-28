const REGISTRATION_HEADERS = [
  'Payment Date',
  'Graduate Name',
  'Former Name',
  'Email',
  'Phone',
  'Tickets',
  'Guest Names',
  'Friday at Congress',
  'Family Picnic',
  'CDO Tour & Photos',
  'Amount Paid',
  'Currency',
  'Stripe Session ID',
  'Payment Intent ID',
  'Payment Status'
];

function setupRegistrationSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const properties = PropertiesService.getScriptProperties();
  const sharedSecret = properties.getProperty('SHEETS_SHARED_SECRET') || Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  properties.setProperties({
    SHEET_ID: spreadsheet.getId(),
    SHEETS_SHARED_SECRET: sharedSecret
  });

  let sheet = spreadsheet.getSheetByName('Registrations');
  if (!sheet) sheet = spreadsheet.insertSheet('Registrations');
  sheet.getRange(1, 1, 1, REGISTRATION_HEADERS.length).setValues([REGISTRATION_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, REGISTRATION_HEADERS.length)
    .setBackground('#083D2D')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setWrap(true);
  sheet.getRange('A:A').setNumberFormat('m/d/yyyy h:mm AM/PM');
  sheet.getRange('F:F').setNumberFormat('0');
  sheet.getRange('K:K').setNumberFormat('$#,##0.00');
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), REGISTRATION_HEADERS.length).createFilter();
  }

  console.log('SHEETS_SHARED_SECRET=' + sharedSecret);
  console.log('Save this value privately in Cloudflare. Do not put it in GitHub.');
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('SHEETS_SHARED_SECRET');
    if (!expectedSecret || payload.sharedSecret !== expectedSecret) {
      return jsonOutput({ ok: false, error: 'Unauthorized' });
    }

    const spreadsheet = SpreadsheetApp.openById(properties.getProperty('SHEET_ID'));
    const sheet = spreadsheet.getSheetByName('Registrations');
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const sessionId = String(payload.stripeSessionId || '');
      if (!sessionId) return jsonOutput({ ok: false, error: 'Missing Stripe Session ID' });

      const lastRow = Math.max(sheet.getLastRow(), 2);
      const existing = sheet.getRange(2, 13, lastRow - 1, 1).createTextFinder(sessionId).matchEntireCell(true).findNext();
      if (!existing) sheet.appendRow([
        new Date(payload.paymentDate),
        payload.graduateName || '',
        payload.formerName || '',
        payload.email || '',
        payload.phone || '',
        Number(payload.tickets || 0),
        payload.guestNames || '',
        payload.fridayCongress || 'No',
        payload.familyPicnic || 'No',
        payload.cdoTourPhotos || 'No',
        Number(payload.amountPaid || 0),
        payload.currency || '',
        sessionId,
        payload.paymentIntentId || '',
        payload.paymentStatus || ''
      ].map(safeCell));

      const row = sheet.getLastRow();
      sheet.getRange(row, 1).setNumberFormat('m/d/yyyy h:mm AM/PM');
      sheet.getRange(row, 6).setNumberFormat('0');
      sheet.getRange(row, 11).setNumberFormat('$#,##0.00');
      saveClassmateResponses(spreadsheet, sessionId, payload.classmateResponses || []);
      return jsonOutput({ ok: true, saved: true });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return jsonOutput({ ok: false, error: String(error.message || error) });
  }
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function safeCell(value) {
  return typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
}

function saveClassmateResponses(spreadsheet, sessionId, responses) {
  if (!Array.isArray(responses) || responses.length > 6) throw new Error('Invalid survey responses');
  if (!responses.length) return;
  let survey = spreadsheet.getSheetByName('Classmate Survey');
  if (!survey) survey = spreadsheet.insertSheet('Classmate Survey');
  const headers = ['Response ID', 'Stripe Session ID', 'Graduate Name', 'City / State / Country', 'Children Reported', 'Grandchildren Reported', 'Career Field', 'Other Career', 'Accomplishment (private unless permitted)', 'CDO Memory (private unless permitted)', 'May Share Written Responses With Name', 'High School Talents / Hobbies (private unless permitted)', 'U.S. States Visited (lifetime)', 'Countries Visited (lifetime)'];
  survey.getRange(1, 1, 1, headers.length).setValues([headers]).setBackground('#083D2D').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
  survey.setFrozenRows(1);
  responses.forEach(function(response, index) {
    const id = sessionId + ':' + (index + 1);
    const lastRow = survey.getLastRow();
    const existing = lastRow > 1 && survey.getRange(2, 1, lastRow - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
    if (existing) return;
    // Blank remains unanswered; numeric zero remains a valid answer.
    survey.appendRow([id, sessionId, response.name || '', response.location || '',
      response.children == null ? '' : response.children,
      response.grandchildren == null ? '' : response.grandchildren,
      response.career || '', response.careerOther || '', response.accomplishment || '', response.memory || '',
      response.shareWithName === true ? 'Yes' : 'No', response.highSchoolHobbies || '',
      response.statesVisited == null ? '' : response.statesVisited,
      response.countriesVisited == null ? '' : response.countriesVisited].map(safeCell));
  });
}

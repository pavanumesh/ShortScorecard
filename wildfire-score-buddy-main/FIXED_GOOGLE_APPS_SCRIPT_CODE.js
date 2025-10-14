function doGet(e) {
  try {
    // Use your actual Spreadsheet ID
    const spreadsheet = SpreadsheetApp.openById('1H6EdCMcDPpz41QpZeqV1B-W7BzNhxuVzmerYMiPZioQ');
    
    // Get the first sheet (most common case)
    const sheet = spreadsheet.getSheets()[0];
    
    // Get all data from the sheet
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Convert to JSON format
    const questions = rows.map(row => {
      const question = {};
      headers.forEach((header, index) => {
        question[header] = row[index];
      });
      return question;
    });
    
    // Return JSON response
    return ContentService
      .createTextOutput(JSON.stringify({ questions: questions }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  return doGet(e);
}

function doGet(e) {
  try {
    // Use your actual Spreadsheet ID
    const spreadsheet = SpreadsheetApp.openById('1H6EdCMcDPpz41QpZeqV1B-W7BzNhxuVzmerYMiPZioQ');
    
    // Debug: Get all sheet names
    const sheets = spreadsheet.getSheets();
    const sheetNames = sheets.map(sheet => sheet.getName());
    
    // Get the first sheet
    const sheet = sheets[0];
    
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
    
    // Return JSON response with debug info
    return ContentService
      .createTextOutput(JSON.stringify({ 
        questions: questions,
        debug: {
          sheetNames: sheetNames,
          totalRows: data.length,
          headers: headers
        }
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        error: error.toString(),
        message: "Check if the spreadsheet ID is correct and the sheet has data"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  return doGet(e);
}

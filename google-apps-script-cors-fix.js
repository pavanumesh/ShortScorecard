// Add this to your Google Apps Script doGet() function
function doGet(e) {
  // Your existing code here...
  
  // Add CORS headers
  return ContentService
    .createTextOutput(JSON.stringify(yourData))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

// If you have a doPost function, add this too:
function doPost(e) {
  // Your existing code here...
  
  return ContentService
    .createTextOutput(JSON.stringify(yourData))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

# Google Apps Script Setup Guide

## Step 1: Create a Google Apps Script

1. **Go to** [script.google.com](https://script.google.com)
2. **Click** "New Project"
3. **Replace the default code** with the following:

```javascript
function doGet(e) {
  try {
    // Get the spreadsheet data
    const spreadsheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
    const sheet = spreadsheet.getSheetByName('Questions'); // Change sheet name as needed
    
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
    
    // Return JSON response with CORS headers
    const output = ContentService
      .createTextOutput(JSON.stringify({ questions: questions }))
      .setMimeType(ContentService.MimeType.JSON);
    
    // Set CORS headers manually
    output.setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    return output;
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
  }
}

function doPost(e) {
  return doGet(e);
}
```

## Step 2: Set up your Google Sheet

Create a Google Sheet with the following structure:

| QID | Question | Section | Weight | Type | Options |
|-----|----------|---------|--------|------|---------|
| Q1 | What is the current fire danger rating? | Fire Danger Assessment | 1.0 | multiple_choice | [{"value":0,"label":"Low"},{"value":1,"label":"Moderate"},{"value":2,"label":"High"},{"value":3,"label":"Very High"},{"value":4,"label":"Extreme"}] |
| Q2 | What is the wind speed? | Weather Conditions | 1.2 | multiple_choice | [{"value":0,"label":"0-5 mph"},{"value":1,"label":"6-15 mph"},{"value":2,"label":"16-25 mph"},{"value":3,"label":"26-40 mph"},{"value":4,"label":"40+ mph"}] |

## Step 3: Configure the Script

1. **Replace `YOUR_SPREADSHEET_ID`** with your actual Google Sheet ID
2. **Change `'Questions'`** to match your sheet name
3. **Save the script** (Ctrl+S)

## Step 4: Deploy the Script

1. **Click** "Deploy" → "New deployment"
2. **Choose** "Web app" as the type
3. **Set** "Execute as" to "Me"
4. **Set** "Who has access" to "Anyone"
5. **Click** "Deploy"
6. **Copy the Web App URL** (it will look like: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`)

## Step 5: Update your React App

Replace the API_URL in your React app with the new Web App URL.

## Step 6: Test the API

You can test your API by visiting the Web App URL directly in your browser. It should return JSON data like:

```json
{
  "questions": [
    {
      "QID": "Q1",
      "Question": "What is the current fire danger rating?",
      "Section": "Fire Danger Assessment",
      "Weight": 1.0,
      "Type": "multiple_choice",
      "Options": "[{\"value\":0,\"label\":\"Low\"},{\"value\":1,\"label\":\"Moderate\"}]"
    }
  ]
}
```

## Troubleshooting

- **If you get HTML instead of JSON**: The script is not deployed correctly
- **If you get CORS errors**: Make sure the CORS headers are set in the script
- **If you get authentication errors**: Make sure "Who has access" is set to "Anyone"

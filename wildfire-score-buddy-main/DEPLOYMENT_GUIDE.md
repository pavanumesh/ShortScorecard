# 🔥 Community Wildfire Resilience Scorecard - Deployment Guide

## 📋 Overview

This guide will help you deploy the Community Wildfire Resilience Scorecard web app connected to Google Sheets.

## 🗂️ Step 1: Set Up Your Google Sheet

### Create the Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it "Wildfire Resilience Scorecard"

### Create the "Questions" Tab

1. Rename Sheet1 to **"Questions"**
2. Add the following headers in row 1:
   ```
   QID | Section | Question | Tooltip | Scale0 | Scale1 | Scale2 | Scale3 | Scale4 | AllowNA | Weight
   ```

3. Example data structure:
   ```
   Q1 | Governance | Does your community have a wildfire action plan? | This includes documented strategies... | No plan | Draft only | Plan exists | Plan reviewed annually | Comprehensive plan | TRUE | 1
   Q2 | Infrastructure | Are fire hydrants maintained regularly? | Regular maintenance ensures... | Never | Rarely | Sometimes | Often | Always | FALSE | 1
   ```

4. Fill in your 30 wildfire resilience questions

### Create the "Responses" Tab

1. Create a new tab named **"Responses"**
2. Add the following headers in row 1:
   ```
   Timestamp | RespondentID | Community | Section | QID | Score | Notes | Weight | WeightedScore | TotalScore
   ```

## ⚙️ Step 2: Deploy Google Apps Script Backend

### Create the Script

1. In your Google Sheet, go to **Extensions > Apps Script**
2. Delete any default code
3. Copy and paste the following code:

```javascript
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const questionsSheet = ss.getSheetByName("Questions");
  const data = questionsSheet.getDataRange().getValues();
  
  // Skip header row
  const headers = data[0];
  const questions = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  
  return ContentService
    .createTextOutput(JSON.stringify({ questions }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const responsesSheet = ss.getSheetByName("Responses");
    
    const data = JSON.parse(e.postData.contents);
    const responses = data.responses;
    
    responses.forEach(response => {
      responsesSheet.appendRow([
        response.timestamp,
        response.respondentId,
        response.community,
        response.section,
        response.qid,
        response.score,
        response.notes,
        response.weight,
        response.weightedScore,
        response.totalScore
      ]);
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        message: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Deploy the Web App

1. Click the **Deploy** button (top right) > **New deployment**
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**
3. Configure:
   - **Description:** Wildfire Scorecard API
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**
5. **Copy the Web App URL** - you'll need this!
6. Click **Authorize access** if prompted and grant permissions

## 🚀 Step 3: Configure the Web App

### Update the API URL

1. Open `src/pages/Index.tsx` in your code editor
2. Find this line near the top:
   ```typescript
   const API_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";
   ```
3. Replace it with your actual Web App URL from Step 2:
   ```typescript
   const API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
   ```

## 🧪 Step 4: Test Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:8080`

4. Test the following:
   - Questions load correctly
   - Dropdowns work for scoring
   - Info buttons show tooltips
   - Notes can be added
   - Average scores calculate
   - Submission works

## 🌐 Step 5: Deploy to Production

### Option A: Deploy with Lovable

1. In Lovable, click **Share** > **Publish**
2. Your app will be deployed automatically
3. You'll get a public URL to share

### Option B: Deploy to Netlify

1. Build the app:
   ```bash
   npm run build
   ```

2. Go to [Netlify](https://app.netlify.com)
3. Drag and drop the `dist` folder
4. Your site is live!

### Option C: Deploy to GitHub Pages

1. Update `vite.config.ts` to add base path:
   ```typescript
   export default defineConfig({
     base: '/your-repo-name/',
     // ... rest of config
   })
   ```

2. Build and deploy:
   ```bash
   npm run build
   git add dist -f
   git commit -m "Deploy"
   git subtree push --prefix dist origin gh-pages
   ```

## 🔒 Security Notes

- The Apps Script is set to "Anyone" access for simplicity
- Consider adding authentication if needed
- Data is stored in your private Google Sheet
- Only you can access the sheet data directly

## 🛠️ Troubleshooting

### Questions Not Loading
- Verify your API_URL is correct
- Check browser console for errors
- Ensure the Apps Script is deployed and published
- Test the API URL directly in a browser

### Submission Fails
- Check that the "Responses" tab exists and has correct headers
- Verify CORS is working (Apps Script handles this automatically)
- Check browser network tab for error details

### Data Not Appearing in Sheet
- Verify all column headers match exactly
- Check Apps Script execution logs
- Ensure the sheet isn't protected or locked

## 📊 Data Analysis

Your responses will automatically populate in the "Responses" tab. You can:
- Create pivot tables to analyze by section
- Calculate community averages
- Export data for further analysis
- Create charts and visualizations

## 🎉 Success!

Your Community Wildfire Resilience Scorecard is now live and collecting valuable data to help communities prepare for wildfire events!

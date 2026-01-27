function doGet(e) {
  try {
    var spreadsheet = SpreadsheetApp.openById('1H6EdCMcDPpz41QpZeqV1B-W7BzNhxuVzmerYMiPZioQ');

    // Questions: use "Questions" sheet if present, else first sheet
    var questionsSheet = spreadsheet.getSheetByName('Questions') || spreadsheet.getSheets()[0];
    var qData = questionsSheet.getDataRange().getValues();
    var qHeaders = qData[0];
    var qRows = qData.slice(1);
    var questions = qRows.map(function (row) {
      var obj = {};
      qHeaders.forEach(function (header, index) {
        obj[header] = row[index];
      });
      return obj;
    });

    // Community Information: sheet named "Community Information" (same spreadsheet)
    var communityInformation = [];
    var infoSheet = spreadsheet.getSheetByName('Community Information');
    if (infoSheet) {
      var infoData = infoSheet.getDataRange().getValues();
      var infoHeaders = infoData[0];
      var infoRows = infoData.slice(1);
      communityInformation = infoRows.map(function (row) {
        var obj = {};
        infoHeaders.forEach(function (header, index) {
          obj[header] = row[index];
        });
        return obj;
      });
    }

    // Section names from "Sections" sheet: col A = code (E1..E10), col B = name (Governance, etc.)
    var sectionNames = {};
    var sectionsSheet = spreadsheet.getSheetByName('Sections');
    if (sectionsSheet) {
      var sData = sectionsSheet.getDataRange().getValues();
      for (var i = 0; i < sData.length; i++) {
        var code = (sData[i][0] || '').toString().trim().toUpperCase();
        var name = (sData[i][1] || '').toString().trim();
        if (code && name) sectionNames[code] = name;
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        questions: questions,
        communityInformation: communityInformation,
        sectionNames: sectionNames
      }))
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

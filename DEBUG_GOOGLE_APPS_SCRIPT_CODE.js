function doGet(e) {
  try {
    var spreadsheet = SpreadsheetApp.openById('1H6EdCMcDPpz41QpZeqV1B-W7BzNhxuVzmerYMiPZioQ');
    var sheets = spreadsheet.getSheets();
    var sheetNames = sheets.map(function (s) { return s.getName(); });

    var questionsSheet = spreadsheet.getSheetByName('Questions') || sheets[0];
    var qData = questionsSheet.getDataRange().getValues();
    var qHeaders = qData[0];
    var questions = qData.slice(1).map(function (row) {
      var obj = {};
      qHeaders.forEach(function (header, i) { obj[header] = row[i]; });
      return obj;
    });

    var communityInformation = [];
    var infoSheet = spreadsheet.getSheetByName('Community Information');
    var infoData = [];
    if (infoSheet) {
      infoData = infoSheet.getDataRange().getValues();
      var infoHeaders = infoData[0];
      communityInformation = infoData.slice(1).map(function (row) {
        var obj = {};
        infoHeaders.forEach(function (header, i) { obj[header] = row[i]; });
        return obj;
      });
    }

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
        sectionNames: sectionNames,
        debug: {
          sheetNames: sheetNames,
          questionsRows: qData.length,
          questionsHeaders: qHeaders,
          communityInfoRows: infoSheet ? infoData.length : 0,
          communityInfoHeaders: infoSheet && infoData.length ? infoData[0] : []
        }
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: error.toString(),
        message: 'Check if the spreadsheet ID is correct and the sheet has data'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  return doGet(e);
}

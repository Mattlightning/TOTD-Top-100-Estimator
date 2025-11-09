var scriptPrp = PropertiesService.getScriptProperties()

function GatherData() {
  var SinceCOTD = parseInt(scriptPrp.getProperty("HoursSinceCOTD"))

  var RefreshToken = scriptPrp.getProperty("NadeoRefreshToken")
  var AccessToken = ""

  SinceCOTD++

  if (RefreshToken == "") { // Get Ubisoft Ticket and Nadeo Tokens
    const NadeoTokens = NewTokens()

    AccessToken = NadeoTokens.accessToken
    RefreshToken = NadeoTokens.refreshToken
    scriptPrp.setProperty("NadeoRefreshToken", RefreshToken)

  } else { // Refresh Nadeo Tokens Or Fall Back On Ubisoft Ticket and Nadeo Tokens
    var NadeoTokens = RefreshNadeoTokens(RefreshToken)

    if (NadeoTokens == "Error") {
      Utilities.sleep(5000)
      NadeoTokens = NewTokens()
    }

    AccessToken = NadeoTokens.accessToken
    RefreshToken = NadeoTokens.refreshToken
    scriptPrp.setProperty("NadeoRefreshToken", RefreshToken)
  }

  var MapID = scriptPrp.getProperty("CurrentMapID")
  var SeasonID = scriptPrp.getProperty("CurrentSeasonID")

  if (SinceCOTD == 1) { // Update Current TOTD Map Info
    var TOTDData = GetTOTDInfo(AccessToken)

    while (TOTDData == "Error") {
      Utilities.sleep(5000)
      TOTDData = GetTOTDInfo()
    }

    MapID = TOTDData.mapUid
    SeasonID = TOTDData.seasonUid
    scriptPrp.setProperty("CurrentMapID", MapID)
    scriptPrp.setProperty("CurrentSeasonID", SeasonID)
  }

  var LeaderboardData = GetLeaderboard(AccessToken, MapID, SeasonID)

  while (LeaderboardData == "Error") { // Make Sure LeaderboardData Is Valid Data
    Utilities.sleep(5000)
    LeaderboardData = GetLeaderboard(AccessToken, MapID, SeasonID)
  }

  UpdateCurrentTOTD(LeaderboardData, SinceCOTD)

  if (SinceCOTD != 24) { // Estimate Top 100 Time
    EstimateTop100Time(LeaderboardData, SinceCOTD)

  } else { // Reset SinceCOTD Counter And Date
    RemoveEstimatedTime()

    SinceCOTD = 0

    const OldDate = scriptPrp.getProperty("CurrentDate")

    const DayNum = parseInt(OldDate.slice(0,2))

    if (DayNum != 1) {
      TransferData(MapID, OldDate)

      FindAverageForEach()
    }

    const date = new Date()
    const TimeZone = CalendarApp.getTimeZone()

    const CurrentDate = String(Utilities.formatDate(date, TimeZone, "dd/MM/yyyy"))

    scriptPrp.setProperty("CurrentDate", CurrentDate)
    scriptPrp.setProperty("CurrentDayNum", DayNum)

    console.log(CurrentDate)

    ClearCurrentTOTDSheet()
  }
  scriptPrp.setProperty("HoursSinceCOTD", SinceCOTD)
}



function NewTokens() { // Get Ubisoft Ticket Then Use That To Get Nadeo Token
  var UBITicket = GetUBITicket();

  while (UBITicket == "Error") {
    Utilities.sleep(5000)
    UBITicket = GetUBITicket()
  }

  var NadeoTokens = GetNadeoTokens(UBITicket);

  while (NadeoTokens == "Error") {
    Utilities.sleep(5000)
    NadeoTokens = GetNadeoTokens()
  }

  return NadeoTokens
}



function GetUBITicket() { // Get Ubisoft Ticket
  const email = scriptPrp.getProperty("UBIEmail")
  const password = scriptPrp.getProperty("UBIPassword")

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Ubi-AppId": "86263886-327a-4328-ac69-527f0d20a237",
      "Authorization": "Basic " + Utilities.base64Encode(email + ":" + password),
      "User-Agent": "TOTD Top 100 Estimator / WilsonMatthew808@gmail.com",
    },
    muteHttpExceptions: true,
  }
  const response = UrlFetchApp.fetch("https://public-ubiservices.ubi.com/v3/profiles/sessions", options)

  console.log("Ubisoft Ticket: \n" + response.getContentText())

  const data = JSON.parse(response)

  if (data.ticket) {
    return data.ticket
  } else {
    console.log("Encountered Error in Ubisoft Authentication")
    return "Error"
  }
}



function GetNadeoTokens(UBITicket) { // Use Ubisoft Ticket To Get Nadeo Tokens
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "ubi_v1 t=" + UBITicket,
      "User-Agent": "TOTD Top 100 Estimator / WilsonMatthew808@gmail.com",
    },
    payload: JSON.stringify({
      "audience": "NadeoLiveServices"
    }),
    muteHttpExceptions: true,
  }

  const response = UrlFetchApp.fetch("https://prod.trackmania.core.nadeo.online/v2/authentication/token/ubiservices", options)

  console.log("Nadeo Services Tokens: \n" + response.getContentText())

  const data = JSON.parse(response)

  if (data.accessToken) {
    return data
  } else {
    return "Error"
  }
}



function RefreshNadeoTokens(RefreshToken) { // Use Refresh Token To Update Access Token Instead Of Using Ubisoft Token
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "nadeo_v1 t=" + RefreshToken
    },
    muteHttpExceptions: true,
  }

  const response = UrlFetchApp.fetch("https://prod.trackmania.core.nadeo.online/v2/authentication/token/refresh", options)

  console.log("Nadeo Tokens: \n" + response.getContentText())

  const data = JSON.parse(response)

  if (data.accessToken && data.refreshToken) {
    return data
  } else {
    return "Error"
  }
}



function GetTOTDInfo(AccessToken) { // Get Current TOTD Info (MapID, SeasonID)
  const options = {
    method: "get",
    contentType: "application/json",
    headers: {
      Authorization: "nadeo_v1 t=" + AccessToken,
      Accept: "application/json"
    },
    muteHttpExceptions: true,
  }

  const response = UrlFetchApp.fetch("https://live-services.trackmania.nadeo.live/api/token/campaign/month?length=1", options)

  console.log("TOTD Info: \n" + response.getContentText())

  const data = JSON.parse(response)

  if (data.monthList[0].days && data.monthList[0].lastDay) {
    const CurrentDay = scriptPrp.getProperty("CurrentDayNum")
    const Days = data.monthList[0].days

    const currentTOTDData = Days[CurrentDay - 1]

    if (currentTOTDData.mapUid && currentTOTDData.seasonUid) {
      return currentTOTDData
    } else {
      return "Error"
    }
  } else {
    return "Error"
  }
}



function GetLeaderboard(AccessToken, MapID, SeasonID) { // Get Top 100 Leaderboard Data
  const options = {
    method: "get",
    contentType: "application/json",
    headers: {
      Authorization: "nadeo_v1 t=" + AccessToken,
    },
    muteHttpExceptions: true,
  }
  
  const response = UrlFetchApp.fetch("https://live-services.trackmania.nadeo.live/api/token/leaderboard/group/" + SeasonID + "/map/" + MapID + "/top?length=100&onlyWorld=true", options)

  console.log("TOTD Top 100 Leaderboard: \n" + response.getContentText())

  const data = JSON.parse(response)

  if (data.tops) {

    const TimesData = data.tops[0].top

    var LeaderboardTimes = []

    for (let i = 0; i < TimesData.length; i++) {
      const time = TimesData[i].score
      LeaderboardTimes.push([time])
    }

    return LeaderboardTimes
  }
}



function UpdateCurrentTOTD(LeaderboardData, SinceCOTD) { // Updates Current TOTD Data
  var ss = SpreadsheetApp.openById("1XVoVfJigsVSkUEov7v3P-RARk98VyNbH8PHMep5jdfU")
  var sheet = ss.getSheetByName("Current TOTD Data")

  sheet.getRange(2, SinceCOTD, LeaderboardData.length, 1).setValues(LeaderboardData)
}



function TransferData(MapID, Date) { // Transfers Data From Current TOTD Sheet To TOTD Historic Data Sheet
  var ss = SpreadsheetApp.openById("1XVoVfJigsVSkUEov7v3P-RARk98VyNbH8PHMep5jdfU")
  var CTD = ss.getSheetByName("Current TOTD Data")
  var CTDVals = CTD.getDataRange().getValues()

  var THD = ss.getSheetByName("TOTD Historic Data")

  const Top100Time = CTDVals[100][23]

  var NewData = [MapID, Date, Top100Time]

  for (let i = 0; i < 23; i++) {
    var lastTime = CTDVals[1][i]
    var currentTime
    var lowerPosition

    for (let j = 2; j < 101; j++) {
      currentTime = CTDVals[j][i]

      if (currentTime > Top100Time) {
        lowerPosition = j - 1
        break
      } else {
        lastTime = currentTime
      }
    }

    const timeDiff = currentTime - lastTime
    const top100TimeDiff = Top100Time - lastTime

    const top100PosDecimal = top100TimeDiff / timeDiff

    const top100Pos = lowerPosition + top100PosDecimal

    NewData.push(top100Pos)
  }

  THD.appendRow(NewData)
}



function ClearCurrentTOTDSheet() { // Clears Current TOTD Data Sheet
  var ss = SpreadsheetApp.openById("1XVoVfJigsVSkUEov7v3P-RARk98VyNbH8PHMep5jdfU")
  var sheet = ss.getSheetByName("Current TOTD Data")

  const values = sheet.getDataRange().getValues()
  const headers = values[0]

  sheet.clearContents()

  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
}



function FindAverageForEach() { // Update Average Position For Each Hour
  var ss = SpreadsheetApp.openById("1XVoVfJigsVSkUEov7v3P-RARk98VyNbH8PHMep5jdfU")
  var sheet = ss.getSheetByName("TOTD Historic Data")

  var values = sheet.getDataRange().getValues()

  var AveragePositions = []

  for (let i = 3; i < values[0].length; i++) {
    var TotalPositions = 0
    var Total = 0

    for (let j = 1; j < values.length; j++) {
      Total++
      TotalPositions += parseInt(values[j][i])
    }

    const AveragePosition = TotalPositions / Total

    AveragePositions.push(AveragePosition)
  }

  sheet = ss.getSheetByName("Average Data")

  sheet.getRange(2,1,1,AveragePositions.length).setValues([AveragePositions])
}



function EstimateTop100Time(LeaderboardData, SinceCOTD) { // Estimates The Top 100 Cut-Off Time
  var ss = SpreadsheetApp.openById("1XVoVfJigsVSkUEov7v3P-RARk98VyNbH8PHMep5jdfU")

  var sheet = ss.getSheetByName("Average Data")

  var values = sheet.getDataRange().getValues()

  if (values[1]) {
    const AveragePosition = Number(values[1][SinceCOTD - 1])

    const LowerPosition = Math.floor(Number(AveragePosition))

    const PositionDiff = AveragePosition - LowerPosition

    const LowerTime = Number(LeaderboardData[LowerPosition - 1])
    const UpperTime = Number(LeaderboardData[LowerPosition])

    const TimeDiff = UpperTime - LowerTime

    const EstimatedTop100TimeDiff = Math.round(TimeDiff * PositionDiff)

    const EstimatedTop100Time = LowerTime + EstimatedTop100TimeDiff

    console.log(EstimatedTop100Time)

    UpdateEstimatedTime(EstimatedTop100Time)
  }
}



function UpdateEstimatedTime(EstimatedTime) { // Updates The Estimated Top 100 Time And MapID That Is Read By OpenPlanet plugin
  var ss = SpreadsheetApp.openById("1XVoVfJigsVSkUEov7v3P-RARk98VyNbH8PHMep5jdfU")

  var sheet = ss.getSheetByName("Estimated Time")

  const MapID = scriptPrp.getProperty("CurrentMapID")

  sheet.getRange(2,1,1,2).setValues([[MapID, EstimatedTime]])
}



function RemoveEstimatedTime() { // Removes MapID And Estimated Time When New TOTD Is Released
  var ss = SpreadsheetApp.openById("1XVoVfJigsVSkUEov7v3P-RARk98VyNbH8PHMep5jdfU")

  var sheet = ss.getSheetByName("Estimated Time")

  sheet.getRange(2,1,1,2).setValues([["",""]])
}

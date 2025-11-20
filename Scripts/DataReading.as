const string EstimatedTimeURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRotN-o3qz_Ui3YCSTt41-QoXl6YOqCR7hEJhTCsAd45V7jRyICQbPqjXTunkux9kZUJ-oN_W-_ClV2/pub?gid=49565184&single=true&output=csv";

void FetchData() {
    RefreshCD = true;

    auto req = Net::HttpGet(EstimatedTimeURL);

    while (!req.Finished()) yield();

    if (req.ResponseCode() != 200) return;

    auto lines = req.String().Split("\n");
    if (lines.Length > 1) {
        auto Data = lines[1].Split(","); // Lines[0] contains Headers

        TOTDMapID = Data[0].Trim();
        uint time = Text::ParseInt64(Data[1].Trim());

        EstimatedTop100Time = "0" + Time::Format(time, true, true);
    }

    RefreshCD = false;
}

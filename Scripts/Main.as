string TOTDMapID;
string EstimatedTop100Time;

bool RefreshCD = false;

[Setting hidden]
bool showWindow = false;

void RenderMenu() {
    if (UI::MenuItem(Icons::Calculator + " TOTD Top 100 Estimator", "", showWindow)) {
        showWindow = !showWindow;
    }
}

void Render() {
    auto rootMap = GetApp().RootMap;

    if (rootMap !is null) {
        string MapID = rootMap.IdName;

        if (showWindow && MapID == TOTDMapID) {
            bool gameUI = UI::IsGameUIVisible();

            if (gameUI) {
                bool overlay = UI::IsOverlayShown();
                
                int WindowFlags = UI::WindowFlags::NoResize | UI::WindowFlags::AlwaysAutoResize | UI::WindowFlags::NoCollapse; 
                if (!overlay) WindowFlags |= UI::WindowFlags::NoTitleBar | UI::WindowFlags::NoMove;

                UI::Begin("TOTD Top 100 Estimator", WindowFlags);

                UI::Text("Estimated Top 100: " + EstimatedTop100Time);
                if (overlay) {
                    if (UI::Button("Refresh", vec2(60,26)) && !RefreshCD) {
                        startnew(FetchData);
                    }
                }

                UI::End();
            }
        }
    }
}

void Main() {
    while (true) {
        FetchData();
        sleep(5 * 60 * 1000);
    }
}

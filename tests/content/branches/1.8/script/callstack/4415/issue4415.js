function runTest()
{
    FBTest.sysout("issue4415.START");
    FBTest.openNewTab(basePath + "script/callstack/4415/issue4415.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.enableScriptPanel(function(win)
        {
            var panel = FW.Firebug.chrome.selectPanel("script");
            var stackPanel = FW.Firebug.chrome.selectSidePanel("callstack");

            FBTest.waitForBreakInDebugger(FW.Firebug.chrome, 18, false, function(row)
            {
                var panelNode = stackPanel.panelNode;

                var frames = panelNode.querySelectorAll(".objectBox-stackFrame");
                FBTest.compare(4, frames.length, "There must be four frames");

                FBTest.clickContinueButton();
                FBTest.testDone("issue4415.DONE");
            });

            FBTest.click(win.document.getElementById("testButton"));
        });
    });
}

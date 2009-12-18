function runTest()
{
    FBTest.sysout("issue2558.START");

    // 1) Open test page
    FBTestFirebug.openNewTab(basePath + "dom/2558/issue2558.html", function(win)
    {
        // 2) Open Firebug and enable the Script panel.
        FBTestFirebug.openFirebug();
        FBTestFirebug.enableScriptPanel(function()
        {
            FBTestFirebug.selectPanel("script");

            // Wait for break in debugger.
            var chrome = FW.Firebug.chrome;
            FBTestFirebug.waitForBreakInDebugger(chrome, 34, false, function(sourceRow)
            {
                FBTest.progress("issue2558; Halted on debugger keyword.");
                var watchPanel = FW.FirebugContext.getPanel("watches", true);
                FBTest.ok(watchPanel, "The watch panel must be there");

                // 4) Create new watch expression 'arguments'.
                watchPanel.addWatch("arguments");

                //xxxHonza: sometimes the element is there synchronously
                // sometimes asynchronously. This must be solved e.g. by
                // MutationRecognizer?
                setTimeout(function()
                {
                    // 5) Check evaluated expression.
                    var watchEntry = watchPanel.panelNode.getElementsByClassName(
                        "memberRow watchRow hasChildren").item(0);
                    FBTest.ok(watchEntry, "There must be an expandable watch entry");

                    // Resume debugger, test done.
                    FBTestFirebug.clickContinueButton();
                    FBTestFirebug.testDone("issue2558; DONE");
                }, 300);
            });

            // 3) Execute test on the page (use async to have clean callstack).
            setTimeout(function() {
                FBTest.click(win.document.getElementById("testButton"));
            }, 10);
        });
    });
}

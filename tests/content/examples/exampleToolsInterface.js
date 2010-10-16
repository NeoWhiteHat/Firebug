function runTest()
{
    FBTest.sysout("exampleToolsInterface.START");

    // 1) Load test case page
    FBTest.openNewTab(basePath + "examples/exampleToolsInterface.html", function(win)
    {
        // 2) Open Firebug and enable the Script panel.
        FBTest.openFirebug();
        FBTest.enableScriptPanel(function(win)
        {
            // 3) Select the Script panel
            var panel = FW.FirebugChrome.selectPanel("script");


            var browser = new FW.Browser();
            FBTest.ok(browser, "We created a browser");

            FBTest.sysout("Browser ", browser);

            // Asynchronously wait for break in debugger.
            var chrome = FW.Firebug.chrome;
            FBTest.waitForBreakInDebugger(chrome, 21, false, function(row)
            {
                // TODO: test code, verify UI, etc.

                // Resume debugger.
                FBTest.clickContinueButton();

                // 5) Finish test.
                FBTest.testDone("exampleToolsInterface.DONE");
            });

            // 4) Execute test by clicking on the 'Execute Test' button.
            FBTest.click(win.document.getElementById("testButton"));
        });
    });
}

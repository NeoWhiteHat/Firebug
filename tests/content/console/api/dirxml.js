function runTest()
{
    FBTest.sysout("console.dirxml.START");
    FBTest.openNewTab(basePath + "console/api/dirxml.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.enableConsolePanel(function(win)
        {
            var config = {tagName: "div", classes: "logRow logRow-dirxml"};
            FBTest.waitForDisplayedElement("console", config, function(row)
            {
                var xml = "<div id=\"content\" style=\"display: none;\"><span>a</span><span><span>b</span></span></div>";
                FBTest.compare(xml, row.textContent, "XML must be properly displayed.");
                FBTest.testDone("console.dirxml.DONE");
            });

            // Execute test implemented on the test page.
            FBTest.click(win.document.getElementById("testButton"));
        });
    });
}

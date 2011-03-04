function runTest()
{
    FBTest.sysout("console.time.START");
    FBTest.openNewTab(basePath + "console/api/time.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.enableConsolePanel(function(win)
        {
            var config = {tagName: "div", classes: "logRow logRow-info"};
            FBTest.waitForDisplayedElement("console", config, function(row)
            {
                var reTextContent = /a:\s*(\d+)ms\s*time\.html\s*\(line 32\)/;
                var m = row.textContent.match(reTextContent);
                FBTest.ok(m.length == 2, "Logged textContent must be something like 'a: 1000ms time.html (line 32)'");

                var elapsed = m[1];
                FBTest.ok(elapsed > 0 && elapsed < 2000, "The elapsed time should be within this range.");

                FBTest.testDone("console.time.DONE");
            });

            // Execute test implemented on the test page.
            FBTest.click(win.document.getElementById("testButton"));
        });
    });
}

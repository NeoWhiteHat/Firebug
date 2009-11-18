function runTest()
{
    FBTest.sysout("issue2285.START");

    var prefOrigValue = FBTestFirebug.getPref("showXMLHttpRequests");
    FBTestFirebug.setPref("showXMLHttpRequests", true);

    FBTestFirebug.openNewTab(basePath + "console/spy/2285/issue2285.html", function(win)
    {
        FBTestFirebug.enableConsolePanel(function()
        {
            var panel = FW.FirebugChrome.selectPanel("console");

            // Run test implemented on the page.
            win.wrappedJSObject.onMultipart(function(request)
            {
                // Expand XHR log in the Console panel.
                var rows = FW.FBL.getElementsByClass(panel.panelNode,
                    "logRow", "logRow-spy", "loaded");

                FBTest.compare(1, rows.length, "There must be just on XHR.");

                if (rows.length > 0)
                {
                    var logRow = rows[0];
                    var clickTarget = FW.FBL.getElementByClass(logRow, "spyTitleCol", "spyCol");
                    FBTest.click(clickTarget);
                    FBTestFirebug.expandElements(clickTarget, "netInfoResponseTab");

                    var responseBody = FW.FBL.getElementByClass(logRow, "netInfoResponseText", "netInfoText");
                    FBTest.ok(responseBody, "Response tab must exist in");
                    if (responseBody)
                    {
                        // If the activity-observer is available the response is correct.
                        // Otherwise only the first part of the multipart XHR is displayed.
                        var response = Ci.nsIHttpActivityObserver ? "Part0-Part1-Part2-Part3-" : "Part0-";
                        FBTest.compare(response, responseBody.textContent, "Response text must match."); 
                    }
                }

                // Finish test
                FBTestFirebug.setPref("showXMLHttpRequests", prefOrigValue);
                FBTestFirebug.testDone("issue2285.DONE");
            });
        });
    });
}

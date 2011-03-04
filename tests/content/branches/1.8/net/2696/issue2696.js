// Test entry point.
function runTest()
{
    FBTest.sysout("issue2696.START");

    // Disable XHR spy for this test.
    FBTestFirebug.setPref("showXMLHttpRequests", false);

    // 1) Load test case page
    FBTestFirebug.openNewTab(basePath + "net/2696/issue2696.html", function(win)
    {
        // 2) Open Firebug and enable the Net panel.
        FBTestFirebug.openFirebug();
        FBTestFirebug.enableNetPanel(function(win)
        {
            // 3) Select Net panel
            var panel = FW.FirebugChrome.selectPanel("net");

            // Asynchronously wait for the request beeing displayed.
            onRequestDisplayed(function(netRow)
            {
                var panel = FW.FirebugChrome.selectPanel("net");
                var netRow = FW.FBL.getElementByClass(panel.panelNode, "netRow", "category-xhr",
                    "hasHeaders", "loaded");

                FBTest.ok(netRow, "There must be just one xhr request.");
                if (!netRow)
                    return FBTestFirebug.testDone();

                FBTest.click(netRow);

                // 5) Expand the test request entry
                var netInfoRow = netRow.nextSibling;
                FBTestFirebug.expandElements(netInfoRow, "netInfoResponseTab");

                var responseBody = FW.FBL.getElementByClass(panel.panelNode, "netInfoResponseText", 
                    "netInfoText");

                // 6) Verify response
                FBTest.ok(responseBody, "Response tab must exist");
                if (responseBody)
                    FBTest.compare("Test response for 2696.",
                        responseBody.textContent, "Test response must match.");

                // 7) Finish test
                FBTestFirebug.testDone("issue2696.DONE");
            });

            // 4) Execute test by clicking on the 'Execute Test' button.
            FBTest.click(win.document.getElementById("testButton"));
        });
    });
}

function onRequestDisplayed(callback)
{
    // Create listener for mutation events.
    var doc = FBTestFirebug.getPanelDocument();
    var recognizer = new MutationRecognizer(doc.defaultView, "tr",
        {"class": "netRow category-xhr loaded"});

    // Wait for a XHR log to appear in the Net panel.
    recognizer.onRecognizeAsync(callback);
}

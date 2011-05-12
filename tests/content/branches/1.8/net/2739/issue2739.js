// Test entry point.
function runTest()
{
    FBTest.sysout("issue2739.START");

    // Disable XHR spy for this test.
    FBTestFirebug.setPref("showXMLHttpRequests", false);

    // Load test case page
    FBTestFirebug.openNewTab(basePath + "net/2739/issue2739.html", function(win)
    {
        // Open Firebug and enable the Net panel.
        FBTestFirebug.openFirebug();
        FBTestFirebug.enableNetPanel(function(win)
        {
            var panel = FW.Firebug.chrome.selectPanel("net");

            // Asynchronously wait for two requests beeing displayed.
            waitForResponse(panel);

            // Execute test.
            FBTest.click(win.document.getElementById("testButton"));
        });
    });
}

function waitForResponse(panel)
{
    // The mutation-recognizer callback can be fired more time for the same
    // netRow (as its attributes are changing).
    onRequestDisplayed(function(netRow)
    {
        var netRows = panel.panelNode.getElementsByClassName(
            "netRow category-xhr hasHeaders loaded");

        if (netRows.length == 2)
        {
            onVerifyResponses();
            return;
        }

        // Wait for the other request to be displayed.
        waitForResponse(panel);
    });
}

// Called as soon as both XHR requests are displayed in the Net panel.
function onVerifyResponses()
{
    verifyResponses();
    FBTestFirebug.testDone("issue2696.DONE");
}

function verifyResponses(netRow)
{
    var panel = FW.Firebug.chrome.selectPanel("net");

    FBTestFirebug.expandElements(panel.panelNode, "category-xhr");
    FBTestFirebug.expandElements(panel.panelNode, "netInfoResponseTab");

    var responses = panel.panelNode.getElementsByClassName("netInfoResponseText");
    if (!FBTest.compare(2, responses.length, "There must be two xhr responses."))
        return;

    FBTest.compare("Response for test 2739:start", responses[0].textContent, "Test response #1 must match.");
    FBTest.compare("Response for test 2739:link", responses[1].textContent, "Test response #2 must match.");
}

function onRequestDisplayed(callback)
{
    // Create listener for mutation events.
    var doc = FBTestFirebug.getPanelDocument();
    var recognizer = new MutationRecognizer(doc.defaultView, "tr",
        {"class": "netRow category-xhr hasHeaders loaded"});

    // Wait for a XHR log to appear in the Net panel.
    recognizer.onRecognizeAsync(callback);
}

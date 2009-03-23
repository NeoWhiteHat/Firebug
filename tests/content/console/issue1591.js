/*
 * issue1591.js
 * test for http://code.google.com/p/fbug/issues/detail?id=1591
 * Author: Rob Campbell, Mozilla Corp., Mar 20, 2009
 */

function isEmpty(obj) {
    if (obj)
        return obj.length == 0;
    return true;
}

function testCommandLineForError()
{
    var panel = FW.FirebugChrome.selectPanel("console");
    // FBTest.progress("looking up command line in " + panel);
    
    var clickTarget = FW.document.getElementById("fbCommandLine");

    // FBTest.progress("command line: " + clickTarget);
    FBTest.focus(clickTarget);
    
    // gather rows from panel
    var rows = FW.FBL.getElementsByClass(panel.panelNode,
        "logRow", "logRow-error");
    FBTest.ok(isEmpty(rows), "Checking for Errors");
    // Finish test
    FBTestFirebug.testDone("issue1591.DONE");
}

// Test entry point.
function runTest()
{
    FBTestFirebug.openNewTab(basePath + "console/issue1591.html", function(win)
    {
        if (!FBTestFirebug.isFirebugOpen())
            FBTestFirebug.openFirebug();
        FBTestFirebug.enableConsolePanel(testCommandLineForError());
    });
}



function openOpenCloseClose()
{
    var openOpenCloseCloseURL = FBTest.getHTTPURLBase()+"firebug/OpenFirebugOnThisPage.html";

    FBTestFirebug.openNewTab(openOpenCloseCloseURL, function openFirebug(win)
    {
        FBTest.progress("opened tab for "+win.location);

        var placement = FBTest.FirebugWindow.Firebug.getPlacement();
        FBTest.compare("none", placement, "Firebug starts placed nowhere");

        FBTest.progress("Press the toggle Firebug");
        FBTest.Firebug.pressToggleFirebug();

        var placement = FBTest.FirebugWindow.Firebug.getPlacement();
        FBTest.compare("inBrowser", placement, "Firebug now open inBrowser");

        if (FBTest.FirebugWindow.FirebugContext)
        {
            var contextName = FBTest.FirebugWindow.FirebugContext.getName();
            FBTest.ok(true, "chromeWindow.FirebugContext "+contextName);
            FBTest.ok(contextName == openOpenCloseCloseURL, "FirebugContext set to "+openOpenCloseCloseURL);
        }
        else
            FBTest.ok(false, "no FirebugContext");

        FBTest.progress("Press the toggle Firebug");
        FBTest.Firebug.pressToggleFirebug();

        var placement = FBTest.FirebugWindow.Firebug.getPlacement();
        FBTest.compare("minimized", placement, "Firebug minimizes");

        FBTest.progress("Press the toggle Firebug");
        FBTest.Firebug.pressToggleFirebug();

        placement = FBTest.FirebugWindow.Firebug.getPlacement();
        FBTest.compare("inBrowser", placement, "Firebug reopens inBrowser");

        FBTest.progress("Close Firebug");
        FBTest.Firebug.closeFirebug();

        var placement = FBTest.FirebugWindow.Firebug.getPlacement();
        FBTest.compare("none", placement, "Firebug closed");

        FBTestFirebug.testDone("openOpenCloseClose.DONE");
    });
}



//------------------------------------------------------------------------
// Auto-run test

function runTest()
{
    FBTest.sysout("Activation.started");
    FBTest.sysout("activation.js FBTest", FBTest);

    if (FBTest.FirebugWindow)
        FBTest.ok(true, "We have the Firebug Window: "+FBTest.FirebugWindow.location);
    else
        FBTest.ok(false, "No Firebug Window");

    // Auto run sequence
    openOpenCloseClose();
}



function allOpenAllClose()
{
    FBTest.progress("All Close");
    FW.Firebug.Activation.toggleAll("off");

    window.allOpenAllCloseURL = FBTest.getHTTPURLBase()+"firebug/OpenFirebugOnThisPage.html";

    FBTestFirebug.openNewTab(allOpenAllCloseURL, function openFirebug(win)
    {
        FBTest.progress("opened tab for "+win.location);

        var open = FW.Firebug.chrome.isOpen();
        FBTest.ok(!open, "Firebug starts closed");

        FBTest.progress("All Open");
        FW.Firebug.Activation.toggleAll("on");

        allOpened();  // allow UI to come up then check it
    });
}

function allOpened()
{
    var placement = FW.Firebug.getPlacement();
    FBTest.compare("inBrowser", placement, "Firebug now open in browser");

    if (FBTest.FirebugWindow.FirebugContext)
    {
        var contextName = FBTest.FirebugWindow.FirebugContext.getName();
        FBTest.ok(true, "chromeWindow.FirebugContext "+contextName);
        FBTest.ok(contextName == allOpenAllCloseURL, "FirebugContext set to "+allOpenAllCloseURL);
    }
    else
        FBTest.ok(false, "no FirebugContext");

    FBTestFirebug.openNewTab(basePath + "firebug/AlsoOpenFirebugOnThisPage.html", alsoOpened);
}

function alsoOpened(win)
{
    FBTest.progress("Opened "+win.location);

    var placement = FW.Firebug.getPlacement();
    FBTest.compare("inBrowser", placement, "Firebug opened because of all open");

    FBTest.Firebug.pressToggleFirebug();  // toggle to minimize

    var placement = FW.Firebug.getPlacement();
    FBTest.compare("minimized", placement, "Firebug minimized");

    var statusbarIcon = FW.document.getElementById('fbStatusIcon');

    var toolTip = statusbarIcon.getAttribute("tooltiptext");
    var number = /^(\d).*Firebugs/.exec(toolTip);
    if (number)
        FBTest.compare("2", number[1], "Should be 2 Firebugs now");

    FW.Firebug.Activation.toggleAll("off");

    var open = FW.Firebug.chrome.isOpen();
    FBTest.ok(!open, "Firebug closed by all off");

    var toolTip = statusbarIcon.getAttribute("tooltiptext");
    var number = /^(\d).*Firebugs/.exec(toolTip);
    FBTest.ok(!number, "Should be no Firebugs now");

    FW.Firebug.Activation.toggleAll("none");

    var toolTip = statusbarIcon.getAttribute("tooltiptext");
    var expectedText = "all pages";
    var all = (new RegExp(expectedText)).exec(toolTip);
    FBTest.compare(expectedText, all, "Should be All pages info");

    FBTestFirebug.testDone("allOpenAllClose.DONE");
}

//------------------------------------------------------------------------
// Auto-run test

function runTest()
{
    FBTest.sysout("allOpenAllClose.started");

    if (FBTest.FirebugWindow)
        FBTest.ok(true, "We have the Firebug Window: "+FBTest.FirebugWindow.location);
    else
        FBTest.ok(false, "No Firebug Window");

    // Auto run sequence
    allOpenAllClose();
}

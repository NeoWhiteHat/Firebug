/* See license.txt for terms of usage */

// ************************************************************************************************
// Test Console Overlay Implementation

/**
 * This overlay is intended to append a new menu-item into the Firebug's icon menu.
 * This menu is used to open the Test Console (test runner window).
 */
var FBTestFirebugOverlay = {};

(function() {

var Cc = Components.classes;
var Ci = Components.interfaces;

var cmdLineHandler = Cc["@mozilla.org/commandlinehandler/general-startup;1?type=FBTest"].getService(Ci.nsICommandLineHandler);

this.initialize = function()
{
    window.removeEventListener("load", FBTestFirebugOverlay.initialize, false);

    // abandon ship if we are loaded by chromebug
    var winURL = window.location.toString();
    if (winURL == "chrome://chromebug/content/chromebug.xul")
        return;

    // Open console if the command line says so of if the pref says so.
    var cmd = cmdLineHandler.wrappedJSObject;
    if (cmd.runFBTests)
        FBTestFirebugOverlay.open(cmd.testListURI);
    else if (Firebug.getPref(Firebug.prefDomain, "alwaysOpenTestConsole"))
        FBTestFirebugOverlay.open();
};

this.open = function(testListURI)
{
    var consoleWindow = null;
    FBL.iterateBrowserWindows("FBTestConsole", function(win) {
        consoleWindow = win;
        return true;
    });

    var args = {
        firebugWindow: window,
        testListURI: testListURI
    };

    // Try to connect an existing trace-console window first.
    if (consoleWindow)
    {
        if ("initWithParams" in consoleWindow)
            consoleWindow.initWithParams(args);
        consoleWindow.focus();
        return;
    }

    consoleWindow = window.openDialog(
        "chrome://fbtest/content/testConsole.xul",
        "FBTestConsole",
        "chrome,resizable,scrollbars=auto,minimizable,dialog=no",
        args);

    if (FBTrace.DBG_FBTEST)
        FBTrace.sysout("fbtest.TestConsoleOverlay.open on FirebugWindow: " +
            window.location);
};

this.onSelectionChanged = function()
{
    try
    {
        FBL.iterateBrowserWindows("FBTestConsole", function(win)
        {
            if (win.FBTestApp)
                win.FBTestApp.SelectionController.selectionChanged();
            return true;
        });
    }
    catch (err)
    {
        if (FBTrace.DBG_FBTEST || FBTrace.DBG_ERRORS)
            FBTrace.sysout("fbtest.FBTestFirebugOverlay; onSelectionChanged", err);
    }
};

// Register load listener for command line arguments handling.
window.addEventListener("load", FBTestFirebugOverlay.initialize, false);

}).apply(FBTestFirebugOverlay);

// ************************************************************************************************

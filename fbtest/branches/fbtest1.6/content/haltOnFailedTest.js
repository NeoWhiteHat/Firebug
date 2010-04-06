/* See license.txt for terms of usage */

FBTestApp.ns(function() { with (FBL) {

// ************************************************************************************************
// Halt On Failed Test Implementation

var Cc = Components.classes;
var Ci = Components.interfaces;

// Services
var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

// ************************************************************************************************

// Helper shortcut.
var HaltOnFailedTest = FBTestApp.TestWindowLoader.HaltOnFailedTest

FBTestApp.TestWindowLoader.HaltOnFailedTest =
{
    initialize: function()
    {
        // Localize strings in XUL (using string bundle).
        this.internationalizeUI();

        HaltOnFailedTest.enabled = Firebug.getPref(FBTestApp.prefDomain, "haltOnFailedTest");
        this.setHaltOnFailedTestButton();
    },

    internationalizeUI: function()
    {
        var buttons = ["haltOnFailedTest"];

        for (var i=0; i<buttons.length; i++)
        {
            var element = $(buttons[i]);
            FBL.internationalize(element, "label");
            FBL.internationalize(element, "tooltiptext");
            FBL.internationalize(element, "pickerTooltiptext");
            FBL.internationalize(element, "barTooltiptext");
        }
    },

    setHaltOnFailedTestButton: function()
    {
        $('haltOnFailedTest').setAttribute('checked', HaltOnFailedTest.enabled?'true':'false');
    },

    onToggleHaltOnFailedTest: function()
    {
        HaltOnFailedTest.enabled = !HaltOnFailedTest.enabled;
        Firebug.setPref(FBTestApp.prefDomain, "haltOnFailedTest", HaltOnFailedTest.enabled);
        HaltOnFailedTest.setHaltOnFailedTestButton();
    },

    onFailure: function()
    {
        if (!HaltOnFailedTest.enabled)
            return;

        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("FBTestApp.TestWindowLoader.HaltOnFailedTest.onFailure ");
        FBTestApp.TestRunner.clearTestTimeout();
        Firebug.Debugger.halt(function breakOnFailure(frame)
        {
            var dropFrames = 7;

            if (FBTrace.DBG_FBTEST)
                FBTrace.sysout("FBTestApp.TestWindowLoader.HaltOnFailedTest.onFailure.breakOnFailure dropping "+dropFrames, frame);

            for (var i = 0; frame && frame.isValid && i < dropFrames; i++)
                frame = frame.callingFrame;

            Firebug.Debugger.breakAsIfDebugger(frame);
        });
    },

    /* nsIObserve */
    observe: function(subject, topic, data)
    {
        try
        {
            if (topic == "fbtest")
            {
                if (data === "shutdown")
                    observerService.removeObserver(HaltOnFailedTest, "fbtest");

                if (data in HaltOnFailedTest)
                    HaltOnFailedTest[data]();
                else
                    FBTrace.sysout("FBTestApp.TestWindowLoader.HaltOnFailedTest no method for "+data);
            }
        }
        catch (e)
        {
            dump("FBTestApp.TestWindowLoader.observe; EXCEPTION " + e, e);
        }
    },
};

// ************************************************************************************************
// Registration

/**
 * Listen to events fired by {@link FBTestApp.TestConsole}.
 */
observerService.addObserver(FBTestApp.TestWindowLoader.HaltOnFailedTest, "fbtest", false);

// ************************************************************************************************
}});

/**
 * 1) Open two new tabs and firebug on it with Net panel selected.
 * 2) Disable and Enable net panel.
 * 3) Perform net request on the first tab and check net panel content.
 * 4) Perform net request on the second tab and check net panel content.
 */

var tab1 = null;
var tab2 = null;

function runTest()
{
    FBTest.sysout("activation.START");

    // Open two tabs one after another, open Firebug on both and select Net panel.
    tab1 = FBTestFirebug.openNewTab(basePath + "net/activation/activation1.html", function() {
        FBTestFirebug.openFirebug();
        FW.FirebugChrome.selectPanel("net");
        tab2 = FBTestFirebug.openNewTab(basePath + "net/activation/activation2.html", function() {
            FBTestFirebug.openFirebug();
            FW.FirebugChrome.selectPanel("net");
            onRunTest();
        });
    });
}

function onRunTest(window)
{
    // Disable and enable
    FBTestFirebug.disableNetPanel();
    FBTestFirebug.enableNetPanel();

    // Select first tab, execute XHR and verify. Once it's done do the same for the other tab. 
    selectTabAndVerify(tab1, function() {
        selectTabAndVerify(tab2, function() {
            FBTestFirebug.testDone("activation.DONE");
        });
    });
}

function selectTabAndVerify(tab, callback)
{
    var tabbrowser = FW.getBrowser();
    tabbrowser.selectedTab = tab;

    var win = tab.linkedBrowser.contentWindow;
    win.wrappedJSObject.runTest(function(request)
    {
        var panel = FW.FirebugChrome.selectPanel("net");
        var netRow = FW.FBL.getElementByClass(panel.panelNode, "netRow", "category-xhr", "hasHeaders", "loaded");
        FBTest.ok(netRow, "There must be one xhr request.");
        callback();
    });
}

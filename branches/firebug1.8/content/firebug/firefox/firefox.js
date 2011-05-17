/* See license.txt for terms of usage */

define([
],
function()
{
    // Constants

    var Ci = Components.interfaces;
    var Cc = Components.classes;
    var Cu = Components.utils;
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
// ---- Browser.xul dependent code ----------
function getBrowserDocument()
{
    return top.document;
}

// ---- Browser.xul independent code ----------
var Firefox =
{
    getElementById: function(id)
    {
        return getBrowserDocument().getElementById(id);
    },
    getTabBrowser: function()
    {
        var tabBrowser = Firefox.getElementById("content");
        return tabBrowser;
    },
    getCurrentBrowser: function()
    {
        return Firefox.getTabBrowser().selectedBrowser;
    },
    getBrowsers: function()
    {
        return Firefox.getTabBrowser().browsers;
    },
    selectTabByWindow: function(win)
    {
        var tabBrowser = Firefox.getTabBrowser();
        var tab = tabBrowser.getBrowserForDocument(win.document);
        tabBrowser.selectedBrowser = tab;
    },

    getCurrentURI: function()
    {
        try
        {
            return Firefox.getTabBrowser().currentURI;
        }
        catch (exc)
        {
            return null;
        }
    },
    /**
     * Returns <browser> element for specified content window.
     * @param {Object} win - Content window
     */
    getBrowserForWindow: function(win)
    {
        var tabBrowser = Firefox.getTabBrowser();
        if (tabBrowser && win.document)
            return tabBrowser.getBrowserForDocument(win.document);
    },

    openWindow: function(windowType, url, features, params)
    {
        var win = windowType ? wm.getMostRecentWindow(windowType) : null;
        if (win)
        {
            if ("initWithParams" in win)
                win.initWithParams(params);
            win.focus();
        }
        else
        {
            var winFeatures = "resizable,dialog=no,centerscreen" + (features != "" ? ("," + features) : "");
            var parentWindow = (this.instantApply || !window.opener || window.opener.closed) ? window : window.opener;
            win = parentWindow.openDialog(url, "_blank", winFeatures, params);
        }
        return win;
    },

    viewSource: function(url, lineNo)
    {
        window.openDialog("chrome://global/content/viewSource.xul", "_blank",
            "all,dialog=no", url, null, null, lineNo);
    },
};

//************************************************************************************************

//XXXjoe This horrible hack works around a focus bug in Firefox which is caused when
//the HTML Validator extension and Firebug are installed.  It causes the keyboard to
//behave erratically when typing, and the only solution I've found is to delay
//the initialization of HTML Validator by overriding this function with a timeout.
//XXXrobc Do we still need this? Does this extension even exist anymore?
if (top.hasOwnProperty('TidyBrowser'))
{
 var prev = TidyBrowser.prototype.updateStatusBar;
 TidyBrowser.prototype.updateStatusBar = function()
 {
     var self = this, args = arguments;
     setTimeout(function()
     {
         prev.apply(self, args);
     });
 }
}

return Firefox;
});

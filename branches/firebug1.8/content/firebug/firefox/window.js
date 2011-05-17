/* See license.txt for terms of usage */

define([
    "firebug/lib/trace",
    "firebug/http/httpLib",
    "firebug/firefox/firefox",
],
function(FBTrace, HTTP, Firefox) {

// ********************************************************************************************* //
// Constants

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

var WIN = {};

var window = {};     // these declarations exist to cause errors if we accidently
var document = {};   // reference these globals

// ********************************************************************************************* //
// Crossbrowser API

WIN.getWindowProxyIdForWindow = function(win)
{
    var id = WIN.getWindowId(win).outerWindowID;

    // xxxJJB, xxxHonza: the id is often null, what could be the problem?
    // jjb: My guess: just another Mozilla bug
    if (!id)
        return WIN.getTabIdForWindow(win);

    return id;
},

WIN.getTabForWindow = function(aWindow)
{
    aWindow = WIN.getRootWindow(aWindow);

    var tabBrowser = Firefox.getTabBrowser();
    if (!aWindow || !tabBrowser || !tabBrowser.getBrowserIndexForDocument)
    {
        FBTrace.sysout("ERROR no tabBrowser");
        return null;
    }

    try
    {
        var targetDoc = aWindow.document;

        var tab = null;
        var targetBrowserIndex = tabBrowser.getBrowserIndexForDocument(targetDoc);
        if (targetBrowserIndex != -1)
        {
            tab = tabBrowser.tabContainer.childNodes[targetBrowserIndex];
            return tab;
        }
    }
    catch (ex)
    {
    }

    return null;
},

WIN.getTabIdForWindow = function(win)
{
    var tab = WIN.getTabForWindow(win);
    return tab ? tab.linkedPanel : null;
},

// ********************************************************************************************* //
// Window iteration

WIN.iterateWindows = function(win, handler)
{
    if (!win || !win.document)
        return;

    handler(win);

    if (win == top || !win.frames)
        return; // XXXjjb hack for chromeBug

    for (var i = 0; i < win.frames.length; ++i)
    {
        var subWin = win.frames[i];
        if (subWin != win)
            WIN.iterateWindows(subWin, handler);
    }
};

WIN.getRootWindow = function(win)
{
    for (; win; win = win.parent)
    {
        if (!win.parent || win == win.parent || !(win.parent instanceof win.Window) )
            return win;
    }
    return null;
};

// ********************************************************************************************* //
// Firefox browsing

WIN.openNewTab = function(url, postText)
{
    if (!url)
        return;

    var postData = null;
    if (postText)
    {
        var stringStream = HTTP.getInputStreamFromString(postText);
        postData = Cc["@mozilla.org/network/mime-input-stream;1"].createInstance(Ci.nsIMIMEInputStream);
        postData.addHeader("Content-Type", "application/x-www-form-urlencoded");
        postData.addContentLength = true;
        postData.setData(stringStream);
    }

    var tabBrowser = Firefox.getTabBrowser();
    return tabBrowser.selectedTab = tabBrowser.addTab(url, null, null, postData);
};

// Iterate over all opened firefox windows of the given type. If the callback returns true
// the iteration is stopped.
WIN.iterateBrowserWindows = function(windowType, callback)
{
    var windowList = wm.getZOrderDOMWindowEnumerator(windowType, true);
    if (!windowList.hasMoreElements())
        windowList = wm.getEnumerator(windowType);

    while (windowList.hasMoreElements())
    {
        if (callback(windowList.getNext()))
            return true;
    }

    return false;
};

WIN.iterateBrowserTabs = function(browserWindow, callback)
{
    var tabBrowser = browserWindow.getBrowser();
    var numTabs = tabBrowser.browsers.length;

    for(var index=0; index<numTabs; index++)
    {
        var currentBrowser = tabBrowser.getBrowserAtIndex(index);
        if (callback(tabBrowser.mTabs[index], currentBrowser))
            return true;
    }

    return false;
}


WIN.getBrowserByWindow = function(win)
{
    var browsers = Firefox.getBrowsers();
    for (var i = 0; i < browsers.length; ++i)
    {
        var browser = browsers[i];
        if (browser.contentWindow === win)
            return browser;
    }

    return null;
}

// ********************************************************************************************* //

WIN.getWindowId = function(win)
{
    var util = win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    var innerWindowID = "(none)";

    try
    {
        var outerWindowID = util.outerWindowID;
        innerWindowID = util.currentInnerWindowID;
    }
    catch(exc)
    {
        // no - op
    }

    return {
        outer: outerWindowID,
        inner: innerWindowID,
        toString: function() {
            return this.outer+"."+this.inner;
        }
    };
};

WIN.safeGetWindowLocation = function(window)
{
    try
    {
        if (window)
        {
            if (window.closed)
                return "(window.closed)";
            if ("location" in window)
                return window.location+"";
            else
                return "(no window.location)";
        }
        else
            return "(no context.window)";
    }
    catch (exc)
    {
        if (FBTrace.DBG_WINDOWS || FBTrace.DBG_ERRORS)
        {
            FBTrace.sysout("TabContext.getWindowLocation failed "+exc, exc);
            FBTrace.sysout("TabContext.getWindowLocation failed window:", window);
        }

        return "(getWindowLocation: "+exc+")";
    }
};

// ********************************************************************************************* //

return WIN;

// ********************************************************************************************* //
});

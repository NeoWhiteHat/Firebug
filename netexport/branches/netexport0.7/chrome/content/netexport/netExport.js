/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

const Cc = Components.classes;
const Ci = Components.interfaces;

const dirService = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
const appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);

const harVersion = "1.1";

// ************************************************************************************************
// Module implementation

/**
 * This module implements an Export feature that allows to save all Net panel
 * data into a file using HTTP Archive format.
 * http://groups.google.com/group/firebug-working-group/web/http-tracing---export-format
 */
Firebug.NetMonitorSerializer = extend(Firebug.Module,
{
    initialize: function(owner)
    {
        Firebug.Module.initialize.apply(this, arguments);
    },

    shutdown: function()
    {
        Firebug.Module.shutdown.apply(this, arguments);
    },

    internationalizeUI: function(doc)
    {
        if (FBTrace.DBG_NETEXPORT)
            FBTrace.sysout("netexport.internationalizeUI");

        var elements = ["netExport", "netExportCompress"];
        for (var i=0; i<elements.length; i++)
        {
            var element = $(elements[i], doc);
            FBL.internationalize(element, "label");
            FBL.internationalize(element, "tooltiptext");
            FBL.internationalize(element, "buttontooltiptext");
        }
    },

    // Handle Export toolbar button.
    exportData: function(context)
    {
        if (!context)
            return;

        if (FBTrace.DBG_NETEXPORT)
            FBTrace.sysout("netexport.Exporting data for: " + context.getName());

        var panel = context.getPanel("net");

        // Build entries.
        var numberOfRequests = 0;
        panel.enumerateRequests(function(file) {
            if (file.loaded)
                numberOfRequests++;
        })

        if (numberOfRequests > 0)
        {
            // Get target file for exported data. Bail out, if the user presses cancel.
            var file = this.getTargetFile();
            if (!file)
                return;
        }

        // Build JSON result string. If the panel is empty a dialog with warning message
        // automatically appears.
        var jsonString = this.buildData(context);
        if (!jsonString)
            return;

        if (!this.saveToFile(file, jsonString, context))
            return;

        var viewerURL = Firebug.getPref(Firebug.prefDomain, "netexport.viewerURL");
        if (viewerURL)
            this.ViewerOpener.openViewer(viewerURL, jsonString);
    },

    // Handle Import toolbar button.
    importData: function(context)
    {
        alert("TBD");
    },

    // Open File Save As dialog and let the user to pick proper file location.
    getTargetFile: function()
    {
        var nsIFilePicker = Ci.nsIFilePicker;
        var fp = Cc["@mozilla.org/filepicker;1"].getService(nsIFilePicker);
        fp.init(window, null, nsIFilePicker.modeSave);
        fp.appendFilter("HTTP Archive Files","*.har; *.json");
        fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);
        fp.filterIndex = 1;
        fp.defaultString = "netData.har";

        var rv = fp.show();
        if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace)
            return fp.file;

        return null;
    },

    // Build JSON string from the Net panel data.
    buildData: function(context)
    {
        var jsonString = "";

        try
        {
            // Export all data into a JSON string.
            var builder = new JSONBuilder();
            var jsonData = builder.build(context);
            if (FBTrace.DBG_NETEXPORT)
                FBTrace.sysout("netexport.buildData; entries: " + jsonData.log.entries.length,
                    jsonData);

            if (!jsonData.log.entries.length)
            {
                alert($STR("netexport.message.Nothing to export"));
                return null;
            }

            jsonString = JSON.stringify(jsonData, null, '  ');
        }
        catch (err)
        {
            if (FBTrace.DBG_NETEXPORT || FBTrace.DBG_ERRORS)
                FBTrace.sysout("netexport.exportData EXCEPTION", err);
        }

        if (FBTrace.DBG_NETEXPORT)
            FBTrace.sysout("netexport.data", jsonData);

        return jsonString;
    },

    // Save JSON string into a file.
    saveToFile: function(file, jsonString, context)
    {
        try
        {
            var foStream = Cc["@mozilla.org/network/file-output-stream;1"]
                .createInstance(Ci.nsIFileOutputStream);
            foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0); // write, create, truncate

            var doc = context.window.document;
            var convertor = Cc["@mozilla.org/intl/converter-output-stream;1"]
                .createInstance(Ci.nsIConverterOutputStream);

            // Write JSON data.
            convertor.init(foStream, "UTF-8", 0, 0);
            convertor.writeString(jsonString);
            convertor.close(); // this closes foStream

            return true;
        }
        catch (err)
        {
            alert(err.toString());
        }

        return false;
    },

    onToggleOption: function(event, menuitem)
    {
        FirebugChrome.onToggleOption(menuitem);

        // Don't bubble up so, the main command (executed when the menu-button
        // iself is pressed) is not fired.
        cancelEvent(event);
    }
});

// ************************************************************************************************
// Export Net panel data as JSON.

function JSONBuilder()
{
    this.pageMap = [];
}

JSONBuilder.prototype =
{
    build: function(context)
    {
        this.context = context;

        var panel = context.getPanel("net");

        // Build basic structure for data.
        var log = this.buildLog();

        // Build entries.
        var self = this;
        panel.enumerateRequests(function(file) {
            if (file.loaded)
                log.entries.push(self.buildEntry(log, file));
        })

        return {log:log};
    },

    buildLog: function()
    {
        var log = {};
        log.version = harVersion;
        log.creator = {name: "Firebug", version: Firebug.version};
        log.browser = {name: appInfo.name, version: appInfo.version};
        log.pages = [];
        log.entries = [];
        return log;
    },

    buildPage: function(file)
    {
        var page = {};

        // Page start time is set when the first request is processed (see buildEntry)
        page.startedDateTime = 0;

        // Page title and ID comes from a document object that is shared by
        // all requests executed by the same page (since Firebug 1.5b1).
        var pageId = file.document.id;
        var title = file.document.title;

        page.id = "page_" + (pageId ? pageId : "0");
        page.title = title ? title : this.context.getTitle();
        return page;
    },

    getPage: function(log, file)
    {
        var page = this.pageMap[file.document.id];
        if (page)
            return page;

        this.pageMap[file.document.id] = page = this.buildPage(file);
        log.pages.push(page); 

        return page;
    },

    buildEntry: function(log, file)
    {
        var page = this.getPage(log, file);

        var entry = {};
        entry.pageref = page.id;
        entry.startedDateTime = dateToJSON(new Date(file.startTime));
        entry.time = file.endTime - file.startTime;
        entry.request = this.buildRequest(file);
        entry.response = this.buildResponse(file);
        entry.cache = this.buildCache(file);
        entry.timings = this.buildTimings(file);

        // Compute page load start time according to the first request start time.
        if (!page.startedDateTime)
            page.startedDateTime = entry.startedDateTime;

        // Put page timings into the page object now when we have the first entry.
        if (!page.pageTimings)
            page.pageTimings = this.buildPageTimings(file);

        return entry;
    },

    buildPageTimings: function(file)
    {
        var timings = {};
        timings.onContentLoad = file.phase.contentLoadTime - file.startTime;
        timings.onLoad = file.phase.windowLoadTime - file.startTime;
        return timings;
    },

    buildRequest: function(file)
    {
        var request = {};

        request.method = file.method;
        request.url = file.request.URI.spec;
        request.httpVersion = this.getHttpVersion(file.request, true);

        request.cookies = this.buildRequestCookies(file);
        request.headers = this.buildHeaders(file.requestHeaders);

        request.queryString = file.urlParams;
        request.postData = this.buildPostData(file);

        request.headersSize = -1; //xxxHonza: waiting for the activityObserver.
        request.bodySize = file.postText ? file.postText.length : -1;

        return request;
    },

    buildPostData: function(file)
    {
        if (!file.postText)
            return;

        var postData = {mimeType: ""};

        var text = file.postText;
        if (isURLEncodedFile(file, text))
        {
            var lines = text.split("\n");
            postData.mimeType = "application/x-www-form-urlencoded";
            postData.params = parseURLEncodedText(lines[lines.length-1]);
        }
        else
        {
            postData.text = text;
        }

        if (FBTrace.DBG_NETEXPORT)
            FBTrace.sysout("netexport.buildPostData; ", postData);

        return postData;
    },

    buildRequestCookies: function(file)
    {
        var header = findHeader(file.requestHeaders, "cookie");

        var result = [];
        var cookies = header ? header.split("; ") : [];
        for (var i=0; i<cookies.length; i++)
        {
            var option = cookies[i].split("=");
            var cookie = {};
            cookie.name = option[0];
            cookie.value = option[1];
            result.push(cookie);
        }

        return result;
    },

    buildResponseCookies: function(file)
    {
        var header = findHeader(file.responseHeaders, "set-cookie");

        var result = [];
        var cookies = header ? header.split("\n") : [];
        for (var i=0; i<cookies.length; i++)
        {
            var cookie = this.parseCookieFromResponse(cookies[i]);
            result.push(cookie);
        }

        return result;
    },

    parseCookieFromResponse: function(string)
    {
        var cookie = new Object();
        var pairs = string.split("; ");

        for (var i=0; i<pairs.length; i++)
        {
            var option = pairs[i].split("=");
            if (i == 0)
            {
                cookie.name = option[0];
                cookie.value = option[1];
            } 
            else
            {
                var name = option[0].toLowerCase();
                if (name == "httponly")
                {
                    cookie.httpOnly = true;
                }
                else if (name == "expires")
                {
                    var value = option[1];
                    value = value.replace(/-/g, " ");
                    cookie[name] = dateToJSON(new Date(value.replace(/-/g, " ")));
                }
                else
                {
                    cookie[name] = option[1];
                }
            }
        }
        
        return cookie;
    },

    buildHeaders: function(headers)
    {
        var result = [];
        for (var i=0; headers && i<headers.length; i++)
            result.push({name: headers[i].name, value: headers[i].value});
        return result;
    },

    buildResponse: function(file)
    {
        var response = {};

        response.status = file.responseStatus;
        response.statusText = file.responseStatusText;
        response.httpVersion = this.getHttpVersion(file.request, false);

        response.cookies = this.buildResponseCookies(file);
        response.headers = this.buildHeaders(file.responseHeaders);
        response.content = this.buildContent(file);

        response.redirectURL = findHeader(file.responseHeaders, "Location");

        response.headersSize = -1; //xxxHonza: waiting for the activityObserver.
        response.bodySize = file.size;

        return response;
    },

    buildContent: function(file)
    {
        var content = {};
        content.size = file.responseText ? file.responseText.length :
            (file.size >= 0 ? file.size : 0);

        try
        {
            content.mimeType = file.request.contentType;
        }
        catch (e)
        {
            if (FBTrace.DBG_NETEXPORT || FBTrace.DBG_ERRORS)
                FBTrace.sysout("netexport.buildContent EXCEPTION", e);
        }

        if (file.responseText)
            content.text = file.responseText;

        return content;
    },

    buildCache: function(file)
    {
        var cache = {};

        if (!file.fromCache)
            return cache;

        //cache.beforeRequest = {}; //xxxHonza: There is no such info yet in the Net panel.

        if (file.cacheEntry)
            cache.afterRequest = this.buildCacheEntry(file.cacheEntry);
        else
            cache.afterRequest = null;

        return cache;
    },

    buildCacheEntry: function(cacheEntry)
    {
        var cache = {};
        cache.expires = findHeader(cacheEntry, "Expires");
        cache.lastAccess = findHeader(cacheEntry, "Last Fetched");
        cache.eTag = ""; //xxxHonza
        cache.hitCount = findHeader(cacheEntry, "Fetch Count");
        return cache;
    },

    buildTimings: function(file)
    {
        var timings = {};
        timings.dns = file.resolvingTime - file.startTime;
        timings.connect = file.connectingTime - file.startTime;

        if (file.sendingTime != file.startTime)
            timings.send = file.sendingTime - file.startTime - timings.connect - timings.dns;
        else
            timings.send = 0;   //  Waiting for activity observer.
 
        timings.wait = file.respondedTime - file.waitingForTime;
        timings.receive = file.endTime - file.respondedTime;
        timings.blocked = file.waitingForTime - file.startTime - timings.connect - timings.dns - timings.send;

        return timings;
    },

    getHttpVersion: function(request, forRequest)
    {
        if (request instanceof Ci.nsIHttpChannelInternal)
        {
            try
            {
                var major = {}, minor = {};

                if (forRequest)
                    request.getRequestVersion(major, minor);
                else
                    request.getResponseVersion(major, minor);

                return "HTTP/" + major.value + "." + minor.value;
            }
            catch(err)
            {
                if (FBTrace.DBG_NETEXPORT || FBTrace.DBG_ERRORS)
                    FBTrace.sysout("netexport.getHttpVersion EXCEPTION", err);
            }
        }

        return "";
    },
}

// ************************************************************************************************
// Viewer Opener

Firebug.NetMonitorSerializer.ViewerOpener =
{
    // Open online viewer for immediate preview.
    openViewer: function(url, jsonString)
    {
        var self = this;
        var result = iterateBrowserWindows("navigator:browser", function(browserWin)
        {
            return iterateBrowserTabs(browserWin, function(tab, currBrowser)
            {
                var currentUrl = currBrowser.currentURI.spec;
                if (currentUrl.indexOf("/har/viewer") >= 0)
                {
                    var tabBrowser = browserWin.getBrowser();
                    tabBrowser.selectedTab = tab;
                    browserWin.focus();

                    var win = tabBrowser.contentWindow.wrappedJSObject;

                    // Fill out the inout JSON text box.
                    var sourceEditor = $("sourceEditor", win.document);
                    sourceEditor.value = jsonString;

                    // Click the Append Preview button.
                    self.click($("appendPreview", win.document));

                    if (FBTrace.DBG_NETEXPORT)
                        FBTrace.sysout("netExport.openViewer; Select an existing tab", tabBrowser);
                    return true;
                }
            })
        });

        // The viewer is not opened yet so, open a new tab.
        if (!result)
        {
            gBrowser.selectedTab = gBrowser.addTab(url);

            if (FBTrace.DBG_NETEXPORT)
                FBTrace.sysout("netExport.openViewer; Open HAR Viewer tab",
                    gBrowser.selectedTab.linkedBrowser);

            var self = this;
            var browser = gBrowser.selectedTab.linkedBrowser;
            function onContentLoad(event) {
                browser.removeEventListener("DOMContentLoaded", onContentLoad, true);
                self.onContentLoad(event, jsonString);
            }
            browser.addEventListener("DOMContentLoaded", onContentLoad, true);
        }
    },

    onContentLoad: function(event, jsonString)
    {
        var win = event.currentTarget;
        var content = $("content", win.contentDocument);
        if (FBTrace.DBG_NETEXPORT)
            FBTrace.sysout("netexport.DOMContentLoaded;", content);

        var self = this;
        function onViewerInit(event)
        {
            content.removeEventListener("onViewerInit", onViewerInit, true);

            var doc = content.ownerDocument;
            var win = doc.defaultView.wrappedJSObject;
            if (FBTrace.DBG_NETEXPORT)
                FBTrace.sysout("netexport.onViewerInit; HAR Viewer initialized", win);

            // Initialize input JSON box.
            $("sourceEditor", doc).value = jsonString;

            // Switch to the Preview tab by clicking on the preview button.
            self.click($("appendPreview", doc));
        }

        content.addEventListener("onViewerInit", onViewerInit, true);
    },

    click: function(button)
    {
        var doc = button.ownerDocument;
        var event = doc.createEvent("MouseEvents");
        event.initMouseEvent("click", true, true, doc.defaultView, 0, 0, 0, 0, 0,
            false, false, false, false, 0, null);
        button.dispatchEvent(event);
    }
}

// ************************************************************************************************
// Helpers

// xxxHonza: duplicated in net.js
function isURLEncodedFile(file, text)
{
    if (text && text.indexOf("Content-Type: application/x-www-form-urlencoded") != -1)
        return true;

    // The header value doesn't have to be alway exactly "application/x-www-form-urlencoded",
    // there can be even charset specified. So, use indexOf rather than just "==".
    var headerValue = findHeader(file.requestHeaders, "Content-Type");
    if (headerValue && headerValue.indexOf("application/x-www-form-urlencoded") == 0)
        return true;

    return false;
}

function findHeader(headers, name)
{
    name = name.toLowerCase();
    for (var i = 0; headers && i < headers.length; ++i)
    {
        if (headers[i].name.toLowerCase() == name)
            return headers[i].value;
    }

    return "";
}

function safeGetName(request)
{
    try
    {
        return request.name;
    }
    catch (exc) { }

    return null;
}

function dateToJSON(date)
{
    function f(n, c) {
        if (!c) c = 2;
        var s = new String(n);
        while (s.length < c) s = "0" + s;
        return s;
    }

    var result = date.getUTCFullYear() + '-' +
        f(date.getMonth() + 1) + '-' +
        f(date.getDate()) + 'T' +
        f(date.getHours()) + ':' +
        f(date.getMinutes()) + ':' +
        f(date.getSeconds()) + '.' +
        f(date.getMilliseconds(), 3);

    var offset = date.getTimezoneOffset();
    var offsetHours = Math.floor(offset / 60);
    var offsetMinutes = Math.floor(offset % 60);
    var prettyOffset = (offset > 0 ? "-" : "+") +
        f(Math.abs(offsetHours)) + ":" + f(Math.abs(offsetMinutes));

    return result + prettyOffset;
}

// ************************************************************************************************
// Registration

Firebug.registerStringBundle("chrome://netexport/locale/netExport.properties");
Firebug.registerModule(Firebug.NetMonitorSerializer);

// ************************************************************************************************
}});

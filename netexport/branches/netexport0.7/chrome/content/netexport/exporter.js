/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

const Cc = Components.classes;
const Ci = Components.interfaces;

const appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);

const harVersion = "1.1";

// ************************************************************************************************

Firebug.NetExport.Exporter =
{
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
            if (file.loaded && file.requestHeaders && file.responseHeaders)
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
            Firebug.NetExport.ViewerOpener.openViewer(viewerURL, jsonString);
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
            var builder = new Firebug.NetExport.HARBuilder();
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
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("netexport.Exporter; Failed to export net data " + err.toString());
        }

        return false;
    }
};

// ************************************************************************************************
// Viewer Opener

Firebug.NetExport.ViewerOpener =
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
}});

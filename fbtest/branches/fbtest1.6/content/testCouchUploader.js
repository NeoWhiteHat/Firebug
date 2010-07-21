/* See license.txt for terms of usage */

FBTestApp.ns(function() { with (FBL) {

// ************************************************************************************************
// Test Console Implementation

var Cc = Components.classes;
var Ci = Components.interfaces;

// ************************************************************************************************

FBTestApp.TestCouchUploader =
{
    onUpload: function()
    {
        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.TestCouchUploader.onUpload;");

        var total = this.getTotalTests();
        if (!total)
        {
            // xxxHonza: localization
            alert("There are no test results to upload!");
            return;
        }

        // Get header document...
        var header = this.getHeaderDoc();

        // ...and store it into the DB to get ID.
        var self = this;
        var options =
        {
            success: function(headerResp)
            {
                self.onHeaderUploaded(headerResp, header);
            },
            error: function(status, error, reason)
            {
                if (FBTrace.DBG_FBTEST || FBTrace.DBG_ERRORS)
                    FBTrace.sysout("fbtest.TestCouchUploader.onUpload; ERROR Can't upload test results" +
                        status + ", " + error + ", " + reason);

                alert("Can't upload test results! " + error + ", " + reason);
            }
        }
        CouchDB.saveDoc(header, options);
    },

    onHeaderUploaded: function(headerResp, header)
    {
        if (FBTrace.DBG_FBTEST)
            FBTrace.sysout("fbtest.TestCouchUploader.onUploaonHeaderUploaded; " +
                "Header uploaded OK", headerResp);

        // Collect all results.
        var self = this;
        var results = {docs: []};
        FBTestApp.TestConsole.iterateTests(function(group, test)
        {
            // The test must be launched at least once.
            if (test.start)
            {
                var resultDoc = self.getResultDoc(test);
                resultDoc.headerid = headerResp.id;
                resultDoc["Export Date"] = header["Export Date"];
                results.docs.push(resultDoc);
            }
        })

        // Store all results into the DB
        var options =
        {
            success: function(resultsResp)
            {
                self.onResultsUploaded(headerResp.id, resultsResp);
            },
            error: function(status, error, reason)
            {
                if (FBTrace.DBG_FBTEST || FBTrace.DBG_ERRORS)
                    FBTrace.sysout("fbtest.TestCouchUploader.onUpload; ERROR Can't upload test results" +
                        status + ", " + error + ", " + reason);

                alert("Can't upload test results!");
            }
        }
        CouchDB.bulkSave(results, options);
    },

    onResultsUploaded: function(headerid, data)
    {
        var remoteFBL = FBTestApp.FBTest.FirebugWindow.FBL;
        //remoteFBL.openNewTab("http://legoas/firebug/tests/content/testbot/results/?userheaderid=" + headerid);
        //remoteFBL.openNewTab("http://getfirebug.com/tests/content/testbot/results/?userheaderid=" + headerid);
        remoteFBL.openNewTab("http://getfirebug.com/testresults/?userheaderid=" + headerid);
    },

    onStatusBarPopupShowing: function(event)
    {
        // Can't upload if there are no results.
        $("menu_uploadTestResults").disabled = !this.isEnabled();
    },

    isEnabled: function()
    {
        return this.getTotalTests() > 0;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    getHeaderDoc: function()
    {
        var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
        var currLocale = Firebug.getPref("general.useragent", "locale");
        var systemInfo = Cc["@mozilla.org/system-info;1"].getService(Ci.nsIPropertyBag);
        var application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);

        var header = {type: "user-header"};
        header["App Build ID"] = appInfo.appBuildID;
        //header["App Changeset"] =
        header["App Name"] = appInfo.name;
        header["App Platform"] = appInfo.platformVersion;
        header["App Version"] = appInfo.version;
        //header["CPU Architecture"] =
        header["Export Date"] = (new Date()).toGMTString();
        header["FBTest"] = FBTestApp.TestConsole.getVersion();
        header["Firebug"] = Firebug.version;
        header["Locale"] = currLocale;
        header["OS Detailed Name"] = ""; //xxxHonza todo
        header["OS Name"] = systemInfo.getProperty("name");
        header["OS Version"] = systemInfo.getProperty("version");
        header["Test Suite"] = FBTestApp.TestConsole.testListPath;
        header["Total Tests"] = this.getTotalTests().toString();

        // Put together a list of installed extensions.
        var extensions = [];
        for (var i=0; i<application.extensions.all.length; i++)
        {
            var ext = application.extensions.all[i];
            extensions.push({
                name: ext.name,
                id: ext.id,
                enabled: ext.enabled
            });
        }
        header["Extensions"] = extensions;

        return header;
    },

    getResultDoc: function(test)
    {
        var result = extend(this.getHeaderDoc(), {type: "user-result"});

        result.description = test.desc;
        result.file = test.uri;
        result.result = test.error ? (test.category == "fails" ? "TEST-KNOWN-FAIL" :
            "TEST-UNEXPECTED-FAIL") : "TEST-PASS"

        if (test.error)
        {
            var progress = "";
            for (var resultIdx in test.results)
            {
                var testResult = test.results[resultIdx];
                progress += (testResult.pass ? "[OK]" : "[ERROR]") + " " + testResult.msg + "\n";
            }
            result.progress = progress;
        }

        return result;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    getTotalTests: function()
    {
        var total = 0;
        FBTestApp.TestConsole.iterateTests(function(group, test)
        {
            // The test must be launched at least once.
            if (test.start)
                total++;
        })
        return total;
    },
};

// ************************************************************************************************

var CouchDB =
{
    uri: "http://brasstacks.mozilla.com/couchdb/firebug/",

    saveDoc: function(doc, options)
    {
        options = options || {};
        this.ajax({
            type: "POST",
            url: this.uri,
            contentType: "application/json",
            data: toJSON(doc),
            complete: function(req)
            {
                var resp = parseJSON(req.responseText);
                if (req.status == 201)
                {
                    doc._id = resp.id;
                    doc._rev = resp.rev;
                    if (options.success)
                        options.success(resp);
                }
                else if (options.error)
                {
                    options.error(req.status, resp.error, resp.reason);
                }
                else
                {
                    alert("The document could not be saved: " + resp.reason);
                }
            }
        });
    },

    bulkSave: function(docs, options)
    {
        extend(options, {successStatus: 201});
        this.ajax({
            type: "POST",
            url: this.uri + "_bulk_docs",
            data: toJSON(docs),
            complete: function(req)
            {
                var resp = parseJSON(req.responseText);
                if (req.status == 201)
                {
                    if (options.success)
                        options.success(resp);
                }
                else if (options.error)
                {
                    options.error(req.status, resp.error, resp.reason);
                }
                else
                {
                    alert("The document could not be saved: " + resp.reason);
                }
            },
        });
    },

    ajax: function(options)
    {
        try
        {
            var request = CCIN("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");
            request.open(options.type, options.url, true);
            request.setRequestHeader("Content-Type", options.contentType);
            request.onreadystatechange = function()
            {
                if (request.readyState === 4)
                {
                    if (options.complete)
                        options.complete(request);
                }
            }
            request.send(options.data);
        }
        catch (e)
        {
            if (FBTrace.DBG_FBTEST || FBTrace.DBG_ERRORS)
                FBTrace.sysout("fbtest.TestCouchUploader; ajax EXCEPTION " + e, e);
        }
    }
}

// ************************************************************************************************

function toJSON(obj)
{
    return obj !== null ? JSON.stringify(obj) : null;
}

function parseJSON(data)
{
    return JSON.parse(data);
}

// ************************************************************************************************
}});

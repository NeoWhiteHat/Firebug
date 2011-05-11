/* See license.txt for terms of usage */

define([
    "firebug/lib/xpcom",
    "firebug/lib/trace",
    "firebug/lib/deprecated",
    "firebug/lib/stackFrame",
],
function(XPCOM, FBTrace, Deprecated, StackFrame) {

// ********************************************************************************************* //
// Constants

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

const NS_SEEK_SET = Ci.nsISeekableStream.NS_SEEK_SET;

var HTTP = {};

// ********************************************************************************************* //
// Module Implementation

HTTP.readFromStream = function(stream, charset, noClose)
{
    var sis = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
    sis.setInputStream(stream);

    var segments = [];
    for (var count = stream.available(); count; count = stream.available())
        segments.push(sis.readBytes(count));

    if (!noClose)
        sis.close();

    var text = segments.join("");

    try
    {
        return HTTP.convertToUnicode(text, charset);
    }
    catch (err)
    {
        if (FBTrace.DBG_ERRORS)
            FBTrace.sysout("httpLib.readFromStream EXCEPTION charset: " + charset, err);
    }

    return text;
};

HTTP.readPostTextFromPage = function(url, context)
{
    if (url == context.browser.contentWindow.location.href)
    {
        try
        {
            var webNav = context.browser.webNavigation;
            var descriptor = (webNav instanceof Ci.nsIWebPageDescriptor) ?
                webNav.currentDescriptor : null;

            if (!(descriptor instanceof Ci.nsISHEntry))
                return;

            if (entry && entry.postData)
            {
                if (!(entry.postData instanceof Ci.nsISeekableStream))
                    return;

                var postStream = entry.postData;
                postStream.seek(NS_SEEK_SET, 0);

                var charset = context.window.document.characterSet;
                return HTTP.readFromStream(postStream, charset, true);
            }
         }
         catch (exc)
         {
             if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("httpLib.readPostText FAILS, url:"+url, exc);
         }
     }
};

HTTP.readPostTextFromRequest = function(request, context)
{
    try
    {
        var is = (request instanceof Ci.nsIUploadChannel) ? request.uploadStream : null;
        if (is)
        {
            if (!(is instanceof Ci.nsISeekableStream))
                return;

            var ss = is;
            var prevOffset;
            if (ss)
            {
                prevOffset = ss.tell();
                ss.seek(NS_SEEK_SET, 0);
            }

            // Read data from the stream..
            var charset = (context && context.window) ? context.window.document.characterSet : null;
            var text = HTTP.readFromStream(is, charset, true);

            // Seek locks the file so, seek to the beginning only if necko hasn't read it yet,
            // since necko doesn't seek to 0 before reading (at lest not till 459384 is fixed).
            if (ss && prevOffset == 0)
                ss.seek(NS_SEEK_SET, 0);

            return text;
        }
    }
    catch(exc)
    {
        if (FBTrace.DBG_ERRORS)
            FBTrace.sysout("httpLib.readPostTextFromRequest FAILS ", exc);
    }

    return null;
};

HTTP.getInputStreamFromString = function(dataString)
{
    var stringStream = Cc["@mozilla.org/io/string-input-stream;1"].
        createInstance(Ci.nsIStringInputStream);

    if ("data" in stringStream) // Gecko 1.9 or newer
        stringStream.data = dataString;
    else // 1.8 or older
        stringStream.setData(dataString, dataString.length);

    return stringStream;
};

HTTP.getWindowForRequest = function(request)
{
    var loadContext = HTTP.getRequestLoadContext(request);
    try
    {
        if (loadContext)
            return loadContext.associatedWindow;
    }
    catch (ex)
    {
    }

    return null;
};

HTTP.getRequestLoadContext = function(request)
{
    try
    {
        if (request && request.notificationCallbacks)
        {
            StackFrame.suspendShowStackTrace();
            return request.notificationCallbacks.getInterface(Ci.nsILoadContext);
        }
    }
    catch (exc)
    {
    }
    finally
    {
        StackFrame.resumeShowStackTrace();
    }

    try
    {
        if (request && request.loadGroup && request.loadGroup.notificationCallbacks)
        {
            StackFrame.suspendShowStackTrace();
            return request.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);
        }
    }
    catch (exc)
    {
    }
    finally
    {
        StackFrame.resumeShowStackTrace();
    }

    return null;
};

HTTP.getRequestWebProgress = Deprecated.deprecated("Use getRequestLoadContext function",
    HTTP.getRequestLoadContext);

// ********************************************************************************************* //

HTTP.convertToUnicode = function(text, charset)
{
    if (!text)
        return "";

    try
    {
        var conv = Cc["@mozilla.org/intl/scriptableunicodeconverter"].getService(
            Ci.nsIScriptableUnicodeConverter);
        conv.charset = charset ? charset : "UTF-8";
        return conv.ConvertToUnicode(text);
    }
    catch (exc)
    {
        if (FBTrace.DBG_ERRORS)
            FBTrace.sysout("lib.convertToUnicode: fails: for charset "+charset+" conv.charset:"+
                conv.charset+" exc: "+exc, exc);

        // the exception is worthless, make up a new one
        throw new Error("Firebug failed to convert to unicode using charset: "+conv.charset+
            " in @mozilla.org/intl/scriptableunicodeconverter");
    }
};

HTTP.convertFromUnicode = function(text, charset)
{
    if (!text)
        return "";

    try
    {
        var conv = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(
            Ci.nsIScriptableUnicodeConverter);
        conv.charset = charset ? charset : "UTF-8";
        return conv.ConvertFromUnicode(text);
    }
    catch (exc)
    {
        if (FBTrace.DBG_ERRORS)
            FBTrace.sysout("lib.convertFromUnicode: fails: for charset "+charset+" conv.charset:"+
                conv.charset+" exc: "+exc, exc);
    }
};

// ************************************************************************************************
// Network Tracing

HTTP.getStateDescription = function(flag)
{
    var state = [];
    var nsIWebProgressListener = Ci.nsIWebProgressListener;
    if (flag & nsIWebProgressListener.STATE_START) state.push("STATE_START");
    else if (flag & nsIWebProgressListener.STATE_REDIRECTING) state.push("STATE_REDIRECTING");
    else if (flag & nsIWebProgressListener.STATE_TRANSFERRING) state.push("STATE_TRANSFERRING");
    else if (flag & nsIWebProgressListener.STATE_NEGOTIATING) state.push("STATE_NEGOTIATING");
    else if (flag & nsIWebProgressListener.STATE_STOP) state.push("STATE_STOP");

    if (flag & nsIWebProgressListener.STATE_IS_REQUEST) state.push("STATE_IS_REQUEST");
    if (flag & nsIWebProgressListener.STATE_IS_DOCUMENT) state.push("STATE_IS_DOCUMENT");
    if (flag & nsIWebProgressListener.STATE_IS_NETWORK) state.push("STATE_IS_NETWORK");
    if (flag & nsIWebProgressListener.STATE_IS_WINDOW) state.push("STATE_IS_WINDOW");
    if (flag & nsIWebProgressListener.STATE_RESTORING) state.push("STATE_RESTORING");
    if (flag & nsIWebProgressListener.STATE_IS_INSECURE) state.push("STATE_IS_INSECURE");
    if (flag & nsIWebProgressListener.STATE_IS_BROKEN) state.push("STATE_IS_BROKEN");
    if (flag & nsIWebProgressListener.STATE_IS_SECURE) state.push("STATE_IS_SECURE");
    if (flag & nsIWebProgressListener.STATE_SECURE_HIGH) state.push("STATE_SECURE_HIGH");
    if (flag & nsIWebProgressListener.STATE_SECURE_MED) state.push("STATE_SECURE_MED");
    if (flag & nsIWebProgressListener.STATE_SECURE_LOW) state.push("STATE_SECURE_LOW");

    return state.join(", ");
};

HTTP.getStatusDescription = function(status)
{
    var nsISocketTransport = Ci.nsISocketTransport;
    var nsITransport = Ci.nsITransport;

    if (status == nsISocketTransport.STATUS_RESOLVING) return "STATUS_RESOLVING";
    if (status == nsISocketTransport.STATUS_CONNECTING_TO) return "STATUS_CONNECTING_TO";
    if (status == nsISocketTransport.STATUS_CONNECTED_TO) return "STATUS_CONNECTED_TO";
    if (status == nsISocketTransport.STATUS_SENDING_TO) return "STATUS_SENDING_TO";
    if (status == nsISocketTransport.STATUS_WAITING_FOR) return "STATUS_WAITING_FOR";
    if (status == nsISocketTransport.STATUS_RECEIVING_FROM) return "STATUS_RECEIVING_FROM";
    if (status == nsITransport.STATUS_READING) return "STATUS_READING";
    if (status == nsITransport.STATUS_WRITING) return "STATUS_WRITING";
};

HTTP.getLoadFlagsDescription = function(loadFlags)
{
    var flags = [];
    var nsIChannel = Ci.nsIChannel;
    var nsICachingChannel = Ci.nsICachingChannel;

    if (loadFlags & nsIChannel.LOAD_DOCUMENT_URI) flags.push("LOAD_DOCUMENT_URI");
    if (loadFlags & nsIChannel.LOAD_RETARGETED_DOCUMENT_URI) flags.push("LOAD_RETARGETED_DOCUMENT_URI");
    if (loadFlags & nsIChannel.LOAD_REPLACE) flags.push("LOAD_REPLACE");
    if (loadFlags & nsIChannel.LOAD_INITIAL_DOCUMENT_URI) flags.push("LOAD_INITIAL_DOCUMENT_URI");
    if (loadFlags & nsIChannel.LOAD_TARGETED) flags.push("LOAD_TARGETED");
    if (loadFlags & nsIChannel.LOAD_CALL_CONTENT_SNIFFERS) flags.push("LOAD_CALL_CONTENT_SNIFFERS");
    if (loadFlags & nsICachingChannel.LOAD_NO_NETWORK_IO) flags.push("LOAD_NO_NETWORK_IO");
    if (loadFlags & nsICachingChannel.LOAD_CHECK_OFFLINE_CACHE) flags.push("LOAD_CHECK_OFFLINE_CACHE");
    if (loadFlags & nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE) flags.push("LOAD_BYPASS_LOCAL_CACHE");
    if (loadFlags & nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE_IF_BUSY) flags.push("LOAD_BYPASS_LOCAL_CACHE_IF_BUSY");
    if (loadFlags & nsICachingChannel.LOAD_ONLY_FROM_CACHE) flags.push("LOAD_ONLY_FROM_CACHE");
    if (loadFlags & nsICachingChannel.LOAD_ONLY_IF_MODIFIED) flags.push("LOAD_ONLY_IF_MODIFIED");

    return flags.join(", ");
};

// ************************************************************************************************

HTTP.BaseProgressListener =
{
    QueryInterface : function(iid)
    {
        if (iid.equals(Ci.nsIWebProgressListener) ||
            iid.equals(Ci.nsISupportsWeakReference) ||
            iid.equals(Ci.nsISupports))
        {
            return this;
        }

        throw Components.results.NS_NOINTERFACE;
    },

    stateIsRequest: false,
    onLocationChange: function() {},
    onStateChange : function() {},
    onProgressChange : function() {},
    onStatusChange : function() {},
    onSecurityChange : function() {},
    onLinkIconAvailable : function() {}
};

// ********************************************************************************************* //
// Registration

return HTTP;

// ********************************************************************************************* //
});

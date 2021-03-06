/* See license.txt for terms of usage */


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * @name CommandLineHandler
 * @constructor CommandLineHandler
 * @description Processes command-line arguments to connect to a remote debug host and port.
 *
 */
function CommandLineHandler() {
    this.wrappedJSObject = this;
}
CommandLineHandler.prototype =
/** @lends CommandLineHandler */
{

      classDescription: "command line handler",
      contractID: "@almaden.ibm.com/crossfire/command-line-handler;1",
      classID: Components.ID("3AB17C22-D1A6-4FF0-9A66-3DBD42114D61"),
      QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler]),
      _xpcom_categories: [{ category: "command-line-handler", entry: "m-crossfire-clh" }],

    handle: function(cmdLine) {
        try {
            this.serverPort = cmdLine.handleFlagWithParam("crossfire-server-port", false);
            if (!this.serverPort) {
                this.host = cmdLine.handleFlagWithParam("crossfire-host", false);
                this.port = cmdLine.handleFlagWithParam("crossfire-port", false);
            }
        } catch (e) {
            Cu.reportError("Command Line Handler failed: " + e);
        }

        try {
            this.loadFBModules = cmdLine.handleFlag("-load-fb-modules", false);
            this.noFBModules = cmdLine.handleFlag("-no-fb-modules", false);

            if (this.loadFBModules) {
                this._watchAndInitializeFirebug();
            }

        } catch (e2) {
            Cu.reportError("Command Line Handler failed: " + e2);
        }
    },

    /**
     * @name CommandLineHandler.getServerPort
     * @function
     * @description  getServerPort
     * @return the server port that was specified on the command-line.
     */
    getServerPort: function() {
        return this.serverPort;
    },

    /**
     * @name CommandLineHandler.getPort
     * @function
     * @description  getPort
     * @return the port that was specified on the command-line.
     */
    getPort: function() {
        return this.port;
    },

    /**
     * @name CommandLineHandler.getHost
     * @function
     * @description getHost
     * @return the host that was specified on the command-line.
     */
    getHost: function() {
        return this.host;
    },

    /**
     * @name CommandLineHandler.loadFBModules
     * @function
     * @description loadFBModules
     * @return boolean indicating whether -load-fb-modules flag was specified on the command-line.
     */
    shouldLoadFBModules: function() {
        return (this.loadFBModules && !this.noFBModules);
    },

    /** @ignore */
    _watchAndInitializeFirebug: function() {
        // initialize Firebug Modules before panels are loaded...
        var windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);

        var windowObserver = {
            QueryInterface: function(iid) {
                    if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsIObserver))
                        throw NS_ERROR_NO_INTERFACE;
                    return this;
            },

            observe: function( subject, topic, data) {
                if (topic == "domwindowopened") {
                    if (/* nsIDOMWindow */ subject.Firebug) {
                        subject.Firebug.initialize();
                        windowWatcher.unregisterNotification(windowObserver);
                    }
                }
            }
        };

        windowWatcher.registerNotification(windowObserver);
    }

};

/** @ignore */

if (XPCOMUtils.generateNSGetFactory) {
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([CommandLineHandler])
} else {
    //mcollins: FF3 complains if NSGetModule is not a function
    function NSGetModule() {
        return XPCOMUtils.generateModule([CommandLineHandler]);
    }
}
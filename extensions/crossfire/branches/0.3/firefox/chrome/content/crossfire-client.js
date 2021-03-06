/* See license.txt for terms of usage */

FBL.ns(function() {

    var Crossfire = top.Crossfire;

    /**
     * @name CrossfireClient
     * @description Firebug Module for Client-side Crossfire functions.
     */
    Crossfire.CrossfireClient = FBL.extend(Firebug.Module, {
        contexts: [],
        dispatchName: "CrossfireClient",
        toolName: "all", // receive all packets, regardless of 'tool' header

        /**
         * @name initialize
         * @description Initializes Crossfire
         * @function
         * @private
         * @memberOf CrossfireClient
         * @extends Firebug.Module
         */
        initialize: function() {
            var host, port;
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            host = commandLine.getHost();
            port = commandLine.getPort();

            this.contexts = [];

            if (host && port) {
                this.connectClient(host, port);
            }
        },


        /**
         * @name connectClient
         * @description Attempts to connect to remote host/port
         * @function
         * @public
         * @memberOf CrossfireClient
         * @param {String} host the remote host name.
         * @param {Number} port the remote port number.
         */
        connectClient: function(host, port) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE connect: host => " + host + " port => " + port);
            }

            this.host = host;
            this.port = port;
            try {

                this.transport = Crossfire.getClientTransport();
                this.transport.addListener(this);
                this.transport.open(host, port);
            }
            catch(e) {
                if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout(e);
            }
        },

        /**
         * @name onConnectionStatusChanged
         * @description Called when the status of the transport's connection changes.
         * @function
         * @public
         * @memberOf CrossfireClient
         * @param {String} status the status to report
         */
        onConnectionStatusChanged: function( status) {
            this.status = status;
            if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
                //this.getBrowserContexts();
            }
        },

        /**
         * @name fireEvent
         * @function
         * @description Listens for events from Crossfire socket,
         * and dispatch them to BTI calls.
         */
        fireEvent: function(event)
        {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("fireEvent: " + event);

            var contextId = event.contextId,
                eventName = event.event,
                data = event.data;

            //FBL.dispatch(this.fbListeners, "onExecute", [packet]);
        },


        handleResponse: function( response) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CrossfireClient handleResponse => " + response);
        },

        _sendCommand: function( command, data) {
            //TODO:
            this.transport.sendRequest(command, data);
        },

        // tools
        enableTool: function( toolName) {
            this._sendCommand("enableTool", {"toolName":toolName});
        },

        disableTool: function( toolName) {
            this._sendCommand("disableTool", {"toolName":toolName});
        },

        getBrowserContexts: function() {
            this._sendCommand("listcontexts");
        },

    });

    // register module
    Firebug.registerModule(Crossfire.CrossfireClient);
});
/* See license.txt for terms of usage */

define(["crossfireModules/crossfire","crossfireModules/crossfire-status",], function (CrossfireModule, CrossfireStatus) {

    function CrossfireClient() {
        this.contexts = {};
        this.listeners = [];
    }
    /**
     * @name CrossfireClient
     * @description Firebug Module for Client-side Crossfire functions.
     */
    CrossfireClient.prototype = FBL.extend(Firebug.Module, {

        //contexts: [],
        dispatchName: "CrossfireClient",
        toolName: "all", // receive all packets, regardless of 'tool' header
        //listeners: [],

        /*
         * @name initialize
         * @description Initializes Crossfire
         * @function
         * @private
         * @memberOf CrossfireModule
         * @extends Firebug.Module
         *
        initialize: function() {
            var host, port;
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            host = commandLine.getHost();
            port = commandLine.getPort();

            this.contexts = {};



            if (host && port) {
                this.connectClient(host, port);
            }
        },*/


        /**
         * @name connectClient
         * @description Attempts to connect to remote host/port
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param {String} host the remote host name.
         * @param {Number} port the remote port number.
         */
        connectClient: function(host, port) {
            if (FBTrace.DBG_CROSSFIRE_CLIENT) {
                FBTrace.sysout("CROSSFIRE connect: host => " + host + " port => " + port);
            }

            this.host = host;
            this.port = port;
            try {

                this.transport = CrossfireModule.getClientTransport();
                this.transport.addListener(this);
                this.transport.open(host, port);
            }
            catch(e) {
                if (FBTrace.DBG_CROSSFIRE_CLIENT) FBTrace.sysout(e);
            }
        },

        /**
         * @name onConnectionStatusChanged
         * @description Called when the status of the transport's connection changes.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param {String} status the status to report
         */
        onConnectionStatusChanged: function( status) {
            if (status == CrossfireStatus.STATUS_CONNECTED_CLIENT) {
                this.getBrowserContexts();
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
            if (FBTrace.DBG_CROSSFIRE_CLIENT)
                FBTrace.sysout("CrossfireClient fireEvent: " + event);

            var contextId = event.context_id,
                eventName = event.event,
                data = event.data;
/*
            if (eventName == "onContextCreated") {
                var btiContext = new BrowserContext();
                this.contexts[contextId] = btiContext;
                this.btiBrowser._contextCreated(btiContext);
            } else if (eventName == "onScript") {
                var browserContext = this.contexts[contextId];
                var ccu = new CompilationUnit(data.href, browserContext); //CrossfireClient.CrossfireCompilationUnit(data.href, contextId);
                browserContext._addCompilationUnit(ccu);
            }
*/
            //FBL.dispatch(this.fbListeners, "onExecute", [packet]);

            this.Browser.dispatch(eventName, data);
        },


        handleResponse: function( response) {
            if (FBTrace.DBG_CROSSFIRE_CLIENT)
                FBTrace.sysout("CrossfireClient handleResponse => " + response);
            if (response.command == "listcontexts") {
                //TODO: create BTI BrowserContexts?
            }
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

        // ----- BTI/Crossfire-ish things -----
        getBrowserContexts: function() {
            this._sendCommand("listcontexts");
        },

        /*
        CrossfireCompilationUnit : FBL.extend(BTI.CompilationUnit, {

            getSourceLines: function( context) {
                CrossfireClient._sendCommand("scripts", {
                    "context_id": context.Crossfire.crossfire_id
                    });
            }
        })
        */

        // ----- Browser Interface -----
        Browser: function() {
            return CrossfireClient;
        },

        getTools: function() {

        },

        getTool: function( name) {

        },

        getBrowserContext: function(id) {

        },

        addListener: function( listener) {
            this.listeners.push(listener);
        },

        removeListener: function( listener) {
            this.listeners.splice(this.listeners.indexOf(listener), 1);
        },

        dispatch: function(eventName, args) {
            if (FBTrace.DBG_CROSSFIRE_DISPATCH)
                FBTrace.sysout("dispatching " + eventName + " to " + this.listeners.length + "listeners");
            for (var listener in this.listeners) {
                try {
                    listener[eventName].apply(listener, args);
                } catch (e) {
                    if (FBTrace.DBG_CROSSFIRE_DISPATCH)
                        FBTrace.sysout("failed to dispatch " + eventName + " to " + listener + ": " + e);
                }
            }
        },

        onDebug: function()
        {
            FBTrace.sysout.apply(FBTrace, arguments);
        },

        // ----- Javascript Tool Interface -----
        JavaScript: {
            /**
             * @name breakOnNext
             */
            breakOnNext : function(context, enable)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient breakOnNext");
            /*
                if (enable)
                    Firebug.Debugger.suspend(context);
                else
                    Firebug.Debugger.unSuspend(context);
                    */
            },

            /**
             * @name setBreakpoint
             */
            setBreakpoint : function(context, url, lineNumber)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient setBreakpoint");
                /*
                // TODO we should be sending urls over not compilation units
                var compilationUnit = context.getCompilationUnit(url);
                Firebug.Debugger.setBreakpoint(compilationUnit, lineNumber);
                */
            },

            /**
             * @name clearBreakpoint
             */
            clearBreakpoint : function(context, url, lineNumber)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient clearBreakpoint");
                /*
                // This is more correct, but bypasses Debugger
                Firebug.Debugger.fbs.clearBreakpoint(url, lineNumber);
                */
            },

            /**
             * @name enableBreakpoint
             */
            enableBreakpoint : function(context, url, lineNumber)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient enableBreakpoint");
                /*
                Firebug.Debugger.fbs.enableBreakpoint(url, lineNumber);
                */
            },

            /**
             * @name disableBreakpoint
             */
            disableBreakpoint : function(context, url, lineNumber)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient disableBreakpoint");
                /*
                Firebug.Debugger.fbs.disableBreakpoint(url, lineNumber);
                */
            },

            /**
             * @name isBreakpointDisabled
             */
            isBreakpointDisabled : function(context, url, lineNumber)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient isBreakpointDisabled");
                /*
                Firebug.Debugger.fbs.isBreakpointDisabled(url, lineNumber);
                */
            },

            // xxx mcollins stolen comment from jjb's inProcess javascripttool
            // These functions should be on stack instead

            /**
             * @name resumeJavascript
             */
            resumeJavaScript : function(context)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient resumeJavaScript");
                /*
                Firebug.Debugger.resume(context);
                */
            },

            /**
             * @name stepOver
             */
            stepOver : function(context)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient stepOver");
                /*
                Firebug.Debugger.stepOver(context);
                */
            },

            /**
             * @name stepInto
             */
            stepInto : function(context)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient stepInto");
                /*
                Firebug.Debugger.stepInto(context);
                */
            },

            /**
             * @name stepOut
             */
            stepOut : function(context)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient stepOut");
                /*
                Firebug.Debugger.stepOut(context);
                */
            },

            /**
             * @name runUntil
             */
            runUntil : function(compilationUnit, lineNumber)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient runUntil");
                /*
                Firebug.Debugger.runUntil(compilationUnit.getBrowserContext(), compilationUnit, lineNumber, Firebug.Debugger);
                */
            },

            // Events
            // mcollins FIXME: listen to something here...
            //ToolsInterface.browser.addListener(ToolsInterface.JavaScript);  // This is how we get events

            /**
             * @name onActivateTool
             * @description A previously enabled tool becomes active and sends us an event.
             */
            onActivateTool : function(toolname, active)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient onActivateTool");
                /*
                if (FBTrace.DBG_ACTIVATION)
                    FBTrace.sysout("onActivateTool "+toolname+" = "+active);

                if (toolname === 'script')
                {
                    Firebug.ScriptPanel.prototype.onJavaScriptDebugging(active);
                    ToolsInterface.browser.eachContext(function refresh(context)
                    {
                        context.invalidatePanels('script');
                    });
                }
                */
            },

            /**
             * @name onStartDebugging
             */
            onStartDebugging : function(context, frame)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient onStartDebugging");
                /*
                Firebug.selectContext(context);
                var panel = Firebug.chrome.selectPanel("script");
                panel.onStartDebugging(frame);
                */
            },

            /**
             * @name onStopDebugging
             */
            onStopDebugging : function(context)
            {
                if (FBTrace.DBG_CROSSFIRE_CLIENT)
                    FBTrace.sysout("CrossfireClient onStopDebugging");
                /*
                var panel = context.getPanel("script", true);
                if (panel && panel === Firebug.chrome.getSelectedPanel())  // then we are looking at the script panel
                    panel.showNoStackFrame(); // unhighlight and remove toolbar-status line

                if (panel)
                {
                    panel.onStopDebugging();
                }
                */
            }
        }
    });

    // register module
    Firebug.registerModule(CrossfireClient);

    return exports = Firebug.CrossfireClient = CrossfireClient;
// enifed
});
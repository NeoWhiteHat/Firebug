/* See license.txt for terms of usage */
/**
 * Crossfire
 * Firebug extension to add support for remote debug protocol.
 *
 */

const CROSSFIRE_VERSION = "0.2";
var CONTEXT_ID_SEED = Math.round(Math.random() * 10000000);

var Crossfire = Crossfire || {};

FBL.ns(function() { with(FBL) {

    /**
     * @name CrossfireModule
     * @namespace CrossfireModule
     * @module Firebug Module for Crossfire. This module acts as a controller
     * between Firebug and the remote debug connection.  It is responsible for
     * opening a connection to the remote debug host and dispatching any
     * command requests to the FirebugCommandAdaptor (@see FirebugCommandAdaptor.js).
     *
     * This module also adds context and debugger listeners and sends the
     * appropriate events to the remote host.
     */
    top.CrossfireModule = extend(Firebug.Module, /**@lends CrossfireModule */ {
        dispatchName: "Crossfire",

        /** extends Firebug.Module */
        initialize: function() {
            var host, port, serverPort;

            Components.utils.import("resource://crossfire/SocketTransport.js");

            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;

            serverPort = commandLine.getServerPort();
            if (serverPort) {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE Got command-line args: server-port => " + serverPort);

                this.startServer("localhost", serverPort);

            } else if (host && port) {
                host = commandLine.getHost();
                port = commandLine.getPort();

                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE Got command-line args: host => " + host + " port => " + port);

                this.connectClient(host, port);
            }
        },

        /**
         * @description attempt to connect to remote host/port
         * @param {String} host the remote host name.
         * @param {Number} port the remote port number.
         */
        connectClient: function(host, port) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE connect: host => " + host + " port => " + port);
            this.host = host;
            this.port = port;

            this._addListeners();

            if (!this.clientTransport)
                this.clientTransport = new CrossfireSocketTransport();

            this.clientTransport.addListener(this);
            this.clientTransport.open(host, port);
        },

        /**
         * @description listen for incoming connections on a port.
         * @param {String} host the host name.
         * @param {Number} port the port number to listen on.
         */
        startServer: function( host, port) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE startServer: host => " + host + " port => " + port);

            this.serverPort = port;

            try {
                this.transport = getCrossfireServer();

                this._addListeners();

                this.transport.addListener(this);

                this.transport.open(host, port);

                //this.connect(host, port);
            } catch(e) {
                FBTrace.sysout(e);
            }
        },

        _addListeners: function() {
            Firebug.Debugger.addListener(this);
            Firebug.Console.addListener(this);
            Firebug.Inspector.addListener(this);
            Firebug.HTMLModule.addListener(this);
        },

        /**
         *
         */
        stopServer: function() {
            this.transport.close();
        },

        /**
         * @description disconnect the current connection.
         */
        disconnect: function() {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE disconnect");
            if (this.status != CROSSFIRE_STATUS.STATUS_DISCONNECTED && this.transport) {
                this.transport.close();
                this.transport = null;
            }
        },

        // --
        findContextById: function(context_id) {
            return TabWatcher.iterateContexts(function(context) {
                if (context.Crossfire) {
                    if (context_id == context.Crossfire.crossfire_id) {
                        return context;
                    }
                }
            });
        },

        // ----- Crossfire transport listener -----

        /**
         * @description
         * Listener function called by the transport when a request is
         * received.
         *
         * @description
         * Looks up the context by the request object's <code>context_id</code>
         * property and calls the requested command on that context's
         * command adaptor.
         */
        handleRequest: function( request) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE received request " + request.toSource());

            var command = request.command;

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE handling command: " + command + ", with arguments: ",  request.arguments );

            var response;
            if (command == "listcontexts") {
                response = this.listContexts();
            } else if (command == "version") {
                response =  { "version": CROSSFIRE_VERSION };
            } else {
                var context = CrossfireModule.findContextById(request.context_id);
                if (context) var commandAdaptor = context.Crossfire.commandAdaptor;

                if (!commandAdaptor) {
                    if (FBTrace.DBG_CROSSFIRE)
                        FBTrace.sysout("CROSSFIRE FAILS no context matches id "+request.context_id);
                    return;
                }
                try {
                    response = commandAdaptor[command].apply(commandAdaptor, [ request.arguments ]);
                } catch (e) {
                    if (FBTrace.DBG_CROSSFIRE)
                        FBTrace.sysout("CROSSFIRE exception while executing command " + e);
                }
            }

            if (response) {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE sending response => " + response.toSource());
                this.transport.sendResponse(command, request.seq, response, this.running, true);
            } else {
                this.transport.sendResponse(command, request.seq, {}, this.running, false);
            }
        },

        /**
         * @description called when the status of the transport's connection changes.
         * @param {String} status
         */
        onConnectionStatusChanged: function( status) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onConnectionStatusChanged: " + status);
            this.status = status;
            this.updateStatusText(status);
            this.updateStatusIcon(status);
        },

        /**
         *
         * @description send events generated by Firebug to the remote host.
         * @param <code>context</context> context of this event.
         * @param {String} <code>eventName<code> name of the event
         * @param {Object} arguments any arguments after the first two will be passed to the event handler.
         */
        handleEvent: function( context, eventName /*, [arg1 [, arg2] ...] */) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE handleEvent " + eventName);

            var args = Array.prototype.slice.apply(arguments, [2]);

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE handleEvent arguments: " + args);

            if (this.transport && this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                var eventAdaptor = context.Crossfire.eventAdaptor;
                var eventData = eventAdaptor[eventName].apply(eventAdaptor, args);
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE handleEvent sending to transport: " + eventData);
                this.transport.sendEvent(eventName, eventData);
            }
        },

        // ----- firebug listeners -----

        onSourceFileCreated: function( context, sourceFile) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onSourceFileCreated => " + sourceFile.href);


            var context_href;
            try {
                context_href = context.window.location.href;
            } catch(e) {
                context_href = "";
            }

            context.Crossfire.commandAdaptor.sourceFileLoaded(sourceFile);

            this.handleEvent(context, "onScript", { "href": sourceFile.href, "context_href": context_href });

        },

        // ----- context listeners -----
        /**
         * @description Add the new context to our list of contexts.
         * @description Create a new command and event adaptor for the context when it is loaded.
         * @param context
         */
        initContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  initContext "+context.getName());

            context.Crossfire = { "crossfire_id" : generateId() };

            context.Crossfire["commandAdaptor"] = new Crossfire.FirebugCommandAdaptor(context);
            context.Crossfire["eventAdaptor"] = new Crossfire.FirebugEventAdaptor(context);

            this.handleEvent(context, "onContextCreated");
        },

        /**
         * @description Send "onContextCreated" event.
         * @param context
         */
        loadedContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  loadedContext");

            //context.Crossfire.commandAdaptor.setContextLoaded();

            this.handleEvent(context, "onContextLoaded");

        },

        /**
         *
         * @description send context change event
         */
        showContext: function(browser, context) {
            if (this.currentContext == null || !this.currentContext.Crossfire) // no previous context
            {
                if (context)
                    this.handleEvent(context, "onContextChanged", context);
                // else nothing to show
            }
            else
            {
                // NB the context may be null meaning "we are not looking at anything now
                this.handleEvent(this.currentContext, "onContextChanged", context);
            }
            this.currentContext = context;
        },

        /**
         *  @description Tell remote side about destruction.
         *  @param context
         */
        destroyContext: function(context) {

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: destroyContext "+context.getName());

            if (context.Crossfire) {
                this.handleEvent(context, "onContextDestroyed");
            }
        },

        // ----- utils -----

        /**
         * listContexts method is called in response to a <code>listcontexts</code> command.
         * This method returns all the context id's that we know about.
         *
         * This is the only method that returns a protocol command response
         * that is not implemented in FirebugCommandAdaptor, because it is
         * not specific to one context.
         */
        listContexts: function() {

            var contexts = [];
            TabWatcher.iterateContexts(function convertForNetwork(context) {
                if (context.Crossfire) {
                    var href = safeGetWindowLocation(win);  // maybe we want context.getName()???
                    contexts.push( { "crossfire_id" : context.Crossfire.crossfire_id,
                        "href": href });
                }
            });

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE listContexts" + contexts.length + " contexts.", contexts);

            return { "contexts": contexts };
        },

        /**
         * Make a copy of a frame since the jsdIStackFrame's are ephemeral,
         * but our protocol is asynchronous so the original frame object may
         * be gone by the time the remote host requests it.
         */
        copyFrame: function copyFrame( frame, ctx, shouldCopyStack) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("copy frame => ", frame);

            if (FBTrace.DBG_CROSSFIRE_FRAMES)
                FBTrace.sysout("frame count => " + (++ctx.Crossfire.frameCount));

            if (ctx) {
                var context = ctx;
            }

            var frameCopy = {};

            // recursively copy scope chain
            function copyScope( aScope) {
                if (FBTrace.DBG_CROSSFIRE_FRAMES)
                    FBTrace.sysout("Copying scope => ", aScope);

                var copiedScope = {};
                try {
                    var listValue = {value: null}, lengthValue = {value: 0};
                    aScope.getProperties(listValue, lengthValue);

                    for (var i = 0; i < lengthValue.value; ++i) {
                        var prop = listValue.value[i];
                        var name = prop.name.getWrappedValue();
                           copiedScope[name.toString()] = prop.value.getWrappedValue();
                    }

                    if (aScope.jsParent) {
                        //copiedScope.parent = copyScope(aScope.jsParent);
                    }
                } catch (ex) {
                    if (FBTrace.DBG_CROSSFIRE_FRAMES) FBTrace.sysout("Exception copying scope => " + e);
                }
                return context.Crossfire.commandAdaptor.serialize(copiedScope);
                //return copiedScope;
            }

            if (frame && frame.isValid) {
                try {
                    var sourceFile = Firebug.SourceFile.getSourceFileByScript(context, frame.script)
                    if (sourceFile) {
                        var analyzer = sourceFile.getScriptAnalyzer(frame.script);
                        if (analyzer) {
                            lineno = analyzer.getSourceLineFromFrame(context, frame);
                            frameCopy["line"] = lineno;
                            var frameScript = sourceFile.href.toString();
                            if (FBTrace.DBG_CROSSFIRE_FRAMES)
                                FBTrace.sysout("frame.script is " + frameScript);

                            frameCopy["script"] = frameScript;
                        }
                    }
                } catch (x) {
                    if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("Exception getting script name");
                    frameCopy["line"] = frame.line;
                }

                frameCopy["scope"] =  copyScope(frame.scope);

                if (frame.thisValue) {
                    if (FBTrace.DBG_CROSSFIRE_FRAMES)
                        FBTrace.sysout("copying thisValue from frame...");
                    try {
                       var thisVal = frame.thisValue.getWrappedValue();
                       frameCopy["thisValue"] = context.Crossfire.commandAdaptor.serialize(thisVal);
                    } catch( e) {
                        if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("Exception copying thisValue => " + e);
                    }
                } else if (FBTrace.DBG_CROSSFIRE_FRAMES) {
                    FBTrace.sysout("no thisValue in frame");
                }

                /* is 'callee' different from 'callingFrame'?
                try {
                    frameCopy["callee"] = frame.callee.getWrappedValue();
                } catch( e) {
                    frameCopy["callee"] = frame.callee;
                }
                */

                frameCopy["functionName"] = frame.functionName;

                // copy eval so we can call it from 'evaluate' command
                frameCopy["eval"] = function() { return frame.eval.apply(frame, arguments); };

                // recursively copy all the frames in the stack
                function copyStack( aFrame) {
                    if (FBTrace.DBG_CROSSFIRE_FRAMES)
                        FBTrace.sysout("CROSSFIRE copyStack: calling frame is => ", aFrame.callingFrame);
                    if (aFrame.callingFrame && aFrame.callingFrame.isValid) {
                        var stack = copyStack(aFrame.callingFrame);
                        stack.splice(0,0,copyFrame(aFrame, context, false));
                        return stack;
                    } else {
                        return [ copyFrame(aFrame, context, false) ];
                    }
                }

                if (shouldCopyStack) {
                    if (frame.callingFrame) {
                        var stack = copyStack(frame.callingFrame);
                        frameCopy["stack"] = stack;
                        frameCopy["frameIndex"] = stack.length -1;
                    } else {
                        frameCopy["frameIndex"] = 0;
                    }
                }
            }
            return frameCopy;
        },


        // ----- Firebug Debugger listener -----

        /**
         * Copy the current frame (in case remote host requests it)
         * and send <code>onBreak</code> event.
         */
        onStartDebugging: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onStartDebugging");

            var frame = context.stoppedFrame;
            var lineno = 1;
            var sourceFile = Firebug.SourceFile.getSourceFileByScript(context, frame.script)
            if (sourceFile) {
                var analyzer = sourceFile.getScriptAnalyzer(frame.script);
                if (analyzer)
                    lineno = analyzer.getSourceLineFromFrame(context, frame);
            }
            var href = sourceFile.href.toString();
            var context_id = context.Crossfire.crossfire_id;

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onStartDebugging href => " + href);

            context.Crossfire.frameCount = 0;
            context.Crossfire.currentFrame = this.copyFrame(frame, context, true);

            this.handleEvent(context, "onBreak", href, lineno);

            this.setRunning(false);
        },

        onStop: function(context, frame, type, rv) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onStop");
        },

        /**
         * Send <code>onResume</code> event and set status 'running' to true.
         */
        onResume: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: onResume");

            context.Crossfire.currentFrame = null;
            context.Crossfire.commandAdaptor.clearRefs();

            this.handleEvent(context, "onResume");
            this.setRunning(true);
        },

        /**
         * Send <code>onToggleBreakpoint</code> event.
         */
        onToggleBreakpoint: function(context, url, lineNo, isSet, props) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: onToggleBreakpoint");
            this.handleEvent(context, "onToggleBreakpoint");
        },

        /**
         * Send <code>onToggleBreakpoint</code> event.
         */
        onToggleErrorBreakpoint: function(context, url, lineNo, isSet, props) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: onToggleErrorBreakpoint");
            this.handleEvent(context, "onToggleBreakpoint");

        },


        // ----- Firebug HTMLModule listener -----

        /**
         * Send <code>onToggleBreakpoint</code> event for HTML breakpoints.
         */
        onModifyBreakpoint: function(context, xpath, type) {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE: onModifyBreakpoint");
             this.handleEvent(context, "onToggleBreakpoint");
        },


        // ----- Firebug Console listener -----

        /**
         * logFormatted listener.
         * @description Generates event packets based on the className (log,debug,info,warn,error).
         * @description The object or message logged is contained in the packet's <code>data</code> property.
         * The generated event names are:
         * 		<code>onConsoleLog</code>,
         * 		<code>onConsoleDebug</code>,
         * 		<code>onConsoleInfo</code>,
         * 		<code>onConsoleWarn</code>,
         * 		<code>onConsoleError</code>
         */
        logFormatted: function(context, objects, className, sourceLink) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE logFormatted");

            var win = context.window;
            var winFB = (win.wrappedJSObject?win.wrappedJSObject:win)._firebug;
            if (winFB)
            {
                //var data = winFB.userObjects;

                var eventName = "onConsole" + className.substring(0,1).toUpperCase() + className.substring(1);
                var data = (win.wrappedJSObject?win.wrappedJSObject:win)._firebug.userObjects;

                this.handleEvent(context, eventName, data);
            }
        },

        // ----- Firebug.Inspector Listener -----

        /**
         * @description Send <code>onInspectNode</code> event.
         */
        onInspectNode: function(context, node) {
            node = node.wrappedJSObject;
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onInspectNode", node);
            this.handleEvent(context, "onInspectNode", node);
        },

        /* @ignore
        onStopInspecting: function(context, node) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onStopInspecting");

            var context_id = context.Crossfire.crossfire_id;
            this.transport.sendEvent("onStopInspecting", { "context_id": context_id });
        }
        */

        /**
         * Update Crossfire connection status icon.
         */
        updateStatusIcon: function( status) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE updateStatusIcon");
            var icon = $("crossfireIcon");
            if (icon) {
                if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER
                        || status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
                    setClass($("menu_connectCrossfireClient"), "hidden");
                    setClass($("menu_startCrossfireServer"), "hidden");

                    removeClass($("menu_disconnectCrossfire"), "hidden");

                    removeClass(icon, "disconnected");
                    removeClass(icon, "waiting");
                    setClass(icon, "connected");

                } else if (status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER
                        /* TODO: create a separate icon state for 'connecting' */
                        || status == CROSSFIRE_STATUS.STATUS_CONNECTING) {
                    setClass($("menu_connectCrossfireClient"), "hidden");
                    setClass($("menu_startCrossfireServer"), "hidden");

                    removeClass($("menu_disconnectCrossfire"), "hidden");

                    removeClass(icon, "disconnected");
                    removeClass(icon, "connected");
                    setClass(icon, "waiting");

                } else { //we are disconnected if (status == CROSSFIRE_STATUS.STATUS_DISCONNECTED) {
                    setClass($("menu_disconnectCrossfire"), "hidden");
                    removeClass($("menu_connectCrossfireClient"), "hidden");
                    removeClass($("menu_startCrossfireServer"), "hidden");

                    removeClass(icon, "connected");
                    removeClass(icon, "waiting");
                    setClass(icon, "disconnected");
                }
            }
        },

        updateStatusText: function( status) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE updateStatusText: " + status);

            var icon = $("crossfireIcon");

            if (status == CROSSFIRE_STATUS.STATUS_DISCONNECTED) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: disconnected.");
            } else if (status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: accepting connections on port " + this.serverPort);
            } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTING) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connecting...");
            } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connected to client on port " + this.serverPort);
            } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connected to " + this.host + ":" + this.port);
            }

        },

        /**
         * Update Crossfire running status.
         */
        setRunning: function( isRunning) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE setRunning", isRunning);
            var icon = $("crossfireIcon");
            if (icon) {
                if (isRunning) {
                     setClass(icon, "running");
                } else {
                     removeClass(icon, "running");
                }
            }
            this.running = isRunning;
        },

        // Crossfire status menu
        onStatusMenuShowing: function( menu) {
            if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE onStatusMenuShowing");
            if (this.running) {

            } else {

            }
        },

        // FBTest listener
        onGetTestList: function(testLists)
        {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onGetTestList");

            testLists.push({
                extension: "Crossfire",
                testListURL: "chrome://crossfire/content/fbtest/testList.html"
            });
        }

    });

    // register module
    Firebug.registerModule(CrossfireModule);


    // ----- Crossfire XUL Event Listeners -----

    Crossfire.onStatusClick = function( el) {
        $("crossfireStatusMenu").openPopup(el, "before_end", 0,0,false,false);
    };

    Crossfire.onStatusMenuShowing = function( menu) {
        //CrossfireModule.onStatusMenuShowing(menu);
    };

    Crossfire.startServer = function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("Crossfire.startServer");
        var params = _getDialogParams(true);
        window.openDialog("chrome://crossfire/content/connect-dialog.xul", "crossfire-connect","chrome,modal,dialog", params);

        if (params.host && params.port) {
            CrossfireModule.startServer(params.host, parseInt(params.port));
        }

    };

    Crossfire.stopServer = function() {
         if (FBTrace.DBG_CROSSFIRE)
             FBTrace.sysout("Crossfire.stopServer");

    };

    Crossfire.connect = function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("Crossfire.connect");
        var params = _getDialogParams(false);

        window.openDialog("chrome://crossfire/content/connect-dialog.xul", "crossfire-connect","chrome,modal,dialog", params);

        if (params.host && params.port) {
            CrossfireModule.connectClient(params.host, parseInt(params.port));
        }
    };

    Crossfire.disconnect = function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("Crossfire.disconnect");

        CrossfireModule.disconnect();
    };

    function _getDialogParams( isServer) {
        var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
        var host = commandLine.getHost();
        var port = commandLine.getPort();

        var title;
        if (isServer) {
            title = "Crossfire - Start Server";
        } else {
            title = "Crossfire - Connect to Server";
        }

        return { "host": null, "port": null, "title": title, "cli_host": host, "cli_port": port };
    }

    // generate a unique id for newly created context.
    function generateId() {
        return "xf"+CROSSFIRE_VERSION + "::" + (++CONTEXT_ID_SEED);
    }

//end FBL.ns()
}});
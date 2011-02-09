var FirebugLoadManager = function () {
    try
    {
        // Get ModuleLoader implementation (it's Mozilla JS code module)
        Components.utils["import"]("resource://firebug/moduleLoader.js");
        if (FBTrace.DBG_MODULES)
            FBTrace.sysout("Loaded ModuleLoader");
    }
    catch (exc)
    {
        var msg = exc.toString() +" "+(exc.fileName || exc.sourceName) + "@" + exc.lineNumber;
        if (FBTrace.DBG_MODULES)
        {
            dump("Import moduleLoader.js FAILS: "+msg+"\n");
            FBTrace.sysout("Import moduleLoader.js ERROR "+msg, exc);
        }
        Components.utils.reportError(msg);
        throw exc;
    }

    function preLoadInitialization()
    {
        // FIXME, create options.js as dependent of loader. Firebug.architecture = this.getPref(this.prefDomain, "architecture");
    }

    function getModuleLoaderScope()
    {
        var firebugScope = // pump the objects from this scope down into module loader
        {
            window : window,
            Firebug: Firebug,
            fbXPCOMUtils: fbXPCOMUtils,
            FBL: FBL,
            FirebugReps: FirebugReps,
            FBTrace: FBTrace,
            domplate: domplate,
            setTimeout: function(fn, delay) { return window.setTimeout(fn, delay); }, // bind window via closure
            clearTimeout: function(timeout) { return window.clearTimeout(timeout); }, // bind window via closure
            setInterval: function(fn, delay) { return window.setInterval(fn, delay); }, // bind window via closure
            clearInterval: function(timeout) { return window.clearInterval(timeout); }, // bind window via closure
        };
        return firebugScope;
    }

    function getModuleLoaderConfig()
    {
        var uid = Math.random();  // to give each XUL window its own loader (for now)
        var config = {
            context:"Firebug "+uid, // TODO XUL window id on FF4.0+
            baseUrl: "resource://firebugModules/",
            onDebug: function() {
                if (!this.FBTrace)
                {
                    // traceConsoleService is a global of |window| frome trace.js.
                    // on the first call we use it to get a ref to the Cu.import module object
                    this.FBTrace = traceConsoleService.getTracer("extensions.firebug");
                }
                this.FBTrace.sysout.apply(this.FBTrace,arguments);
            },
            onError: function()
            {
                Components.utils.reportError(arguments[0]);
                if (!this.FBTrace)
                {
                    // traceConsoleService is a global of |window| frome trace.js.
                    // on the first call we use it to get a ref to the Cu.import module object
                    this.FBTrace = traceConsoleService.getTracer("extensions.firebug");
                }
                this.FBTrace.sysout.apply(this.FBTrace,arguments);
            },
            waitSeconds: 0,
            debug: true,
            /* edit: function(errorMsg, errorURL, errorLineNumber)
            {
                window.alert(errorMsg+" "+errorURL+"@"+errorLineNumber);
            },
            edit: function(context, url, module)
            {
                FBTrace.sysout("opening window modal on "+url);
                var a = {url: url};
                return window.showModalDialog("chrome://firebug/content/external/editors.xul",{}, "resizable:yes;scroll:yes;dialogheight:480;dialogwidth:600;center:yes");
            }
            */
        };
        return config;
    }

    function createLoader()
    {
        preLoadInitialization();
        var firebugScope = getModuleLoaderScope();// pump the objects from this scope down into module loader
        var config = getModuleLoaderConfig();
        var loader = new ModuleLoader(firebugScope, config);
        return loader;
    }

    function loadCore(coreInitialize)
    {
        var loader = createLoader();
        var defaultPanels = // this will pull in all the rest of the code by dependencies
            [
             "tabContext.js",
             "sourceBox.js",
             "script.js",
            ];

        defaultPanels.push("debugger.js");

        loader.define(defaultPanels, coreInitialize);
    }

    return {loadCore: loadCore};
}();
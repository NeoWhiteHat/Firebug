var Firebug = Firebug || {};

Firebug.getModuleLoaderConfig = function(baseConfig)
{
    baseConfig = baseConfig || {};

    // Set configuration defaults.
    baseConfig.baseLoaderUrl = baseConfig.baseLoaderUrl || "resource://moduleLoader/";
    baseConfig.prefDomain = baseConfig.prefDomain || "extensions.firebug";
    baseConfig.arch = baseConfig.arch ||  "firebug_rjs/bti/inProcess";
    baseConfig.baseUrl = baseConfig.baseUrl || "resource://";
    baseConfig.paths = baseConfig.paths || {"arch": baseConfig.arch, "firebug": "firebug_rjs"};

    // to give each XUL window its own loader (for now)
    var uid = Math.random();

    var config =
    {
        context: "Firebug " + uid, // TODO XUL window id on FF4.0+
        baseUrl: baseConfig.baseUrl,
        paths: baseConfig.paths,
        modules: [
                  "firebug/trace/traceModule",
                  "firebug/chrome/navigationHistory",
                  "firebug/chrome/knownIssues",
                  "firebug/js/sourceFile",
                  "firebug/chrome/shortcuts",
                  "firebug/firefox/start-button/startButtonOverlay",
                  "firebug/editor/external/externalEditors",
                  "firebug/firefox/firebugMenu",
                  "firebug/chrome/panelActivation",
                  "firebug/console/memoryProfiler",
                  "firebug/chrome/tableRep",
                  "firebug/html/htmlPanel",
                  "firebug/console/commandLinePopup",
                  "firebug/accessible/a11y",
                  "firebug/js/scriptPanel",
                  "firebug/js/callstack",
                  "firebug/console/consoleInjector",
                  "firebug/net/spy",
                  "firebug/js/tabCache",
                  "firebug/chrome/activation",
                  "arch/tools",
                  ]
    };

    return config;
}

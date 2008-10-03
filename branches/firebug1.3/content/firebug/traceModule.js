/* See license.txt for terms of usage */

/**
 * UI control of debug Logging for Firebug internals
 */
FBL.ns(function() { with (FBL) {

// ***********************************************************************************
// Shorcuts and Services

const Cc = Components.classes;
const Ci = Components.interfaces;

const windowMediator = CCSV("@mozilla.org/appshell/window-mediator;1", "nsIWindowMediator");
const clipboard = CCSV("@mozilla.org/widget/clipboard;1", "nsIClipboard");

const PrefService = Cc["@mozilla.org/preferences-service;1"];
const prefs = PrefService.getService(Ci.nsIPrefBranch2);
const prefService = PrefService.getService(Ci.nsIPrefService);

const reDBG = /extensions\.([^\.]*)\.(DBG_.*)/;
const reDBG_FBS = /DBG_FBS_(.*)/;

var EOF = "<br/>";

// ***********************************************************************************
// Trace Module

Firebug.TraceModule = extend(Firebug.Module,
{
    listeners: [],

    initialize: function(prefDomain, prefNames)
    {
        FBTrace.DBG_OPTIONS = Firebug.getPref(prefDomain, "DBG_OPTIONS");

        if (FBTrace.DBG_OPTIONS)
            FBTrace.sysout("traceModule.initialize: " + prefDomain);

        this.prefDomain = prefDomain;

        // Create menu items for Trace Console 
        // (Open Console and a new option Always Open Console)
        this.initMenu();

        // Init option according to the pref domain.
        this.initDomainOptions(this.prefDomain);

        prefs.addObserver("extensions", this, false);

        // Open console automatically if the pref says so.
        if (Firebug.getPref(this.prefDomain, "alwaysOpenTraceConsole"))
            this.openConsole();
    },

    shutdown: function()
    {
        prefs.removeObserver("extensions", this, false);

        if (this.consoleWindow)
            this.consoleWindow.TraceConsole.unregisterModule(this);
    },

    initMenu: function()
    {
        // Create menu item "Open Firebug Tracing" within Firebug menu (the bug-menu on FB bar).
        var popupMenu = $("fbFirebugMenuPopup");
        this.createOpenTracingMenu(popupMenu);

        // Create menu item "Open Firebug Tracing" within Firefox Tools menu.
        var toolsMenu = $("menu_firebug");
        if (toolsMenu)  // then we are in Firefox not eg Chromebug
            this.createOpenTracingMenu(toolsMenu.menupopup);

        // Create new option "Always Open Firebug Tracing" item within Firebug options menu.
        var optionsMenu = $("FirebugMenu_OptionsPopup");
        this.createAlwaysOpenTracingMenu(optionsMenu);
    },

    reattachContext: function(browser, context) 
    {
        if (FBTrace.DBG_OPTIONS)
            FBTrace.sysout("traceModule.reattachContext for: " + 
                context ? context.window.location.href : "null context",
                [browser, context]);

        // Create proper menu items for Firebug Tracing window in the new Firebug window.
        var viewMenu = browser.chrome.$("view-menu");
        this.createOpenTracingMenu(viewMenu.menupopup);

        var optionsMenu = browser.chrome.$("FirebugMenu_OptionsPopup");
        this.createAlwaysOpenTracingMenu(optionsMenu);
    },

    createOpenTracingMenu: function(parentMenu)
    {
        if (!parentMenu)
            return;

        var doc = parentMenu.ownerDocument;
        var menuItem = doc.createElement("menuitem");
        menuItem.setAttribute("label", "Open Firebug Tracing"); // xxxHonza localization
        menuItem.setAttribute("oncommand", "Firebug.TraceModule.openConsole()");
        var firstItem = parentMenu.firstChild;
        parentMenu.insertBefore(menuItem, firstItem);
        parentMenu.insertBefore(document.createElement("menuseparator"), firstItem);
    },

    createAlwaysOpenTracingMenu: function(parentMenu)
    {
        if (!parentMenu)
            return;

        var menuItemId = "FirebugMenu_Options_alwaysOpenTraceConsole";
        var doc = parentMenu.ownerDocument;
        if ($(menuItemId, doc))
            return;

        var menuItem = doc.createElement("menuitem");
        menuItem.setAttribute("id", menuItemId);
        menuItem.setAttribute("label", "Always Open Firebug Tracing"); // xxxHonza localization
        menuItem.setAttribute("type", "checkbox");
        menuItem.setAttribute("oncommand", "FirebugChrome.onToggleOption(this)");
        menuItem.setAttribute("option", "alwaysOpenTraceConsole");
        parentMenu.appendChild(document.createElement("menuseparator"));
        parentMenu.appendChild(menuItem);
    },

    // nsIObserver
    observe: function(subject, topic, data)
    {
        if (topic == "nsPref:changed")
        {
            var m = reDBG.exec(data);
            if (m)
            {
                var prefDomain = "extensions." + m[1];
                if (prefDomain == this.prefDomain) {
                    var optionName = data.substr(data.lastIndexOf(".")+1);
                    FBTrace[optionName] = Firebug.getPref(prefDomain, m[2]);
                }
            }
            else
            {
                if (FBTrace.DBG_OPTIONS) 
                    FBTrace.sysout("traceModule.observe : "+data+"\n");
            }
        }
    },

    initDomainOptions: function(prefDomain)
    {
        if (FBTrace.DBG_OPTIONS)
            FBTrace.sysout("TraceModule.initialize prefDomain="+prefDomain+"\n");

        for (var p in FBTrace)
        {
            var f = reDBG_FBS.exec(p);
            if (f)
            {
                FBTrace[p] = Firebug.getPref("extensions.firebug-service", p);
                if (FBTrace.DBG_OPTIONS)
                    FBTrace.sysout("TraceModule.initialize extensions.firebug-service."+p+"="+FBTrace[p]+"\n");
            }
            else
            {
                var m = p.indexOf("DBG_");
                if (m != -1)
                    FBTrace[p] = Firebug.getPref(prefDomain, p); // set to 'true' to turn on all traces;
                if (FBTrace.DBG_OPTIONS && m)
                    FBTrace.sysout("TraceModule.initialize "+prefDomain+"."+p+"="+FBTrace[p]+"\n");
            }
        }
        prefs.setBoolPref("browser.dom.window.dump.enabled", true);
        prefs.addObserver("extensions", this, false);
    },

    getOptionsMenuItems: function()
    {
        var items = [];
        for (p in FBTrace) 
        {
            var m = p.indexOf("DBG_");
            if (m == -1)
                continue;

            var label = p.substr(4);
            items.push({
                label: label,
                nol10n: true,
                type: "checkbox",
                checked: FBTrace[p],
                pref: p,
                command: this.setOption
            });
        }

        items.sort(function(a, b) {
            return a.label > b.label;
        });

        return items;
    },

    setOption: function(event)
    {
        var menuitem = event.target.wrappedJSObject;
        var label = menuitem.getAttribute("label");
        var category = 'DBG_'+label;
        FBTrace[category] = !FBTrace[category];

        if (FBTrace[category])
            menuitem.setAttribute("checked", "true");
        else
            menuitem.removeAttribute("checked");

        if (FBTrace.DBG_OPTIONS) 
            FBTrace.sysout("traceConsole.setOption: " + category + ", " + 
                FBTrace[category], menuitem);

        var prefDomain;
        if (category.indexOf("_FBS_") == -1)
        {
            prefDomain = Firebug.prefDomain;
            Firebug.setPref(prefDomain, category, FBTrace[category] );
            prefService.savePrefFile(null);
        }
        else
        {
            prefDomain = "extensions.firebug-service";
            prefs.setBoolPref(prefDomain+"."+category, FBTrace[category]);
            prefService.savePrefFile(null);
        }

        if (FBTrace.DBG_OPTIONS)
            FBTrace.sysout("traceConsole.setOption: "+prefDomain+"."+category+ " = " + FBTrace[category] + "\n");
    },

    openConsole: function()
    {
        this.consoleWindow = windowMediator.getMostRecentWindow(
            "FBTraceConsole." + this.prefDomain);

        // Try to connect an existing trace-console window first.
        if (this.consoleWindow) {
            this.consoleWindow.TraceConsole.registerModule(this);
            this.consoleWindow.focus();
            return;
        }

        if (FBTrace.DBG_OPTIONS)
            FBTrace.sysout("traceModule.openConsole, prefDomain: " + this.prefDomain);

        var self = this;
        var args = {
            FBL: FBL,
            Firebug: Firebug,
            traceModule: self,
            prefDomain: this.prefDomain,
        };

        if (FBTrace.DBG_OPTIONS) {
            for (var p in args)
                FBTrace.sysout("tracePanel.openConsole prefDomain:" +
                    this.prefDomain +" args["+p+"]= "+ args[p]+"\n");
        }

        this.consoleWindow = window.openDialog(
            "chrome://firebug/content/traceConsole.xul",
            "FBTraceConsole." + this.prefDomain,
            "chrome,resizable,scrollbars=auto,minimizable",
            args);
    },

    // Trace console listeners
    onLoadConsole: function(win, rootNode)
    {
        try
        {
            for (var i=0; i<this.listeners.length; i++) {
                if (this.listeners[i].onLoadConsole)
                    this.listeners[i].onLoadConsole(win, rootNode);
            }
        }
        catch (err)
        {
            if (FBTrace.DBG_ERRORS || DBG_OPTIONS)
                FBTrace.sysout("traceModule.onLoadConsole EXCEPTION", err);
        }
    },

    onUnloadConsole: function(win)
    {
        try
        {
            for (var i=0; i<this.listeners.length; i++) {
                if (this.listeners[i].onUnloadConsole)
                    this.listeners[i].onUnloadConsole(win);
            }
        }
        catch (err)
        {
            if (FBTrace.DBG_ERRORS || DBG_OPTIONS)
                FBTrace.sysout("traceModule.onUnloadConsole EXCEPTION", err);
        }
    },

    onDump: function(message)
    {
        try
        {
            for (var i=0; i<this.listeners.length; i++) {
                if (this.listeners[i].onDump)
                    this.listeners[i].onDump(message);
            }
        }
        catch (err)
        {
            if (FBTrace.DBG_ERRORS || DBG_OPTIONS)
                FBTrace.sysout("traceModule.onDump EXCEPTION", err);
        }
    },

    addListener: function(listener)
    {
        this.listeners.push(listener);
    },

    removeListener: function()
    {
        remove(this.listeners, listener);
    }
});

// ************************************************************************************************
// Trace Console Rep

Firebug.TraceModule.PanelTemplate = domplate({

    tag:
        TABLE({class: "traceTable", cellpadding: 0, cellspacing: 0},
            TBODY(
                TR({class: "traceInfoRow"},
                    TD({class: "traceInfoCol"},
                        DIV({class: "traceInfoBody"},
                            DIV({class: "traceInfoTabs"},
                                A({class: "traceInfoLogsTab traceInfoTab", onclick: "$onClickTab",
                                    view: "Logs"},
                                    "Logs" //xxxHonza localization
                                ),
                                A({class: "traceInfoOptionsTab traceInfoTab", onclick: "$onClickTab",
                                    view: "Options"},
                                    "Options"  //xxxHonza localization
                                )
                            ),
                            DIV({class: "traceInfoLogsText traceInfoText"}),
                            DIV({class: "traceInfoOptionsText traceInfoText"})
                        )
                    )
                )
            )
        ),

    onClickTab: function(event)
    {
        this.selectTab(event.currentTarget);
    },

    selectTabByName: function(parentNode, tabName)
    {
        var tab = getElementByClass(parentNode, "traceInfo" + tabName + "Tab");
        if (tab)
            this.selectTab(tab);
    },

    selectTab: function(tab)
    {
        var messageInfoBody = tab.parentNode.parentNode;

        var view = tab.getAttribute("view");
        if (messageInfoBody.selectedTab)
        {
            messageInfoBody.selectedTab.removeAttribute("selected");
            messageInfoBody.selectedText.removeAttribute("selected");
        }

        var textBodyName = "traceInfo" + view + "Text";

        messageInfoBody.selectedTab = tab;
        messageInfoBody.selectedText = getChildByClass(messageInfoBody, textBodyName);

        messageInfoBody.selectedTab.setAttribute("selected", "true");
        messageInfoBody.selectedText.setAttribute("selected", "true");
    }
});

// ************************************************************************************************
// Trace message 

Firebug.TraceModule.MessageTemplate = domplate(Firebug.Rep,
{
    inspectable: false,

    tableTag:
        TABLE({class: "messageTable", cellpadding: 0, cellspacing: 0},
            TBODY()
        ),

    rowTag:
        TR({class: "messageRow $message|getMessageType",
            _repObject: "$message",
            $exception: "$message|isException",
            onclick: "$onClickRow"},
            TD({class: "messageNameCol messageCol"},
                DIV({class: "messageNameLabel messageLabel"},
                    "$message|getMessageIndex")
            ),
            TD({class: "messageCol"},
                DIV({class: "messageLabel", title: "$message|getMessageTitle"},
                    "$message|getMessageLabel")
            )
        ),

    separatorTag:
        TR({class: "messageRow separatorRow"},
            TD({class: "messageCol", colspan: "2"},
                DIV("$message|getMessageIndex")
            )
        ),

    bodyRow:
        TR({class: "messageInfoRow"},
            TD({class: "messageInfoCol", colspan: 8})
        ),

    bodyTag:
        DIV({class: "messageInfoBody", _repObject: "$message"},
            DIV({class: "messageInfoTabs"},
                A({class: "messageInfoStackTab messageInfoTab", onclick: "$onClickTab",
                    view: "Stack"},
                    "Stack"
                ),
                A({class: "messageInfoExcTab messageInfoTab", onclick: "$onClickTab",
                    view: "Exc",
                    $collapsed: "$message|hideException"},
                    "Exception"
                ),
                A({class: "messageInfoPropsTab messageInfoTab", onclick: "$onClickTab",
                    view: "Props",
                    $collapsed: "$message|hideProperties"},
                    "Properties"
                ),
                A({class: "messageInfoScopeTab messageInfoTab", onclick: "$onClickTab",
                    view: "Scope",
                    $collapsed: "$message|hideScope"},
                    "Scope"
                ),
                A({class: "messageInfoResponseTab messageInfoTab", onclick: "$onClickTab",
                    view: "Response",
                    $collapsed: "$message|hideResponse"},
                    "Response"
                ),
                A({class: "messageInfoSourceTab messageInfoTab", onclick: "$onClickTab",
                    view: "Source",
                    $collapsed: "$message|hideSource"},
                    "Source"
                ),
                A({class: "messageInfoIfacesTab messageInfoTab", onclick: "$onClickTab",
                    view: "Ifaces",
                    $collapsed: "$message|hideInterfaces"},
                    "Interfaces"
                ),
                // xxxHonza: this doesn't seem to be much useful.
                /*A({class: "messageInfoTypesTab messageInfoTab", onclick: "$onClickTab",
                    view: "Types",
                    $collapsed: "$message|hideTypes"},
                    "Types"
                ),*/
                A({class: "messageInfoObjectTab messageInfoTab", onclick: "$onClickTab",
                    view: "Types",
                    $collapsed: "$message|hideObject"},
                    "Object"
                ),
                A({class: "messageInfoEventTab messageInfoTab", onclick: "$onClickTab",
                    view: "Event",
                    $collapsed: "$message|hideEvent"},
                    "Event"
                )
            ),
            DIV({class: "messageInfoStackText messageInfoText"},
                TABLE({class: "messageInfoStackTable", cellpadding: 0, cellspacing: 0},
                    TBODY(
                        FOR("stack", "$message|stackIterator",
                            TR(
                                TD({class: "stackFrame"},
                                    A({class: "stackFrameLink", onclick: "$onClickStackFrame",
                                        lineNumber: "$stack.lineNumber"},
                                        "$stack.fileName"),
                                    SPAN("&nbsp;"),
                                    SPAN("(", "$stack.lineNumber", ")"),
                                    SPAN("&nbsp;"),
                                    A({class: "openDebugger", onclick: "$onOpenDebugger",
                                        lineNumber: "$stack.lineNumber",
                                        fileName: "$stack.fileName"},
                                        "[...]")
                                )
                            )
                        )
                    )
                )
            ),
            DIV({class: "messageInfoExcText messageInfoText"}),
            DIV({class: "messageInfoPropsText messageInfoText"}),
            DIV({class: "messageInfoResponseText messageInfoText"},
                IFRAME({class: "messageInfoResponseFrame"})
            ),
            DIV({class: "messageInfoSourceText messageInfoText"}),
            DIV({class: "messageInfoIfacesText messageInfoText"}),
            DIV({class: "messageInfoScopeText messageInfoText"}),
            DIV({class: "messageInfoTypesText messageInfoText"}),
            DIV({class: "messageInfoObjectText messageInfoText"}),
            DIV({class: "messageInfoEventText messageInfoText"})
        ),

    // Data providers
    getMessageType: function(message)
    {
        return message.getType();
    },

    getMessageIndex: function(message)
    {
        return message.index + 1;
    },

    getMessageLabel: function(message)
    {
        var maxLength = Firebug.getPref(Firebug.TraceModule.prefDomain, 
            "trace.maxMessageLength");
        return message.getLabel(maxLength);
    },

    getMessageTitle: function(message)
    {
        return message.getLabel(-1);
    },

    isException: function(message)
    {
        return message.getException();
    },

    hideProperties: function(message)
    {
        return !message.getProperties();
    },

    hideScope: function(message)
    {
        return !message.getScope();
    },

    hideInterfaces: function(message)
    {
        return !message.getInterfaces();
    },

    hideTypes: function(message)
    {
        return !message.getTypes();
    },

    hideObject: function(message)
    {
        return !message.getObject();
    },

    hideEvent: function(message)
    {
        return !message.getEvent();
    },

    hideException: function(message)
    {
        return !message.getException();
    },

    hideResponse: function(message)
    {
        return !(message.obj instanceof Ci.nsIHttpChannel);
    },

    hideSource: function(message)
    {
        return !(message.obj instanceof Ci.nsIHttpChannel);
    },

    // Stack frame support
    stackIterator: function(message)
    {
        return message.getStackArray();
    },

    onClickStackFrame: function(event)
    {
        var winType = "FBTraceConsole-SourceView";
        var url = event.target.innerHTML;
        var lineNumber = event.target.getAttribute("lineNumber");

        openDialog("chrome://global/content/viewSource.xul",
            winType, "all,dialog=no",
            event.target.innerHTML, null, null, lineNumber, false);
    },

    onOpenDebugger: function(event)
    {
        var target = event.target;
        var lineNumber = target.getAttribute("lineNumber");
        var fileName = target.getAttribute("fileName");

        if (typeof(ChromeBugOpener) == "undefined")
            return;

        // Open Chromebug window.
        var cbWindow = ChromeBugOpener.openNow();
        FBTrace.dumpProperties("Chromebug window has been opened", cbWindow);

        // xxxHonza: Open Chromebug with the source code file, scrolled automatically
        // to the specified line number. Currently chrome bug doesn't return the window
        // from ChromeBugOpener.openNow method. If it would be following code opens
        // the source code file and scrolls to the given line.

        // Register onLoad listener and open the source file at the specified line.
        if (cbWindow) {
            cbWindow.addEventListener("load", function() {
                var context = cbWindow.FirebugContext;
                var link = new cbWindow.FBL.SourceLink(fileName, lineNumber, "js");
                context.chrome.select(link, "script");
            }, true);
        }
    },

    // Firebug rep support
    supportsObject: function(message, type)
    {
        return message instanceof Firebug.TraceModule.TraceMessage;
    },

    browseObject: function(message, context)
    {
        return false;
    },

    getRealObject: function(message, context)
    {
        return message;
    },

    // Context menu
    getContextMenuItems: function(message, target, context)
    {
        var items = [];

        if (getAncestorByClass(target, "messageRow"))
        {
            items.push({
              label: "Cut",   //xxxHonza localization
              nol10n: true,
              command: bindFixed(this.onCutMessage, this, message)
            });

            items.push({
              label: "Copy",  //xxxHonza localization
              nol10n: true,
              command: bindFixed(this.onCopyMessage, this, message)
            });

            items.push("-");

            items.push({
              label: "Remove",  //xxxHonza localization
              nol10n: true,
              command: bindFixed(this.onRemoveMessage, this, message)
            });
        }

        if (getAncestorByClass(target, "messageInfoStackText"))
        {
            items.push({
              label: "Copy Stack",  //xxxHonza localization
              nol10n: true,
              command: bindFixed(this.onCopyStack, this, message)
            });
        }

        if (getAncestorByClass(target, "messageInfoExcText"))
        {
            items.push({
              label: "Copy Exception",  //xxxHonza localization
              nol10n: true,
              command: bindFixed(this.onCopyException, this, message)
            });
        }

        if (items.length > 0)
            items.push("-");

        items.push(this.optionMenu("Show Scope Variables", "trace.enableScope"));

        return items;
    },

    optionMenu: function(label, option)
    {
        var checked = Firebug.getPref(Firebug.TraceModule.prefDomain, option);
        return {label: label, type: "checkbox", checked: checked, nol10n: true,
            command: bindFixed(Firebug.setPref, Firebug, Firebug.TraceModule.prefDomain,
                option, !checked) };
    },

    getTooltip: function(message)
    {
        return message.text;
    },

    // Context menu commands
    onCutMessage: function(message)
    {
        this.onCopyMessage(message);
        this.onRemoveMessage(message);
    },

    onCopyMessage: function(message)
    {
        copyToClipboard(message.text);
    },

    onRemoveMessage: function(message)
    {
        var parentNode = message.row.parentNode;
        parentNode.removeChild(message.row);
    },

    onCopyStack: function(message)
    {
        copyToClipboard(message.getStack());
    },

    onCopyException: function(message)
    {
        copyToClipboard(message.getException());
    },

    // Clipboard helpers
    copyToClipboard: function(text)
    {
        if (!text)
            return;

        // Initialize transfer data.
        var trans = CCIN("@mozilla.org/widget/transferable;1", "nsITransferable");
        var wrapper = CCIN("@mozilla.org/supports-string;1", "nsISupportsString");
        wrapper.data = text;
        trans.addDataFlavor("text/unicode");
        trans.setTransferData("text/unicode", wrapper, text.length * 2);

        // Set the data into the global clipboard
        clipboard.setData(trans, null, Ci.nsIClipboard.kGlobalClipboard);
    },

    // Implementation
    createTable: function(parentNode)
    {
        return HelperDomplate.replace(this.tableTag, {}, parentNode, this);
    },

    dump: function(message, parentNode)
    {
        var panelNode = parentNode.parentNode.parentNode;
        var scrolledToBottom = isScrolledToBottom(panelNode);

        // Set message index
        message.index = parentNode.childNodes.length;

        // Insert log into the console.
        var row = HelperDomplate.insertRows(this.rowTag, {message: message},
            parentNode, this)[0];

        message.row = row;

        // Only if the manifest uses useNativeWrappers=no.
        // The row in embedded frame, which uses type="content-primary", from some
        // reason, this conten type changes wrapper around the row, so let's set
        // directly thte wrappedJSObject here, so row-expand works.
        if (row.wrappedJSObject)
            row.wrappedJSObject.repObject = message;

        if (scrolledToBottom)
            scrollToBottom(panelNode);
    },

    dumpSeparator: function(parentNode)
    {
        var panelNode = parentNode.parentNode.parentNode;
        var scrolledToBottom = isScrolledToBottom(panelNode);

        var fakeMessage = {};
        fakeMessage.index = parentNode.childNodes.length;

        var row = HelperDomplate.insertRows(this.separatorTag, {message: fakeMessage},
            parentNode, this)[0];

        if (scrolledToBottom)
            scrollToBottom(panelNode);

        panelNode.scrollTop = panelNode.scrollHeight - panelNode.offsetHeight + 50;
    },

    // Body of the message.
    onClickRow: function(event)
    {
        if (isLeftClick(event))
        {
            var row = getAncestorByClass(event.target, "messageRow");
            if (row)
            {
                this.toggleRow(row);
                cancelEvent(event);
            }
        }
    },

    toggleRow: function(row, forceOpen)
    {
        var opened = hasClass(row, "opened");
        if (opened && forceOpen)
            return;

        toggleClass(row, "opened");

        if (hasClass(row, "opened"))
        {
            var message = row.repObject;
            if (!message && row.wrappedJSObject)
                message = row.wrappedJSObject.repObject;

            var bodyRow = HelperDomplate.insertRows(this.bodyRow, {}, row)[0];
            var messageInfo = HelperDomplate.replace(this.bodyTag,
                {message: message}, bodyRow.firstChild);
            message.bodyRow = bodyRow;


            this.selectTabByName(messageInfo, "Stack");
        }
        else
        {
            row.parentNode.removeChild(row.nextSibling);
        }
    },

    selectTabByName: function(messageInfoBody, tabName)
    {
        var tab = getChildByClass(messageInfoBody, "messageInfoTabs",
            "messageInfo" + tabName + "Tab");
        if (tab)
            this.selectTab(tab);
    },

    onClickTab: function(event)
    {
        this.selectTab(event.currentTarget);
    },

    selectTab: function(tab)
    {
        var messageInfoBody = tab.parentNode.parentNode;

        var view = tab.getAttribute("view");
        if (messageInfoBody.selectedTab)
        {
            messageInfoBody.selectedTab.removeAttribute("selected");
            messageInfoBody.selectedText.removeAttribute("selected");
        }

        var textBodyName = "messageInfo" + view + "Text";

        messageInfoBody.selectedTab = tab;
        messageInfoBody.selectedText = getChildByClass(messageInfoBody, textBodyName);

        messageInfoBody.selectedTab.setAttribute("selected", "true");
        messageInfoBody.selectedText.setAttribute("selected", "true");

        var message = Firebug.getRepObject(messageInfoBody);

        // Make sure the original Domplate is *not* tracing for now.
        var dumpDOM = FBTrace.DBG_DOM;
        FBTrace.DBG_DOM = false;
        this.updateInfo(messageInfoBody, view, message);
        FBTrace.DBG_DOM = dumpDOM;
    },

    updateInfo: function(messageInfoBody, view, message)
    {
        var tab = messageInfoBody.selectedTab;
        if (hasClass(tab, "messageInfoStackTab"))
        {
            // The content is generated by domplate template.
        }
        else if (hasClass(tab, "messageInfoPropsTab"))
        {
            this.updateInfoImpl(messageInfoBody, view, message, message.getProperties);
        }
        else if (hasClass(tab, "messageInfoScopeTab"))
        {
            this.updateInfoImpl(messageInfoBody, view, message, message.getScope,
                function (message, valueBox, text) {
                    Firebug.TraceModule.PropertyTree.tag.replace({object: message.scope}, valueBox);
                });
        }
        else if (hasClass(tab, "messageInfoIfacesTab"))
        {
            this.updateInfoImpl(messageInfoBody, view, message, message.getInterfaces);
        }
        else if (hasClass(tab, "messageInfoTypesTab"))
        {
            this.updateInfoImpl(messageInfoBody, view, message, message.getTypes);
        }
        else if (hasClass(tab, "messageInfoEventTab"))
        {
            this.updateInfoImpl(messageInfoBody, view, message, message.getEvent);
        }
        else if (hasClass(tab, "messageInfoObjectTab"))
        {
            this.updateInfoImpl(messageInfoBody, view, message, message.getProperties,
                function (message, valueBox, text) {
                    if (message.obj instanceof Element)
                        Firebug.HTMLPanel.CompleteElement.tag.replace({object: message.obj}, valueBox);
                    else
                        Firebug.TraceModule.PropertyTree.tag.replace({object: message.obj}, valueBox);
                });
        }
        else if (hasClass(tab, "messageInfoExcTab"))
        {
            this.updateInfoImpl(messageInfoBody, view, message, message.getException);
        }
        else if (hasClass(tab, "messageInfoResponseTab"))
        {
            this.updateInfoImpl(messageInfoBody, view, message, message.getResponse,
                function (message, valueBox, text) {
                    var iframe = getChildByClass(valueBox, "messageInfoResponseFrame");
                    iframe.contentWindow.document.body.innerHTML = text;
                });
        }
        else if (hasClass(tab, "messageInfoSourceTab"))
        {
            this.updateInfoImpl(messageInfoBody, view, message, message.getResponse,
                function (message, valueBox, text) {
                    if (text)
                        insertWrappedText(text, valueBox);
                });
        }
    },

    updateInfoImpl: function(messageInfoBody, view, message, getter, setter)
    {
        var valueBox = getChildByClass(messageInfoBody, "messageInfo" + view + "Text");
        if (!valueBox.valuePresented)
        {
            var text = getter.apply(message);
            if (typeof(text) != "undefined")
            {
                valueBox.valuePresented = true;

                if (setter)
                    setter(message, valueBox, text);
                else
                    valueBox.innerHTML = text;
            }
        }
    }
});

// ************************************************************************************************
// Helper Domplate object that doesn't trace.

var HelperDomplate = (function()
{
    // Private helper function.
    function execute()
    {
        var args = cloneArray(arguments), fn = args.shift(), object = args.shift();

        // Make sure the original Domplate is *not* tracing for now.
        if (typeof FBTrace != "undefined") {
            var dumpDOM = FBTrace.DBG_DOM;
            FBTrace.DBG_DOM = false;
        }

        var retValue = fn.apply(object, args);

        if (typeof FBTrace != "undefined")
            FBTrace.DBG_DOM = dumpDOM;

        return retValue;
    }

    return {
        insertRows: function(tag, args, parentNode, self)
        {
            return execute(tag.insertRows, tag, args, parentNode, self);
        },

        replace: function(tag, args, parentNode, self)
        {
            return execute(tag.replace, tag, args, parentNode, self);
        }
   }
}());

// ************************************************************************************************
// Trace Message Object

Firebug.TraceModule.TraceMessage = function(type, text, obj)
{
    this.type = type;
    this.text = text;
    this.obj = obj;
    this.stack = [];

    if (this.obj instanceof Ci.nsIScriptError)
    {
        var trace = Firebug.errorStackTrace;
        if (trace)
        {
            trace = Firebug.Errors.correctLineNumbersWithStack(trace, obj) ? trace : null;
            this.stack = trace;
        }
        else  // Put info about the script error location into the stack.
            this.stack.push({fileName:this.obj.sourceName, lineNumber:this.obj.lineNumber});
    }
    else
    {
        // Initialize stack trace info. This must be done now, when the stack
        // is available.
        for (var frame = Components.stack, i=0; frame; frame = frame.caller, i++)
        {
            // Skip first three frames (this code).
            if (i < 6)
                continue;

            var fileName = unescape(frame.filename ? frame.filename : "");
            var sourceLine = frame.sourceLine ? frame.sourceLine : "";
            var lineNumber = frame.lineNumber ? frame.lineNumber : "";
            this.stack.push({fileName:fileName, lineNumber:lineNumber});
        }
    }

    if (this.obj instanceof Ci.nsIHttpChannel)
    {
        //firebug.netModule.getHttpHeaders(this.obj, this);
    }

    if (this.obj instanceof Ci.nsICachingChannel)
    {
        try
        {
            var cacheToken = this.obj.cacheToken;
            if (cacheToken instanceof Ci.nsICacheEntryDescriptor)
            {
                this.cacheClient = cacheToken.clientID;
                this.cacheKey = cacheToken.key;
            }
        }
        catch (e)
        {
        }
    }

    if (this.obj instanceof Error || 
        this.obj instanceof Ci.nsIException || 
        this.obj instanceof Ci.nsIScriptError)
    {
        // Put the error message into the title so, it's immediately visible.
        this.text += " " + this.obj.message;
    }

    // Get snapshot of all properties now, as they can be changed.
    this.getProperties();

    // Get current scope
    this.getScope();
}

// ************************************************************************************************

Firebug.TraceModule.TraceMessage.prototype =
{
    reXPConnect: /\[xpconnect wrapped ([^\]]*)\]/,

    getType: function()
    {
        return this.type;
    },

    getLabel: function(maxLength)
    {
        if (maxLength <= 10 || this.text.length <= maxLength)
            return this.text.replace(/[\n]/g,"");

        return this.text.substr(0, maxLength - 3) + "...";
    },

    getStackArray: function()
    {
        return this.stack;
    },

    getStack: function()
    {
        var result = "";
        for (var i=0; i<this.stack.length; i++) {
            var frame = this.stack[i];
            result += frame.fileName + " (" + frame.lineNumber + ")\n";
        }

        return result;
    },

    getProperties: function()
    {
        if (this.props)
            return this.props;

        this.props = "";

        if (this.obj instanceof Array)
        {
            if (this.obj.length)
            {
                for (var p=0; p<this.obj.length; p++)
                {
                    try
                    {
                        this.props += "[" + p + "] = " + this.obj[p] + EOF;
                    }
                    catch (e)
                    {
                        alert(e);
                    }
                }
            }
            else
            {
                for (var p in this.obj)
                {
                    try
                    {
                        this.props += "[" + p + "] = ";

                        this.props += "{";
                        var subobj = this.obj[p];
                        for (var p1 in subobj)
                            this.props += "'" + p1 + "': " + subobj[p1] + ", ";
                        this.props += "}" + EOF;
                    }
                    catch (e)
                    {
                        alert(e);
                    }
                }
            }
        }
        else if (typeof(this.obj) == 'string')
        {
            this.props = this.obj + EOF;
        }
        else if (this.obj instanceof Ci.jsdIValue)
        {
            var listValue = {value: null}, lengthValue = {value: 0};
            this.obj.getProperties(listValue, lengthValue);
            for (var i = 0; i < lengthValue.value; ++i)
            {
                var prop = listValue.value[i];
                try {
                    var name = prop.name.getWrappedValue();
                    this.props += "[" + name + "] = " + prop.value.getWrappedValue() + EOF;
                } catch (e) {
                    alert(e);
                }
            }
        }
        else if (this.obj instanceof Ci.nsISupportsCString)
        {
            this.props = this.obj.data;
        }
        else
        {
            var propsTotal = 0;
            for (var p in this.obj)
            {
                propsTotal++;
                try
                {
                    var pAsString = p + "";
                    var m = this.reXPConnect.exec(pAsString);
                    if (m)
                    {
                        var kind = m[1];
                        if (!this.obj[p] instanceof Ci[kind])
                        {
                            var xpobj = this.obj[p].wrappedJSObject;
                            this.props += "[" + p + "] = " + xpobj + EOF;
                        }
                    }
                    this.props += "[" + p + "] = " + this.obj[p] + EOF;
                }
                catch (e)
                {
                }
            }
        }

        return this.props;
    },

    getInterfaces: function()
    {
        if (this.ifaces)
            return this.ifaces;

        this.ifaces = "";
        for (iface in Components.interfaces)
        {
            if (this.obj instanceof Components.interfaces[iface]) {
                for (p in Components.interfaces[iface])
                    this.ifaces += "[" + iface + "." + p + "]=" + this.obj[p] + EOF;
            }
        }

        return this.ifaces;
    },

   getScope: function()
   {
       if (!Firebug.getPref(Firebug.prefDomain, "trace.enableScope"))
           return null;

       if (this.scope)
           return this.scope;

       var scope = {};
       Firebug.Debugger.halt(function(frame)
       {
           for (var i=0; i<4 && frame; i++)
               frame = frame.callingFrame;

           if (frame)
           {
               var listValue = {value: null}, lengthValue = {value: 0};
               frame.scope.getProperties(listValue, lengthValue);

               for (var i=lengthValue.value-1; i>=0; i--)
               {
                   var prop = listValue.value[i];
                   var name = prop.name.getWrappedValue();
                   var value = prop.value.getWrappedValue();

                   if ((typeof(value) != "function") && name && value)
                       scope[name.toString()] = value.toString();
               }
           }
       });

       return this.scope = scope;
   },

    getResponse: function()
    {
        var result = null;
        try
        {
            var self = this;
            TabWatcher.iterateContexts(function(context) {
                var url = self.obj.originalURI.spec;
                result = context.sourceCache.loadText(url);
                if (result)
                    throw "OK"; // Break the cycle if the response is there.
            });
        }
        catch (err)
        {
        }

        return result;
    },

    getException: function()
    {
        if (this.err)
            return this.err;

        this.err = "";

        if (this.obj && this.obj.message)
            return this.obj.message;

        // xxxJJB: this isn't needed, instanceof does QI. try {this.obj = this.obj.QueryInterface(Ci.nsIException);} catch (err){}
        if (!this.obj)
            return null;

        if (this.obj instanceof Error || this.obj instanceof Ci.nsIException)
        {
            try
            {
                this.err += "<span class='ExceptionMessage'>" + this.obj.message + "</span>" + EOF;
                this.err += this.obj.name + EOF;
                this.err += this.obj.fileName + "(" + this.obj.lineNumber+ ")" + EOF;
            }
            catch (err)
            {
                alert(e);
            }
        }

        return this.err;
    },

    getTypes: function()
    {
        if (this.types)
            return this.types;

        this.types = "";

        try {
            var obj = this.obj;
            while (obj)
            {
                this.types += "typeof = " + typeof(obj) + EOF;
                if (obj)
                    this.types += "    constructor = " + obj.constructor + EOF;

                obj = obj.prototype;
            }
        }
        catch (e)
        {
            alert(e);
        }

        return this.types;
    },

    getEvent: function()
    {
        if (!(this.obj instanceof Event))
            return;

        if (this.eventInfo)
            return this.eventInfo;

        this.eventInfo = "";

        try
        {
            if (this.obj.eventPhase == this.obj.AT_TARGET)
                this.eventInfo += " at target ";
            else if (this.obj.eventPhase == this.obj.BUBBLING_PHASE)
                this.eventInfo += " bubbling phase ";
            else
                this.eventInfo += " capturing phase ";

            if (this.obj.relatedTarget)
                this.eventInfo += this.obj.relatedTarget.tagName + "->";

            if (this.obj.currentTarget)
            {
                if (this.obj.currentTarget.tagName)
                    this.eventInfo += this.obj.currentTarget.tagName + "->";
                else
                    this.eventInfo += this.obj.currentTarget.nodeName + "->";
            }

            this.eventInfo += this.obj.target.tagName;
        }
        catch (err)
        {
            alert(err);
        }

        return this.eventInfo;
    },

    getObject: function()
    {
        return this.obj;
    }
}

// ************************************************************************************************
// Domplate helpers - Tree (domplate widget)

/**
 * This object is intended as a domplate widget for displaying hierarchical
 * structure (tree). Specific tree should be derived from this object and
 * getMembers method should be implemented.
 */
Firebug.TraceModule.Tree = domplate(Firebug.Rep,
{
    tag:
        TABLE({class: "domTable", cellpadding: 0, cellspacing: 0, onclick: "$onClick"},
            TBODY(
                FOR("member", "$object|memberIterator",
                    TAG("$member|getRowTag", {member: "$member"}))
            )
        ),

    rowTag:
        TR({class: "memberRow $member.open $member.type\\Row", $hasChildren: "$member.hasChildren",
            _repObject: "$member", level: "$member.level"},
            TD({class: "memberLabelCell", style: "padding-left: $member.indent\\px"},
                DIV({class: "memberLabel $member.type\\Label"}, "$member.name")
            ),
            TD({class: "memberValueCell"},
                TAG("$member.tag", {object: "$member.value"})
            )
        ),

    loop:
        FOR("member", "$members",
            TAG("$member|getRowTag", {member: "$member"})),

    memberIterator: function(object)
    {
        return this.getMembers(object);
    },

    getRowTag: function(member)
    {
        return this.rowTag;
    },

    onClick: function(event)
    {
        if (!isLeftClick(event))
            return;

        var row = getAncestorByClass(event.target, "memberRow");
        var label = getAncestorByClass(event.target, "memberLabel");
        if (label && hasClass(row, "hasChildren"))
            this.toggleRow(row);
    },

    toggleRow: function(row)
    {
        var level = parseInt(row.getAttribute("level"));

        if (hasClass(row, "opened"))
        {
            removeClass(row, "opened");

            var tbody = row.parentNode;
            for (var firstRow = row.nextSibling; firstRow; firstRow = row.nextSibling) {
                if (parseInt(firstRow.getAttribute("level")) <= level)
                    break;

                tbody.removeChild(firstRow);
            }
        }
        else
        {
            setClass(row, "opened");

            var repObject = row.repObject;
            if (repObject) {
                var members = this.getMembers(repObject.value, level+1);
                if (members)
                    this.loop.insertRows({members: members}, row);
            }
        }
    },

    getMembers: function(object, level)
    {
        // Implement in derived classes.
        return [];
    },

    createMember: function(type, name, value, level)
    {
        var rep = Firebug.getRep(value);
        var tag = rep.shortTag ? rep.shortTag : rep.tag;
        var valueType = typeof(value);
        var hasChildren = this.hasProperties(value) && (valueType == "object");

        return {
            name: name,
            value: value,
            type: type,
            rowClass: "memberRow-" + type,
            open: "",
            level: level,
            indent: level*16,
            hasChildren: hasChildren,
            tag: tag
        };
    },

    hasProperties: function(ob)
    {
        try {
            for (var name in ob)
                return true;
        } catch (exc) {}
        return false;
    }
});

// ************************************************************************************************

Firebug.TraceModule.PropertyTree = domplate(Firebug.TraceModule.Tree,
{
    reXPConnect: /\[xpconnect wrapped ([^\]]*)\]/,

    getMembers: function(object, level)
    {
        if (!level)
            level = 0;

        try
        {
            var members = [];
            for (var p in object)
            {
                try
                {
                    var pAsString = p + "";
                    var m = this.reXPConnect.exec(pAsString);
                    if (m)
                    {
                        var kind = m[1];
                        if (!object[p] instanceof Ci[kind])
                        {
                            var xpobj = object[p].wrappedJSObject;
                            members.push(this.createMember("dom", p, xpobj, level));
                        }
                    }
                    members.push(this.createMember("dom", p, object[p], level));
                }
                catch (e)
                {
                }
            }
        }
        catch (err)
        {
            FBTrace.sysout("Exception", err);
        }

        return members;
    }
});

// ************************************************************************************************
// Registration

Firebug.registerModule(Firebug.TraceModule);
Firebug.registerRep(Firebug.TraceModule.MessageTemplate);

// ************************************************************************************************

}});

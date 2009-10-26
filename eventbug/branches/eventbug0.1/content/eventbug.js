/* See license.txt for terms of usage */
FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

const Cc = Components.classes;
const Ci = Components.interfaces;

const SHOW_ALL = Ci.nsIDOMNodeFilter.SHOW_ALL;

var eventListenerService = null;

// ************************************************************************************************

// Register string bundle of this extension so, $STR method (implemented by Firebug)
// can be used. Also, perform the registration here so, localized strings used
// in template definitions can be resolved.
Firebug.registerStringBundle("chrome://eventbug/locale/eventbug.properties");

// ************************************************************************************************

/**
 * @panel Represents an Events panel displaying a list of registered DOM event listeners.
 * The list is grouped by event types.
 */
function EventPanel() {}
EventPanel.prototype = extend(Firebug.Panel,
/** @lends EventPanel */
{
    name: "events",
    title: $STR("eventbug.Events"),

    initialize: function(context, doc)
    {
        Firebug.Panel.initialize.apply(this, arguments);
        appendStylesheet(doc, "eventBugStyles");
    },

    show: function(state)
    {
        Firebug.Panel.show.apply(this, arguments);

        this.showToolbarButtons("fbEventButtons", true);

        var root = this.context.window.document.documentElement;
        this.selection = this.getBoundEventInfos(root);
        this.rebuild(true);
    },

    hide: function()
    {
        Firebug.Panel.hide.apply(this, arguments);

        this.showToolbarButtons("fbEventButtons", false);
    },

    /**
     * Build content of the panel. The basic layout of the panel is generated by
     * {@link EventInfoTemplate} template.
     */
    rebuild: function()
    {
        try
        {
            if (this.selection)
            {
                EventInfoTemplate.tag.replace({object: this.selection}, this.panelNode);
            }
            else
            {
                if (FBTrace.DBG_EVENTS)
                    FBTrace.sysout("event.rebuild no this.selection");
            }
        }
        catch(e)
        {
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("Event.rebuild fails "+e, e);
        }
    },

    getObjectPath: function(object)
    {
        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("event getObjectPath NOOP", object);
    },

    /**
     * Walk down from elt, build an (elt, info) pair for each listenerInfo,
     * bin all pairs by type (eg 'click').
     */
    getBoundEventInfos: function(elt)
    {
        var walker = this.context.window.document.createTreeWalker(elt, SHOW_ALL, null, true);

        var node = elt;
        var eventInfos = {};
        for (; node; node = walker.nextNode())
        {
            if(FBTrace.DBG_EVENTS)
                FBTrace.sysout("getBoundEventInfos "+node, node);
            if (node.firebugIgnore)
                continue;

            this.appendEventInfos(node, function buildEventInfos(elt, info)
            {
                if (elt.firebugIgnore)
                    return;

                var entry = new BoundEventListenerInfo(elt,  info);
                if (eventInfos.hasOwnProperty(info.type))
                    eventInfos[info.type].push(entry);
                else
                    eventInfos[info.type] = [entry];  // one handler of this type
                if (FBTrace.DBG_EVENTS)
                    FBTrace.sysout("buildEventInfos "+info.type, eventInfos[info.type]);
            });
        }
        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("getBoundEventInfos eventInfos", eventInfos);
        return eventInfos;
    },

    appendEventInfos: function(elt, fnTakesEltInfo)
    {
        var els = getEventListenerService();
        if (!els)
            return;

        var infos = els.getListenerInfoFor(elt, {});
        for (var i = 0; i < infos.length; i++)
        {
            var anInfo = infos[i];
            if (anInfo instanceof Ci.nsIEventListenerInfo) // QI
            {
                if(FBTrace.DBG_EVENTS)
                    FBTrace.sysout(this.context.getName()+" info["+i+"] "+anInfo, [elt, anInfo]);
                fnTakesEltInfo(elt, anInfo);
            }
        }
    },

    supportsObject: function(object)
    {
        return 0;
    },
});

// ************************************************************************************************

/**
 * @panel Represents a side panel for the HTML panel. This panel displays list of associated
 * event listeners for selected element.
 */
function EventElementPanel() {}
EventElementPanel.prototype = extend(Firebug.Panel,
/** @lends EventElementPanel */
{
    name: "ElementEvents",
    title: $STR("eventbug.Events"),
    parentPanel: "html",

    initialize: function(context, doc)
    {
        Firebug.Panel.initialize.apply(this, arguments);
        appendStylesheet(doc, "eventBugStyles");
    },

    show: function(state)
    {
        Firebug.Panel.show.apply(this, arguments);
    },

    supportsObject: function(object)
    {
        return false;
    },

    updateSelection: function(element)
    {
        Firebug.Panel.updateSelection.apply(this, arguments);

        if (!(element instanceof Element))
            return;

        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("eventbug.updateSelection; " + element.localName);

        var els = getEventListenerService();
        if (!els)
        {
            FirebugReps.Warning.tag.replace({object:
                $STR("eventbug.You need Firefox 3.7")},
                this.panelNode);
        }

        var listeners = els.getListenerInfoFor(element, {});
        if (listeners && listeners.length)
        {
            ElementListenerInfoRep.tag.replace({listeners: listeners}, this.panelNode);
        }
        else
        {
            FirebugReps.Warning.tag.replace({object:
                $STR("eventbug.This Element has no listeners")},
                this.panelNode);
        }
    },

    getOptionsMenuItems: function()
    {
        return [];
    }
});

// ************************************************************************************************

/**
 * @panel
 */
function EventHTMLPanel() {}
EventHTMLPanel.prototype = extend(Firebug.Panel,
/** @lends EventHTMLPanel */
{
    name: "events-html",
    title: "HTML",
    parentPanel: "events",

    initialize: function(context, doc)
    {
        Firebug.Panel.initialize.apply(this, arguments);
    },
});

// ************************************************************************************************

/**
 * @panel
 */
function EventScriptPanel() {}
EventScriptPanel.prototype = extend(Firebug.Panel,
/** @lends EventHTMLPanel */
{
    name: "events-script",
    title: "Script",
    parentPanel: "events",

    initialize: function(context, doc)
    {
        Firebug.Panel.initialize.apply(this, arguments);
    },
});

// ************************************************************************************************

/**
 * @domplate This template is used to render content of Events side panel that is available
 * within the HTML panel.
 */
var ElementListenerInfoRep = domplate(Firebug.Rep,
{
    inspectable: false,

    tag:
        TABLE({"class": "eventInfoTable", cellpadding: 0, cellspacing: 0},
            TBODY(
                FOR("listener", "$listeners",
                    TR({"class": "eventRow", onclick: "$onClickRow", _repObject: "$listener"},
                        TD({"class": "eventTypeCol eventCol"},
                            DIV({"class": "eventLabel"},
                                SPAN({"class": "eventTypeLabel eventLabel"},
                                    "$listener.type"
                                ),
                                SPAN("&nbsp;"),
                                SPAN({"class": "capturingLabel eventLabel"},
                                    "$listener|getCapturing"
                                ),
                                SPAN("&nbsp;"),
                                SPAN({"class": "infoLabel eventLabel"},
                                    "$listener|getInfo"
                                )
                            )
                        )
                    )
                )
            )
       ),

    scriptRow:
        TR({"class": "eventScriptRow"},
            TD({"class": "eventScriptCol", colspan: 1})
        ),

    getCapturing: function(listener)
    {
        return listener.capturing ? $STR("eventbug.capturing") : "";
    },

    getInfo: function(listener)
    {
        var text = "(";

        if (listener.allowsUntrusted)
            text += $STR("eventbug.allowsUntrusted");

        if (listener.inSystemEventGroup)
            text += (text ? ", " : "") + $STR("eventbug.inSystemEventGroup");

        return text + ")";
    },

    onClickRow: function(event)
    {
        if (isLeftClick(event))
        {
            var row = getAncestorByClass(event.target, "eventRow");
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
            var scriptRow = this.scriptRow.insertRows({}, row)[0];

            var source = EventListenerInfoRep.getSource(row.repObject);
            var lines = splitLines(source);
            FirebugReps.SourceText.tag.replace({object: {lines: lines}},
                scriptRow.firstChild);
        }
        else
        {
            row.parentNode.removeChild(row.nextSibling);
        }
    },
});

// ************************************************************************************************

function BoundEventListenerInfo(element, eventInfo)
{
    this.element = element;
    this.listener = eventInfo;
}

// ************************************************************************************************

var EventListenerInfoRep = domplate(Firebug.Rep,
{
    tag:
        SPAN({onclick: "$onClickFunction"},
            A({"class": "objectLink objectLink-$linkToType",
                _repObject: "$object"},
                "$object|getHandlerSummary"),
                SPAN("$object|getAttributes")
            ),

    getAttributes: function(listener)
    {
        return (listener.capturing?" Capturing ":"") +
               (listener.allowsUntrusted?" Allows-Untrusted ":"") +
               (listener.inSystemEventGroup?" System-Event-Group":"");
    },

    getHandlerSummary: function(listener)
    {
        if (!listener)
            return "";

        var fnAsString = this.getSource(listener);

        var start = fnAsString.indexOf('{');
        var end = fnAsString.lastIndexOf('}') + 1;
        var fncName = cropString(fnAsString.substring(start, end), 37);
        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("getHandlerSummary "+fncName, listener);

        return fncName;
    },

    onClickFunction: function(event)
    {
        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("onClickFunction, "+event, event);

        if (isLeftClick(event))
        {
            var row = getAncestorByClass(event.target, "objectLink-function");
            if (row)
            {
                if (FBTrace.DBG_EVENTS)
                    FBTrace.sysout("events.onClickFunction, "+row.repObject, row.repObject);

                var listener = row.repObject;
                var link = EventListenerInfoRep.getListenerSourceLink(listener);
                if (link)
                    Firebug.chrome.select(link);
                cancelEvent(event);
            }
        }
    },

    reFunctionName: /unction\s*([^\(]*)/,

    getScriptForListenerInfo: function(listenerInfo)
    {
        var fn = listenerInfo.getDebugObject();
        if (fn && fn instanceof Ci.jsdIValue)
        {
            var script = fn.script;
            return script;
        }
        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("getScriptForListenerInfo FAILS: listenerInfo has getDebugObject "+
                fn+" for "+this.getSource(listenerInfo), {fn: fn, listener: listener});
    },

    getListenerSourceLink: function(listener)
    {
        var script = this.getScriptForListenerInfo(listener);
        if (script)
        {
            var contexts = TabWatcher.contexts;  // chromebug
            if (!isSystemURL(FirebugContext.getName()))
                contexts = [FirebugContext]; // Firebug

            for (var i = 0; i < contexts.length; i++)
            {
                var context = contexts[i];

                var sourceFile = Firebug.SourceFile.getSourceFileByScript(context, script);
                if (sourceFile)
                    return getSourceLinkForScript(script, context);
            }
        }
        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("getListenerSourceLink FAILS:  script "+script+ "in "+context.getName()+
                " for "+this.getSource(listener),{script: script, listener: listener});
    },

    getSource: function(listenerInfo)
    {
        var script = this.getScriptForListenerInfo(listenerInfo);
        if (script)
            return script.functionObject.stringValue;
        else
            return $STR("eventbug.native_listener");
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    className: "nsIEventListenerInfo",
    linkToType: "function",

    supportsObject: function(object)
    {
        if (!Ci.nsIEventListenerInfo)
            return 0;

        return (object instanceof Ci.nsIEventListenerInfo)?10:0;
    },

    getTooltip: function(listener)
    {
        return this.getHandlerSummary(listener);
    },

    inspectObject: function(listenerInfo, context)
    {
        var script = getScriptForListenerInfo(listenerInfo);

        if (script)
            return context.chrome.select(script);

        // Fallback is to just open the view-source window on the file
        var dataURL = getDataURLForContent(this.getSource(listenerInfo), context.window.location.toString());
        viewSource(dataURL, 1);
    },

    getContextMenuItems: function(sourceLink, target, context)
    {
        return [
            {label: "CopyLocation", command: bindFixed(this.copyLink, this, sourceLink) },
            "-",
            {label: "OpenInTab", command: bindFixed(this.openInTab, this, sourceLink) }
        ];
    }
});

// ************************************************************************************************

/**
 * @domplate: Template for basic layout of the {@link EventPanel} panel.
 */
var EventInfoTemplate = domplate(Firebug.Rep,
{
    tag:
        TABLE({"class": "eventInfoTable", cellpadding: 0, cellspacing: 0},
            TBODY({"class": "eventInfoTBody"},
                FOR("boundEventListeners", "$object|getBoundEventInfosArray",
                    TR({"class": "eventRow", onclick: "$onClickEventType",
                        _repObject:"$boundEventListeners"},
                        TD({"class": "eventTypeCol eventCol"},
                            DIV({"class": "eventTypeLabel eventLabel"},
                                "$boundEventListeners.eventType"
                            )
                        ),
                        TD({"class": "boundEventListenerInfoCell"}
                        )
                    )
                )
            )
        ),

    eventTypeBody:
        TR({"class": "eventTypeBodyRow"},
            TD({"class": "eventTypeBodyCol", colspan: 2},
                TABLE({cellpadding: 0, cellspacing: 0},
                    TBODY(
                        FOR("info", "$boundEventListeners.infos",
                            TR({"class": "eventRow"},
                                TD({"class": "eventCol"},
                                    TAG("$boundEventListeners.tag", {object: "$info"})
                                )
                            )
                        )
                    )
                )
            )
        ),

    /**
     * Convert from hashTable keyed by eventType to array
     */
    getBoundEventInfosArray: function(boundEventListenersByType)
    {
        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("getBoundEventInfosArray had type " + typeof(boundEventListenersByType),
                boundEventListenersByType);

        var members = [];
        for (var eventType in boundEventListenersByType)
        {
            if (boundEventListenersByType.hasOwnProperty(eventType))
            {
                var boundEventListenerInfos = boundEventListenersByType[eventType];
                if (FBTrace.DBG_EVENTS)
                    FBTrace.sysout("getBoundEventInfosArray "+eventType+" had type " +
                        typeof(boundEventListenerInfos), boundEventListenerInfos);

                var member = {eventType: eventType, infos: boundEventListenerInfos,
                    tag: BoundEventListenerInfoRep.tag};
                members.push(member);
            }
        }

        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("getBoundEventInfosArray members "+members.length, members);
        return members;
    },

    getEventListnerInfos: function(boundEventListeners)
    {
        if (FBTrace.DBG_EVENTS)
            FBTrace.sysout("getValue ", eventType);
        return eventType.value;
    },

    getNaturalTag: function(value)
    {
        var rep = Firebug.getRep(value);
        var tag = rep.shortTag ? rep.shortTag : rep.tag;
        return tag;
    },

    onClickEventType: function(event)
    {
        if (isLeftClick(event))
        {
            var row = getAncestorByClass(event.target, "eventRow");
            if (row)
            {
                this.toggleRow(row);
                cancelEvent(event);
            }
        }
    },

    toggleRow: function(row)
    {
        toggleClass(row, "opened");
        var opened = hasClass(row, "opened");

        if (hasClass(row, "opened"))
        {
            var boundListeners = row.repObject;
            if (!boundListeners && row.wrappedJSObject)
                boundListeners = row.wrappedJSObject.repObject;
            if (FBTrace.DBG_EVENTS)
                FBTrace.sysout("toggleRow boundListeners", boundListeners);

            this.eventTypeBody.insertRows({boundEventListeners: boundListeners}, row);
        }
        else
        {
            row.parentNode.removeChild(row.nextSibling);
        }
    }
});

// ************************************************************************************************

var BoundEventListenerInfoRep = domplate(Firebug.Rep,
{
    tag:
        DIV({"class": "eventListenerInfo", _repObject: "$object"},
            TAG("$object.element|getNaturalTag",
                {object: "$object.element"}
            ),
            SPAN({"class": "arrayComma"}, "."),
            TAG("$object.listener|getNaturalTag",
                {object: "$object.listener"}
            )
        ),

    shortTag:
        SPAN({_repObject: "$object"},
            TAG("$object.element|getNaturalTag", {object: "$object.element"})
        ),

    getNaturalTag: function(value)
    {
        var rep = Firebug.getRep(value);
        var tag = rep.shortTag ? rep.shortTag : rep.tag;
        return tag;
    },

    supportsObject: function(object)
    {
        return (object instanceof BoundEventListenerInfo)?10:0;
    },
});

// ************************************************************************************************
// Helpers

/**
 * Returns <code>@mozilla.org/eventlistenerservice;1</code> service. This method
 * caches reference to the service when called the first time.
 */
function getEventListenerService()
{
    if (!eventListenerService)
    {
        try
        {
            var eventListenerClass = Cc["@mozilla.org/eventlistenerservice;1"];
            eventListenerService = eventListenerClass.getService(Ci.nsIEventListenerService);
        }
        catch (exc)
        {
            if (FBTrace.DBG_ERRORS)
                FBTrace.sysout("getEventListenerService FAILS "+exc, exc);
        }
    }
    return eventListenerService;
}

function appendStylesheet(doc)
{
    // Make sure the stylesheet isn't appended twice.
    if (!$("eventBugStyles", doc))
    {
        var styleSheet = createStyleSheet(doc, "chrome://eventbug/skin/eventbug.css");
        styleSheet.setAttribute("id", "eventBugStyles");
        addStyleSheet(doc, styleSheet);
    }
}

// ************************************************************************************************
// Tracing Helpers

function dumpEvents()
{
    try
    {
        var elt = document.getElementById("button");
        var info = eventListenerService.getListenerInfoFor(elt);
        if (info instanceof Components.interfaces.nsIVariant)
        {
            output.heading("nsIVariant typeof info: "+typeof info+"\n");
        }
        else if (info.wrappedJSObject)
        {
            output.heading("wrappedJSObject typeof info: "+typeof info.wrappedJSObject+"\n");
        }
        else
        {
            output.heading("info "+info+"\n");
            output.heading("info.length "+info.length+"\n");
            for (var i = 0; i < info.length; i++)
            {
                var anInfo = info[i];
                if (anInfo instanceof Ci.nsIEventListenerInfo)
                    output.heading("info["+i+"] "+anInfo);
                for (var p in info[i])
                    output.heading('info['+i+"]["+p+']='+info[i][p]);
                 s = "info["+i+"]";
                 s += " type: " + anInfo.type;
                 s += ", toSource(): " + EventListenerInfoRep.getSource(anInfo);
                 s += ", capturing:" + anInfo.capturing;
                 s += ", allowsUntrusted: " + anInfo.allowsUntrusted;
                 s += ", inSystemEventGroup: " + anInfo.inSystemEventGroup + "\n";
                 output.heading(s);
            }
        }
    }
    catch (exc)
    {
        output.heading("Failed to get eventListenerService: "+exc+"\n");
    }
}

// ************************************************************************************************
// Registration

// xxxHonza: what if the stylesheet registration would be as follows:
//Firebug.registerStylesheet("chrome://eventbug/skin/eventbug.css");

Firebug.registerPanel(EventPanel);
Firebug.registerPanel(EventElementPanel);
Firebug.registerPanel(EventHTMLPanel);
Firebug.registerPanel(EventScriptPanel);
Firebug.registerRep(EventListenerInfoRep);
Firebug.registerRep(BoundEventListenerInfoRep);

// ************************************************************************************************
}});
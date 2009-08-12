/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

const Cc = Components.classes;
const Ci = Components.interfaces;
//************************************************************************************************


Chromebug.DomWindowContext = function(global, browser, chrome, persistedState)
{
    var tabContext = new Firebug.TabContext(global, browser, Firebug.chrome, persistedState);
    for (var n in tabContext)
         this[n] = tabContext[n];

    this.isChromeBug = true;
    this.loaded = true;
    this.detached = window;  // the window containing firebug for the context is chromebug window
    this.originalChrome = null;


    this.global = global;
    if (global instanceof Ci.nsIDOMWindow)
        this.window = global;
    else
    {
        if (global)
            var name = Firebug.Rep.getTitle(global);
        else
            var name ="mystery";

        this.setName("noWindow://"+name);
    }

    var persistedState = FBL.getPersistedState(this, "script");
    if (!persistedState.enabled)  // for now default all chromebug window to enabled.
        persistedState.enabled = "enable";

    FBTrace.sysout("Chromebug.domWindowContext "+(this.window?"has window ":"")+(this.global?" ":"NULL global ")+this.getName());
}

Chromebug.DomWindowContext.prototype = extend(Firebug.TabContext.prototype,
{
    setName: function(name)
    {
        this.name = new String(name);
    },

    getGlobalScope: function()
    {
        return this.global;  // override Firebug's getGlobalScope; same iff global == domWindow
    },
    // *************************************************************************************************

    getLoadHandler: function()
    {
        return function loadHandler(event)  // this is bound to a XULWindow's outerDOMWindow (only)
        {
            // We've just loaded all of the content for an outer nsIDOMWindow for a XUL window. We need to create a context for it.
            var outerDOMWindow = event.currentTarget; //Reference to the currently registered target for the event.
            var domWindow = event.target.defaultView;

            if (domWindow == outerDOMWindow)
            {
                var oldName = this.getName();
                delete this.name; // remove the cache

                if (FBTrace.DBG_CHROMEBUG)
                    FBTrace.sysout("context.domWindowWatcher found outerDOMWindow "+outerDOMWindow.location+" tried context rename: "+oldName+" -> "+this.getName());
                return;
            }

            if (FBTrace.DBG_CHROMEBUG)
                FBTrace.sysout("context.domWindowWatcher, new "+Chromebug.XULAppModule.getDocumentTypeByDOMWindow(domWindow)+" window "+safeGetWindowLocation(domWindow)+" in outerDOMWindow "+ outerDOMWindow.location+" event.orginalTarget: "+event.originalTarget.documentURI);

            var context = Firebug.Chromebug.getContextByGlobal(domWindow, true);
            if (context)
            {
                // then we had one, say from a Frame
                var oldName = context.getName();
                delete context.name;
                 if (FBTrace.DBG_CHROMEBUG) FBTrace.sysout("ChromeBugPanel.domWindowWatcher found context with id="+context.uid+" and outerDOMWindow.location.href="+outerDOMWindow.location.href+"\n");
                 if (FBTrace.DBG_CHROMEBUG) FBTrace.sysout("ChromeBugPanel.domWindowWatcher rename context with id="+context.uid+" from "+oldName+" -> "+context.getName()+"\n");
                Chromebug.globalScopeInfos.remove(context.globalScope);
            }
            else
            {
                var context = Firebug.Chromebug.getOrCreateContext(domWindow); // subwindow
                if (FBTrace.DBG_CHROMEBUG) FBTrace.sysout("ChromeBugPanel.domWindowWatcher created context with id="+context.uid+" and outerDOMWindow.location.href="+outerDOMWindow.location.href+"\n");
            }
            var gs = new Chromebug.ContainedDocument(context.xul_window, context);
            Chromebug.globalScopeInfos.add(context, gs);
        }
    },

    getUnloadHandler: function()
    {
        return function unloadeHandler(event)
        {
            FBTrace.sysout("DOMWindowContext.unLoadHandler event.currentTarget.location: "+event.currentTarget.location, event);
            var outerDOMWindow = event.currentTarget; //Reference to the currently registered target for the event.
            var domWindow = event.target.defaultView;

             if (!domWindow)
            {
                FBTrace.sysout("ChromeBug unloadHandler found no DOMWindow for event.target", event.target);
                return;
            }

            if (! domWindow instanceof Ci.nsIDOMWindow)
            {
                FBTrace.sysout("ChromeBug unloadHandler domWindow not nsIDOMWindow event.currentTarget.location"+event.currentTarget.location, domWindow);
                return;
            }

            var context = Firebug.Chromebug.getContextByGlobal(domWindow);
            if (context)
            {
                FBTrace.sysout("Firebug.Chromebug.unloadHandler found context with id="+context.uid+" and domWindow.location.href="+domWindow.location.href+"\n");
                Chromebug.globalScopeInfos.remove(context.globalScope);
            }
            else
                FBTrace.sysout("ChromeBug unloadHandler found no context for domWindow:"+domWindow.location);
            return;
        }
    },

});


}});

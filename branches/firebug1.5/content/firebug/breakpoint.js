/* See license.txt for terms of usage */

FBL.ns(function() { with (FBL) {

// ************************************************************************************************
// Constants

// ************************************************************************************************

Firebug.Breakpoint =
{
    resume: function(context, tooltip, disableTooltip)
    {
        if (FBTrace.DBG_BP)
            FBTrace.sysout("breakpoint.resume; " + context.getName());

        Firebug.Debugger.syncCommands(context);

        var chrome = Firebug.chrome;
        var breakable = Firebug.chrome.getGlobalAttribute("cmd_resumeExecution", "breakable").toString();
        if (breakable == "true")
        {
            chrome.setGlobalAttribute("cmd_resumeExecution", "breakable", "false");
            chrome.setGlobalAttribute("cmd_resumeExecution", "tooltiptext", disableTooltip);
        }
        else
        {
            chrome.setGlobalAttribute("cmd_resumeExecution", "breakable", "true");
            chrome.setGlobalAttribute("cmd_resumeExecution", "tooltiptext", tooltip);
        }
    },
};

// ************************************************************************************************

Firebug.Breakpoint.BreakpointListRep = domplate(Firebug.Rep,
{
    tag:
        DIV({onclick: "$onClick", role : "list"},
            FOR("group", "$groups",
                DIV({"class": "breakpointBlock breakpointBlock-$group.name", role: "listitem"},
                    H1({"class": "breakpointHeader groupHeader"},
                        "$group.title"
                    ),
                    DIV({"class": "breakpointsGroupListBox", role: "listbox"},
                        FOR("bp", "$group.breakpoints",
                            TAG("$bp|getBreakpointRep", {bp: "$bp"})
                        )
                    )
                )
            )
        ),

    getBreakpointRep: function(bp)
    {
        var rep = Firebug.getRep(bp);
        return rep.tag;
    },

    onClick: function(event)
    {
        var panel = Firebug.getElementPanel(event.target);

        if (getAncestorByClass(event.target, "breakpointCheckbox"))
        {
            var node = getElementByClass(event.target.parentNode, "objectLink-sourceLink");
            if (!node)
                return;

            var sourceLink = node.repObject;

            panel.noRefresh = true;
            if (event.target.checked)
                fbs.enableBreakpoint(sourceLink.href, sourceLink.line);
            else
                fbs.disableBreakpoint(sourceLink.href, sourceLink.line);
            panel.noRefresh = false;
        }
        else if (getAncestorByClass(event.target, "closeButton"))
        {
            var sourceLink =
                getElementByClass(event.target.parentNode, "objectLink-sourceLink").repObject;

            panel.noRefresh = true;

            var head = getAncestorByClass(event.target, "breakpointBlock");
            var groupName = getClassValue(head, "breakpointBlock");
            if (groupName == "breakpoints")
                fbs.clearBreakpoint(sourceLink.href, sourceLink.line);
            else if (groupName == "errorBreakpoints")
                fbs.clearErrorBreakpoint(sourceLink.href, sourceLink.line);
            else if (groupName == "monitors")
            {
                fbs.unmonitor(sourceLink.href, sourceLink.line)
            }

            var row = getAncestorByClass(event.target, "breakpointRow");
            panel.removeRow(row);

            panel.noRefresh = false;
        }
    }
});

// ************************************************************************************************

Firebug.Breakpoint.BreakpointRep = domplate(Firebug.Rep,
{
    tag:
        DIV({"class": "breakpointRow focusRow", role: "option", "aria-checked": "$bp.checked"},
            DIV({"class": "breakpointBlockHead"},
                INPUT({"class": "breakpointCheckbox", type: "checkbox",
                    _checked: "$bp.checked", tabindex : '-1'}),
                SPAN({"class": "breakpointName"}, "$bp.name"),
                TAG(FirebugReps.SourceLink.tag, {object: "$bp|getSourceLink"}),
                IMG({"class": "closeButton", src: "blank.gif"})
            ),
            DIV({"class": "breakpointCode"}, "$bp.sourceLine")
        ),

    getSourceLink: function(bp)
    {
        return new SourceLink(bp.href, bp.lineNumber, "js");
    },

    supportsObject: function(bp)
    {
        return (bp instanceof Firebug.Debugger.Breakpoint);
    }
});

// ************************************************************************************************

Firebug.Breakpoint.BreakpointsPanel = function() {}

Firebug.Breakpoint.BreakpointsPanel.prototype = extend(Firebug.Panel,
{
    name: "breakpoints",
    parentPanel: "script",
    order: 2,

    initialize: function()
    {
        Firebug.Panel.initialize.apply(this, arguments);
    },

    destroy: function(state)
    {
        Firebug.Panel.destroy.apply(this, arguments);
    },

    initializeNode : function(oldPanelNode)
    {
        dispatch([Firebug.A11yModel], 'onInitializeNode', [this, 'console']);
    },

    destroyNode : function()
    {
        dispatch([Firebug.A11yModel], 'onDestroyNode', [this, 'console']);
    },

    show: function(state)
    {
        this.refresh();
    },

    refresh: function()
    {
        if (!Firebug.Debugger.isAlwaysEnabled(this.context))
            this.updateScriptFiles(this.context);

        var extracted = this.extractBreakpoints(this.context, breakpoints, errorBreakpoints, monitors);

        var breakpoints = extracted.breakpoints;
        var errorBreakpoints = extracted.errorBreakpoints;
        var monitors = extracted.monitors;

        if (FBTrace.DBG_BP)
            FBTrace.sysout("debugger.breakpoints.refresh extracted "+breakpoints.length+errorBreakpoints.length+monitors.length, [breakpoints, errorBreakpoints, monitors]);

        function sortBreakpoints(a, b)
        {
            if (a.href == b.href)
                return a.lineNumber < b.lineNumber ? -1 : 1;
            else
                return a.href < b.href ? -1 : 1;
        }

        breakpoints.sort(sortBreakpoints);
        errorBreakpoints.sort(sortBreakpoints);
        monitors.sort(sortBreakpoints);

        if (FBTrace.DBG_BP)
            FBTrace.sysout("debugger.breakpoints.refresh sorted "+breakpoints.length+errorBreakpoints.length+monitors.length, [breakpoints, errorBreakpoints, monitors]);

        var groups = [];

        if (breakpoints.length)
            groups.push({name: "breakpoints", title: $STR("Breakpoints"),
                breakpoints: breakpoints});
        if (errorBreakpoints.length)
            groups.push({name: "errorBreakpoints", title: $STR("ErrorBreakpoints"),
                breakpoints: errorBreakpoints});
        if (monitors.length)
            groups.push({name: "monitors", title: $STR("LoggedFunctions"),
                breakpoints: monitors});

        dispatch(Firebug.Debugger.fbListeners, "getBreakpoints", [this.context, groups]);

        if (groups.length)
            Firebug.Breakpoint.BreakpointListRep.tag.replace({groups: groups}, this.panelNode);
        else
            FirebugReps.Warning.tag.replace({object: "NoBreakpointsWarning"}, this.panelNode);

        if (FBTrace.DBG_BP)
            FBTrace.sysout("debugger.breakpoints.refresh "+breakpoints.length+errorBreakpoints.length+monitors.length, [breakpoints, errorBreakpoints, monitors]);

        dispatch([Firebug.A11yModel], 'onBreakRowsRefreshed', [this, this.panelNode]);
    },

    extractBreakpoints: function(context, breakpoints, errorBreakpoints, monitors)
    {
        var breakpoints = [];
        var errorBreakpoints = [];
        var monitors = [];

        var renamer = new SourceFileRenamer(context);
        var self = this;
        var Breakpoint = Firebug.Debugger.Breakpoint;

        for (var url in context.sourceFileMap)
        {
            fbs.enumerateBreakpoints(url, {call: function(url, line, props, script)
            {
                if (FBTrace.DBG_BP) FBTrace.sysout("debugger.extractBreakpoints type: "+props.type, props);
                if (renamer.checkForRename(url, line, props)) // some url in this sourceFileMap has changed, we'll be back.
                    return;

                if (script)  // then this is a current (not future) breakpoint
                {
                    var analyzer = Firebug.SourceFile.getScriptAnalyzer(context, script);
                    if (FBTrace.DBG_BP) FBTrace.sysout("debugger.refresh enumerateBreakpoints for script="+script.tag+(analyzer?" has analyzer":" no analyzer")+"\n");
                    if (analyzer)
                        var name = analyzer.getFunctionDescription(script, context).name;
                    else
                        var name = FBL.guessFunctionName(url, 1, context);
                    var isFuture = false;
                }
                else
                {
                    if (FBTrace.DBG_BP) FBTrace.sysout("debugger.refresh enumerateBreakpoints future for url@line="+url+"@"+line+"\n");
                    var isFuture = true;
                }

                var source = context.sourceCache.getLine(url, line);
                breakpoints.push(new Breakpoint(name, url, line, !props.disabled, source, isFuture));
            }});

            fbs.enumerateErrorBreakpoints(url, {call: function(url, line, props)
            {
                if (renamer.checkForRename(url, line, props)) // some url in this sourceFileMap has changed, we'll be back.
                    return;

                var name = Firebug.SourceFile.guessEnclosingFunctionName(url, line, context);
                var source = context.sourceCache.getLine(url, line);
                errorBreakpoints.push(new Breakpoint(name, url, line, true, source));
            }});

            fbs.enumerateMonitors(url, {call: function(url, line, props)
            {
                if (renamer.checkForRename(url, line, props)) // some url in this sourceFileMap has changed, we'll be back.
                    return;

                var name = Firebug.SourceFile.guessEnclosingFunctionName(url, line, context);
                monitors.push(new Breakpoint(name, url, line, true, ""));
            }});

        }

        var result = null;

        if (renamer.needToRename(context))
            result = this.extractBreakpoints(context); // since we renamed some sourceFiles we need to refresh the breakpoints again.
        else
            result = { breakpoints: breakpoints, errorBreakpoints: errorBreakpoints, monitors: monitors };

        // even if we did not rename, some bp may be dynamic
        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("debugger.extractBreakpoints context.dynamicURLhasBP: "+context.dynamicURLhasBP, result);

        return result;
    },

    getOptionsMenuItems: function()
    {
        var items = [];

        var context = this.context;
        if (!Firebug.Debugger.isAlwaysEnabled(context))
            this.updateScriptFiles(context);

        var bpCount = 0, disabledCount = 0;
        for (var url in context.sourceFileMap)
        {
            fbs.enumerateBreakpoints(url, {call: function(url, line)
            {
                ++bpCount;
                if (fbs.isBreakpointDisabled(url, line))
                    ++disabledCount;
            }});
        }

        if (disabledCount)
        {
            items.push(
                {label: "EnableAllBreakpoints",
                    command: bindFixed(
                        Firebug.Debugger.enableAllBreakpoints, Firebug.Debugger, context) }
            );
        }
        if (bpCount && disabledCount != bpCount)
        {
            items.push(
                {label: "DisableAllBreakpoints",
                    command: bindFixed(
                        Firebug.Debugger.disableAllBreakpoints, Firebug.Debugger, context) }
            );
        }

        items.push(
            "-",
            {label: "ClearAllBreakpoints", disabled: !bpCount,
                command: bindFixed(Firebug.Debugger.clearAllBreakpoints, Firebug.Debugger, context) }
        );

        return items;
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    removeRow: function(row)
    {
        row.parentNode.removeChild(row);

        var bpCount = countBreakpoints(this.context);
        if (!bpCount)
            this.refresh();
    },
});

function countBreakpoints(context)
{
    var count = 0;
    for (var url in context.sourceFileMap)
    {
        fbs.enumerateBreakpoints(url, {call: function(url, lineNo)
        {
            ++count;
        }});
    }
    return count;
}

// ************************************************************************************************

function SourceFileRenamer(context)
{
    this.renamedSourceFiles = [];
    this.context = context;
    this.bps = [];
}

SourceFileRenamer.prototype.checkForRename = function(url, line, props)
{
    var sourceFile = this.context.sourceFileMap[url];
    if (sourceFile.isEval() || sourceFile.isEvent())
    {
        var segs = sourceFile.href.split('/');
        if (segs.length > 2)
        {
            if (segs[segs.length - 2] == "seq")
            {
                this.renamedSourceFiles.push(sourceFile);
                this.bps.push(props);
            }
        }
        this.context.dynamicURLhasBP = true;  // whether not we needed to rename, the dynamic sourceFile has a bp.
        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("debugger.checkForRename found bp in "+sourceFile+" renamed files:", this.renamedSourceFiles);
    }
    else
    {
        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("debugger.checkForRename found static bp in "+sourceFile+" bp:", props);
    }

    return (this.renamedSourceFiles.length > 0);
};

SourceFileRenamer.prototype.needToRename = function(context)
{
    if (this.renamedSourceFiles.length > 0)
        this.renameSourceFiles(context);

    if (FBTrace.DBG_SOURCEFILES)
        FBTrace.sysout("debugger renamed " + this.renamedSourceFiles.length + " sourceFiles", context.sourceFileMap);

    return this.renamedSourceFiles.length;
}

SourceFileRenamer.prototype.renameSourceFiles = function(context)
{
    for (var i = 0; i < this.renamedSourceFiles.length; i++)
    {
        var sourceFile = this.renamedSourceFiles[i];
        var bp = this.bps[i];
        FBTrace.sysout("debugger.renameSourceFiles type: "+bp.type, bp);
        var oldURL = sourceFile.href;
        var sameType = bp.type;
        var sameLineNo = bp.lineNo;
        var sameDebuggr = bp.debugger;

        var segs = oldURL.split('/');  // last is sequence #, next-last is "seq", next-next-last is kind
        var kind = segs.splice(segs.length - 3, 3)[0];
        var callerURL = segs.join('/');
        var newURL = Firebug.Debugger.getURLFromMD5(callerURL, sourceFile.source, kind);
        sourceFile.href = newURL.href;

        fbs.removeBreakpoint(bp.type, oldURL, bp.lineNo);
        delete context.sourceFileMap[oldURL];  // SourceFile delete

        this.watchSourceFile(context, sourceFile);
        var newBP = fbs.addBreakpoint(sameType, sourceFile, sameLineNo, bp, sameDebuggr);

        var panel = context.getPanel("script", true);
        if (panel)
        {
            panel.context.invalidatePanels("breakpoints");
            panel.renameSourceBox(oldURL, newURL.href);
        }
        if (context.sourceCache.isCached(oldURL))
        {
            var lines = context.sourceCache.load(oldURL);
            context.sourceCache.storeSplitLines(newURL.href, lines);
            context.sourceCache.invalidate(oldURL);
        }

        if (FBTrace.DBG_SOURCEFILES)
            FBTrace.sysout("SourceFileRenamer renamed "+oldURL +" to "+newURL, { newBP: newBP, oldBP: bp});
    }
    return this.renamedSourceFiles.length;
}

// ************************************************************************************************

Firebug.Breakpoint.ConditionEditor = function(doc)
{
    this.initialize(doc);
}

Firebug.Breakpoint.ConditionEditor.prototype = domplate(Firebug.InlineEditor.prototype,
{
    tag:
        DIV({"class": "conditionEditor"},
            DIV({"class": "conditionEditorTop1"},
                DIV({"class": "conditionEditorTop2"})
            ),
            DIV({"class": "conditionEditorInner1"},
                DIV({"class": "conditionEditorInner2"},
                    DIV({"class": "conditionEditorInner"},
                        DIV({"class": "conditionCaption"}, $STR("ConditionInput")),
                        INPUT({"class": "conditionInput", type: "text",
                            "aria-label": $STR("ConditionInput")}
                        )
                    )
                )
            ),
            DIV({"class": "conditionEditorBottom1"},
                DIV({"class": "conditionEditorBottom2"})
            )
        ),

    initialize: function(doc)
    {
        this.box = this.tag.replace({}, doc, this);

        // XXXjjb we need childNode[1] always
        this.input = this.box.childNodes[1].firstChild.firstChild.lastChild;
        Firebug.InlineEditor.prototype.initialize.apply(this, arguments);
    },

    show: function(sourceLine, panel, value)
    {
        this.target = sourceLine;
        this.panel = panel;

        if (this.getAutoCompleter)
            this.getAutoCompleter().reset();

        hide(this.box, true);
        panel.selectedSourceBox.appendChild(this.box);

        if (this.input)
            this.input.value = value;

        setTimeout(bindFixed(function()
        {
            var offset = getClientOffset(sourceLine);

            var bottom = offset.y+sourceLine.offsetHeight;
            var y = bottom - this.box.offsetHeight;
            if (y < panel.selectedSourceBox.scrollTop)
            {
                y = offset.y;
                setClass(this.box, "upsideDown");
            }
            else
                removeClass(this.box, "upsideDown");

            this.box.style.top = y + "px";
            hide(this.box, false);

            if (this.input)
            {
                this.input.focus();
                this.input.select();
            }
        }, this));
    },

    hide: function()
    {
        this.box.parentNode.removeChild(this.box);

        delete this.target;
        delete this.panel;
    },

    layout: function()
    {
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    endEditing: function(target, value, cancel)
    {
        if (!cancel)
        {
            var sourceFile = this.panel.location;
            var lineNo = parseInt(this.target.textContent);

            fbs.setBreakpointCondition(sourceFile, lineNo, value, Firebug.Debugger);
        }
    }
});

// ************************************************************************************************

Firebug.Breakpoint.BreakNotification = function(doc, cause)
{
    this.initialize(doc, cause);
}

Firebug.Breakpoint.BreakNotification.prototype = domplate(Firebug.InlineEditor.prototype,
{
    tag:
        DIV({"class": "conditionEditor breakNotification", onclick: "$hide"},
            DIV({"class": "notationEditorTop1"},
                DIV({"class": "notationEditorTop2"})
            ),
            DIV({"class": "notationEditorInner1"},
                DIV({"class": "notationEditorInner2"},
                    DIV({"class": "conditionEditorInner"},
                        DIV({"class": "notationCaption"},
                            SPAN({"class": "notationTitle"}, "$cause.title"),
                            BUTTON({"class": "notationButton", onclick: "$onCopyAction",
                                $collapsed: "$cause|hideCopyAction"},
                                $STR("Copy")
                            )
                        ),
                        DIV({"class": "notationCaption"}, "$cause.message")
                    )
                )
            ),
            DIV({"class": "notationEditorBottom1"},
                DIV({"class": "notationEditorBottom2"})
            )
        ),

    initialize: function(doc, cause)
    {
        this.cause = cause;
        this.box = this.tag.replace({cause: cause}, doc, this);
    },

    show: function(sourceLine, panel, value)
    {
        this.target = sourceLine;
        this.panel = panel;

        hide(this.box, true);
        panel.selectedSourceBox.appendChild(this.box);

        setTimeout(bindFixed(function()
        {
            var offset = getClientOffset(sourceLine);

            var bottom = offset.y+sourceLine.offsetHeight;
            var y = bottom - this.box.offsetHeight;
            if (y < panel.selectedSourceBox.scrollTop)
            {
                y = offset.y;
                setClass(this.box, "upsideDown");
            }
            else
                removeClass(this.box, "upsideDown");

            this.box.style.top = y + "px";
            hide(this.box, false);
        }, this));
    },

    hide: function()
    {
        if (this.panel)
        {
            var guts = getElementByClass(this.box, "conditionEditorInner");
            clearNode(guts);

            var msg = this.cause.message;
            if (msg)
            {
                var self = this;
                var interval = setInterval(function slide(event)
                {
                    if (self.box.clientWidth < 20)
                    {
                        clearInterval(interval);
                        self.box.parentNode.removeChild(self.box);
                        self.target.setAttribute('title', msg);
                        setClass(self.target, "noteInToolTip");
                        delete self.target;
                        delete self.panel;
                    }
                    else
                        self.box.style.width = (self.box.clientWidth - 20)+"px";
                }, 2);
            }
            else
            {
                delete this.target;
                delete this.panel;
            }
        }
        // else we already called hide
    },

    hideCopyAction: function(cause)
    {
        return !cause.copyAction;
    },

    onCopyAction: function(event)
    {
        if (this.cause.copyAction)
            this.cause.copyAction();
    }
});

// ************************************************************************************************
// Registration

Firebug.registerPanel(Firebug.Breakpoint.BreakpointsPanel);
Firebug.registerRep(Firebug.Breakpoint.BreakpointRep);

// ************************************************************************************************
}});

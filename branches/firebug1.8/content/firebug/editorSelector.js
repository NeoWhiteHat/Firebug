define("editorSelector.js", ["ToolsInterface"], function(ToolsInterface) { with(FBL) {
    //************************************************************************************************
    // Reusable code for modules that support editing
    Firebug.EditorSelector =
    {
            // Override for each module
            getEditorOptionKey: function()
            {
                return "cssEditMode";
            },

            editors: {},

            registerEditor: function(name, editor)
            {
                this.editors[name] = editor;
            },
            unregisterEditor: function(name, editor)
            {
                delete this.editors[name];
            },
            getEditorByName: function(name)
            {
                return this.editors[name];
            },
            getEditorsNames: function()
            {
                var names = [];
                for (var p in this.editors)
                {
                    if (this.editors.hasOwnProperty(p))
                        names.push(p);
                }
                return names;
            },

            setCurrentEditorName: function(name)
            {
                this.currentEditorName = name;
                Firebug.Options.set(this.getEditorOptionKey(), name);
            },
            getCurrentEditorName: function()
            {
                if (!this.currentEditorName)
                    this.currentEditorName = Firebug.Options.get(this.getEditorOptionKey());

                return this.currentEditorName;
            },
            getCurrentEditor: function()
            {
                return this.getEditorByName(this.getCurrentEditorName());
            },

            onEditMode: function(event, menuitem)
            {
                var mode = menuitem.getAttribute("mode");
                if (mode)
                    this.setCurrentEditorName(mode);

                this.updateEditButton();
                FBL.cancelEvent(event);
            },

            updateEditButton: function()
            {
                // Update lable of the edit button according to the preferences.
                var mode = this.getCurrentEditorName();
                var label = Firebug.chrome.$("menu_"+this.getEditorOptionKey()+mode).label;
                var command = Firebug.chrome.$("cmd_toggle"+this.getEditorOptionKey());
                command.setAttribute("label", label);
            },

            onOptionsShowing: function(popup)
            {
                var mode = this.getCurrentEditorName();

                for (var child = popup.firstChild; child; child = child.nextSibling)
                {
                    if (child.localName == "menuitem")
                    {
                        if (child.id == "menu_"+this.getEditorOptionKey()+mode)
                            child.setAttribute("checked", true);
                        else
                            child.removeAttribute("checked");
                    }
                }
            },

    };

    return Firebug.EditorSelector;
}});
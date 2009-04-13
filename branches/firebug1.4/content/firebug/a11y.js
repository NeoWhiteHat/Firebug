/* See license.txt for terms of usage */

FBL.ns( function()
{
    with (FBL)
    {
        Firebug.A11yModel = extend(Firebug.Module, {

            dispatchName: "a11y",

            enabled : false,

            tabFocused : false,

            initializeUI: function()
            {
                this.set(Firebug.getPref(Firebug.prefDomain, 'enableA11y'));
            },

            toggle : function()
            {
                this.set(!this.enabled); 
            },

            set : function(enable)
            {
                //This needs a fix, how to get a correct reference to either Browser.xml or Firebug.xml chrome here?
                var chrome = typeof context != "undefined" ? context.chrome : FirebugChrome;
                this.enabled = enable;
                Firebug.setPref(Firebug.prefDomain, 'enableA11y', enable);
                $('cmd_enableA11y').setAttribute('checked', enable + '');
                if (enable)
                    this.performEnable(chrome);
                else
                    this.performDisable(chrome);
            },
            
            reattachContext: function(browser, context)
            {
                this.set(Firebug.getPref(Firebug.prefDomain, 'enableA11y'));
            },
            
            performEnable : function(chrome)
            {
                //add class used by all a11y related css styles (e.g. :focus and -moz-user-focus styles)
                FBL.setClass(chrome.$('fbContentBox'), 'useA11y');
                FBL.setClass(chrome.$('fbStatusBar'), 'useA11y');
                //manage all key events in toolbox (including tablists)
                chrome.$("fbPanelBar1").addEventListener("keypress", this.handlePanelBarKeyPress , true);
                //make focus stick to inspect button when clicked
                chrome.$("fbInspectButton").addEventListener("mousedown", this.focusTarget, true);
                this.handleTabBarFocus = FBL.bind(this.handleTabBarFocus, this);
                this.handleTabBarBlur = FBL.bind(this.handleTabBarBlur, this);
                chrome.$('fbPanelBar1-panelTabs').addEventListener('focus', this.handleTabBarFocus, true);
                chrome.$('fbPanelBar1-panelTabs').addEventListener('blur', this.handleTabBarBlur, true);
                chrome.$('fbPanelBar2-panelTabs').addEventListener('focus', this.handleTabBarFocus, true);
                chrome.$('fbPanelBar2-panelTabs').addEventListener('blur', this.handleTabBarBlur, true);

            },

            performDisable : function(chrome)
            {	//undo everything we did in performEnable
                FBL.removeClass(chrome.$('fbContentBox'), 'useA11y');
                FBL.removeClass(chrome.$('fbStatusBar'), 'useA11y');
                chrome.$("fbPanelBar1").removeEventListener("keypress", this.handlePanelBarKeyPress , true);
                chrome.$("fbInspectButton").removeEventListener("mousedown", this.focusTarget, true);
                chrome.$('fbPanelBar1-panelTabs').removeEventListener('focus', this.handleTabBarFocus, true);
                chrome.$('fbPanelBar1-panelTabs').removeEventListener('blur', this.handleTabBarBlur, true);
                chrome.$('fbPanelBar2-panelTabs').removeEventListener('focus', this.handleTabBarFocus, true);
                chrome.$('fbPanelBar2-panelTabs').removeEventListener('blur', this.handleTabBarBlur, true);
            },
            
            focusTarget : function(event)
            {
                event.target.focus();
            },
            
            handlePanelBarKeyPress : function (event)
            {
                var target = event.originalTarget;
                var isTab = target.nodeName.toLowerCase() == "paneltab";
                var isButton = target.nodeName.search(/(xul:)?toolbarbutton/) != -1;
                var isDropDownMenu = isButton && target.getAttribute('type') == "menu";
                var siblingTab, forward, keyCode, toolbar, buttons;
                if (isTab || isButton )
                {
                    keyCode = event.keyCode || event.charCode;
                    switch (keyCode)
                    {
                        case KeyEvent.DOM_VK_LEFT:
                        case KeyEvent.DOM_VK_RIGHT:
                            forward = event.keyCode == KeyEvent.DOM_VK_RIGHT;
                            if (isTab)
                            {
                                //will only work as long as long as siblings only consist of paneltab elements
                                siblingTab = target[forward ? 'nextSibling' : 'previousSibling'];
                                if (!siblingTab)
                                    siblingTab = target.parentNode[forward ? 'firstChild' : 'lastChild'];
                                if (siblingTab)
                                {
                                    var panelBar = FBL.getAncestorByClass(target, 'panelBar')
                                    setTimeout(FBL.bindFixed(function()
                                    {
                                        panelBar.selectTab(siblingTab);
                                        siblingTab.focus();
                                    }, this));
                                }
                           }
                           else if (isButton)
                           {
                               if (target.id=="fbFirebugMenu" && !forward)
                               {
                                    FBL.cancelEvent(event);
                                    return;
                               }
                               toolbar = FBL.getAncestorByClass(target, 'innerToolbar');
                               if (toolbar)
                               {
                                   var doc = target.ownerDocument;
                                   //temporarily make all buttons in the toolbar part of the tab order,
                                   //to allow smooth, native focus advancement
                                   FBL.setClass(toolbar, 'hasTabOrder');
                                   doc.commandDispatcher[forward ? 'advanceFocus' : 'rewindFocus']();
                                   //Very ugly hack, but it works well. This prevents focus to 'spill out' of a 
                                   //toolbar when using the left and right arrow keys 
                                   if (!FBL.isAncestor(doc.commandDispatcher.focusedElement, toolbar))
                                   {
                                       //we moved focus to somewhere out of the toolbar: not good. Move it back to where it was.
                                       doc.commandDispatcher[!forward ? 'advanceFocus' : 'rewindFocus']();
                                   }
                                   //remove the buttons from the tab order again, so that it will remain uncluttered
                                   FBL.removeClass(toolbar, 'hasTabOrder');
                               }
                                FBL.cancelEvent(event);
                                return;
                           }
                        break;
                        case KeyEvent.DOM_VK_RETURN:
                        case KeyEvent.DOM_VK_SPACE:
                        case KeyEvent.DOM_VK_UP:
                        case KeyEvent.DOM_VK_DOWN:
                            if (isTab && target.tabMenu)
                            {
                                target.tabMenu.popup.showPopup(target.tabMenu, -1, -1, "popup", "bottomleft", "topleft");
                            }
                            else if (isButton)
                            {
                                if (isDropDownMenu)
                                {
                                    target.open = true;
                                }
                                FBL.cancelEvent(event);
                                return false;
                            }
                        break;
                        case KeyEvent.DOM_VK_F4:
                            if (isTab && target.tabMenu)
                            {
                                target.tabMenu.popup.showPopup(target.tabMenu, -1, -1, "popup", "bottomleft", "topleft");
                            }
                        break;
                    }
                }
            },

            handleTabBarFocus: function(event)
            {
                this.tabFocused = true;
            },

            handleTabBarBlur: function(event)
            {
                this.tabFocused = false;
            }

        });

        Firebug.registerModule(Firebug.A11yModel);
    }
});
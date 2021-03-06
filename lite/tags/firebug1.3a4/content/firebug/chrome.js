FBL.ns(function() { with (FBL) {
// ************************************************************************************************

FBL.FirebugChrome = 
{
    chromeMap: {},
    
    sidePanelWidth: 300,
    
    selectedPanelName: "Console",
    
    selectedHTMLElementId: null,
    
    htmlSelectionStack: [],
    
    consoleMessageQueue: [],
    
    height: 250,
    
    isOpen: false,
    
    create: function()
    {
        if (FBTrace.DBG_INITIALIZE) FBTrace.sysout("FirebugChrome.create", "creating chrome window");
        
        createChromeWindow();
    },
    
    initialize: function()
    {
        if (FBTrace.DBG_INITIALIZE) FBTrace.sysout("FirebugChrome.initialize", "initializing chrome window");
        
        if (Env.chrome.type == "frame")
            ChromeMini.create(Env.chrome);
            
        var chrome = Firebug.chrome = new Chrome(Env.chrome);
        FirebugChrome.chromeMap[chrome.type] = chrome;
        
        addGlobalEvent("keydown", onGlobalKeyDown);
        
        if (Env.Options.enablePersistent && chrome.type == "popup")
        {
            // TODO: xxxpedro persist - revise chrome synchronization when in persistent mode
            var frame = FirebugChrome.chromeMap.frame;
            if (frame)
                frame.close();
            
            //chrome.reattach(frame, chrome);
            //TODO: xxxpedro persist synchronize?
            chrome.initialize();
        }
    },
    
    clone: function(FBChrome)
    {
        for (var name in FBChrome)
        {
            var prop = FBChrome[name];
            if (FBChrome.hasOwnProperty(name) && !isFunction(prop))
            {
                this[name] = prop;
            }
        }
    }
};


// ************************************************************************************************
// Chrome Window Options

var ChromeDefaultOptions = 
{
    type: "frame",
    id: "FirebugUI",
    height: 250
};

// ************************************************************************************************
// Chrome Window Creation

var createChromeWindow = function(options)
{
    options = options || {};
    options = extend(ChromeDefaultOptions, options);
    
    var context = options.context || Env.browser;
    
    var chrome = {};
    
    chrome.type = Env.Options.enablePersistent ? "popup" : options.type;
    
    var isChromeFrame = chrome.type == "frame";
    var useLocalSkin = Env.useLocalSkin;
    var url = useLocalSkin ? Env.Location.skin : "about:blank";
    
    if (isChromeFrame)
    {
        // Create the Chrome Frame
        var node = chrome.node = createGlobalElement("iframe");
        
        node.setAttribute("id", options.id);
        node.setAttribute("frameBorder", "0");
        node.firebugIgnore = true;
        node.style.border = "0";
        node.style.visibility = "hidden";
        node.style.zIndex = "2147483647"; // MAX z-index = 2147483647
        node.style.position = noFixedPosition ? "absolute" : "fixed";
        node.style.width = "100%"; // "102%"; IE auto margin bug
        node.style.left = "0";
        node.style.bottom = noFixedPosition ? "-1px" : "0";
        node.style.height = options.height + "px";
        
        // avoid flickering during chrome rendering
        if (isFirefox)
            node.style.display = "none";
        
        if (useLocalSkin)
            node.setAttribute("src", Env.Location.skin);
        
        // document.body not available in XML+XSL documents in Firefox
        context.document.getElementsByTagName("body")[0].appendChild(node);
    }
    else
    {
        // Create the Chrome Popup
        var height = FirebugChrome.height || options.height;
        var options = [
                "true,top=",
                Math.max(screen.availHeight - height - 61 /* Google Chrome bug */, 0),
                ",left=0,height=",
                height,
                ",width=",
                screen.availWidth-10, // Opera opens popup in a new tab if it's too big!
                ",resizable"          
            ].join("");
        
        var node = chrome.node = context.window.open(
            url, 
            "popup", 
            options
          );
        
        if (node)
        {
            try
            {
                node.focus();
            }
            catch(E)
            {
                alert("Firebug Error: Firebug popup was blocked.");
                return;
            }
        }
        else
        {
            alert("Firebug Error: Firebug popup was blocked.");
            return;
        }
    }
    
    if (!useLocalSkin)
    {
        var tpl = getChromeTemplate(!isChromeFrame);
        var doc = isChromeFrame ? node.contentWindow.document : node.document;
        doc.write(tpl);
        doc.close();
    }
    
    var win;
    var waitDelay = useLocalSkin ? isChromeFrame ? 200 : 300 : 100;
    var waitForChrome = function()
    {
        if ( // Frame loaded... OR
             isChromeFrame && (win=node.contentWindow) &&
             node.contentWindow.document.getElementById("fbCommandLine") ||
             
             // Popup loaded
             !isChromeFrame && (win=node.window) && node.document &&
             node.document.getElementById("fbCommandLine") )
        {
            chrome.window = win.window;
            chrome.document = win.document;
            
            // Prevent getting the wrong chrome height in FF when opening a popup 
            setTimeout(function(){
                onChromeLoad(chrome);
            },0);
        }
        else
            setTimeout(waitForChrome, waitDelay);
    }
    
    waitForChrome();
};


var onChromeLoad = function onChromeLoad(chrome)
{
    Env.chrome = chrome;
    
    if (FBTrace.DBG_INITIALIZE) FBTrace.sysout("Chrome onChromeLoad", "chrome window loaded");
    
    if (Env.Options.enablePersistent)
    {
        // TODO: xxxpedro persist - make better chrome synchronization when in persistent mode
        Env.FirebugChrome = FirebugChrome;
        
        chrome.window.Firebug = chrome.window.Firebug || {};
        chrome.window.Firebug.SharedEnv = Env;
        
        if (Env.isDevelopmentMode)
        {
            Env.browser.window.FBDev.loadChromeApplication(chrome);
        }
        else
        {
            var doc = chrome.document;
            var script = doc.createElement("script");
            script.src = Env.Location.app + "#remote,persist";
            doc.getElementsByTagName("head")[0].appendChild(script);
        }
    }
    else
    {
        if (chrome.type == "frame")
        {
            // initialize the chrome application
            setTimeout(function(){
                FBL.Firebug.initialize();
            },0);
        }
        else if (chrome.type == "popup")
        {
            var oldChrome = FirebugChrome.chromeMap.frame;
            
            var newChrome = new Chrome(chrome);
        
            // TODO: xxxpedro sync detach reattach attach
            dispatch(newChrome.panelMap, "detach", [oldChrome, newChrome]);
        
            if (oldChrome)
                oldChrome.close();
            
            newChrome.reattach(oldChrome, newChrome);
        }
    }
};

var getChromeTemplate = function(isPopup)
{
    var tpl = FirebugChrome.injected; 
    var r = [], i = -1;
    
    r[++i] = '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/DTD/strict.dtd">';
    r[++i] = '<html><head><title>';
    r[++i] = Firebug.version;
    
    /*
    r[++i] = '</title><link href="';
    r[++i] = Env.Location.skinDir + 'firebug.css';
    r[++i] = '" rel="stylesheet" type="text/css" />';
    /**/
    
    r[++i] = '</title><style>';
    r[++i] = tpl.CSS;
    r[++i] = '</style>';
    /**/
    
    r[++i] = '</head><body class=' + (isPopup ? '"FirebugPopup"' : '') + '>';
    r[++i] = tpl.HTML;
    r[++i] = '</body></html>';
    
    return r.join("");
};

// ************************************************************************************************
// Chrome Class
    
var Chrome = function Chrome(chrome)
{
    var type = chrome.type;
    var Base = type == "frame" ? ChromeFrameBase : ChromePopupBase; 
    
    append(this, chrome); // inherit chrome window properties
    append(this, Base);   // inherit chrome class properties (ChromeFrameBase or ChromePopupBase)
    
    FirebugChrome.chromeMap[type] = this;
    Firebug.chrome = this;
    Env.chrome = chrome.window;
    
    this.commandLineVisible = false;
    this.sidePanelVisible = false;
    
    this.create();
    
    return this;
};

// ************************************************************************************************
// ChromeBase

var ChromeBase = extend(Controller, PanelBar);

append(ChromeBase, Context.prototype);

append(ChromeBase,
{
    create: function()
    {
        PanelBar.create.call(this);
        
        if (Firebug.Inspector)
            this.inspectButton = new Button({
                type: "toggle",
                element: $("fbChrome_btInspect"),
                owner: Firebug.Inspector,
                
                onPress: Firebug.Inspector.startInspecting,
                onUnpress: Firebug.Inspector.stopInspecting          
            });
    },
    
    destroy: function()
    {
        this.inspectButton.destroy();
        
        PanelBar.destroy.call(this);
        
        this.shutdown();
    },
    
    testMenu: function()
    {
        var firebugMenu = new Menu(
        {
            id: "fbFirebugMenu2",
            
            items:
            [
                {
                    label: "Open Firebug",
                    type: "shortcut",
                    key: isFirefox ? "Shift+F12" : "F12",
                    checked: true,
                    command: "toggleChrome"
                },
                {
                    label: "Open Firebug in New Window",
                    type: "shortcut",
                    key: isFirefox ? "Ctrl+Shift+F12" : "Ctrl+F12",
                    command: "openPopup"
                },
                {
                    label: "Inspect Element",
                    type: "shortcut",
                    key: "Ctrl+Shift+C",
                    command: "toggleInspect"
                },
                {
                    label: "Command Line",
                    type: "shortcut",
                    key: "Ctrl+Shift+L",
                    command: "focusCommandLine"
                },
                "-",
                {
                    label: "Options",
                    type: "group",
                    child: "fbFirebugOptionsMenu"
                },
                "-",
                {
                    label: "Firebug Lite Website...",
                    command: "visitWebsite"
                },
                {
                    label: "Discussion Group...",
                    command: "visitDiscussionGroup"
                },
                {
                    label: "Issue Tracker...",
                    command: "visitIssueTracker"
                }
            ],
            
            onHide: function()
            {
                iconButton.restore();
            },
            
            toggleChrome: function()
            {
                Firebug.chrome.toggle();
            },
            
            openPopup: function()
            {
                Firebug.chrome.toggle(true, true);
            },
            
            toggleInspect: function()
            {
                Firebug.Inspector.toggleInspect();
            },
            
            focusCommandLine: function()
            {
                Firebug.chrome.focusCommandLine();
            },
            
            visitWebsite: function()
            {
                this.visit("http://getfirebug.com/lite.html");
            },
            
            visitDiscussionGroup: function()
            {
                this.visit("http://groups.google.com/group/firebug");
            },
            
            visitIssueTracker: function()
            {
                this.visit("http://code.google.com/p/fbug/issues/list");
            },
            
            visit: function(url)
            {
                window.open(url);
            }
            
        });
        
        var firebugOptionsMenu =
        {
            id: "fbFirebugOptionsMenu",
            
            getItems: function()
            {
                var cookiesDisabled = !Firebug.saveCookies;
                
                return [
                    {
                        label: "Save Options in Cookies",
                        type: "checkbox",
                        value: "saveCookies",
                        checked: Firebug.saveCookies,
                        command: "saveOptions"
                    },
                    "-",
                    {
                        label: "Start Opened",
                        type: "checkbox",
                        value: "startOpened",
                        checked: Firebug.startOpened,
                        disabled: cookiesDisabled
                    },
                    {
                        label: "Start in New Window",
                        type: "checkbox",
                        value: "startInNewWindow",
                        checked: Firebug.startInNewWindow,
                        disabled: cookiesDisabled
                    },
                    {
                        label: "Show Icon When Hidden",
                        type: "checkbox",
                        value: "showIconWhenHidden",
                        checked: Firebug.showIconWhenHidden,
                        disabled: cookiesDisabled
                    },
                    "-",
                    {
                        label: "Override Console Object",
                        type: "checkbox",
                        value: "overrideConsole",
                        checked: Firebug.overrideConsole,
                        disabled: cookiesDisabled
                    },
                    {
                        label: "Ignore Firebug Elements",
                        type: "checkbox",
                        value: "ignoreFirebugElements",
                        checked: Firebug.ignoreFirebugElements,
                        disabled: cookiesDisabled
                    },
                    {
                        label: "Disable When Firebug Active",
                        type: "checkbox",
                        value: "disableWhenFirebugActive",
                        checked: Firebug.disableWhenFirebugActive,
                        disabled: cookiesDisabled
                    },
                    "-",
                    {
                        label: "Enable Trace Mode",
                        type: "checkbox",
                        value: "enableTrace",
                        checked: Firebug.enableTrace,
                        disabled: cookiesDisabled
                    },
                    {
                        label: "Enable Persistent Mode (experimental)",
                        type: "checkbox",
                        value: "enablePersistent",
                        checked: Firebug.enablePersistent,
                        disabled: cookiesDisabled
                    },
                    "-",
                    {
                        label: "Restore Options",
                        command: "restorePrefs",
                        disabled: cookiesDisabled
                    }
                ];
            },
            
            onCheck: function(target, value, checked)
            {
                Firebug.setPref(value, checked);
            },           
            
            saveOptions: function(target)
            {
                var saveEnabled = target.getAttribute("checked");
                
                if (!saveEnabled) this.restorePrefs();
                
                this.updateMenu(target);
                
                return false;
            },
            
            restorePrefs: function(target)
            {
                Firebug.restorePrefs();
                
                if(Firebug.saveCookies)
                    Firebug.savePrefs()
                else
                    Firebug.erasePrefs();
                
                if (target)
                    this.updateMenu(target);
                
                return false;
            },
            
            updateMenu: function(target)
            {
                var options = getElementsByClass(target.parentNode, "fbMenuOption");
                
                var firstOption = options[0]; 
                var enabled = Firebug.saveCookies;
                if (enabled)
                    Menu.check(firstOption);
                else
                    Menu.uncheck(firstOption);
                
                if (enabled)
                    Menu.check(options[0]);
                else
                    Menu.uncheck(options[0]);
                
                for (var i = 1, length = options.length; i < length; i++)
                {
                    var option = options[i];
                    
                    var value = option.getAttribute("value");
                    var pref = Firebug[value];
                    
                    if (pref)
                        Menu.check(option);
                    else
                        Menu.uncheck(option);
                    
                    if (enabled)
                        Menu.enable(option);
                    else
                        Menu.disable(option);
                }
            }
        };
        
        Menu.register(firebugOptionsMenu);
        
        var menu = firebugMenu;
        
        var testMenuClick = function(event)
        {
            //console.log("testMenuClick");
            cancelEvent(event, true);
            
            var target = event.target || event.srcElement;
            
            if (menu.isVisible)
                menu.hide();
            else
            {
                var offsetLeft = isIE6 ? 1 : -4;  // IE6 problem with fixed position
                var box = Firebug.chrome.getElementBox(target);
                menu.show(box.left + offsetLeft, box.top + box.height -5);
            }
            
            return false;
        };
        
        var iconButton = new IconButton({
            type: "toggle",
            element: $("fbFirebugButton"),
            
            onClick: testMenuClick
        });
        
        iconButton.initialize();
        
        //addEvent($("fbToolbarIcon"), "click", testMenuClick);
    },
    
    initialize: function()
    {
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        if (Firebug.Console)
            Firebug.Console.flush();
        
        if (Firebug.Trace)
            FBTrace.flush(Firebug.Trace);
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        if (FBTrace.DBG_INITIALIZE) FBTrace.sysout("Firebug.chrome.initialize", "initializing chrome application");
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // initialize inherited classes
        Controller.initialize.call(this);
        PanelBar.initialize.call(this);
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // create the interface elements cache
        
        fbTop = $("fbTop");
        fbContent = $("fbContent");
        fbContentStyle = fbContent.style;
        fbBottom = $("fbBottom");
        fbBtnInspect = $("fbBtnInspect");
        
        fbToolbar = $("fbToolbar");
      
        fbPanelBox1 = $("fbPanelBox1");
        fbPanelBox1Style = fbPanelBox1.style;
        fbPanelBox2 = $("fbPanelBox2");
        fbPanelBox2Style = fbPanelBox2.style;
        fbPanelBar2Box = $("fbPanelBar2Box");
        fbPanelBar2BoxStyle = fbPanelBar2Box.style;
      
        fbHSplitter = $("fbHSplitter");
        fbVSplitter = $("fbVSplitter");
        fbVSplitterStyle = fbVSplitter.style;
      
        fbPanel1 = $("fbPanel1");
        fbPanel1Style = fbPanel1.style;
        fbPanel2 = $("fbPanel2");
        fbPanel2Style = fbPanel2.style;
      
        fbConsole = $("fbConsole");
        fbConsoleStyle = fbConsole.style;
        fbHTML = $("fbHTML");
      
        fbCommandLine = $("fbCommandLine");
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // static values cache
        topHeight = fbTop.offsetHeight;
        topPartialHeight = fbToolbar.offsetHeight;
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        
        disableTextSelection($("fbToolbar"));
        disableTextSelection($("fbPanelBarBox"));
        disableTextSelection($("fbPanelBar1"));
        disableTextSelection($("fbPanelBar2"));
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // create a new instance of the CommandLine class
        if (Firebug.CommandLine)
            commandLine = new Firebug.CommandLine(fbCommandLine);
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Add the "javascript:void(0)" href attributes used to make the hover effect in IE6
        if (isIE6 && Firebug.Selector)
        {
            // TODO: xxxpedro change to getElementsByClass
            var as = $$(".fbHover");
            for (var i=0, a; a=as[i]; i++)
            {
                a.setAttribute("href", "javascript:void(0)");
            }
        }
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // initialize all panels
        /*
        var panelMap = Firebug.panelTypes;
        for (var i=0, p; p=panelMap[i]; i++)
        {
            if (!p.parentPanel)
            {
                this.addPanel(p.prototype.name);
            }
        }
        /**/
        
        // ************************************************************************************************
        // ************************************************************************************************
        // ************************************************************************************************
        // ************************************************************************************************
        
        if(Firebug.Inspector)
            this.inspectButton.initialize();
        
        // ************************************************************************************************
        // ************************************************************************************************
        // ************************************************************************************************
        // ************************************************************************************************
        
        // Select the first registered panel
        // TODO: BUG IE7
        var self = this;
        setTimeout(function(){
            self.selectPanel(FirebugChrome.selectedPanelName);
            
            if (FirebugChrome.selectedPanelName == "Console")
                Firebug.chrome.focusCommandLine();
        },0);
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        //this.draw();
        
        this.testMenu();
    },
    
    shutdown: function()
    {
        // ************************************************************************************************
        // ************************************************************************************************
        // ************************************************************************************************
        // ************************************************************************************************
        
        if(Firebug.Inspector)
            this.inspectButton.shutdown();
        
        // ************************************************************************************************
        // ************************************************************************************************
        // ************************************************************************************************
        // ************************************************************************************************

        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        
        // remove disableTextSelection event handlers
        restoreTextSelection($("fbToolbar"));
        restoreTextSelection($("fbPanelBarBox"));
        restoreTextSelection($("fbPanelBar1"));
        restoreTextSelection($("fbPanelBar2"));
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Remove the interface elements cache
        
        fbTop = null;
        fbContent = null;
        fbContentStyle = null;
        fbBottom = null;
        fbBtnInspect = null;
        
        fbToolbar = null;

        fbPanelBox1 = null;
        fbPanelBox1Style = null;
        fbPanelBox2 = null;
        fbPanelBox2Style = null;
        fbPanelBar2Box = null;
        fbPanelBar2BoxStyle = null;
  
        fbHSplitter = null;
        fbVSplitter = null;
        fbVSplitterStyle = null;
  
        fbPanel1 = null;
        fbPanel1Style = null;
        fbPanel2 = null;
  
        fbConsole = null;
        fbConsoleStyle = null;
        fbHTML = null;
  
        fbCommandLine = null;
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // static values cache
        
        topHeight = null;
        topPartialHeight = null;
        
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // shutdown inherited classes
        Controller.shutdown.call(this);
        PanelBar.shutdown.call(this);
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // destroy the instance of the CommandLine class
        if (Firebug.CommandLine)
            commandLine.destroy();
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    toggle: function(forceOpen, popup)
    {
        if(popup)
        {
            this.detach();
        }
        else
        {
            if (isOpera && Firebug.chrome.type == "popup" && Firebug.chrome.node.closed)
            {
                var frame = FirebugChrome.chromeMap.frame;
                frame.reattach();
                
                FirebugChrome.chromeMap.popup = null;
                
                frame.open();
                
                return;
            }
                
            // If the context is a popup, ignores the toggle process
            if (Firebug.chrome.type == "popup") return;
            
            var shouldOpen = forceOpen || !FirebugChrome.isOpen;
            
            if(shouldOpen)
               this.open();
            else
               this.close();
        }       
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    detach: function()
    {
        if(!FirebugChrome.chromeMap.popup)
        {     
            createChromeWindow({type: "popup"});
        }
    },
    
    reattach: function(oldChrome, newChrome)
    {
        Firebug.browser.window.Firebug = Firebug;
        
        // chrome synchronization
        var newPanelMap = newChrome.panelMap;
        var oldPanelMap = oldChrome.panelMap;
        
        var panel;
        for(var name in newPanelMap)
        {
            // TODO: xxxpedro innerHTML
            panel = newPanelMap[name]; 
            if (panel.options.innerHTMLSync)
                panel.contentNode.innerHTML = oldPanelMap[name].contentNode.innerHTML;
        }
        
        Firebug.chrome = newChrome;
        
        // TODO: xxxpedro sync detach reattach attach
        //dispatch(Firebug.chrome.panelMap, "detach", [oldChrome, newChrome]);
        
        if (newChrome.type == "popup")
        {
            newChrome.initialize();
            //dispatch(Firebug.modules, "initialize", []);
        }
        else
        {
            // TODO: xxxpedro only needed in persistent
            // should use FirebugChrome.clone, but popup FBChrome
            // isn't acessible 
            FirebugChrome.selectedPanelName = oldChrome.selectedPanel.name;
        }
        
        dispatch(newPanelMap, "reattach", [oldChrome, newChrome]);
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    draw: function()
    {
        var size = Firebug.chrome.getWindowSize();
        
        // Height related values
        var commandLineHeight = Firebug.chrome.commandLineVisible ? fbCommandLine.offsetHeight : 0,
            y = Math.max(size.height /* chrome height */, topHeight),
            
            height = Math.max(y - topHeight - commandLineHeight /* fixed height */, 0)+ "px",
            
            
            // Width related values
            sideWidth = Firebug.chrome.sidePanelVisible ? FirebugChrome.sidePanelWidth : 0,
            
            width = Math.max(size.width /* chrome width */ - sideWidth, 0) + "px";
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Height related rendering
        fbPanelBox1Style.height = height;
        fbPanel1Style.height = height;
        
        if (isIE || isOpera)
        {
            // Fix IE and Opera problems with auto resizing the verticall splitter
            fbVSplitterStyle.height = Math.max(y - topPartialHeight - commandLineHeight, 0) + "px";
        }
        //xxxpedro FF2 only?
        /*
        else if (isFirefox)
        {
            // Fix Firefox problem with table rows with 100% height (fit height)
            fbContentStyle.maxHeight = Math.max(y - fixedHeight, 0)+ "px";
        }/**/
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        // Width related rendering
        fbPanelBox1Style.width = width;
        fbPanel1Style.width = width;
        
        // SidePanel rendering
        if (Firebug.chrome.sidePanelVisible)
        {
            sideWidth = Math.max(sideWidth - 6, 0) + "px";
            
            fbPanel2Style.height = height;
            fbPanel2Style.width = sideWidth;
            
            fbPanelBox2Style.width = sideWidth;
            fbPanelBar2BoxStyle.width = sideWidth;
            fbVSplitterStyle.right = sideWidth;
        }
    },
    
    resize: function()
    {
        var self = this;
        // avoid partial resize when maximizing window
        setTimeout(function(){
            self.draw();
            
            if (noFixedPosition && self.type == "frame")
                self.fixIEPosition();
        }, 0);
    },
    
    layout: function(panel)
    {
        if (FBTrace.DBG_CHROME) FBTrace.sysout("Chrome.layout", "");
        
        var options = panel.options;
        
        changeCommandLineVisibility(options.hasCommandLine);
        changeSidePanelVisibility(options.hasSidePanel);
        
        Firebug.chrome.draw();
    },
    
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    
    focusCommandLine: function()
    {
        var selectedPanelName = this.selectedPanel.name, panelToSelect;
        
        if (focusCommandLineState == 0 || selectedPanelName != "Console")
        {
            focusCommandLineState = 0;
            lastFocusedPanelName = selectedPanelName;
            
            panelToSelect = "Console";
        }
        if (focusCommandLineState == 1)
        {
            panelToSelect = lastFocusedPanelName;
        }
        
        this.selectPanel(panelToSelect);
        
        if (panelToSelect == "Console")
            commandLine.element.focus();
        else
            fbPanel1.focus();
        
        focusCommandLineState = ++focusCommandLineState % 2;
    }
    
});

var focusCommandLineState = 0, lastFocusedPanelName; 

// ************************************************************************************************
// ChromeFrameBase

var ChromeFrameBase = extend(ChromeBase,
{
    create: function()
    {
        ChromeBase.create.call(this);
        
        // restore display for the anti-flicker trick
        if (isFirefox)
            this.node.style.display = "block";
        
        if (Env.Options.startInNewWindow)
        {
            this.close();
            this.toggle(true, true);
            return;
        }
        
        if (Env.Options.startOpened)
            this.open();
        else
            this.close();
    },
    
    destroy: function()
    {
        removeGlobalEvent("keydown", onGlobalKeyDown);
        
        ChromeBase.destroy.call(this);
        
        this.document = null;
        delete this.document;
        
        this.window = null;
        delete this.window;
        
        this.node.parentNode.removeChild(this.node);
        this.node = null;
        delete this.node;
    },
    
    initialize: function()
    {
        //FBTrace.sysout("Frame", "initialize();")
        ChromeBase.initialize.call(this);
        
        this.addController(
            [Firebug.browser.window, "resize", this.resize],
            [$("fbChrome_btClose"), "click", this.close],
            [$("fbChrome_btDetach"), "click", this.detach]       
        );
        
        if (!Env.Options.enablePersistent)
            this.addController([Firebug.browser.window, "unload", Firebug.shutdown]);
        
        if (noFixedPosition)
        {
            this.addController(
                [Firebug.browser.window, "scroll", this.fixIEPosition]
            );
        }
        
        fbVSplitter.onmousedown = onVSplitterMouseDown;
        fbHSplitter.onmousedown = onHSplitterMouseDown;
        
        this.isInitialized = true;
    },
    
    shutdown: function()
    {
        fbVSplitter.onmousedown = null;
        fbHSplitter.onmousedown = null;
        
        ChromeBase.shutdown.apply(this);
        
        this.isInitialized = false;
    },
    
    reattach: function()
    {
        var frame = FirebugChrome.chromeMap.frame;
        
        ChromeBase.reattach(FirebugChrome.chromeMap.popup, this);
    },
    
    open: function()
    {
        if (!FirebugChrome.isOpen)
        {
            FirebugChrome.isOpen = true;
            
            var node = this.node;
            
            node.style.visibility = "hidden"; // Avoid flickering
            
            if (Firebug.showIconWhenHidden)
            {
                if (ChromeMini.isInitialized)
                {
                    ChromeMini.shutdown();
                }
                
            }
            else
                node.style.display = "block";
            
            var main = $("fbChrome");
            main.style.display = "block";
            
            var self = this;
            setTimeout(function(){
                node.style.visibility = "visible";
                
                //dispatch(Firebug.modules, "initialize", []);
                self.initialize();
                
                if (noFixedPosition)
                    self.fixIEPosition();
                
                self.draw();
        
            }, 10);
        }
    },
    
    close: function()
    {
        if (FirebugChrome.isOpen || !this.isInitialized)
        {
            if (this.isInitialized)
            {
                //dispatch(Firebug.modules, "shutdown", []);
                this.shutdown();
            }
            
            FirebugChrome.isOpen = false;
            
            var node = this.node;
            
            if (Firebug.showIconWhenHidden)
            {
                node.style.visibility = "hidden"; // Avoid flickering
                
                // TODO: xxxpedro - persist IE fixed? 
                var main = $("fbChrome", FirebugChrome.chromeMap.frame.document);
                main.style.display = "none";
                        
                ChromeMini.initialize();
                
                node.style.visibility = "visible";
            }
            else
                node.style.display = "none";
        }
    },
    
    fixIEPosition: function()
    {
        // fix IE problem with offset when not in fullscreen mode
        var doc = this.document;
        var offset = isIE ? doc.body.clientTop || doc.documentElement.clientTop: 0;
        
        var size = Firebug.browser.getWindowSize();
        var scroll = Firebug.browser.getWindowScrollPosition();
        var maxHeight = size.height;
        var height = this.node.offsetHeight;
        
        var bodyStyle = doc.body.currentStyle;
        
        this.node.style.top = maxHeight - height + scroll.top + "px";
        
        if (this.type == "frame" && (bodyStyle.marginLeft || bodyStyle.marginRight))
        {
            this.node.style.width = size.width + "px";
        }
        
        if (fbVSplitterStyle)
            fbVSplitterStyle.right = FirebugChrome.sidePanelWidth + "px";
        
        this.draw();
    }

});


// ************************************************************************************************
// ChromeMini

var ChromeMini = extend(Controller, 
{
    create: function(chrome)
    {
        append(this, chrome);
        this.type = "mini";
    },
    
    initialize: function()
    {
        Controller.initialize.apply(this);
        
        var doc = FirebugChrome.chromeMap.frame.document;
        
        var mini = $("fbMiniChrome", doc);
        mini.style.display = "block";
        
        var miniIcon = $("fbMiniIcon", doc);
        var width = miniIcon.offsetWidth + 10;
        miniIcon.title = "Open " + Firebug.version;
        
        var errors = $("fbMiniErrors", doc);
        if (errors.offsetWidth)
            width += errors.offsetWidth + 10;
        
        var node = this.node;
        node.style.height = "27px";
        node.style.width = width + "px";
        node.style.left = "";
        node.style.right = 0;
        node.setAttribute("allowTransparency", "true");

        if (noFixedPosition)
            this.fixIEPosition();
        
        this.document.body.style.backgroundColor = "transparent";
        
        
        this.addController(
            [$("fbMiniIcon", doc), "click", onMiniIconClick]       
        );
        
        if (noFixedPosition)
        {
            this.addController(
                [Firebug.browser.window, "scroll", this.fixIEPosition]
            );
        }
        
        this.isInitialized = true;
    },
    
    shutdown: function()
    {
        var node = this.node;
        node.style.height = FirebugChrome.height + "px";
        node.style.width = "100%";
        node.style.left = 0;
        node.style.right = "";
        node.setAttribute("allowTransparency", "false");
        
        if (noFixedPosition)
            this.fixIEPosition();
        
        this.document.body.style.backgroundColor = "#fff";
        
        var doc = FirebugChrome.chromeMap.frame.document;
        
        var mini = $("fbMiniChrome", doc);
        mini.style.display = "none";
        
        Controller.shutdown.apply(this);
        
        this.isInitialized = false;
    },
    
    draw: function()
    {
    
    },
    
    fixIEPosition: ChromeFrameBase.fixIEPosition
    
});


// ************************************************************************************************
// ChromePopupBase

var ChromePopupBase = extend(ChromeBase, {
    
    initialize: function()
    {
        this.document.body.className = "FirebugPopup";
        
        ChromeBase.initialize.call(this)
        
        this.addController(
            [Firebug.chrome.window, "resize", this.resize],
            [Firebug.chrome.window, "unload", this.destroy]
        );
        
        if (Env.Options.enablePersistent)
        {
            this.persist = bind(this.persist, this);
            addEvent(Firebug.browser.window, "unload", this.persist);
        }
        else
            this.addController(
                [Firebug.browser.window, "unload", this.close]
            );
        
        fbVSplitter.onmousedown = onVSplitterMouseDown;
    },
    
    destroy: function()
    {
        // TODO: xxxpedro sync detach reattach attach
        var frame = FirebugChrome.chromeMap.frame;
        
        if(frame)
        {
            dispatch(frame.panelMap, "detach", [this, frame]);
            
            frame.reattach(this, frame);
        }
        
        if (Env.Options.enablePersistent)
        {
            removeEvent(Firebug.browser.window, "unload", this.persist);
        }
        
        ChromeBase.destroy.apply(this);
        
        FirebugChrome.chromeMap.popup = null;
        
        this.node.close();
    },
    
    persist: function()
    {
        persistTimeStart = new Date().getTime();
        
        removeEvent(Firebug.browser.window, "unload", this.persist);
        
        Firebug.Inspector.destroy();
        Firebug.browser.window.FirebugOldBrowser = true;
        
        var persistTimeStart = new Date().getTime();
        
        var waitMainWindow = function()
        {
            var doc, head;
        
            try
            {
                if (window.opener && !window.opener.FirebugOldBrowser && (doc = window.opener.document)/* && 
                    doc.documentElement && (head = doc.documentElement.firstChild)*/)
                {
                    
                    try
                    {
                        var persistDelay = new Date().getTime() - persistTimeStart;
                
                        window.Firebug = Firebug;
                        window.opener.Firebug = Firebug;
                
                        Env.browser = window.opener;
                        Firebug.browser = Firebug.context = new Context(Env.browser);
                
                        registerConsole();
                
                        var chrome = Firebug.chrome;
                        addEvent(Firebug.browser.window, "unload", chrome.persist)
                
                        FBL.cacheDocument();
                        Firebug.Inspector.create();
                
                        var htmlPanel = chrome.getPanel("HTML");
                        htmlPanel.createUI();
                        
                        Firebug.Console.info("Firebug could not capture console calls during " + 
                                persistDelay + "ms");
                    }
                    catch(pE)
                    {
                        alert("persist error: " + (pE.message || pE));
                    }
                    
                }
                else
                {
                    window.setTimeout(waitMainWindow, 0);
                }
            
            } catch (E) {
                window.close();
            }
        };
        
        waitMainWindow();    
    },
    
    close: function()
    {
        this.destroy();
    }

});



// ************************************************************************************************
// Internals


// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
//
var commandLine = null;


// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// Interface Elements Cache

var fbTop = null;
var fbContent = null;
var fbContentStyle = null;
var fbBottom = null;
var fbBtnInspect = null;

var fbToolbar = null;

var fbPanelBox1 = null;
var fbPanelBox1Style = null;
var fbPanelBox2 = null;
var fbPanelBox2Style = null;
var fbPanelBar2Box = null;
var fbPanelBar2BoxStyle = null;

var fbHSplitter = null;
var fbVSplitter = null;
var fbVSplitterStyle = null;

var fbPanel1 = null;
var fbPanel1Style = null;
var fbPanel2 = null;
var fbPanel2Style = null;

var fbConsole = null;
var fbConsoleStyle = null;
var fbHTML = null;

var fbCommandLine = null;

//* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

var topHeight = null;
var topPartialHeight = null;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

var chromeRedrawSkipRate = isIE ? 75 : isOpera ? 80 : 75;

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

var lastSelectedPanelName = null;


//************************************************************************************************
// UI helpers

var changeCommandLineVisibility = function changeCommandLineVisibility(visibility)
{
    var last = Firebug.chrome.commandLineVisible;
    Firebug.chrome.commandLineVisible =  
        typeof visibility == "boolean" ? visibility : !Firebug.chrome.commandLineVisible;
    
    if (Firebug.chrome.commandLineVisible != last)
    {
        fbBottom.className = Firebug.chrome.commandLineVisible ? "" : "hide";
    }
};

var changeSidePanelVisibility = function changeSidePanelVisibility(visibility)
{
    var last = Firebug.chrome.sidePanelVisible;
    Firebug.chrome.sidePanelVisible =  
        typeof visibility == "boolean" ? visibility : !Firebug.chrome.sidePanelVisible;
    
    if (Firebug.chrome.sidePanelVisible != last)
    {
        fbPanelBox2.className = Firebug.chrome.sidePanelVisible ? "" : "hide"; 
        fbPanelBar2Box.className = Firebug.chrome.sidePanelVisible ? "" : "hide";
    }
};


// ************************************************************************************************
// F12 Handler

var onGlobalKeyDown = function onGlobalKeyDown(event)
{
    var keyCode = event.keyCode;
    var shiftKey = event.shiftKey;
    var ctrlKey = event.ctrlKey;
    
    if (keyCode == 123 /* F12 */ && (!isFirefox && !shiftKey || shiftKey && isFirefox))
    {
        Firebug.chrome.toggle(false, ctrlKey);
        cancelEvent(event, true);
    }
    else if (keyCode == 67 /* C */ && ctrlKey && shiftKey)
    {
        Firebug.Inspector.toggleInspect();
        cancelEvent(event, true);
    }
    else if (keyCode == 76 /* L */ && ctrlKey && shiftKey)
    {
        Firebug.chrome.focusCommandLine();
        cancelEvent(event, true);
    }
};

var onMiniIconClick = function onMiniIconClick(event)
{
    Firebug.chrome.toggle(false, event.ctrlKey);
    cancelEvent(event, true);
}
    

// ************************************************************************************************
// Horizontal Splitter Handling

var onHSplitterMouseDown = function onHSplitterMouseDown(event)
{
    addGlobalEvent("mousemove", onHSplitterMouseMove);
    addGlobalEvent("mouseup", onHSplitterMouseUp);
    
    if (isIE)
        addEvent(Firebug.browser.document.documentElement, "mouseleave", onHSplitterMouseUp);
    
    fbHSplitter.className = "fbOnMovingHSplitter";
    
    return false;
};

var lastHSplitterMouseMove = 0;
var onHSplitterMouseMoveBuffer = null;
var onHSplitterMouseMoveTimer = null;

var onHSplitterMouseMove = function onHSplitterMouseMove(event)
{
    cancelEvent(event, true);
    
    var clientY = event.clientY;
    var win = isIE
        ? event.srcElement.ownerDocument.parentWindow
        : event.target.ownerDocument && event.target.ownerDocument.defaultView;
    
    if (!win)
        return;
    
    if (win != win.parent)
    {
        var frameElement = win.frameElement;
        if (frameElement)
        {
            var framePos = Firebug.browser.getElementPosition(frameElement).top;
            clientY += framePos;
            
            if (frameElement.style.position != "fixed")
                clientY -= Firebug.browser.getWindowScrollPosition().top;
        }
    }
    
    if (isOpera && isQuiksMode && win.frameElement.id == "FirebugUI")
    {
        clientY = Firebug.browser.getWindowSize().height - win.frameElement.offsetHeight + clientY;
    }
    /*
    console.log(
            typeof win.FBL != "undefined" ? "no-Chrome" : "Chrome",
            //win.frameElement.id,
            event.target,
            clientY
        );/**/
    
    onHSplitterMouseMoveBuffer = clientY; // buffer
    
    if (new Date().getTime() - lastHSplitterMouseMove > chromeRedrawSkipRate) // frame skipping
    {
        lastHSplitterMouseMove = new Date().getTime();
        handleHSplitterMouseMove();
    }
    else
        if (!onHSplitterMouseMoveTimer)
            onHSplitterMouseMoveTimer = setTimeout(handleHSplitterMouseMove, chromeRedrawSkipRate);
    
    return false;
};

var handleHSplitterMouseMove = function()
{
    if (onHSplitterMouseMoveTimer)
    {
        clearTimeout(onHSplitterMouseMoveTimer);
        onHSplitterMouseMoveTimer = null;
    }
    
    var clientY = onHSplitterMouseMoveBuffer;
    
    var windowSize = Firebug.browser.getWindowSize();
    var scrollSize = Firebug.browser.getWindowScrollSize();
    
    // compute chrome fixed size (top bar and command line)
    var commandLineHeight = Firebug.chrome.commandLineVisible ? fbCommandLine.offsetHeight : 0;
    var fixedHeight = topHeight + commandLineHeight;
    var chromeNode = Firebug.chrome.node;
    
    var scrollbarSize = !isIE && (scrollSize.width > windowSize.width) ? 17 : 0;
    
    //var height = !isOpera ? chromeNode.offsetTop + chromeNode.clientHeight : windowSize.height;
    var height =  windowSize.height;
    
    // compute the min and max size of the chrome
    var chromeHeight = Math.max(height - clientY + 5 - scrollbarSize, fixedHeight);
        chromeHeight = Math.min(chromeHeight, windowSize.height - scrollbarSize);

    FirebugChrome.height = chromeHeight;
    chromeNode.style.height = chromeHeight + "px";
    
    if (noFixedPosition)
        Firebug.chrome.fixIEPosition();
    
    Firebug.chrome.draw();
};

var onHSplitterMouseUp = function onHSplitterMouseUp(event)
{
    removeGlobalEvent("mousemove", onHSplitterMouseMove);
    removeGlobalEvent("mouseup", onHSplitterMouseUp);
    
    if (isIE)
        removeEvent(Firebug.browser.document.documentElement, "mouseleave", onHSplitterMouseUp);
    
    fbHSplitter.className = "";
    
    Firebug.chrome.draw();
    
    // avoid text selection in IE when returning to the document
    // after the mouse leaves the document during the resizing
    return false;
};


// ************************************************************************************************
// Vertical Splitter Handling

var onVSplitterMouseDown = function onVSplitterMouseDown(event)
{
    addGlobalEvent("mousemove", onVSplitterMouseMove);
    addGlobalEvent("mouseup", onVSplitterMouseUp);
    
    return false;
};

var lastVSplitterMouseMove = 0;

var onVSplitterMouseMove = function onVSplitterMouseMove(event)
{
    if (new Date().getTime() - lastVSplitterMouseMove > chromeRedrawSkipRate) // frame skipping
    {
        var target = event.target || event.srcElement;
        if (target && target.ownerDocument) // avoid error when cursor reaches out of the chrome
        {
            var clientX = event.clientX;
            var win = document.all
                ? event.srcElement.ownerDocument.parentWindow
                : event.target.ownerDocument.defaultView;
          
            if (win != win.parent)
                clientX += win.frameElement ? win.frameElement.offsetLeft : 0;
            
            var size = Firebug.chrome.getWindowSize();
            var x = Math.max(size.width - clientX + 3, 6);
            
            FirebugChrome.sidePanelWidth = x;
            Firebug.chrome.draw();
        }
        
        lastVSplitterMouseMove = new Date().getTime();
    }
    
    cancelEvent(event, true);
    return false;
};

var onVSplitterMouseUp = function onVSplitterMouseUp(event)
{
    removeGlobalEvent("mousemove", onVSplitterMouseMove);
    removeGlobalEvent("mouseup", onVSplitterMouseUp);
    
    Firebug.chrome.draw();
};


// ************************************************************************************************
}});
function runTest()
{
    FBTest.sysout("issue4386.START");
    FBTest.openNewTab(basePath + "dom/4386/issue4386.html", function(win)
    {
        FBTest.openFirebug();

        FBTestFirebug.enableScriptPanel(function(win)
        {
            FBTest.reload(function()
            {
                var panel = FBTest.selectPanel("dom");

                // expand to 'a' property
                expandProperty("test", "a", function(row)
                {
                    panel.breakOnProperty(row);

                    // 'b' property
                    row = FBTest.getDOMPropertyRow(null, "b");
                    panel.breakOnProperty(row);

                    // 'c' property
                    row = FBTest.getDOMPropertyRow(null, "c");
                    panel.breakOnProperty(row);

                    // 'd' property
                    row = FBTest.getDOMPropertyRow(null, "d");
                    panel.breakOnProperty(row);

                    FBTest.selectPanel("script");
                    var sidePanel = FBTest.selectSidePanel("breakpoints");
                    var breakpoints = sidePanel.panelNode.querySelectorAll(".breakpointRow");
                    var breakpoint = breakpoints[0];

                    if (FBTest.compare(4, breakpoints.length, "There must be four breakpoints"))
                    {
                        // Delete first breakpoint
                        FBTest.click(breakpoint.querySelector(".closeButton"));
    
                        // Delete second breakpoint
                        breakpoint = sidePanel.panelNode.querySelector(".breakpointRow");
                        FBTest.click(breakpoint.querySelector(".closeButton"));
        
                        // Disable third breakpoint
                        breakpoint = sidePanel.panelNode.querySelector(".breakpointRow");
                        FBTest.click(breakpoint.querySelector(".breakpointCheckbox"));
                    }

                    // Wait until third breakpoint is disabled
                    setTimeout(function ()
                    {
                        breakpoints = sidePanel.panelNode.querySelectorAll(".breakpointRow");
                        FBTest.compare(2, breakpoints.length, "There must be two breakpoints left");
                        FBTest.compare("false", breakpoints[0].getAttribute("aria-checked"), "The first remaining breakpoint (for 'c') must be disabled");
                        FBTest.compare("true", breakpoints[1].getAttribute("aria-checked"), "The second remaining breakpoint (for 'd') must be enabled");
      
                        panel = FBTest.selectPanel("dom");
    
                        // 'a' property
                        row = FBTest.getDOMPropertyRow(null, "a");
                        FBTest.compare(undefined, row.getAttribute("breakpoint"), "The property 'a' must not have a breakpoint set");
    
                        // 'b' property
                        row = FBTest.getDOMPropertyRow(null, "b");
                        FBTest.compare(undefined, row.getAttribute("breakpoint"), "The property 'b' must not have a breakpoint set");
    
                        // 'c' property
                        row = FBTest.getDOMPropertyRow(null, "c");
                        FBTest.compare("true", row.getAttribute("disabledbreakpoint"), "The property 'c' must have a disabled breakpoint set");
    
                        // 'd' property
                        row = FBTest.getDOMPropertyRow(null, "d");
                        FBTest.compare("true", row.getAttribute("breakpoint"), "The property 'b' must have an enabled breakpoint set");

                        FBTest.testDone("issue4386.DONE");
                    }, 500);
                });
            });
        });
    });
}

//xxxHonza: should be part of FBTest namespace. See also dom/2772
function expandProperty(propName, lastChild, callback)
{
    FBTest.waitForDOMProperty(lastChild, callback);

    var row = FBTest.getDOMPropertyRow(null, propName);
    var propLabel = row.querySelector(".memberLabel.userLabel");
    FBTest.click(propLabel);
}
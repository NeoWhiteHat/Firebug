function runTest()
{
    FBTest.sysout("issue2976.START");
    FBTest.openNewTab(basePath + "css/2976/issue2976.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.enableNetPanel(function(win)
        {
            FW.Firebug.chrome.selectPanel("html");

            FBTest.selectElementInHtmlPanel("myElement", function(node)
            {
                // Reset clipboard content
                FBTest.clearClipboard();

                var stylePanel = FW.Firebug.chrome.selectSidePanel("css");
                var cssSelector = stylePanel.panelNode.querySelector(".cssSelector");
                FBTest.executeContextMenuCommand(cssSelector, "fbCopyStyleDeclaration", function()
                {
                    setTimeout(function() {
                        var cssDecl = FBTest.getClipboardText();
                        var expected = /background-color: LightYellow;\s*color: red;\s*font-weight: bold;/;
                        FBTest.compare(expected, cssDecl,
                            "CSS declaration must be properly copied into the clipboard");
                        FBTest.testDone("issue2976.DONE");
                    }, 1000);
                });
            })
        });
    });
}

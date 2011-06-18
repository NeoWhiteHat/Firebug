function runTest()
{
    FBTest.sysout("issue1338.START");
    FBTest.openNewTab(basePath + "css/1338/issue1338.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.selectPanel("html");

        // Search for 'element1' within the HTML panel, which
        // automatically expands the tree.
        FBTest.searchInHtmlPanel("element1", function(sel)
        {
            FBTest.sysout("issue1338; selection:", sel);

            // Click on the element to make sure it's selected.
            var nodeLabelBox = FW.FBL.getAncestorByClass(sel.anchorNode, "nodeLabelBox");
            var nodeTag = nodeLabelBox.querySelector(".nodeTag");
            FBTest.mouseDown(nodeTag);

            var panel = FBTest.selectSidePanel("css");
            var values = panel.panelNode.querySelectorAll(".cssPropValue");

            // Click the CSS value of the height property to open the inline editor
            FBTest.synthesizeMouse(values[2]);

            var editor = panel.panelNode.querySelector(".textEditorInner");

            // Press 'Up' and verify incrementation
            FBTest.sendShortcut("VK_UP");
            FBTest.compare("8em", editor.value, "Must be incremented to 8em");

            // Press 'Ctrl+Up' and verify incrementation
            FBTest.sendShortcut("VK_UP", {ctrlKey: true});
            FBTest.compare("8.1em", editor.value, "Must be incremented to 8.1em");

            // Press 'Shift+Up' and verify incrementation
            FBTest.sendShortcut("VK_UP", {shiftKey: true});
            FBTest.compare("18.1em", editor.value, "Must be incremented to 18.1em");

            // Press 'Down' and verify incrementation
            FBTest.sendShortcut("VK_DOWN");
            FBTest.compare("17.1em", editor.value, "Must be decremented to 17.1em");

            // Press 'Ctrl+Down' and verify incrementation
            FBTest.sendShortcut("VK_DOWN", {ctrlKey: true});
            FBTest.compare("17em", editor.value, "Must be decremented to 17em");

            // Press 'Shift+Down' and verify incrementation
            FBTest.sendShortcut("VK_DOWN", {shiftKey: true});
            FBTest.compare("7em", editor.value, "Must be decremented to 7em");

            FBTest.testDone("issue1338.DONE");
        });
    });
}
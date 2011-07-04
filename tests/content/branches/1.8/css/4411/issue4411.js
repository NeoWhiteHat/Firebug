function runTest()
{
    FBTest.sysout("issue4411.START");
    FBTest.openNewTab(basePath + "css/4411/issue4411.html", function(win)
    {
        FBTest.openFirebug();
        var panel = FBTest.selectPanel("stylesheet");

        FBTest.selectPanelLocationByName(panel, "issue4411.html");

        var tests = [];
        tests.push(hexValue);
        tests.push(namedColor);
        tests.push(rgb);
        tests.push(rgba);
        tests.push(hsl);
        tests.push(hsla);

        FBTestFirebug.runTestSuite(tests, function()
        {
            FBTest.testDone("issue4411; DONE");
        });
    });
}

function hexValue(callback)
{
    executeTest("#hex", "rgb(140, 255, 140)", callback);
}

function namedColor(callback)
{
    executeTest("#name", "lightgreen", callback);
}

function rgb(callback)
{
    executeTest("#rgb", "rgb(140, 255, 140)", callback);
}

function rgba(callback)
{
    executeTest("#rgba", "rgba(140, 255, 140, 0.5)", callback);
}

function hsl(callback)
{
    executeTest("#hsl", "rgb(137, 255, 137)", callback);
}

function hsla(callback)
{
    executeTest("#hsla", "rgba(137, 255, 137, 0.5)", callback);
}

//************************************************************************************************

function executeTest(elementID, expectedValue, callback)
{
    FBTest.searchInCssPanel(elementID, function(node)
    {
        FBTest.sysout("issue4411; selection: ", node);
    
        var rule = FW.FBL.getAncestorByClass(node, "cssRule");
        var propValue = rule.querySelector(".cssPropValue");
        FBTest.mouseOver(propValue);
    
        var config = {tagName: "div", classes: "infoTipColorBox"};
        FBTest.waitForDisplayedElement("stylesheet", config, function (infoTip)
        {
            var infoTipActive = infoTip.parentNode.getAttribute("active");

            if (FBTest.ok(infoTipActive,
                "There must be a color infotip shown hovering the value of the 'color' property " +
                "of '" + elementID + "'."))
            {
                FBTest.compare(expectedValue, infoTip.firstChild.style.backgroundColor,
                    "The infotip must contain the same color as specified in the " +
                    "rule '" + elementID + "'.");
            }

            callback();
        });
    });
}
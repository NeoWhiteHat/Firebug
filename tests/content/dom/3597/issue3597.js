function runTest()
{
    FBTest.sysout("issue3597.START");
    FBTest.openNewTab(basePath + "dom/3597/issue3597.html", function(win)
    {
        FBTest.openFirebug();

        expandProperty("_testString", "childObj", function()
        {
            expandProperty("childObj", "lastItem", function()
            {
                FBTest.click(win.document.getElementById("testButton"));
                panel.rebuild(true);

                // Wait till the _testString is displayed again.
                FBTest.waitForDOMProperty("_testString", function(row)
                {
                    var row = getPropertyRow(panel, "_testString");

                    // The _testString must have 'string' type now.
                    FBTest.compare(
                        /_testString\"\{\"childObj\"\:\{\"a\"\:5\,\"b\"\:4\,\"lastItem\"\:5\}\}/,
                        row.textContent, "The object must be displayed as a string now");

                    FBTest.testDone("issue3597.DONE");
                });
            });
        });
    });
}

//xxxHonza: should be part of FBTest namespace. See also dom/2772
function expandProperty(panel, propName, lastChild, callback)
{
    FBTest.waitForDOMProperty(lastChild, callback);

    var row = getPropertyRow(panel, propName);
    var propLabel = row.querySelector(".memberLabel.userLabel");
    FBTest.click(propLabel);
}

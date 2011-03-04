function runTest()
{
    FBTest.sysout("UrlParams.START");
    FBTest.openNewTab(basePath + "net/url-params/test.html", function(win)
    {
        FBTest.openFirebug();
        FBTest.enableNetPanel(function(win)
        {
            var panel = FW.FirebugChrome.selectPanel("net");

            var config = {tagName: "tr", classes: "netRow category-xhr hasHeaders loaded"};
            FBTest.waitForDisplayedElement("net", null, function(netRow)
            {
                // Expand net entry.
                FBTest.click(netRow);

                var netInfoRow = netRow.nextSibling;
                FBTestFirebug.expandElements(netInfoRow, "netInfoParamsTab");

                var paramsTable = netInfoRow.querySelector(".netInfoParamsTable");
                FBTest.compare("value11value22value33", paramsTable.textContent,
                    "Ampersands must be propery encoded.");

                FBTest.testDone("UrlParams.DONE");
            });

            FBTest.click(win.document.getElementById("testButton"));
        });
    });
}

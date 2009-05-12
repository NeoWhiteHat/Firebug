// FBTest entry point
function runTest()
{
    FBTest.sysout("search; START");
    FBTestFirebug.clearCache();
    FBTestFirebug.openNewTab(basePath + "search/netVictim.htm", function(win)
    {
        FBTestFirebug.enableNetPanel(function(win)
        {
            FBTestFirebug.selectPanel("net");

            // There is several configurations.
            var testSuite = [];

            // Test 1: 'script', forward, case insensitive, include response bodies.
            testSuite.push(function(callback)
            {
                executeSearchTest("script", false, false, true, function(counter)
                {
                    FBTest.compare(13, counter, "There must be precise number of occurences.");
                    callback();
                });
            });

            // Test 2: 'script', forward, case sensitive, include response bodies.
            testSuite.push(function(callback)
            {
                executeSearchTest("Script", false, true, true, function(counter)
                {
                    FBTest.compare(2, counter, "There must be precise number of occurences.");
                    callback();
                });
            });

            // Test 3: 'script', forward, case insensitive, not response bodies.
            testSuite.push(function(callback)
            {
                executeSearchTest("script", false, false, false, function(counter)
                {
                    FBTest.compare(1, counter, "There must be precise number of occurences.");
                    callback();
                });
            });

            runTestSuite(testSuite);
        });
    });
}

// Run various search configurations.
function runTestSuite(tests)
{
    var test = tests.shift();
    test.call(this, function()
    {
        if (tests.length > 0)
            setTimeout(function() { runTestSuite(tests); }, 100);
        else
            FBTestFirebug.testDone("search; DONE");
    })
}

// Set search box value and global search options.
function doSearch(text, reverse, caseSensitive, responseBody, callback)
{
    FW.document.getElementById("fbSearchBox").value = text;
    FW.Firebug.searchCaseSensitive = caseSensitive;
    FW.Firebug.netSearchResponseBody = responseBody;

    // Press enter key within the search box.
    FBTest.focus(FW.document.getElementById("fbSearchBox"));
    FBTest.pressKey(13, "fbSearchBox");
}

// Execute one test.
function executeSearchTest(text, reverse, caseSensitive, responseBody, callback)
{
    var counter = 0;
    var firstMatch = null;

    function searchNext()
    {
        var panel = FBTestFirebug.getPanel("net");
        var sel = panel.document.defaultView.getSelection();
        if (sel.rangeCount != 1)
        {
            FBTest.compare(1, sel.rangeCount, "There must be one range selected.");
            return callback(counter);
        }

        var match = sel.getRangeAt(0);

        // OK, we have found the first occurence again, so finish the test.
        FBTest.sysout("search.match; ", match);
        if (firstMatch && (firstMatch.compareBoundaryPoints(Range.START_TO_START, match) ||
            firstMatch.compareBoundaryPoints(Range.END_TO_END, match)) == 0)
            return callback(counter);

        // Remember the first match.
        if (!firstMatch)
        {
            firstMatch = match;
            FBTest.sysout("search.firstMatch; ", firstMatch);
        }

        counter++;

        doSearch(text, reverse, caseSensitive, responseBody, callback);
        setTimeout(searchNext, 300);
    };

    doSearch(text, reverse, caseSensitive, responseBody, callback);
    setTimeout(searchNext, 300);
}

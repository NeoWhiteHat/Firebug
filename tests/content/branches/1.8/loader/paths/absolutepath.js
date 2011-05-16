function runTest()
{
    FBTest.sysout("absolutepath.START;");
    FBTest.progress("using baseLocalPath: " + baseLocalPath);

    var baseUrl = baseLocalPath + "loader/paths/";
    var config = {
        context: baseUrl + Math.random(),  // to give each test its own loader,
    };

    var require = FBTest.getRequire();
    require(config, [
        baseUrl + "add",
        baseUrl + "subtract"
    ],
    function(AddModule, SubtractModule)
    {
        FBTest.compare(3, AddModule.add(1, 2), "The add module must be properly loaded");
        FBTest.compare(2, SubtractModule.subtract(3, 1), "The subtract module must be properly loaded");
        FBTest.testDone("absolutepath.DONE");
    });
}

function runTest() 
{
    FBTest.sysout("exampleTest.started");
    FBTest.ok(true, "This is a positive test");
    FBTest.ok(false, "This is a negative test");
    FBTest.compare("Expected", "Expected", "Compare test (positive)");
    FBTest.compare("Expected", "Actual", "Compare test (negative)");
    FBTest.testDone();
}

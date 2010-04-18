// Tests for StorageService module
Components.utils.import("resource://firebug/storageService.js");

function runTest() {
    FBTest.progress("Testing StorageService");

    var url = "test.json";
    var store = StorageService.getStorage(url);
    FBTest.ok(store, "StorageService.getStorage(url);");

    var bar = {first:"time", last:"best"};
    store.setItem("foo", bar);

    var barish = store.getItem("foo");

    for (var p in bar)
        FBTest.compare(bar[p], barish[p], "restore item "+p+" must match");

    setTimeout(function restoreFromDisk()
    {
        var restore = StorageService.getStorage(url);

        FBTest.compare(restore.length, 1, "one item should be restored");

        var key = restore.key(0);

        FBTest.compare(key, "foo", "the key should match");

        var rebarish = restore.getItem(key);

        for (var p in bar)
            FBTest.compare(bar[p], rebarish[p], "restore item "+p+" must match");

        restore.removeItem(key);

        FBTest.compare(restore.length, 0, "removing one item should leave zero");

        restore.clear();

        FBTest.testDone();

    }, 300);


}


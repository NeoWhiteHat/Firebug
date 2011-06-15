var eventAdapterForCSS = {

     onModelChangedCSS: function(changedLineIndex, lineText)
     {
        console.log("firebugPlugin onModelChangedCSS(%s, %s) ", changedLineIndex, lineText);
        firebugPlugin.firebugConnection.callService("IStylesheet", "onRuleLineChanged", [changedLineIndex, lineText]);
     },

};

var resourceOpener =
{

};

var firebugPlugin =
{
    connectToOrion: function() {
        var provider = new eclipse.PluginProvider();
        provider.registerServiceProvider("orion.edit.listener", eventAdapterForCSS, {});
        provider.connect();
        console.log("registered at orion.edit.listener ", eventAdapterForCSS);
    },

    // -------------------------------------
    connectToFirebug: function() {
        // listen for json messages from Firebug Dyne extension
        this.firebugConnection = jsonConnection.add(document.documentElement, this.firebugObjectReceiver.bind(this));
        // For events from dyne to orion
        this.firebugConnection.registerService("firebug.resource.opener", null, resourceOpener);
        console.log("firebugPlugin waiting for firebug at "+document.documentElement.ownerDocument.location, document.documentElement);

        this.firebugConnection.postObject({connection: "firebugPlugin waiting for firebug at "+document.documentElement.ownerDocument.location});

    },

    /*
     * Called when Firebug starts talking back to firebugPlugin
     */
    firebugObjectReceiver: function(props) {

        console.log("orionEditorAdapter received object ", props);
        // diagnostic to report we are ready for events
        console.log('orionEditorAdapter before orion ready message')
        this.firebugConnection.postObject({connection: "orion is ready"});
        console.log("orion posted ready");
    },
};

window.onload = function() {
    try{
        // listen for commands from Firebug
        firebugPlugin.connectToFirebug();
        // Connect to Orion in frame.parent
        firebugPlugin.connectToOrion();

    } catch (exc) {
        console.error(exc);
    }

};
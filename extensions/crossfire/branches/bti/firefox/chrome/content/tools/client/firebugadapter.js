/* See license.txt for terms of usage */

// ************************************************************************************************
// Module

define(["arch/tools"], function initializeFirebugAdapter(ToolsInterface)
{

// ************************************************************************************************
// Attach the BrowserToolsInterface to Firebug object
Firebug.ToolsAdapter =
{
    updateOption: function()
    {
        FBL.dispatch(Firebug.modules, 'updateOption', arguments);
    }
};
ToolsInterface.browser.addListener(Firebug.ToolsAdapter);

return exports = {};

});
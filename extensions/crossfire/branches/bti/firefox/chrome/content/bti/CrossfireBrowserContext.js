/* See license.txt for terms of usage */

define("CrossfireBrowserContext", [], function() {

    /**
     * Describes a root context in a browser - the content that has been served up
     * and is being rendered for a location (URL) that has been navigated to.
     *
     * @constructor
     * @param id unique context identifier, a {@link String} that cannot be <code>null</code>
     * @param url the URL associated with this context
     * @param browser the browser that contains the context
     * @type BrowserContext
     * @return a new {@link BrowserContext}
     * @version 1.0
     */
    function CrossfireBrowserContext(id, url, browser)
    {
        this.id = id;
        this.url = url;
        this.browser = browser;
        this.is_destroyed = false;
        this.is_loaded = false;
        this.compilationUnits = {}; // map of URL to compilation unit
    }

    // ************************************************************************************************
    // API

    /**
     * Returns the unique identifier of this context.
     * <p>
     * This function does not require communication with
     * the browser.
     * </p>
     * @function
     * @returns context identifier as a {@link String}
     */
    CrossfireBrowserContext.prototype.getId = function()
    {
        return this.id;
    };

    /**
     * Returns the URL associated with this context.
     * <p>
     * This function does not require communication with
     * the browser.
     * </p>
     * @function
     * @returns URL as a {@link String}
     */
    CrossfireBrowserContext.prototype.getURL = function()
    {
        return this.url;
    };

    /**
     * Returns the browser this context is contained in.
     * <p>
     * This function does not require communication with
     * the browser.
     * </p>
     * @function
     * @returns a {@link Browser}
     */
    CrossfireBrowserContext.prototype.getBrowser = function()
    {
        return this.browser;
    };

    /**
     * Returns whether this browser context currently exists. Returns <code>false</code>
     * if this context has been destroyed.
     * <p>
     * This function does not require communication with
     * the browser.
     * </p>
     * @function
     * @returns a boolean indicating whether this context currently exists
     */
    CrossfireBrowserContext.prototype.exists = function()
    {
        return !this.is_destroyed;
    };

    /**
     * Returns whether this browser context has completed loading. Returns <code>true</code>
     * if all compilation units referenced by this context have been loaded, otherwise
     * <code>false</code>.
     * <p>
     * This function does not require communication with
     * the browser.
     * </p>
     * @function
     * @returns a boolean indicating whether this context has completed loading
     */
    CrossfireBrowserContext.prototype.isLoaded = function()
    {
        return this.is_loaded;
    };

    /**
     * Requests all JavaScript compilation units that have been compiled (loaded) in this context
     * asynchronously. Compilation units will be retrieved from the browser (if required) and
     * reported to the listener function when available. The listener function may be called before or
     * after this function returns.
     *
     * @function
     * @param listener a function that accepts an array of {@link CompilationUnit}'s.
     */
    CrossfireBrowserContext.prototype.getCompilationUnits = function(listener)
    {
        // TODO:
    };

    /**
     * Returns the {@link CompilationUnit} associated with the specified URL or <code>null</code>
     * if none.
     * <p>
     * This function does not require communication with
     * the browser.
     * </p>
     * @function
     * @param url the URL a script is requested for
     * @returns a {@link CompilationUnit} or <code>null</code>
     */
    CrossfireBrowserContext.prototype.getCompilationUnit = function(url)
    {
        return this.compilationUnits[url];
    };

    /**
     * Returns the JavaScript execution context associated with this browser context
     * or <code>null</code> if none.
     *
     * @function
     * @returns a {@link JavaScriptStack} or <code>null</code>
     */
    CrossfireBrowserContext.prototype.getJavaScriptStack = function()
    {
        // TODO:
    };

    // ************************************************************************************************
    // Private

    /**
     * Notification this context has been destroyed. Clients should not call
     * this function. This function is called by the {@link Browser} implementation
     * of _contextDestroyed(..). Clients should call Browser._contextDestroyed(...)
     * when a context is destroyed.
     *
     * @function
     */
    CrossfireBrowserContext.prototype._destroyed = function()
    {
        this.is_destroyed = true;
    };

    /**
     * Notification this context has been destroyed. Clients should not call
     * this function. This function is called by the {@link Browser} implementation
     * of _contextLoaded(..). Clients should call Browser._contextLoaded(...)
     * when a context has completed loading.
     *
     * @function
     */
    CrossfireBrowserContext.prototype._loaded = function()
    {
        this.is_loaded = true;
    };

    /**
     * Adds the given compilation unit to the collection of compilation units in this execution context.
     * Sends 'onScript' notification. Subclasses should call the method when a script has been
     * created/added in the context. It should only be called once per script. Has no effect if
     * a script with an identical URL has already been added.
     *
     * @function
     * @param compilationUnit a {@link CompilationUnit}
     */
    CrossfireBrowserContext.prototype._addCompilationUnit = function(compilationUnit)
    {
        if (!this.compilationUnits[compilationUnit.getURL()])
        {
            this.compilationUnits[compilationUnit.getURL()] = compilationUnit;
            this.getBrowser()._dispatch("onScript", [compilationUnit]);
        }
    };

    /**
     * Returns a copy of the compilation units known to this execution context in an array.
     *
     * @function
     * @returns array of {@link CompilationUnit}
     */
    CrossfireBrowserContext.prototype._getCompilationUnits = function()
    {
        var copyScripts = [];
        for (var url in this.compilationUnits)
            copyScripts.push(this.compilationUnits[url]);
        return copyScripts;
    };

    return CrossfireBrowserContext;
});
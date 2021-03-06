/* See license.txt for terms of usage */

// This code runs in the FBTest Window and Firefox Window
(function() { with (FBL) {

// ************************************************************************************************
// Constants

const Cc = Components.classes;
const Ci = Components.interfaces;

const prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch2);
const observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

const Application = Components.classes["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
const versionComparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
    .getService(Components.interfaces.nsIVersionComparator);

top.Swarm = {};

/*
 * Common base object for workflow steps, all called with 'this' being the registered object in registerWorkflowStep
 */
Swarm.WorkflowStep =
{
    /*
     * Called when the workflow system is loaded into the UI, on all steps
     * @param doc, the document containing the workflow UI
     * @param progress, a function taking a string, to post progress messages for users
     */
    initialize: function(doc, progress) {},
    /*
     * Called just after the UI selects any workflow, on all steps in the newly selected workflow
     * @param doc, the document containing the workflow UI
     * @param selectedWorkflow, the element selected
     */
    onWorkflowSelect: function(doc, selectedWorkflow) {},
    /*
     * Called just before the UI unselects any workflow, on all steps in the unselected workflow
     * @param doc, the document containing the workflow UI
     */
    onWorkflowUnselect: function(doc, unSelectedWorkflow) {},

    /*
     * Called when a step is allowed to fire
     */
    onStepEnabled: function(doc, stepElement) {},
    /*
     * Called when a step is disallowed to fire
     */
    onStepDisabled: function(doc, stepElement) {},
    /*
     * Called just before any workflow step, on all steps in the selected workflow
     * @param doc, the document containing the workflow UI
     * @param step, the object implementing the step code,
     * @param element, the element with the stepping event
     */
    onStepStarts: function(doc, step, element) {},
    /*
     * Called to execute this workflow step
     */
    onStep: function(event, progress) {},
    /*
     * Called just after any workflow step, on all steps in the selected workflow

     * @param step, the object implementing the step code,
     * @param element, the element with the stepping event
     */
    onStepEnds: function(doc, step, element) {},
    /*
     * called when the workflow system is unloaded, on all steps
     * @param doc, the document containing the workflow UI
     */
    destroy: function(doc) {},

    //-------- Library Functions for workflowSteps ----------------------
    showSwarmTaskData: function(doc) // remaining arguments are ids to be shown; if zero show all
    {
        var swarmTaskDataElements = doc.getElementsByClassName("swarmTaskData");
        for (var i = 0; i < swarmTaskDataElements.length; i++)
        {
            if (arguments.length == 1)
                swarmTaskDataElements[i].classList.remove("swarmTaskDataNotNeeded");
            else
                swarmTaskDataElements[i].classList.add("swarmTaskDataNotNeeded");

            try
            {
                var iframe = swarmTaskDataElements[i].getElementsByTagName("iframe")[0];
                iframe.removeAttribute('style');
            }
            catch (exc)
            {
                FBTrace.sysout("showSwarmTaskData FAILS to delete style.height for "+iframe+" "+exc, swarmTaskDataElements[i])
            }

        }

        var header = doc.getElementById("swarmWorkflowInsertion");
        var height = doc.documentElement.clientHeight - header.offsetHeight - header.offsetTop;  // height we have to work with
        var eachHeight = height/(arguments.length - 1); // todo use CSS3 flex

        var needed = 1;
        while (needed < arguments.length)
        {
            var neededFrame = doc.getElementById(arguments[needed]);
            if (!neededFrame)
                throw new Error("showSwarmTaskData did not find element "+needed+" with id "+arguments[needed]);

            var frameWrapper = neededFrame.parentNode;
            frameWrapper.classList.remove("swarmTaskDataNotNeeded");
            neededFrame.setAttribute('style',"height:"+ eachHeight +"px");

            needed++;
        }
    },
    /*
     * @param extensionId eg firebug@software.joehewitt.com
     * @return nsIFile if the extension is a link, else null
     */
    getLinkToExtension: function(extensionId)
    {
        var installLocation = Swarm.Installer.getExtensionManager().getInstallLocation(extensionId);
        if (installLocation instanceof Ci.nsIInstallLocation)
        {
            var link = installLocation.location;
            if (link instanceof Ci.nsIFile)
            {
                link.append(extensionId); // dir/id
                if (!link.isDirectory())
                    return link;
            }
        }
        return null;
    },

};

Swarm.workflowMonitor =
{
    initialize: function(doc, progress)
    {
        if (!this.initialzed)
        {
            this.injectSwarmWorkflows(doc);
            this.progress = progress;
            this.initialized = true;
        }
    },

    injectSwarmWorkflows: function(doc)
    {
        var webWarning = doc.getElementById("swarmWebPage");
        webWarning.style.visibility = "hidden";

        var swarmWorkflowInsertionPoint = doc.getElementById("swarmWorkflowInsertion");
        var swarmWorkflowInsertion = getResource("chrome://swarm/content/swarmWorkflow.htm");
        swarmWorkflowInsertionPoint.innerHTML = swarmWorkflowInsertion;
    },

    initializeUI: function(doc, progress)
    {
        var swarmWorkflows = doc.getElementById("swarmWorkflows");
        this.hookButtons(swarmWorkflows);
        swarmWorkflows.style.display = "block";
        this.dispatch(this.registeredWorkflowSteps, "initialize", [doc, this.progress]);

        var swarmWorkflowSelectors = doc.getElementsByClassName("swarmWorkflowSelector");
        for (var i = 0; i < swarmWorkflowSelectors.length; i++)
        {
            if (swarmWorkflowSelectors[i].checked)
            {
                var selectedWorkflow = this.getWorkflowBySelector(swarmWorkflowSelectors[i]);
                this.setSelectedWorkflow(doc, selectedWorkflow);
            }

        }
    },

    detachFromPage: function()  // XXXjjb NOT BEING CALLED!
    {
        var doc = browser.contentDocument;
        var swarmWorkflows = doc.getElementById("swarmWorkflows");
        this.unHookButtons(swarmWorkflows);
    },

    hookButtons: function(workflowsElement)
    {
        this.buttonHook = bind(this.doWorkflowEvent, this);
        workflowsElement.addEventListener('click', this.buttonHook, true);

        var selectWorkflow = workflowsElement.ownerDocument.getElementById("selectWorkflow");
        selectWorkflow.addEventListener('click', this.unSelectWorkflow, true);
    },

    doWorkflowEvent: function(event)
    {
        if (event.target.tagName.toLowerCase() === 'button')
            this.doWorkflowStep(event);
        if (event.target.tagName.toLowerCase() === 'input')
            this.selectWorkflow(event);
        // TODO become a joehewitt some day.
    },

    shutdown: function(doc, progress)
    {
        this.dispatch(this.registeredWorkflowSteps, "destroy", [doc, this.progress]);
    },

    unHookButtons: function(workflowsElement)
    {
        workflowsElement.removeEventListener('click',this.buttonHook ,true);

        var selectWorkflow = workflowsElement.ownerDocument.getElementById("selectWorkflow");
        selectWorkflow.addEventListener('click', this.unSelectWorkflow, true);
    },

    // ------------------------------------------------------------------------------------------
    selectWorkflow: function(event)
    {
        var doc = event.target.ownerDocument;
        this.unSelectSelectedWorkflow(doc);

        // select the new workflow
        var selectedWorkflowSelector = event.target;
        var selectedWorkflow = this.getWorkflowBySelector(selectedWorkflowSelector);

        // return the task data to default on
        Swarm.WorkflowStep.showSwarmTaskData(doc);

        // enable some buttons in this workflow
        this.enableStepButtons(doc, selectedWorkflow);
    },

    getWorkflowBySelector: function(selectedWorkflowSelector)
    {
        var parent = selectedWorkflowSelector;
        while(parent = parent.parentNode)
        {
            if (parent.classList && parent.classList.contains("swarmWorkflowSelection"))
            {
                parent.classList.add("swarmWorkflowSelected");
                var input = parent.getElementsByTagName('input')[0];
                input.checked = true;
                break;
            }
        }
        return parent;
    },

    enableStepButtons: function(doc, selectedWorkflow)
    {
        var buttons = selectedWorkflow.getElementsByTagName('button');
        for (var j = 0; j < buttons.length; j++)
        {
            button = buttons[j];
            if ( button.classList.contains("swarmWorkflowStep") || button.classList.contains("swarmWorkflowEnd") )
            {
                this.dispatchToStepByButton(button, "onStepDisabled", [doc, button]);
            }
            else
            {
                button.removeAttribute("disabled");
                this.dispatchToStepByButton(button, "onStepEnabled", [doc, button])
            }
        }
    },

    setSelectedWorkflow: function(doc, selectedWorkflow)
    {
        if (this.currentWorkflow)
        {
            var stepsInWorkflow = this.getStepsFromWorkflow(selectedWorkflow);
            this.dispatch(stepsInWorkflow, "onWorkflowUnselect", [doc, selectedWorkflow]);
        }

        this.currentWorkflow = selectedWorkflow;

        // mark the selector closed
        var swarmWorkflows = doc.getElementById("swarmWorkflows");
        swarmWorkflows.classList.add("swarmWorkflowIsSelected");

        // initialize the newly selected workflow
        var stepsInSelectedWorkflow = this.getStepsFromWorkflow(this.currentWorkflow);
        this.dispatch(stepsInSelectedWorkflow, "onWorkflowSelect", [doc, this.currentWorkflow]);
        
        this.stepWorkflow(doc, this.currentWorkflow);
        return true;
    },

    unSelectSelectedWorkflow: function(doc)
    {
        this.dispatch(this.registeredWorkflowSteps, "onWorkflowUnselect", [doc])
        // unselect the previously selected workflow
        var workFlowSelectors = doc.body.getElementsByClassName("swarmWorkflowSelection");
        for (var i = 0; i < workFlowSelectors.length; i++)
            workFlowSelectors[i].classList.remove("swarmWorkflowSelected");

        // disable all of the buttons in all of the workflows
        var workFlows = doc.getElementById("swarmWorkflows");
        var buttons = workFlows.getElementsByTagName('button');
        for (var j = 0; j < buttons.length; j++)
        {
            buttons[j].setAttribute("disabled", "disabled");
            this.dispatchToStepByButton(buttons[j], "onStepDisabled", [doc, buttons[j]]);
        }

        var inputs = workFlows.getElementsByTagName("input");
        for (var j = 0; j < inputs.length; j++)
             inputs[j].checked = false;
    },

    unSelectWorkflow: function(event)
    {
        var doc = event.target.ownerDocument;
        var swarmWorkflowIsSelected = doc.getElementsByClassName("swarmWorkflowIsSelected");
        for (var i = 0; i < swarmWorkflowIsSelected.length; i++)
            swarmWorkflowIsSelected[i].classList.remove("swarmWorkflowIsSelected");

        Swarm.workflowMonitor.unSelectSelectedWorkflow(doc);
    },

    doWorkflowStep: function(event)
    {
        if (event.target.tagName.toLowerCase() !== 'button')
            return;

        try
        {
            var button = event.target;
            var doc = button.ownerDocument;

            button.classList.add("swarmWorkflowing");

            var step = this.getStepFromButton(button);
            if (!step)
                return this.progress("ERROR: Swarm.WorkflowMonitor.getStepFromButton no handler registered for "+button.getAttribute("class"));

            step["onStep"].apply(step, [event, this.progress]);

            button.classList.remove("swarmWorkflowing");
            event.stopPropagation();
            event.preventDefault();
        }
        catch(exc)
        {
            FBTrace.sysout("Swarm workflow step FAILS "+exc, exc);
            this.progress(exc);
        }

    },

    dispatchToStepByButton: function(button, event, args)
    {
        var step = this.getStepFromButton(button);
        if (!step)
            return this.progress("ERROR: Swarm.WorkflowMonitor.getStepFromButton no handler registered for "+button.getAttribute("class"));

        if (!step[event])
            return this.progress("no function "+event+" for workflow step "+step);

        step[event].apply(step, args);
    },

    getStepFromButton: function(button)
    {
        for(var i = 0; i < button.classList.length; i++)
        {
            if (button.classList[i] in this.registeredWorkflowSteps)
            {
                var stepName = button.classList[i];
                return this.registeredWorkflowSteps[stepName];
            }
        }
    },

    getStepsFromWorkflow: function(workflow)
    {
        var buttons = workflow.getElementsByTagName("button");
        var steps = {};
        for (var i = 0 ; i < buttons.length; i++ )
        {
        	var step = this.getStepFromButton(buttons[i]);
        	steps[step.dispatchName] = step;
        	step.element = buttons[i];
        }
            
        return steps;
    },

    stepWorkflow: function(doc, workflow)
    {
        if (this.currentStep)
        {
              this.currentStep.onStepDisabled(doc, this.currentStep.element);
              this.currentStep = this.getNextStep(this.currentStep.element);
        }
        else
        {
        	var steps = this.getStepsFromWorkflow(workflow);
        	var elts = doc.getElementsByClassName("swarmWorkflowStart");
        	if (elts && elts[0])
        		this.currentStep = this.getStepFromButton(elts[0]);
        	else 
        		this.progress("ERROR: No step with swarmWorkflowStart class")
        }
        
        this.currentStep.element.removeAttribute('disabled');
        this.currentStep.onStepEnabled(doc, this.currentStep.element);
    },

    stepWorkflows: function(doc, stepClassName)
    {
        var elts = doc.getElementsByClassName(stepClassName);
        for (var i = 0; i < elts.length; i++)
        {
            if (elts[i].classList.contains("swarmWorkflowEnd"))
                elts[i].classList.add("swarmWorkflowComplete");
            else
            {
                var nextStep = this.getNextStep(elts[i]);
                if (nextStep)
                {
                    elts[i].setAttribute('disabled', 'disabled');
                    this.dispatchToStepByButton(elts[i], "onStepDisabled", [doc, elts[i]]);
                    nextStep.removeAttribute('disabled');
                    this.dispatchToStepByButton(nextStep, "onStepEnabled", [doc, nextStep]);
                }
            }
        }
    },

    getNextStep: function(elt)
    {
        while(elt = elt.nextSibling)
        {
            if (!elt.classList)  // eg TextNode
                continue;

            if (elt.classList.contains('swarmWorkflowStep'))
                return elt;
            else if (elt.classList.contains('swarmWorkflowEnd'))
                return elt;
        }
    },

    //----------------------------------------------------------------------------------

    registeredWorkflowSteps: {}, // key CSS class name, value obj shaped as Swarm.WorkflowStep

    registerWorkflowStep: function(obj)
    {
    	if (obj.dispatchName)
    		this.registeredWorkflowSteps[obj.dispatchName] = obj;
    	else
    		debugger;
    },

    dispatch: function(object, eventName, args)
    {
        FBTrace.sysout("swarm dispatch "+eventName, {object: object, args:args});

        for(var p in object)
        {
            if (object.hasOwnProperty(p))
            {
                var listener = object[p];
                try
                {
                    listener[eventName].apply(listener, args);
                }
                catch(exc)
                {
                    FBTrace.sysout("swarm.dispatch FAILS for "+p+"["+eventName+"] because "+exc, { exc: exc, listener: listener});
                }
            }
        }
    },

};

Swarm.sourcePicker =  extend(Swarm.WorkflowStep,
{
	dispatchName: "swarmSourcePicker", 
	
    initialize: function(doc, progress)
    {
        Swarm.sourcePicker.eachPicker(doc, function addListenerAndShow(sourcePickerButton)
        {
            sourcePickerButton.addEventListener("keyup", Swarm.sourcePicker.pick, true);
            sourcePickerButton.classList.remove("swarmTaskHidePicker");
            var width = (sourcePickerButton.parentNode.offsetWidth - sourcePickerButton.offsetLeft);
            sourcePickerButton.style.width = width+"px";
            var url = Swarm.sourcePicker.getTaskDataElement(sourcePickerButton).getAttribute('src');
            var baseURL = doc.location.toString();
            var editURL = absoluteURL(url, baseURL);
            sourcePickerButton.setAttribute("value", editURL);
        });
    },

    onWorkflowSelect: function(doc, selectedWorkflow)
    {
        Swarm.sourcePicker.eachPicker(doc, function addListenerAndShow(sourcePickerButton)
        {
            sourcePickerButton.classList.add("swarmTaskHidePicker");
        });
    },

    onWorkflowUnselect: function(doc)
    {
        Swarm.sourcePicker.eachPicker(doc, function addListenerAndShow(sourcePickerButton)
        {
            sourcePickerButton.classList.remove("swarmTaskHidePicker");
        });
    },

    shutdown: function(doc, progress)
    {
        Swarm.sourcePicker.eachPicker(doc, function addListenerAndShow(sourcePickerButton)
        {
            sourcePickerButton.removeEventListener("keyup", Swarm.sourcePicker.pick, true);
        });
    },
    // ------------------

    eachPicker: function(doc, fnOfElement)
    {
        var sourcePickerButtons = doc.getElementsByClassName("swarmTaskSrc");
        for (var i = 0; i < sourcePickerButtons.length; i++)
            fnOfElement(sourcePickerButtons[i]);
    },

    getEnclosingTaskDataDiv: function(element)
    {
        var elt = element;
        while (elt && !elt.classList.contains('swarmTaskData'))
            elt = elt.parentNode;

        return elt;
    },

    getTaskDataElement: function(sourcePickerButton)
    {
        var div = Swarm.sourcePicker.getEnclosingTaskDataDiv(sourcePickerButton);
        if (div)
        {
            var taskData = div.getElementsByTagName('iframe')[0];
            return taskData;
        }
    },

    pick: function(event)
    {
        var sourcePickerButton = event.target;
        var elt = Swarm.sourcePicker.getTaskDataElement(sourcePickerButton)
        var toValue = event.target.value;
        var fromValue = elt.value;
        if (toValue !== fromValue)
            elt.setAttribute('src', toValue);
    }
});
Swarm.workflowMonitor.registerWorkflowStep(Swarm.sourcePicker);


// The interface between the swarm code and fbtest window
Swarm.embedder = {

        progress: function(msg)
        {
            var elt = document.getElementById("progressMessage");
            elt.value = msg;
            if (/ERROR/i.test(msg))
                elt.style.color = "red";
            else
                delete elt.style.color;
            FBTrace.sysout("Swarm.progress "+msg);
        },

        attachToPage: function()
        {
            var browser = $("taskBrowser");
            var doc = browser.contentDocument;
            var swarmFrame = doc.getElementById('swarmDefinition');
            if (swarmFrame)
            {
                this.progress("Found swarmDefinition");
                Swarm.swarmDocument = swarmFrame.contentDocument;
            
                Swarm.workflowMonitor.initialize(doc, this.progress);
                Swarm.workflowMonitor.initializeUI(doc, this.progress);
            }
            else
            {
                this.progress("No swarmDefinition element found");
            }
        },

        detachFromPage: function()
        {
            var browser = $("taskBrowser");
            var doc = browser.contentDocument;
            FBTrace.sysout("detachFromPage ", Swarm);
            Swarm.workflowMonitor.shutdown(doc, this.progress);
        },

        // sync with FBTest -------------------------------------------------------------------
        observe: function(subject, topic, data)
        {
            try
            {
                FBTrace.sysout("swarm-test observe topic "+topic+ "data "+data);
                if (data == "initialize")
                {
                    FBTrace.sysout("swarm test initialize");
                }
                else if (data == "shutdown")
                {
                    observerService.removeObserver(Swarm.embedder, "fbtest");
                    Swarm.embedder.detachFromPage();
                }
                else if (data == "restart")
                {
                    var fbtest = subject;
                    Swarm.embedder.attachToPage();
                }

            }
            catch(exc)
            {
                FBTrace.sysout("observe FAILS "+exc, exc);
            }
        },
};

observerService.addObserver(Swarm.embedder, "fbtest", false);  // removed in observe: 'shutdown'

//-----------------------------------------------------------------------------------------------

//Secure download and hash calculation --------------------------------------------------------
//http://groups.google.com/group/mozilla.dev.platform/browse_thread/thread/9f1bdf8603b72384/74fcb44e8b701966?#74fcb44e8b701966

Swarm.WorkflowStep.secureHashOverHTTPS = function(urlString, fncTakesHashString)
{
    const ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci["nsIIOService"]);
    try
     {
         if (urlString)
             var uri = ioService.newURI(urlString, null, null);
         else
             throw new Error("secureHashOverHTTPS FAILS: no URL given");
     }
     catch(exc)
     {
         throw new Error("secureHashOverHTTPS FAILS: could not create URI from the given URL: "+urlString+" because: "+exc);
     }

     if (!uri.schemeIs("https"))
         throw new Error("secureHashOverHTTPS FAILS: only https URL can be securely downloaded");

     try
     {
         var channel = ioService.newChannel(urlString, null, null);

         var hasher = Cc["@mozilla.org/security/hash;1"]
             .createInstance(Ci.nsICryptoHash);

         var listener =
         {
             onStartRequest: function(request, arg)
             {
                 hasher.init(hasher.SHA1);
                 FBTrace.sysout("onStartRequest "+channel.URI.spec);
             },
             onDataAvailable: function(request, arg, stream, offset, count)
             {
                 FBTrace.sysout("onDataAvailable "+channel.URI.spec+" "+count);
                 var problem = getSecurityProblem(request);
                 if (!problem)
                     hasher.updateFromStream(stream, count);
                 else
                     throw new Error("secureHashOverHTTPS FAILS: "+problem+" reading "+urlString);
             },
             onStopRequest: function(request, arg, statusCode)
             {
                 FBTrace.sysout("onStopRequest "+channel.URI.spec+" "+statusCode);
                 try
                 {
                     var hash = hasher.finish(false);
                     // convert the binary hash data to a hex string.
                     var s = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
                     fncTakesHashString("sha1:"+s);
                 }
                 catch(exc)
                 {
                     throw new Error("secureHashOverHTTPS FAILS: "+exc);
                 }

             }
         };

        channel.asyncOpen(listener, hasher);
     }
     catch (e)
     {
         var cascade =  new Error("secureHashOverHTTPS FAILS "+e);
         cascade.cause = e;
         throw cascade;
     }
}

function getSecurityProblem(channel)
{
    if (channel instanceof Ci.nsIHttpChannel)
     {
         var secInfo = channel.securityInfo;
         if (secInfo instanceof Ci.nsITransportSecurityInfo)
         {
             var iListener = Ci.nsIWebProgressListener;

             var secureBits = (iListener.STATE_IS_SECURE | iListener.STATE_SECURE_HIGH);
             if (secInfo.securityState & secureBits)
             {
                 // https://developer.mozilla.org/En/How_to_check_the_security_state_of_an_XMLHTTPRequest_over_SSL
                 if (secInfo instanceof Ci.nsISSLStatusProvider) // then the secInfo hasA cert
                 {
                     if (secInfo.SSLStatus instanceof Ci.nsISSLStatus)
                     {
                         var cert = secInfo.SSLStatus.serverCert;
                         var certOverrideService = Cc["@mozilla.org/security/certoverride;1"]
                                    .getService(Ci.nsICertOverrideService);

                         var bits = {}, temp = {};

                         if (certOverrideService.hasMatchingOverride(channel.URI.host, channel.URI.port, cert, bits, temp))
                             return "user has overridden certificate checks";

                         return false;
                     }
                     return "channel securityInfo SSLStatus is not an nsISSLStatus";
                 }
                 return "channel securityInfo is not an nsISSLStatusProvider";
             }
             return "channel securityInfo is not in secure state";
         }
         return "channel securityInfo is not valid";
     }
     return "request has no channel for security checks";
}

//return the two-digit hexadecimal code for a byte
function toHexString(charCode)
{
    return ("0" + charCode.toString(16)).slice(-2);
}

// ************************************************************************************************
}}());

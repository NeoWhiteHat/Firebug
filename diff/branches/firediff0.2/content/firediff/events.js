/* See license.txt for terms of usage */
FireDiff  = FireDiff || {};

FBL.ns(function() { with (FBL) {

var i18n = document.getElementById("strings_firediff");

var Events = FireDiff.events,
    Path = FireDiff.Path,
    Reps = FireDiff.reps,
    CSSModel = FireDiff.CSSModel;

const CHANGES = "firebug-firediff-changes";
const ATTR_CHANGES = "firebug-firediff-attrChanges";
const REMOVE_CHANGES = "firebug-firediff-removeChanges";

var ChangeSource = {
    APP_CHANGE: "APP_CHANGE",
    FIREBUG_CHANGE: "FIREBUG_CHANGE"
};

function ChangeEvent(changeSource) {
  this.date = new Date();
  this.changeSource = changeSource || ChangeSource.APP_CHANGE;
}
ChangeEvent.prototype = {
    getChangeType: function() { return this.changeType; },
    getSummary: function() {},
    merge: function(candidate) {},
    mergeCancellation: function(candidate) {},
    cloneOnXPath: function(xpath) {},
    appliesTo: function(target) {
      // Any change that is made to the target or a child
      return target && Path.isChildOrSelf(this.getXpath(target), this.xpath);
    },
    sameFile: function(otherChange) {},
    getSnapshotRep: function(context) {},
    
    apply: function() {},
    revert: function() {},
    
    getMergedXPath: function(prior) {},
    
    getXpath: function(target) {},
    xpathLookup: function(xpath, root) {},
    getActionNode: function(target, xpath) {
      try {
        xpath = xpath || this.getXpath(target);
        if (xpath == this.xpath) {
          // Empty string passed to evaluate is bad. 
          return target;
        }
        
        var components = Path.getRelativeComponents(this.xpath, xpath);
        if (!components.right) {
          return this.xpathLookup(components.left, target);
        }
      } catch (err) {
        if (FBTrace.DBG_ERRORS) {
          FBTrace.sysout("getActionNode Error: " + err, err);
          FBTrace.sysout(" - getActionNode: " + this.xpath + " " + xpath, components);
        }
        throw err;
      }
    },
    getInsertActionNode: function(target, xpath) {
      xpath = xpath || this.getXpath(target);
      
      var parentPath = Path.getParentPath(this.xpath);
      var selfId = Path.getIdentifier(this.xpath);
      
      var components = Path.getRelativeComponents(parentPath, xpath);
      var parentEl;
      if (components.left) {
        parentEl = this.xpathLookup(components.left, target);
      } else {
        parentEl = target;
      }
      
      var siblingEl = this.xpathLookup(selfId.tag + "[" + selfId.index + "]", parentEl);
      return {
        parent: parentEl,
        sibling: siblingEl
      };
    },
    
    toString: function() {
      return "[object ChangeEvent-" + this.changeType + "-" + this.subType + " " + this.xpath + "]";
    }
};

function DOMChangeEvent(target, xpath, displayXPath, changeSource) {
    ChangeEvent.call(this, changeSource);
    this.changeType = "DOM";
    this.xpath = xpath || Path.getElementPath(target);
    this.displayXPath = displayXPath || Path.getElementPath(target, true);
    
    // Store this just to create a mostly accurate repobject link. This shouldn't be used otherwise
    this.target = target;
}
DOMChangeEvent.prototype = extend(ChangeEvent.prototype, {
    sameFile: function(otherChange) {
      return this.getChangeType() == otherChange.getChangeType()
          && this.target.ownerDocument == otherChange.target.ownerDocument;
    },
    getSnapshotRep: function(context) {
      return new Reps.DOMSnapshot(this, context.window.document);
    },
    
    isElementAdded: function() { return false; },
    isElementRemoved: function() { return false; },
    
    getXpath: function(target) { return Path.getElementPath(target); },
    xpathLookup: function(xpath, root) {
      var iterate = root.ownerDocument.evaluate(xpath, root, null, XPathResult.ANY_TYPE, null);
      return iterate.iterateNext();
    },
    
    /* Merge Helper Routines */
    overridesChange: function(prior) {},
    
    annotateTree: function(tree, root) {
      var actionNode = this.getActionNode(tree, root);
      if (!actionNode) {
        if (FBTrace.DBG_ERRORS)   FBTrace.sysout("ERROR: annotateTree: actionNode is undefined tree: " + root, tree);
      }
      actionNode[CHANGES] = this;

      if (actionNode.nodeType == Node.TEXT_NODE) {
        return this;
      } else {
        return actionNode;
      }
    }
});

function DOMInsertedEvent(target, clone, xpath, displayXPath, changeSource) {
    DOMChangeEvent.call(this, target, xpath, displayXPath, changeSource);
    this.clone = clone || target.cloneNode(true);

    if (target instanceof Text) {
        this.previousValue = "";
        this.value = target.data;
    }
}
DOMInsertedEvent.prototype = extend(DOMChangeEvent.prototype, {
    subType: "dom_inserted",
    
    getSummary: function() {
        return i18n.getString("summary.DOMInserted");
    },
    isElementAdded: function() { return true; },
    
    apply: function(target, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getInsertActionNode(target, xpath);
            
            actionNode.parent.insertBefore(this.clone.cloneNode(true), actionNode.sibling);
          }, this));
    },
    revert: function(target, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(target, xpath);
            if (actionNode) {
              actionNode.parentNode.removeChild(actionNode);
            }
          }, this));
    },

    merge: function(candidate) {
      if (candidate.changeType != this.changeType) {
        // We don't touch if it's not dom
        return undefined;
      }
      
      // Only changes that affect us are:
      // - Remove on same xpath (Overrides)
      // - Modification of self (by attr or char data change)
      // - Any modification of children
      // - XPath updates
      
      // Check overrides cases
      if (candidate.overridesChange(this)) {
        // Special case here. The only thing that can override us
        // is our inverse or an action on our parent.
        if (candidate.xpath == this.xpath) {
          return [];
        } else {
          return [candidate];
        }
      }
      
      var updateXPath = candidate.getMergedXPath(this);
      
      // Self and Child modification
      if (Path.isChild(this.xpath, candidate.xpath)
          || (!updateXPath && this.xpath == candidate.xpath)) {
        // Something changed without our own tree, apply those changes and call
        // it a day
        var clone = this.clone.cloneNode(true);   // Yeah..... <Clone, Clone, Clone, ...>
        candidate.apply(clone, this.xpath);
        
        return [new DOMInsertedEvent(this.target, clone, this.xpath, this.displayXPath, this.changeSource)];
      }
      
      // XPath modification
      if (updateXPath) {
        return [
                this.cloneOnXPath(updateXPath),
                candidate
            ];
      }
      
      // No mods to be made
      return undefined;
    },
    mergeCancellation: function(candidate) {
      var updatedPath = Path.updateForRemove(candidate.xpath, this.xpath);
      if (updatedPath != candidate.xpath) {
        return updatedPath;
      }
    },
    cloneOnXPath: function(xpath) {
      return new DOMInsertedEvent(this.target, this.clone, xpath, this.displayXPath, this.changeSource);
    },

    getMergedXPath: function(prior) {
      var updatedPath = Path.updateForInsert(prior.xpath, this.xpath);
      if (updatedPath != prior.xpath) {
        return updatedPath;
      }
    }
});
function DOMRemovedEvent(target, clone, xpath, displayXPath, changeSource) {
    DOMChangeEvent.call(this, target, xpath, displayXPath, changeSource);
    this.clone = clone || target.cloneNode(true);

    if (target instanceof Text) {
        this.value = "";
        this.previousValue = target.data;
    }
}
DOMRemovedEvent.prototype = extend(DOMChangeEvent.prototype, {
    subType: "dom_removed",
    
    getSummary: function() {
        return i18n.getString("summary.DOMRemoved");
    },
    isElementRemoved: function() { return true; },
    
    apply: function(target, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(target, xpath);
            actionNode.parentNode.removeChild(actionNode);
          }, this));
    },
    revert: function(target, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getInsertActionNode(target, xpath);
            
            actionNode.parent.insertBefore(this.clone.cloneNode(true), actionNode.sibling);
          }, this));
    },
    
    merge: function(candidate) {
      if (candidate.changeType != this.changeType) {
        // We don't touch if it's not dom
        return undefined;
      }
      
      if (Path.isChild(this.xpath, candidate.xpath)) {
        // If this is a child WRT to xpath, we don't touch it.
        return undefined;
      }
      
      if (this.xpath === candidate.xpath) {
        // TODO : Can we do this without the constant?
        if (candidate.subType == "dom_inserted") {
          if (this.clone.isEqualNode(candidate.clone)) {
            // Cancellation
            return [];
          }
        }
      } else {
        // Check overrides cases
        if (candidate.overridesChange(this)) {
          return [candidate];
        }
        
        // Check for xpath modifications
        var updateXpath = candidate.getMergedXPath(this);
        if (updateXpath) {
          return [
              this.cloneOnXPath(updateXpath),
              candidate
          ];
        }
      }
    },
    mergeCancellation: function(candidate) {
      var updatedPath = Path.updateForInsert(candidate.xpath, this.xpath);
      if (updatedPath != candidate.xpath) {
        return updatedPath;
      }
    },
    cloneOnXPath: function(xpath) {
      return new DOMRemovedEvent(this.target, this.clone, xpath, this.displayXPath, this.changeSource);
    },

    getMergedXPath: function(prior) {
      var updatedPath = Path.updateForRemove(prior.xpath, this.xpath);
      if (updatedPath != prior.xpath) {
        return updatedPath;
      }
    },
    overridesChange: function(prior) {
      return Path.isChildOrSelf(this.xpath, prior.xpath);
    },
    
    annotateTree: function(tree, root) {
      var actionNode = this.getInsertActionNode(tree, root).parent;
      var list = actionNode[REMOVE_CHANGES] || [];
      list.push(this);
      actionNode[REMOVE_CHANGES] = list;
      
      this.clone.change = this;
      
      return this;
    }
});


function DOMAttrChangedEvent(target, attrChange, attrName, newValue, prevValue, xpath, displayXPath, changeSource, clone) {
    DOMChangeEvent.call(this, target, xpath, displayXPath, changeSource);
    
    this.attrChange = attrChange;
    this.attrName = attrName;
    this.previousValue = prevValue;
    this.value = newValue;
    
    this.clone = clone || target.cloneNode(false);
}
DOMAttrChangedEvent.prototype = extend(DOMChangeEvent.prototype, {
    subType: "attr_changed",
    getSummary: function() {
        if (this.attrChange == MutationEvent.MODIFICATION) {
          return i18n.getString("summary.DOMAttrChanged");
        } else if (this.attrChange == MutationEvent.ADDITION) {
          return i18n.getString("summary.DOMAttrAddition");
        } else if (this.attrChange == MutationEvent.REMOVAL) {
          return i18n.getString("summary.DOMAttrRemoval");
        }
    },
    isAddition: function() { return this.attrChange == MutationEvent.ADDITION; },
    isRemoval: function() { return this.attrChange == MutationEvent.REMOVAL; },
    
    merge: function(candidate) {
        if (candidate.changeType != this.changeType) {
          // We don't touch if it's not dom
          return undefined;
        }
        
        if (this.subType != candidate.subType
                || this.xpath != candidate.xpath
                || this.attrName != candidate.attrName) {
          // Check overrides cases
          if (candidate.overridesChange(this)) {
            return [candidate];
          }
          
          // Check for xpath modifications
          var updateXpath = candidate.getMergedXPath(this);
          if (updateXpath) {
            return [
                this.cloneOnXPath(updateXpath),
                candidate
            ];
          }
          return undefined;
        }
        
        if (candidate.attrChange == MutationEvent.REMOVAL) {
          if (this.attrChange == MutationEvent.ADDITION) {
            // These events cancel, remove.
            return [];
          } else {
            // Anything followed by removal: Removal, merging previous value
            return [
                new DOMAttrChangedEvent(
                    this.target,
                    MutationEvent.REMOVAL, this.attrName,
                    candidate.value, this.previousValue,
                    this.xpath, this.displayXPath, this.changeSource, this.clone)
                ];
          }
        } else if (this.attrChange == MutationEvent.REMOVAL) {
          if (candidate.attrChange == MutationEvent.ADDITION) {
            // Removal followed by addition: one of two cases. Modification or cancellation
            if (this.previousValue == candidate.value) {
              return [];
            } else {
              return [
                  new DOMAttrChangedEvent(
                      this.target,
                      MutationEvent.MODIFICATION, this.attrName,
                      candidate.value, this.previousValue,
                      this.xpath, this.displayXPath, this.changeSource, this.clone)
                  ];
            }
          } else {
            if (this.previousValue == candidate.value) {
              return [];
            } else {
              // Removal following by anything else is that other thing w/ prev set to our value
              return [
                  new DOMAttrChangedEvent(
                      this.target,
                      candidate.attrChange, this.attrName,
                      candidate.value, this.previousValue,
                      this.xpath, this.displayXPath, this.changeSource, this.clone)
                  ];
            }
          }
        } else {
          // Any other events (even those that don't make sense) just result in a merge
          if (this.previousValue == candidate.value) {
            return [];
          } else {
            return [
                new DOMAttrChangedEvent(
                    this.target,
                    this.attrChange, this.attrName,
                    candidate.value, this.previousValue,
                    this.xpath, this.displayXPath, this.changeSource, this.clone)
                ];
          }
        }
    },
    cloneOnXPath: function(xpath) {
      return new DOMAttrChangedEvent(
          this.target,
          this.attrChange, this.attrName,
          this.value, this.previousValue,
          xpath, this.displayXPath, this.changeSource, this.clone)
    },
    
    apply: function(target, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(target, xpath);
            if (this.attrChange == MutationEvent.REMOVAL) {
              actionNode.removeAttribute(this.attrName);
            } else if (this.attrChange == MutationEvent.ADDITION
                || this.attrChange == MutationEvent.MODIFICATION) {
              actionNode.setAttribute(this.attrName, this.value);
            }
          }, this));
    },
    revert: function(target, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(target, xpath);
            if (this.attrChange == MutationEvent.ADDITION) {
              actionNode.removeAttribute(this.attrName);
            } else if (this.attrChange == MutationEvent.REMOVAL
                || this.attrChange == MutationEvent.MODIFICATION) {
              actionNode.setAttribute(this.attrName, this.previousValue);
            }
          }, this));
    },
    
    annotateTree: function(tree, root) {
      var actionNode = this.getActionNode(tree, root);
      var list = actionNode[ATTR_CHANGES] || {};
      list[this.attrName] = this;
      actionNode[ATTR_CHANGES] = list;
      
      return actionNode;
    }
});

function DOMCharDataModifiedEvent(target, newValue, prevValue, xpath, displayXPath, changeSource, clone) {
    DOMChangeEvent.call(this, target, xpath, displayXPath, changeSource);
    
    this.previousValue = prevValue;
    this.value = newValue;
    
    this.clone = clone || target.cloneNode(false);
}
DOMCharDataModifiedEvent.prototype = extend(DOMChangeEvent.prototype, {
    subType: "char_data_modified",
    getSummary: function() {
        return i18n.getString("summary.DOMCharDataModified");
    },
    merge: function(candidate) {
        if (candidate.changeType != this.changeType) {
          // We don't touch if it's not dom
          return undefined;
        }
        
        if (this.subType != candidate.subType
                || this.xpath != candidate.xpath) {
          // Check overrides cases
          if (candidate.overridesChange(this)) {
            return [candidate];
          }
          
          // Check for xpath modifications
          var updateXpath = candidate.getMergedXPath(this);
          if (updateXpath) {
            return [
                this.cloneOnXPath(updateXpath),
                candidate
            ];
          }
          return undefined;
        }
        
        return [ new DOMCharDataModifiedEvent(this.target, candidate.value, this.previousValue, this.xpath, this.displayXPath, this.changeSource, this.clone) ];
    },
    cloneOnXPath: function(xpath) {
      return new DOMCharDataModifiedEvent(
          this.target, this.value, this.previousValue, xpath, this.displayXPath, this.changeSource, this.clone);
    },
    
    apply: function(target, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(target, xpath);
            actionNode.replaceData(0, actionNode.length, this.value);
          }, this));
    },
    revert: function(target, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(target, xpath);
            actionNode.replaceData(0, actionNode.length, this.previousValue);
          }, this));
    }
});

function CSSChangeEvent(style, changeSource, xpath) {
    ChangeEvent.call(this, changeSource);
    
    this.style = style;
    this.xpath = xpath || Path.getStylePath(style);
}
CSSChangeEvent.prototype = extend(ChangeEvent.prototype, {
    changeType: "CSS",

    getXpath: function(target) { return Path.getStylePath(target); },
    xpathLookup: function(xpath, root) {
      return Path.evaluateStylePath(xpath, root);
    },
    sameFile: function(target) {
      return target && Path.getTopPath(target.xpath) == Path.getTopPath(this.xpath);
    },
    getSnapshotRep: function(context) {
      return new Reps.CSSSnapshot(this, context);
    }
});

function CSSRuleEvent(style, changeSource, xpath, clone) {
  CSSChangeEvent.call(this, style, changeSource, xpath);
  
  this.clone = clone || CSSModel.cloneCSSObject(style);
}
CSSRuleEvent.prototype = extend(CSSChangeEvent.prototype, {
  // This is a little bit of a hack. The rule editor does not always have a
  // valid rep object and as a consequence we can't key on the target.
  //
  // Since rule insert and remove events always come from Firebug we assume
  // that this change applies to the current editor
  appliesTo: function(target) { return target; },
});

function CSSInsertRuleEvent(style, changeSource, xpath, clone) {
  CSSRuleEvent.call(this, style, changeSource, xpath, clone);
}
CSSInsertRuleEvent.prototype = extend(CSSRuleEvent.prototype, {
  subType: "insertRule",
  getSummary: function() {
    return i18n.getString("summary.CSSInsertRule");
  },

  annotateTree: function(tree, root) {
    var parent = this.getInsertActionNode(tree, root).parent;
    var identifier = Path.getIdentifier(this.xpath);
    
    if (!parent && FBTrace.DBG_ERRORS) {
      FBTrace.sysout("CSSRuleEvent.annotateTree: Failed to lookup parent " + this.xpath + " " + root, tree);
    }
    var rule = parent.cssRules[identifier.index-1];
    rule[CHANGES] = this;
    rule.xpath = this.xpath;
    return rule;
  },
  merge: function(candidate) {
    if (candidate.subType == "removeRule"
        && this.xpath == candidate.xpath) {
      return this.clone.equals(candidate.clone) ? [] : undefined;
    }
    
    var updateXpath = candidate.getMergedXPath(this);
    if (updateXpath) {
      return [
          this.cloneOnXPath(updateXpath),
          candidate
        ];
    } else if (Path.isChildOrSelf(this.xpath, candidate.xpath)
        && (candidate.subType == "setProp" || candidate.subType == "removeProp")){
      // TODO : Handle @media nested changes?
      var clone = this.clone.clone();
      candidate.apply(clone, this.xpath);
      
      return [ new CSSInsertRuleEvent(this.style, this.changeSource, this.xpath, clone) ];
    }
  },
  cloneOnXPath: function(xpath) {
    return new CSSInsertRuleEvent(this.style, this.changeSource, xpath, this.clone);
  },
  getMergedXPath: function(prior) {
    var updatedPath = Path.updateForInsert(prior.xpath, this.xpath);
    if (updatedPath != prior.xpath) {
      return updatedPath;
    }
  },
  
  apply: function(style, xpath) {
    Firebug.DiffModule.ignoreChanges(bindFixed(
        function() {
          var actionNode = this.getInsertActionNode(style, xpath);
          var identifier = Path.getIdentifier(this.xpath);
          identifier.index--;
          
          if (actionNode.parent instanceof CSSStyleSheet
              || actionNode.parent instanceof CSSMediaRule) {
            Firebug.CSSModule.insertRule(actionNode.parent, this.clone.cssText, identifier.index);
          } else {
            actionNode.parent.cssRules.splice(identifier.index, 0, CSSModel.cloneCSSObject(this.clone));
          }
        }, this));
  },
  revert: function(style, xpath) {
    Firebug.DiffModule.ignoreChanges(bindFixed(
        function() {
          var actionNode = this.getInsertActionNode(style, xpath);
          var identifier = Path.getIdentifier(this.xpath);
          identifier.index--;
          
          if (actionNode.parent instanceof CSSStyleSheet
              || actionNode.parent instanceof CSSMediaRule) {
            Firebug.CSSModule.deleteRule(actionNode.parent, identifier.index);
          } else {
            actionNode.parent.cssRules.splice(identifier.index, 1);
          }
        }, this));
  }
});

function CSSRemoveRuleEvent(style, changeSource, xpath, clone, styleSheet) {
  CSSRuleEvent.call(this, style, changeSource, xpath, clone);
  this.styleSheet = styleSheet || style.parentStyleSheet;
}
CSSRemoveRuleEvent.prototype = extend(CSSRuleEvent.prototype, {
  subType: "removeRule",
  getSummary: function() {
    return i18n.getString("summary.CSSRemoveRule");
  },

  annotateTree: function(tree, root) {
    var actionNode = this.getInsertActionNode(tree, root).parent;
    var list = actionNode[REMOVE_CHANGES] || [];
    list.push(this);
    actionNode[REMOVE_CHANGES] = list;
    // TODO : Verify this is UTed
    actionNode.xpath = this.xpath;
    
    return this;
  },
  merge: function(candidate) {
    if (candidate.subType == "insertRule"
        && this.xpath == candidate.xpath) {
      if (this.clone.equals(candidate.clone)) {
        return [];
      } else {
        return [this, candidate];
      }
    }
    
    var updateXpath = candidate.getMergedXPath(this);
    if (updateXpath) {
      return [
          this.cloneOnXPath(updateXpath),
          candidate
        ];
    } else if (this.xpath == candidate.xpath
        && (this.subType == "setProp" || this.subType == "removeProp")){
      // TODO : Handle @media nested changes?
      // TODO : Unit test this path
      var clone = this.clone.clone();
      candidate.apply(clone, this.xpath);
      
      return [ new CSSRemoveRuleEvents(this.style, this.changeSource, this.xpath, clone, this.styleSheet) ];
    }
  },
  cloneOnXPath: function(xpath) {
    return new CSSRemoveRuleEvent(this.style, this.changeSource, xpath, this.clone, this.styleSheet);
  },
  getMergedXPath: function(prior) {
    var updatedPath = Path.updateForRemove(prior.xpath, this.xpath);
    if (updatedPath != prior.xpath) {
      return updatedPath;
    }
  },
  
  apply: CSSInsertRuleEvent.prototype.revert,
  revert: CSSInsertRuleEvent.prototype.apply
});

function CSSPropChangeEvent(style, propName, changeSource, xpath) {
  CSSChangeEvent.call(this, style, changeSource, xpath);
  
  this.propName = propName;
}
CSSPropChangeEvent.prototype = extend(CSSChangeEvent.prototype, {
  annotateTree: function(tree, root) {
    var parent = this.getActionNode(tree, root);
    
    if (!parent && FBTrace.DBG_ERRORS) {
      FBTrace.sysout("CSSRuleEvent.annotateTree: Failed to lookup parent " + this.xpath, tree);
    }
    var changes = parent.propChanges || [];
    changes.push(this);
    parent.propChanges = changes;
    parent.xpath = this.xpath;
    return parent;
  },
  
  merge: function(candidate) {
    if (candidate.subType == "removeRule"
        && this.xpath == candidate.xpath) {
      return [undefined, candidate];
    }
    
    var updateXpath = candidate.getMergedXPath(this);
    if (updateXpath) {
      return [
          this.cloneOnXPath(updateXpath),
          candidate
        ];
    }
      if (this.changeType != candidate.changeType
              || this.xpath != candidate.xpath
              || this.propName != candidate.propName) {
          return undefined;
      }
      
      return this.mergeSubtype(candidate);
  }
});

function CSSSetPropertyEvent(style, propName, propValue, propPriority, prevValue, prevPriority, changeSource, xpath) {
    CSSPropChangeEvent.call(this, style, propName, changeSource, xpath);
    
    this.propValue = propValue;
    this.propPriority = propPriority;
    this.prevValue = prevValue;
    this.prevPriority = prevPriority;
};
CSSSetPropertyEvent.prototype = extend(CSSPropChangeEvent.prototype, {
    subType: "setProp",
    
    getSummary: function() {
        return i18n.getString("summary.CSSSetProperty");
    },
    mergeSubtype: function(candidate) {
      if (this.subType == candidate.subType) {
        if (this.prevValue != candidate.propValue
            || this.prevPriority != candidate.propPriority) {
          return [
              new CSSSetPropertyEvent(
                      this.style, this.propName,
                      candidate.propValue, candidate.propPriority,
                      this.prevValue, this.prevPriority, this.changeSource,
                      this.xpath)
              ];
        } else {
          return [];
        }
      } else if (candidate.subType == "removeProp"){
        if (this.prevValue != candidate.propValue
            || this.prevPriority != candidate.propPriority) {
          return [
              new CSSRemovePropertyEvent(
                      this.style, this.propName,
                      this.prevValue, this.prevPriority,
                      this.changeSource, this.xpath)
              ];
        } else {
          return [];
        }
      }
    },
    cloneOnXPath: function(xpath) {
      return new CSSSetPropertyEvent(
          this.style, this.propName,
          this.propValue, this.propPriority,
          this.prevValue, this.prevPriority,
          this.changeSource,
          xpath);
    },
    
    apply: function(style, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(style, xpath);
            Firebug.CSSModule.setProperty(actionNode.style, this.propName, this.propValue, this.propPriority);
          }, this));
    },
    revert: function(style, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(style, xpath);
            if (this.prevValue) {
              Firebug.CSSModule.setProperty(actionNode.style, this.propName, this.prevValue, this.prevPriority);
            } else {
              Firebug.CSSModule.removeProperty(actionNode.style, this.propName);
            }
          }, this));
    }
});

function CSSRemovePropertyEvent(style, propName, prevValue, prevPriority, changeSource, xpath) {
    CSSPropChangeEvent.call(this, style, propName, changeSource, xpath);

    // Seed empty values for the current state. This makes the domplate
    // display much easier
    this.propValue = "";
    this.propPriority = "";
    
    this.prevValue = prevValue;
    this.prevPriority = prevPriority;
};
CSSRemovePropertyEvent.prototype = extend(CSSPropChangeEvent.prototype, {
    subType: "removeProp",
    
    getSummary: function() {
        return i18n.getString("summary.CSSRemoveProperty");
    },
    mergeSubtype: function(candidate) {
      if (this.subType == candidate.subType) {
        return [this];
      } else if (candidate.subType == "setProp") {
        if (this.prevValue == candidate.propValue
            && this.prevProperty == candidate.propProperty) {
          return [];
        }

        return [
                new CSSSetPropertyEvent(
                        this.style, this.propName,
                        candidate.propValue, candidate.propPriority,
                        this.prevValue, this.prevPriority, this.changeSource,
                        this.xpath)
                ];
      }
    },
    cloneOnXPath: function(xpath) {
      return new CSSRemovePropertyEvent(
          this.style, this.propName,
          this.prevValue, this.prevPriority,
          this.changeSource,
          xpath);
    },
    apply: function(style, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(style, xpath);
            Firebug.CSSModule.removeProperty(actionNode.style, this.propName);
          }, this));
    },
    revert: function(style, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(style, xpath);
            Firebug.CSSModule.setProperty(actionNode.style, this.propName, this.prevValue, this.prevPriority);
          }, this));
    }
});

// Global API
FireDiff.events = {
    ChangeSource: ChangeSource,
    AnnotateAttrs: {
      CHANGES: CHANGES,
      ATTR_CHANGES: ATTR_CHANGES,
      REMOVE_CHANGES: REMOVE_CHANGES
    },
    
    DOMChangeEvent: DOMChangeEvent,
    DOMInsertedEvent: DOMInsertedEvent,
    DOMRemovedEvent: DOMRemovedEvent,
    DOMAttrChangedEvent: DOMAttrChangedEvent,
    DOMCharDataModifiedEvent: DOMCharDataModifiedEvent,
    
    createDOMChange: function(ev, changeSource) {
        switch (ev.type) {
        case "DOMNodeInserted":
        case "DOMNodeInsertedInfoDocument":
            return new DOMInsertedEvent(ev.target, undefined, undefined, undefined, changeSource);
        case "DOMNodeRemoved":
        case "DOMNodeRemovedFromDocument":
            return new DOMRemovedEvent(ev.target, undefined, undefined, undefined, changeSource);
        case "DOMAttrModified":
            return new DOMAttrChangedEvent(ev.target, ev.attrChange, ev.attrName, ev.newValue, ev.prevValue, undefined, undefined, changeSource);
        case "DOMCharacterDataModified":
            return new DOMCharDataModifiedEvent(ev.target, ev.newValue, ev.prevValue, undefined, undefined, changeSource);
        }
    },
    
    CSSInsertRuleEvent: CSSInsertRuleEvent,
    CSSRemoveRuleEvent: CSSRemoveRuleEvent,
    CSSSetPropertyEvent: CSSSetPropertyEvent,
    CSSRemovePropertyEvent: CSSRemovePropertyEvent,
    
    merge: function(changes) {
        if (!changes.length) {
          return changes;
        }
        
        var ret = [];
        
        if (FBTrace.DBG_FIREDIFF)   FBTrace.sysout("Merge prior", changes);
        changes = changes.slice();
        
        for (var innerIter = 0; innerIter < changes.length; innerIter++) {
            var curTest = changes[innerIter];
            
            if (!curTest) {
                continue;
            }
            
            for (var outerIter = innerIter + 1; curTest && outerIter < changes.length; outerIter++) {
                if (changes[outerIter]) {
                    var mergeValue = curTest.merge(changes[outerIter]);
                    if (mergeValue) {
                        if (FBTrace.DBG_FIREDIFF)   FBTrace.sysout("Merge change " + innerIter + " " + outerIter, mergeValue);
                        
                        if (!mergeValue[0]) {
                            // Cancellation special case
                            for (var cancelIter = innerIter + 1; cancelIter < outerIter; cancelIter++) {
                              if (changes[cancelIter]) {
                                var updatedXPath = curTest.mergeCancellation(changes[cancelIter]);
                                if (updatedXPath) {
                                  changes[cancelIter] = changes[cancelIter].cloneOnXPath(updatedXPath);
                                }
                              }
                            }
                        }
                        
                        curTest = mergeValue[0];
                        changes[outerIter] = mergeValue[1];
                    }
                }
            }
            
            if (curTest) {
              ret.push(curTest);
            }
        }

        if (FBTrace.DBG_FIREDIFF)   FBTrace.sysout("Merge result", ret);
        return ret;
    }
};

}});
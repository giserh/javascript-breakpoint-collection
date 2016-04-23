var registry = new Map();
var objectsAndPropsByDebugId = {}

var hookNames = [
    "propertyGetBefore",
    "propertyGetAfter",
    "propertySetBefore",
    "propertySetAfter",
    "propertyCallBefore",
    "propertyCallAfter"
];

function getPropertyDescriptor(object, propertyName){
    try {
        var descriptor = Object.getOwnPropertyDescriptor(object, propertyName);
    } catch (err){
        console.log("are you sure the property ", propertyName, " exists?")
        throw err
    }
    if (!object){
        throw new Error("Descriptor " + propertyName + " not found");
    }
    if (!descriptor) {
        return getPropertyDescriptor(Object.getPrototypeOf(object), propertyName);
    }
    return descriptor;
}

export { registry, objectsAndPropsByDebugId }


export default function debugObj(obj, prop, options) {
    var debugId = Math.floor(Math.random() * 100000000000).toString()
    objectsAndPropsByDebugId[debugId] = {
        obj,
        prop
    }

    if (registry.get(obj) === undefined) {
        registry.set(obj, {});
    }

    if (registry.get(obj)[prop] === undefined) {
        registry.get(obj)[prop] = {hooks: {}};

        var originalProp = getPropertyDescriptor(obj, prop);
        var isSimpleValue = "value" in originalProp; // rather than getter + setter

        Object.defineProperty(obj, prop, {
            get: function(){
                var retVal;
                triggerHook("propertyGetBefore");
                if (isSimpleValue) {
                    retVal = originalProp.value;
                } else {
                    retVal = originalProp.get.apply(this, arguments);    
                }
                if (typeof retVal === "function") {
                    return function(){
                        triggerHook("propertyCallBefore")
                        retVal.apply(this, arguments);
                        triggerHook("propertyCallAfter")
                    }
                }

                triggerHook("propertyGetAfter");
                return retVal;
            },
            set: function(newValue){
                var retVal;
                triggerHook("propertySetBefore")
                if (isSimpleValue) {
                    retVal = originalProp.value = newValue;
                } else {
                    retVal = originalProp.set.apply(this, arguments);
                }
                triggerHook("propertySetAfter")
                return retVal;
            }
        });
    }


    hookNames.forEach(function(hookName){
        if (options[hookName] !== undefined) {
            if (registry.get(obj)[prop].hooks[hookName] === undefined) {
                registry.get(obj)[prop].hooks[hookName] = [];
            }
            registry.get(obj)[prop].hooks[hookName].push({
                id: debugId,
                fn: options[hookName]
            })
        }
    });

    return debugId;

    function triggerHook(hookName) {
        var hooks = registry.get(obj)[prop].hooks;
        var hooksWithName = hooks[hookName];
        if (hooksWithName !== undefined && hooksWithName.length > 0) {
            hooksWithName.forEach(function(hook){
                hook.fn();
            })
        }
    }
}

function updateEachHook(obj, prop, cb){
    var hooks = registry.get(obj)[prop].hooks;
    hookNames.forEach(function(hookName){
        var accessType = "";
        if (hookName === "propertyGetBefore" || hookName === "propertyGetAfter") {
            accessType = "get";
        }
        if (hookName === "propertySetBefore" || hookName === "propertySetAfter") {
            accessType = "set";
        }
        if (hookName === "propertyCallBefore" || hookName === "propertyCallAfter") {
            accessType = "call";
        }
        
        var hooksWithName = hooks[hookName];
        if (hooksWithName !== undefined) {
            hooks[hookName] = hooksWithName.map(function(hook){
                return cb(hook, accessType)
            })
        }
    })
}

export function updateDebugIdCallback(debugId, callback){
    var objAndProp = objectsAndPropsByDebugId[debugId];
    updateEachHook(objAndProp.obj, objAndProp.prop, function(hook, accessType){
        if (hook.id === debugId) {
            return {
                id: debugId,
                fn: callback
            }
        } else {
            return hook;
        }
    });
}

export function resetDebug(id){
    var objAndProp = objectsAndPropsByDebugId[id];
    var hooks = registry.get(objAndProp.obj)[objAndProp.prop].hooks;
    for (var hookName in hooks) {
        var hooksWithName = hooks[hookName];
        hooks[hookName] = hooksWithName.filter(function(hook){
            return hook.id != id;
        })
    }

    delete objectsAndPropsByDebugId[id];
}
import React from "react"

var registeredBreakpoints = [];
var breakpoints = [
    {
        title: "debugCookieReads",
        debugPropertyGets: [{
            obj: "document",
            prop: "cookie"
        }]
    },
    {
        title: "debugCookieWrites",
        debugPropertySets: [{
            obj: "document",
            prop: "cookie"
        }]
    },
    {
        title: "debugAlertCalls",
        debugCalls: [{
            obj: "window",
            prop: "alert"
        }]
    },
    {
        title: "debugConsoleErrorCalls",
        debugCalls: [{
            obj: "window.console",
            prop: "log"
        }]
    },
    {
        title: "debugConsoleLogCalls",
        debugCalls: [{
            obj: "window.console",
            prop: "log"
        }]
    }
]

class UnactivatedBreakpointListItem extends React.Component {
    render(){
        return <div onClick={()=>this.props.onClick()}
            className="unactivated-breakpoint-list-item">
            {this.props.breakpoint.title}
            <div className="plus">+</div>
        </div>
    }
}

class UnactivatedBreakpointList extends React.Component {
    render(){
        return <div>
            {this.props.breakpoints.map(
                (bp) => <UnactivatedBreakpointListItem
                    key={bp.title}
                    onClick={() => activateBreakpoint(bp)}
                    breakpoint={bp} />
            )}
        </div>
    }
}

class ActivatedBreakpointListItem extends React.Component {
    render(){
        return <div className="activated-breakpiont-list-item">
            {this.props.breakpoint.details.title}
            <button
                className="delete" 
                onClick={() => deactivateBreakpoint(this.props.breakpoint)}>
                &times;
            </button>
            <div style={{marginTop: 4}}>
                <select
                    value={this.props.breakpoint.details.hookType}
                    onChange={(event) => updateBreakpoint(this.props.breakpoint, event.target.value)}>
                    <option value="debugger">debugger</option>
                    <option value="trace">trace</option>
                </select>
            </div>
        </div>
    }
}

class ActivatedBreakpointList extends React.Component {
    render(){
        if (this.props.breakpoints.length === 0) {
            return <div>
                Click on a breakpoint on the left to activate it.
            </div>
        }
        return <div>
            {this.props.breakpoints.map(bp => 
                <ActivatedBreakpointListItem key={bp.title} breakpoint={bp} />
            )}
        </div>
    }
}



function activateBreakpoint(breakpoint, options){
    if (!options) {
        options = {
            hookType: "debugger"
        }
    }
    var hookType = options.hookType;


    var calls = [];
    var {debugPropertyGets, debugPropertySets, debugCalls} = breakpoint;
    if (debugPropertyGets) {
        debugPropertyGets.forEach(function(property){
            calls.push(["debugPropertyGet", property.obj, property.prop, hookType])
        })
    }
    if (debugPropertySets) {
        debugPropertySets.forEach(function(property){
            calls.push(["debugPropertySet", property.obj, property.prop, hookType])
        })
    }
    if (debugCalls) {
        debugCalls.forEach(function(property){
            calls.push(["debugCall", property.obj, property.prop, hookType])
        })
    }

    var code = "(function(){ var fn = function(debugPropertyGet, debugPropertySet, debugCall){";

    calls.forEach(function(call){
        var [method, objName, propName, hookType] = call;
        code += method + '(' + objName + ',"' + propName + '", "' + hookType + '");';
    })
    
    code += "};"
    var details = {
        title: breakpoint.title,
        hookType: hookType
    }
    code += "breakpoints.__internal.registerBreakpoint(fn, " + JSON.stringify(details) + ");";
    code += "return breakpoints.__internal.getRegisteredBreakpoints();"
    code += "})();"
    console.log("eval code", code)
    chrome.devtools.inspectedWindow.eval(code, function(regBp){
        console.log("done eval activate code", arguments)
        registeredBreakpoints = regBp
        app.update();
    });
}

function deactivateBreakpoint(breakpoint, callback) {
    var code = "breakpoints.__internal.disableBreakpoint(" + breakpoint.id + ");";
    code += "breakpoints.__internal.getRegisteredBreakpoints();"
    console.log("eval deactivate", code)
    chrome.devtools.inspectedWindow.eval(code, function(regBp){
        registeredBreakpoints = regBp;
        app.update();
        if (callback) {callback()}
    })   
}

function updateBreakpoint(breakpoint, traceOrDebugger){
    console.log("updateBreakpoint", traceOrDebugger)
    var baseBpObject = breakpoints.filter(function(bp){
        return bp.title === breakpoint.details.title;
    })[0]

    deactivateBreakpoint(breakpoint, function(){
        activateBreakpoint(baseBpObject, {
            hookType: traceOrDebugger
        })
    });
}

var app = null;

readBreakpointsFromPage();

chrome.devtools.network.onNavigated.addListener(function(){
    readBreakpointsFromPage();
})

function readBreakpointsFromPage(){
    chrome.devtools.inspectedWindow.eval("breakpoints.__internal.getRegisteredBreakpoints();", function(regBp){
        console.log("after fetch initial state", arguments)
        console.log("setting regbp to ", regBp)
        registeredBreakpoints = regBp;
        app.update();
    });
}

export default class App extends React.Component {
    componentDidMount(){
        app = this;
    }
    render(){
        return <div className="col-parent">
            <div>JavaScript Breakpoint Collection</div>
            <div>
                <h2>Breakpoints</h2>
                <UnactivatedBreakpointList breakpoints={breakpoints} />
            </div>
            <div>
                <h2>Activated Breakpoints</h2>
                <ActivatedBreakpointList breakpoints={registeredBreakpoints} />
            </div>
        </div>

    }
    update(){
        console.log("update")
        this.setState({sth: Math.random()})
    }
}
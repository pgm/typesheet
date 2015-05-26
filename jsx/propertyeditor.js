var TypeSelector = React.createClass({
    render: function() {
        var customOptions = [];
        var types = this.props.allTypes;
        for(var i=0;i<types.length;i++){
            customOptions.push(
                <option key={"o"+i} value={types[i].id}>
                    {types[i].name}
                </option>
            )
        }
        return (
            <select  className="form-control" selected={this.props.selected}>
                {customOptions}
            </select>
            );
    }
});

var PropertyEditor = React.createClass({
    render: function() {
        if(this.state == null) {
            return (
                <div/>
                );
        }

        // maybe suppress reverse property if expected type is a simple type
        // add button should be disabled unless type and name are provided
        var c = this.props.controller;
        var mkUpdateFn = function(propertyName) {
            return function(event) {
                console.log("event", event);
                console.log("event.target", event.target.type);
                var value;
                if(event.target.type == "checkbox") {
                    console.log("event.target.value", event.target.value);
                    console.log("event.target.checked", event.target.checked);
                    value = event.target.checked;
                } else {
                    value = event.target.value;
                }
                c.updateProperty(propertyName, value);
            }
        }

        var errors = [];
        if(this.state.name == "") {
            errors.push(
                <div key={"e"+errors.length} className="alert alert-danger">
                    Must have name for new property
                </div>
            );
        }

        if(this.state.hasReverseProperty && this.state.reversePropertyName == "") {
            errors.push(
                <div key={"e"+errors.length} className="alert alert-danger">
                    Must have name for new reverse property
                </div>
            );
        }

        var reversePropFields = [];
        if(this.state.hasReverseProperty) {
            reversePropFields.push(
                <div key="r1" className="form-group">
                    <label>Reverse Property Name</label>
                    <input type="text"  className="form-control" onChange={mkUpdateFn("reversePropertyName")} />
                </div>
            )
            reversePropFields.push(
                <div key="r2" className="form-group">
                    <label>Reverse Property Description</label>
                    <input type="text"  className="form-control" onChange={mkUpdateFn("reversePropertyDescription")} />
                </div>
            )
        }

        return (
            <div className="container">
                {errors}
                <div className="form-group">
                    <label>Name</label>
                    <input className="form-control" type="text" value={this.state.name} onChange={mkUpdateFn("name")} />
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <input className="form-control" type="text" value={this.state.description} onChange={mkUpdateFn("description")} />
                </div>
                <div className="form-group">
                    <label>Expected type</label>
                    <TypeSelector selected={this.state.expectedTypeId} allTypes={this.state.allTypes} onChange={mkUpdateFn("expectedTypeId")}/>
                </div>
                <div className="form-group">
                    <label>Is unique</label>
                    <input type="checkbox" className="form-control" onChange={mkUpdateFn("isUnique")} />
                </div>
                <div className="form-group">
                    <label>Has reverse property</label>
                    <input type="checkbox"  className="form-control" onChange={mkUpdateFn("hasReverseProperty")} />
                </div>
                {reversePropFields}
                <button className="btn" onClick={c.addClicked} disabled={errors.length > 0}>Add</button>
            </div>
            );
    }
});

function emptyPropEditorModel () {
    var state = { name: "",
        description: "",
        expectedTypeId: null,
        isUnique: false,
        hasReverseProperty: false,
        reversePropertyName: "",
        reversePropertyDescription: "",
        allTypes : [{id: "Core/String", name: "String"}, {id: "Core/Number", name: "Number"}]
        };

    return state;
}

function PropertyEditorController(initialState) {
    this.listeners = [];
    this.state = initialState;
};

PropertyEditorController.prototype.addListener = function(fn) {
    this.listeners.push(fn);
}

PropertyEditorController.prototype.updateProperty = function(property, value) {
    var update = {}
    update[property] = {$set: value};

    this.setState(React.addons.update(this.state, update));
}

PropertyEditorController.prototype.setState = function(newState) {
    this.state = newState;
    for(var i=0;i<this.listeners.length;i ++) {
        this.listeners[i](newState);
    }
}

PropertyEditorController.prototype.addClicked = function() {

}


function initPropertyEditor(divId) {
    var controller = new PropertyEditorController(emptyPropEditorModel());

    var editor = React.render(
        <PropertyEditor controller={controller} />,
        document.getElementById(divId));

    controller.addListener(function(state) {
        console.log("updating editor with state", state);
        editor.setState(state)
        } );
    editor.setState(controller.state);

}
/// TESTING

//////////////////////////////

// pending: Log of changes?  each change with it's commit id
// map of cell id ->


var getInstancesForType = function(state, typeId) {
    var instances = [];
    var byId = state.cache.instancesByType[typeId];
    for(k in byId) {
        instances.push(byId[k]);
    }

    return instances;
}

// controller

function TableController(state, db) {
    this.state = state;
    this.stateListeners = [];
    this.db = db;
};

TableController.prototype.loadSheet = function(typeId) {
    var c = this;
    var updateState = function(response) {
        console.log("updateState called");
        var state = handleSheetQueryResponse(c.state, response);
        c.setState(state);
    }
    return this.db.loadSheet(typeId).then(updateState);
}

TableController.prototype.setState = function (state) {
    this.state = state;
    for (var i = 0; i < this.stateListeners.length; i++) {
        this.stateListeners[i](state);
    }
}

TableController.prototype.addListener = function (listener) {
    this.stateListeners.push(listener);
}

TableController.prototype.setElementFocus = function (row, column, element) {
    var state = this.state;
    var oldEditorState = state.editorState;
    if (oldEditorState != null) {
        // update the data matrix with the value from the editor
        // there should be an attempt to commit all outstanding changes
        state = applyAddElement(this.state, oldEditorState.row, oldEditorState.column, oldEditorState.value)
    }

    // now position the editor at the new element in the matrix
    var editorValue = "";
    if(row < state.data.length) {
        var cell = state.data[row][column];
        if (cell.length > element) {
            editorValue = cell[element];
        }
    }

    var options;
    var propertyId = state.columns[column];
    var propDef = state.cache.properties[propertyId];
    if(propDef.expectedTypeId == "Core/String") {
        options = null;
    } else {
        options = makeValueSuggestions(propDef.expectedTypeId, state);
        console.log("got options for ", propDef.expectedTypeId, ": ", options);
    }
    [ {text: "Abc", value: "abc"}, {text: "baaaah", value: "2"} ];
    var newEditorState = {row: row, column: column, element: element, value: editorValue, searchText: "", options: options};
    state = React.addons.update(state, {editorState: {$set: newEditorState}})

    this.setState(state);
};

TableController.prototype.searchTextUpdated = function (value) {
    var state = React.addons.update(this.state, {editorState: {searchText: { $set: value} } });
    this.setState(state);
}

TableController.prototype.updateEditorValue = function (value) {
    var state = this.state;

    state = React.addons.update(state, {editorState: {value: { $set: value} } })

    this.setState(state);
}

var newInstanceId = function() {
    // generate a random uuid.  Taken from http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
    return ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }));
}

TableController.prototype.acceptEditorValue = function () {
    var state = this.state;
    var eState = state.editorState;
    var updates = [];
    var valuesMatch = false;
    var instance;
    var property = state.columns[eState.column];

    if (eState.row >= state.rows.length) {
        // if this is past the end of the existing data table, we're actually creating a new instance
        instance = newInstanceId();
        state = applyAddInstance(state, instance);
    } else {
        instance = state.rows[eState.row]
    }

    if (eState.element >= state.data[eState.row][eState.column].length) {
        // this is a new element, so don't remove anything
    } else {
        // this is the replacement of an existing element
        var oldValue = state.data[eState.row][eState.column][eState.element];
        valuesMatch = (oldValue == eState.value);
        if(!valuesMatch) {
            updates.push({op: "DV", instance: instance, property: property, value: oldValue})
        }
    }

    if (!valuesMatch && eState.value != "") {
        updates.push({op: "AV", instance: instance, property: property, value: eState.value})
    }

    var c = this;
    this.db.update(updates).then(function (txn) {
        c.applyCommitted(txn, updates);
    });

    state = React.addons.update(state, {editorState: {$set: null}, uncommitted: {$push: updates } })

    this.setState(state);
}

TableController.prototype.applyCommitted = function(txn, updates) {
    var state = applyCommitted(this.state, txn, updates);
    console.log("updated state with committed", state);
    this.setState(state);
};

TableController.prototype.abortEdit = function () {
    var update = {editorState: {$set: null}};
    this.setState(React.addons.update(this.state, update));
}

TableController.prototype.applySync = function(txn, updates) {
    var state = this.state;
    if(state.version != txn) {
        console.log("apply updates from server response ", txn, updates);
        for(var i=0;i<updates.length;i++) {
            console.log("apply updates from server", updates[i]);
            state = applyUpdate(state, updates[i] )
        }

        state = applySyncComplete(state, txn);
        this.setState(state);
    }
}





TableController.prototype.loadFromQueryTypeResponse = function(typeId, response) {
    var c = this;

    var s = c.state;
    s = addToTypeCache(s, response.types, response.properties);
    c.setState(s);

    var typeDef = s.cache.types[typeId];

    var populateInstanceNames = function(response) {
        var s = c.state;
        s = addToTypeCache(s, response.types, response.properties);
        var names = [];
        for(var i=0;i<response.rows.length;i++) {
            names.push(response.rows[i][0]);
        }
        s = addToInstanceNameCache(s, response.rowIds, names);
        c.setState(s);
    }

    var enumLoads = [];
    for(var i=0;i<typeDef.propertyIds.length;i++) {
        var propertyId = typeDef.propertyIds[i];
        var property = c.cache.properties[propertyId];
        if(property.expectedType != "Core/String") {
            enumLoads.push(c.db.queryType(property.expectedType).then(populateInstanceNames));
        }
    }

    var updateStateWithData = function()
    {
        var s = c.state;

        // show all properties by default?
        var propIds = [];
        for(var i=0;i<response.properties.length;i++) {
            var p = response.properties[i];
            propIds.push(p.id);
            s = applyAddProperty(s, p);
        }

        for(var i=0;i<response.rowIds.length;i++) {
            var id = response.rowIds[i];
            s = applyAddInstance(s, id);
        }

        s = importData(s, response.txnId, response.rowIds, propIds, response.rows);

        c.setState(s);
    };

    Promise.all(enumLoads).then(updateStateWithData);

}

getCellElements = function (row, col, uncommitted, committed, cell, editorState) {
    // first, merge pending operations with current to get elements
    // if there are no elements, then clicking should open an editor at that position
    // if there are elements, the last element should get a plus sign
    // clicking an existing element should result in that element being edited (only for elements which are up-to-date.)
    //      add "oldValue" to editorState to avoid problems with trying to edit value which has not yet committed?

    var elements = [];

    for (var d = 0; d < cell.length; d++) {
        if (editorState != null && editorState.row == row && editorState.column == col && editorState.element == d) {
            elements.push({type: "editor", value: editorState.value});
        } else {
            elements.push({type: "data", value: cell[d]})
        }
    }

    for (var i = 0; i < committed.length; i++) {
        var update = committed[i];
        if (update.op == "DV") {
            elements = dropElementWithValue(elements, update.value);
        } else if (update.op == "AV") {
            elements.push({type: "committed", value: update.value})
        } else {
            console.log("unknown op", update);
        }
    }

    for (var i = 0; i < uncommitted.length; i++) {
        var update = uncommitted[i];
        if (update.op == "DV") {
            elements = dropElementWithValue(elements, update.value);
        } else if (update.op == "AV") {
            elements.push({type: "uncommitted", value: update.value})
        } else {
            console.log("unknown op", update);
        }
    }

    if (editorState != null && editorState.row == row && editorState.column == col && editorState.element >= cell.length) {
        elements.push({type: "editor", value: editorState.value})
    }

    return elements;
};

formatValueForDisplay = function(propertyId, cache, value) {
    var propDef = cache.properties[propertyId];
    if(propDef.expectedTypeId == "Core/String") {
        return value;
    } else {
        var name = cache.instanceNames[value];
        return name;
    }
}

dropElementWithValue = function (elements, value) {
    var n = [];
    for (var i = 0; i < elements.length; i++) {
        if (elements[i].value != value) {
            n.push(elements[i]);
        }
    }
    console.log("dropElementWithValue", elements, value, "->", n);
    return n;
}

/// TESTING

//////////////////////////////

// pending: Log of changes?  each change with it's commit id
// map of cell id ->

var emptyModel = function () {
    var state = {
        version: 0,
        columns: [],
        rows: [],
        data: [],
        instanceToRow: {},
        propertyToColumn: {},
        pending: [],
        uncommitted: [],
        editorState: null
//        {
//            row: 1,
//            column: 2,
//            element: 0,
//            editorValue: "x"
//        }
    };
    return state;
}

var applyUpdate = function (state, update) {
    if (update.op == "AV") {
        return applyAddValue(state, update.instance, update.property, update.value);
    } else if (update.op == "DV") {
        return applyDelValue(state, update.instance, update.property, update.value);
    } else if (update.op == "AI") {
        return applyAddInstance(state, update.instance);
    } else if (update.op == "DI") {
        return applyDelInstance(state, update.instance);
    } else {
        console.log("unknown op:", update.op);
        return state;
    }
}

var setMapValueStruct = function (key, value) {
    var op = {};
    op[key] = {$set: value}
    return op;
}

var applyAddValue = function (state, instance, property, value) {
    var row = state.instanceToRow[instance];
    var column = state.propertyToColumn[property];

    if (row == undefined || column == undefined) {
        // update doesn't affect our copy of state
        console.log("row", row, "or column", column, "not present");
        return state;
    }

    // before bothering to add the value, check to see if it is already there
    var values = state.data[row][column];
    for (var i = 0; i < values.length; i++) {
        if (values[i] == value) {
            return state;
        }
    }

    var update1 = {$push: [value]};
    var update2 = {};
    update2[column] = update1;
    var update3 = {};
    update3[row] = update2;
    var fullUpdate = {data: update3};

    console.log("state before update", state);
    console.log("update", fullUpdate);
    var state2 = React.addons.update(state, fullUpdate);
    console.log("state after update", state2);

    return state2;
};

var dropValueFn = function (value) {
    return function (list) {
        var newList = [];
        for (var i = 0; i < list.length; i++) {
            var t = list[i];
            if (t != value) {
                newList.push(t);
            }
        }
        return newList;
    }
}

var applyDelValue = function (state, instance, property, value) {
    var row = state.instanceToRow[instance];
    var column = state.propertyToColumn[property];

    if (row == undefined || column == undefined) {
        // update doesn't affect our copy of state
        return state;
    }

    var update1 = {$apply: dropValueFn(value)};
    var update2 = {};
    update2[column] = update1;
    var update3 = {};
    update3[row] = update2;
    var fullUpdate = {data: update3};

    return React.addons.update(state, fullUpdate);
};

var applyAddInstance = function (state, instance) {
    var row = []
    for (var i = 0; i < state.columns.length; i++) {
        row.push([])
    }

    console.log("applyAddInstance", row);

    var update = {
        data: {$push: [row]},
        instanceToRow: setMapValueStruct(instance, state.data.length),
        rows: {$push: [
            {id: instance}
        ]}
    };
    return React.addons.update(state, update)
}

var applyDelInstance = function (state, instance) {
    var rowIndex = state.instanceToRow[instance];

    // need to update rows, instanceToRow and data

    var newRows = [];
    var newInstanceToRow = {};
    for (var i = 0; i < state.rows.length; i++) {
        if (i != rowIndex) {
            newInstanceToRow[state.rows[i].id] = newRows.length;
            newRows.push(state.rows[i]);
        }
    }

    var update = {
        data: {$splice: [
            [rowIndex, 1]
        ]},
        rows: {$set: newRows},
        instanceToRow: {$set: newInstanceToRow}
    };
    console.log("applyDelInstance state", state);
    console.log("update", update);
    return React.addons.update(state, update);
}

var applyAddProperty = function (state, property) {
    var appendColumn = {}
    for (var i = 0; i < state.data.length; i++) {
        appendColumn[i] = {$push: [
            []
        ]};
    }

    var update = {data: appendColumn, propertyToColumn: setMapValueStruct(property, state.columns.length), columns: {$push: [
        {id: property, name: property}
    ]}}
    return React.addons.update(state, update)
}

var applyDelProperty = function (state, property) {
    var propertyIndex = state.propertyToColumn[property];

    var dropColFromRows = {};
    for (var i = 0; i < state.data.length; i++) {
        dropColFromRows[i] = {$splice: [
            [propertyIndex, 1]
        ]};
    }

    var newColumns = [];
    var newPropertyToColumn = {};
    for (var i = 0; i < state.columns.length; i++) {
        if (i != propertyIndex) {
            newPropertyToColumn[state.columns[i].id] = newColumns.length;
            newColumns.push(state.columns[i]);
        }
    }

    var update = {
        data: dropColFromRows,
        columns: {$set: newColumns},
        propertyToColumn: {$set: newPropertyToColumn}
    };

    return React.addons.update(state, update)
}


// API used by tabletown

var applyAddElement = function (state, row, column, value) {
    var op = {op: "AV", instance: state.rows[row], property: state.columns[column], value: value}

    var update = {uncommitted: {$push: [op]}};
    return React.addons.update(state, update);
}

var applyRemoveElement = function (state, row, column, element) {
    var op = {op: "DV", instance: state.rows[row], property: state.columns[column], value: state.data[row][column]}

    var update = {uncommitted: {$push: [op]}};
    return React.addons.update(state, update);
}

// called after updates have been sent and committed
var applyCommitted = function (state, txn, updates) {
    var updateSet = {};
    for (var i = 0; i < updates.length; i++) {
        var u = updates[i];
        var key = [u.op, u.instance, u.property, u.value].join(":")
        updateSet[key] = 1;
    }

    // only keep those which have not been committed
    var newUncommitted = [];
    for (var i = 0; i < state.uncommitted.length; i++) {
        var u = state.uncommitted[i];
        var key = [u.op, u.instance, u.property, u.value].join(":")
        if (!(key in updateSet)) {
            newUncommitted.push(u);
        }
    }

    var updatesWithTxn = [];
    for (var i = 0; i < updates.length; i++) {
        updatesWithTxn.push(React.addons.update(updates[i], {txn: {$set: txn}}))
    }

    var update = {uncommitted: {$set: newUncommitted}, pending: {$push: updatesWithTxn}};
    return React.addons.update(state, update);
}

var applySyncComplete = function (state, newVersion) {
    // clear all updates
    var newPending = [];
    var pending = state.pending;

    for (var i = 0; i < pending.length; i++) {
        var p = pending[i];
        if (p.version && p.version > newVersion) {
            newPending.push(p)
        }
    }

    var update = {version: {$set: newVersion}, pending: {$set: newPending}};
    return React.addons.update(state, update)
}

// controller

function TableController(state, db) {
    this.state = state;
    this.stateListeners = [];
    this.db = db;
};

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
    var cell = state.data[row][column];
    if (cell.length > element) {
        editorValue = cell[element];
    }

    var newEditorState = {row: row, column: column, element: element, value: editorValue};
    state = React.addons.update(state, {editorState: {$set: newEditorState}})

    this.setState(state);
};

TableController.prototype.updateEditorValue = function (value) {
    var state = this.state;

    state = React.addons.update(state, {editorState: {value: { $set: value} } })

    this.setState(state);
}

TableController.prototype.acceptEditorValue = function () {
    var state = this.state;
    var eState = state.editorState;
    var updates = [];

    if (eState.element >= state.data[eState.row][eState.column].length) {
        // this is a new element, so don't remove anything
    } else {
        // this is the replacement of an existing element
        var oldValue = state.data[eState.row][eState.column][eState.element];
        updates.push({op: "DV", instance: state.rows[eState.row].id, property: state.columns[eState.column].id, value: oldValue})
    }

    if (eState.value != "") {
        updates.push({op: "AV", instance: state.rows[eState.row].id, property: state.columns[eState.column].id, value: eState.value})
    }

    var c = this;
    this.db.update(updates).then(function (txn) {
        var state = applyCommitted(c.state, txn, updates);
        console.log("updated state with committed", state);
        c.setState(state);
    });

    state = React.addons.update(state, {editorState: {$set: null}, uncommitted: {$push: updates } })

    this.setState(state);
}

TableController.prototype.abortEdit = function () {
    var update = {editorState: {$set: null}};
    this.setState(React.addons.update(this.state, update));
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
            updateTypeForValue(update.value, "committed-deleted-data");
        } else if (update.op == "AV") {
            elements.push({type: "committed", value: update.value})
        } else {
            console.log("unknown op", update);
        }
    }

    for (var i = 0; i < uncommitted.length; i++) {
        var update = uncommitted[i];
        if (update.op == "DV") {
            //updateElementTypeForValue(elements, update.value, "uncommitted-deleted-data");
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

dropElementWithValue = function (elements, value) {
    var n = [];
    for (var i = 0; i < elements; i++) {
        if (elements[i].value != value) {
            n.push(elements[i]);
        }
    }
    return n;
}

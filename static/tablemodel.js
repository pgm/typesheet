/// TESTING

//////////////////////////////

// pending: Log of changes?  each change with it's commit id
// map of cell id ->

var emptyModel = function() {
    var state = {
        version: 0,
        columns: [],
        rows: [],
        data: [],
        instanceToRow: {},
        propertyToColumn:{},
        pending: [],
        uncommitted: []
        };
     return state;
}

var applyUpdate = function(state, update) {
    if(update.op == "AV") {
        return applyAddValue(state, update.instance, update.property, update.value);
    } else if(update.op == "DV") {
        return applyDelValue(state, update.instance, update.property, update.value);
    } else if(update.op == "AI") {
        return applyAddInstance(state, update.instance);
    } else if(update.op == "DI") {
        return applyDelInstance(state, update.instance);
    } else {
        console.log("unknown op:", update.op);
        return state;
    }
}

var setMapValueStruct = function(key, value) {
    var op = {};
    op[key] = {$set: value}
    return op;
}

var applyAddValue = function(state, instance, property, value) {
    var row = state.instanceToRow[instance];
    var column = state.propertyToColumn[property];

    if(row == undefined || column == undefined) {
        // update doesn't affect our copy of state
        console.log("row", row, "or column", column, "not present");
        return state;
    }

    // before bothering to add the value, check to see if it is already there
    var values = state.data[row][column];
    for(var i=0;i<values.length;i++) {
        if(values[i] == value) {
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

var dropValueFn = function(value) {
    return function(list) {
        var newList = [];
        for(var i=0;i<list.length;i++) {
            var t = list[i];
            if(t != value) {
                newList.push(t);
            }
        }
        return newList;
    }
}

var applyDelValue = function(state, instance, property, value) {
    var row = state.instanceToRow[instance];
    var column = state.propertyToColumn[property];

    if(row == undefined || column == undefined) {
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

var applyAddInstance = function(state, instance) {
    var row = []
    for(var i=0;i<state.columns.length;i++) {
        row.push([])
    }

    console.log("applyAddInstance", row);

    var update = {
        data: {$push: [row]},
        instanceToRow: setMapValueStruct(instance, state.data.length),
        rows: {$push: [{id:instance}]}
        };
    return React.addons.update(state, update)
}

var applyDelInstance = function(state, instance) {
    var rowIndex = state.instanceToRow[instance];

    // need to update rows, instanceToRow and data

    var newRows = [];
    var newInstanceToRow = {};
    for(var i=0;i<state.rows.length;i++) {
      if(i != rowIndex) {
        newInstanceToRow[state.rows[i].id] = newRows.length;
        newRows.push(state.rows[i]);
      }
    }

    var update = {
        data: {$splice: [[rowIndex, 1]]},
        rows: {$set: newRows},
        instanceToRow: {$set: newInstanceToRow}
    };
    console.log("applyDelInstance state", state);
    console.log("update", update);
    return React.addons.update(state, update);
}

var applyAddProperty = function(state, property) {
    var appendColumn = {}
    for(var i=0;i<state.data.length;i++) {
        appendColumn[i] = {$push: [[]]};
    }

    var update = {data: appendColumn, propertyToColumn: setMapValueStruct(property, state.columns.length), columns: {$push: [{id: property, name: property}]}}
    return React.addons.update(state, update)
}

var applyDelProperty = function(state, property) {
    var propertyIndex = state.propertyToColumn[property];

    var dropColFromRows = {};
    for(var i=0;i<state.data.length;i++) {
        dropColFromRows[i] = {$splice: [[propertyIndex, 1]]};
    }

    var newColumns = [];
    var newPropertyToColumn = {};
    for(var i=0;i<state.columns.length;i++) {
      if(i != propertyIndex) {
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

var applyAddElement = function(state, row, column, value) {
    var op = {op: "AV", instance: state.rows[row], property:state.columns[column], value:value}

    var update = {uncommitted: {$push: [op]}};
    return React.addons.update(state, update);
}

var applyRemoveElement = function(state, row, column, element) {
    var op = {op: "DV", instance: state.rows[row], property:state.columns[column], value:state.data[row][column]}

    var update = {uncommitted: {$push: [op]}};
    return React.addons.update(state, update);
}

// called after updates have been sent and committed
var applyCommitted = function(state, txn, updates) {
    var updateSet = {};
    for(var i=0;i<updates.length;i++){
        var u = updates[i];
        var key = [u.op, u.instance, u.property, u.value].join(":")
        updateSet[key] = 1;
    }

    // only keep those which have not been committed
    var newUncommitted = [];
    for(var i=0;i<state.uncommitted.length;i++) {
        var u = state.uncommitted[i];
        var key = [u.op, u.instance, u.property, u.value].join(":")
        if(!(key in updateSet)) {
            newUncommitted.push(u);
        }
    }

    var updatesWithTxn = [];
    for(var i=0;i<updates.length;i++){
        updatesWithTxn.push( React.addons.update(updates[i], {txn: {$set: txn}}))
    }

    var update = {uncommitted: {$set: newUncommitted}, pending: {$push: updatesWithTxn}};
    return React.addons.update(state, update);
}

var applySyncComplete = function(state, newVersion) {
    // clear all updates
    var newPending = [];
    var pending = state.pending;

    for(var i=0;i<pending.length;i++) {
        var p = pending[i];
        if(p.version && p.version > newVersion) {
            newPending.push(p)
        }
    }

    var update = {version: {$set: newVersion}, pending: {$set: newPending}};
    return React.addons.update(state, update)
}

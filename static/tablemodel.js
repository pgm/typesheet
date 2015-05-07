/// TESTING

//////////////////////////////

// pending: Log of changes?  each change with it's commit id
// map of cell id ->

var emptyModel = function() {
    var state = {
        columns: [],
        rows: [],
        data: [],
        instanceToRow:{},
        propertyToColumn:{}
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

    if(!row || !column) {
        // update doesn't affect our copy of state
        return state;
    }

    var update1 = {$apply: dropValueFn(value)};
    var update2 = {};
    update2[column] = update1;
    var update3 = {};
    update3[row] = {data: update2};
    var fullUpdate = {rows: update3};

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

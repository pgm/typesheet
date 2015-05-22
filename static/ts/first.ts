///<reference path="react-addons.d.ts" />
///<reference path="es6-promise.d.ts" />

"use strict";

import React = require("react/addons");

interface Update {
    instance: string;
    property: string;
    op: string;
    value: string;
    txn: number;
}

interface TypeDef {
    id: string;
    name: string;
    description: string;
    includedTypeIds: Array<string>;
    propertyIds: Array<string>;
    nameIsUnique: boolean;
}

interface PropDef {
    id: string;
    name: string;
    description: string;
    expectedTypeId: string;
    reversePropertyId: string;
    isUnique: boolean;
}

interface IdCache<T> {
    [index: string]: T;
}

interface Cache {
    properties: IdCache<PropDef>;
    types: IdCache<TypeDef>;
    instanceIdsByType: IdCache<Array<string>>;
    instanceNames: IdCache<string>;
}

interface StrToIndex {
    [index: string]: number;
}

interface EditorState {
    row: number;
    column: number;
    element: number;
    editorValue: string;
    searchText: string;
    options: any;
}

interface TableState {
    version: number;
    columns: Array<string>;  // property ids
    rows: Array<string>;     // instance ids
    data: Array<Array<string>>;
    instanceToRow: StrToIndex;
    propertyToColumn: StrToIndex;
    pending: Array<Update>;
    uncommitted: Array<Update>;
    editorState: EditorState;
    cache: Cache;
}

// all the data required to load a sheet.  This is the type requested, all included types, all instances, and all (instance, name) pairs for referenced properties
// may ultimately require multiple db round trips to collect all of this information
interface LoadSheetResponse {
    typeId: string;
    txnId: number;
    propertyIds: Array<string>;
    instanceIds: Array<string>;
    data: Array<Array<Array<string>>>;
    typeDefs: Array<TypeDef>;
    propDefs: Array<PropDef>;
    referencedTypeInstances: IdCache<Array<string>>;  // typeId -> list of ids of instances that have that type
    instanceNames: IdCache<string>; // instance id -> instance name.  To be shown in lookups
}

var importData = function(state : TableState, txnId : number, rowIds : Array<string>, propertyIds : Array<string>, rows : Array<Array<Array<string>>> ) {
    var projection = [];
    var empty : Array<string> = [];
    for(var rowIndex=0;rowIndex<state.rows.length;rowIndex++) {
        var row : Array<Array<string>> = [];
        for(var colIndex=0;colIndex<state.columns.length;colIndex++) {
            row.push(empty);
        }
        projection.push(row);
    }

    for(var rowIndex=0;rowIndex<rowIds.length;rowIndex++) {
        var instanceId = rowIds[rowIndex];
        var row = rows[rowIndex];
        var projRow = projection[state.instanceToRow[instanceId]];
        if(! projRow) {
            console.warn("projRow", projRow, "state.instanceToRow[instanceId]", state.instanceToRow[instanceId], "instanceId", instanceId);
        }
        for(var colIndex=0;colIndex<propertyIds.length;colIndex++) {
            var propertyId = propertyIds[colIndex];

            var elements = row[colIndex];
            projRow[state.propertyToColumn[propertyId]] = elements;
        }
    }

    var update = {data: {$set: projection}, version: {$set: txnId}};
    return React.addons.update(state, update);
}

function addToTypeCache(s : TableState, types : Array<TypeDef>, properties : Array<PropDef>) : TableState {
    var propMap = {};
    for(var i=0;i<properties.length;i++) {
        var p = properties[i];
        propMap[p.id] = p;
    }

    var typeMap = {}
    for(var i=0;i<types.length;i++) {
        var t = types[i];
        typeMap[t.id] = t;
    }

    var update = {cache: {properties: {$merge: propMap}, types: {$merge: typeMap}}};
    return React.addons.update(s, update);
}

function updateNameCache(state : TableState, referencedTypeInstances: IdCache<Array<string>>, instanceNames: IdCache<string>) {
    var update = {cache: {instanceIdsByType: {$merge: referencedTypeInstances}, instanceNames: {$merge: instanceNames}}};
    return React.addons.update(state, update);
}

function handleSheetQueryResponse(state : TableState, response: LoadSheetResponse) : TableState {
    state = addToTypeCache(state, response.typeDefs, response.propDefs);

    // show all properties
    for(var i=0;i<response.propertyIds.length;i++) {
        var propId = response.propertyIds[i];
        state = applyAddProperty(state, state.cache.properties[propId]);
    }
    // show all rows
    for(var i=0;i<response.instanceIds.length;i++) {
        state = applyAddInstance(state, response.instanceIds[i]);
    }

    state = importData(state, response.txnId, response.instanceIds, response.propertyIds, response.data);
    state = updateNameCache(state, response.referencedTypeInstances, response.instanceNames);
    return state;
}

interface UpdateResponse {
    txn: number;
}

interface QueryUpdatesResponse {
    txn: number;
    ops: Array<Update>;
}

interface Db {
    loadSheet(typeId : string) : Promise<LoadSheetResponse>;
    update(updates : Array<Update>) : Promise<UpdateResponse>;
    queryUpdates(afterTxn : number) : Promise<QueryUpdatesResponse>;
}

function mockLoadSheet(typeId: string) {
    var thisType = {
        id: typeId,
        name: "Type",
        description: "Description",
        includedTypeIds: [],
        propertyIds: ["colorProp"],
        nameIsUnique: true
    };

    var colorType = {
        id: "colorType",
        name: "Color",
        description: "Description",
        includedTypeIds: [],
        propertyIds: [],
        nameIsUnique: true
    };

    var colorProp = {
        id: "colorProp",
        name: "isColor",
        description: "",
        expectedTypeId: "colorType",
        reversePropertyId: null,
        isUnique: false
    };

    var response : LoadSheetResponse = {
        typeId: typeId,
        txnId: 1,
        propertyIds: ["colorProp"],
        instanceIds: ["instance"],
        data: [
            [
                ["red"]
            ]
        ],
        typeDefs: [thisType, colorType],
        propDefs: [colorProp],
        referencedTypeInstances: {"colorType": ["red"]},
        instanceNames: {"red": "Red"}
    };

    var p = new Promise<LoadSheetResponse>((resolve, reject) => {
        resolve(response);
    });

    return p;
}

function emptyModel () : TableState {
    var state = {
        version: 0,
        columns: [],  // property ids
        rows: [],     // instance ids
        data: [],
        instanceToRow: <StrToIndex>{},
        propertyToColumn: <StrToIndex>{},
        pending: [],
        uncommitted: [],
        editorState: null,
        cache: {
            properties: <IdCache<PropDef>>{},
            types: <IdCache<TypeDef>>{},
            instanceIdsByType: <IdCache<Array<string>>>{}, // map of type_id -> (map instance id -> name)
            instanceNames: <IdCache<string>>{}
        }
    };
    return state;
}

// unused?
//var updateInstanceNamesForType = function(state: TableState, typeId: string, instances: Array<InstanceName>) {
//    var byId = {};
//    for(var i=0;i<instances.length;i++) {
//        var instance = instances[i];
//        byId[instance.id] = instance.name;
//    }
//    var typeMap = {};
//    typeMap[typeId] = byId;
//
//    return React.addons.update(state, {cache: {instancesByType: {$merge: typeMap}}})
//}


function applyUpdate (state : TableState, update : Update) : TableState {
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

function applyAddValue (state : TableState, instance : string, property : string, value : string) : TableState{
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

function dropValueFromList (value : string, list : Array<string>) : Array<string> {
    var newList = [];
    for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (t != value) {
            newList.push(t);
        }
    }
    return newList;
}

var applyDelValue = function (state : TableState, instance : string, property : string, value: string) : TableState {
    var row = state.instanceToRow[instance];
    var column = state.propertyToColumn[property];

    if (row == undefined || column == undefined) {
        // update doesn't affect our copy of state
        return state;
    }

    var dropFn = function(list) { return dropValueFromList(value, list) };
    var update1 = {$apply: dropFn};
    var update2 = {};
    update2[column] = update1;
    var update3 = {};
    update3[row] = update2;
    var fullUpdate = {data: update3};

    return React.addons.update(state, fullUpdate);
};

var applyAddInstance = function (state : TableState, instance : string) {
    var row = []
    for (var i = 0; i < state.columns.length; i++) {
        row.push([])
    }

    console.log("applyAddInstance", row);

    var update = {
        data: {$push: [row]},
        instanceToRow: setMapValueStruct(instance, state.data.length),
        rows: {$push: [
            instance
        ]}
    };
    return React.addons.update(state, update)
}

var applyDelInstance = function (state : TableState, instance : string) : TableState {
    var rowIndex = state.instanceToRow[instance];

    // need to update rows, instanceToRow and data

    var newRows = [];
    var newInstanceToRow = {};
    for (var i = 0; i < state.rows.length; i++) {
        if (i != rowIndex) {
            newInstanceToRow[state.rows[i]] = newRows.length;
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

var applyAddProperty = function (state : TableState, property : PropDef) : TableState {
    var appendColumn = {}
    for (var i = 0; i < state.data.length; i++) {
        appendColumn[i] = {$push: [
            []
        ]};
    }

    var propMap = {}
    propMap[property.id] = property;

    var update = {data: appendColumn,
        propertyToColumn: setMapValueStruct(property.id, state.columns.length),
        columns: {$push: [
            property.id
        ]},
        cache: {properties: {$merge: propMap}}};

    var state = <TableState>React.addons.update(state, update)
    console.log("applyAddProperty", state);
    return state;
}

var applyDelProperty = function (state : TableState, property : string) : TableState {
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
            newPropertyToColumn[state.columns[i]] = newColumns.length;
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

var setMapValueStruct = function (key, value) {
    var op = {};
    op[key] = {$set: value}
    return op;
}

// API used by tabletown

var applyAddElement = function (state : TableState, row : number, column : number, value: string) :TableState {
    var op = {op: "AV", instance: state.rows[row], property: state.columns[column], value: value}

    var update = {uncommitted: {$push: [op]}};
    return React.addons.update(state, update);
}

var applyRemoveElement = function (state : TableState, row : number, column : number, element : number) :TableState {
    var op = {op: "DV", instance: state.rows[row], property: state.columns[column], value: state.data[row][column]}

    var update = {uncommitted: {$push: [op]}};
    return <TableState>React.addons.update(state, update);
}

// called after updates have been sent and committed
var applyCommitted = function (state : TableState, txn : number, updates : Array<Update>) :TableState {
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
    return <TableState>React.addons.update(state, update);
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

interface SelectOption {
    value: string;
    text: string;
}

function makeValueSuggestions(typeId : string, state : TableState) : Array<SelectOption> {

            // find all the instances with for the given type
        var instanceIds = state.cache.instanceIdsByType[typeId];
        // look up each one and add it as an option
        var options = [];
        for(var i=0;i<instanceIds.length;i++) {
            var id = instanceIds[i];
            var text = state.cache.instanceNames[id];

            options.push({value: id, text: text})
        }
     return options;
}
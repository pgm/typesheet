
var ElementEditor = React.createClass({
    componentDidMount:function() {
        this.cancelled = false;
    },
    onBlur: function(event) {
        if(!this.cancelled) {
            var newValue = event.target.textContent;
            console.log("new value:", newValue);
            this.props.onChange(newValue);
        }
    },
    render: function() {
        return (
            <div className="pending-change" contentEditable="true" onBlur={this.onBlur}>
                {this.props.value}
            </div>
            );
    }
});

var TableCell = React.createClass({
    getElements: function(row, col, uncommitted, committed, cell, editorState) {
        // first, merge pending operations with current to get elements
        // if there are no elements, then clicking should open an editor at that position
        // if there are elements, the last element should get a plus sign
        // clicking an existing element should result in that element being edited (only for elements which are up-to-date.)
        //      add "oldValue" to editorState to avoid problems with trying to edit value which has not yet committed?

        var elements = [];

        for(var d=0;d<cell.length;d++) {
            if(editorState.row == row && editorState.column == col && editorState.element == d) {
                elements.push({type:"editor", value: editorState.value});
            } else {
                elements.push({type:"data", value: cell[d]})
            }
        }

        for(var i=0;i<committed.length;i++) {
            var update = committed[i];
            if(update.op == "DV") {
                updateTypeForValue(update.value, "committed-deleted-data");
            } else if(update.op == "AV"){
                elements.push({type:"committed", value: update.value})
            } else {
                console.log("unknown op", update);
            }
        }

        for(var i=0;i<uncommitted.length;i++) {
            var update = uncommitted[i];
            if(update.op == "DV") {
                updateTypeForValue(update.value, "uncommitted-deleted-data");
            } else if(update.op == "AV"){
                elements.push({type:"uncommitted", value: update.value})
            } else {
                console.log("unknown op", update);
            }
        }

        if(editorState.row == row && editorState.column == col && editorState.element >= cell.length ) {
            elements.push({type:"editor", value: editorState.value})
        }

        return elements;
    },
    render: function() {
        var controller = this.props.controller;
        var row = this.props.row;
        var col = this.props.col;
        var cell = this.props.cell;
        var editorState = this.props.editorState;
        var uncommitted = this.props.uncommitted;
        var committed = this.props.committed;

        var cellKey="c"+row+"."+col;

        var elements = []; //this.getElements(row, col, uncommitted, committed, cell, editorState);
        var results = [];

        var setEditorToAdd = function() {
                console.log("add", row, col);
            controller.setElementFocus(row, col, cell.length);
        };

        var mkSetEditorToEdit = function(elementIndex) {
            return function() {
                console.log("edit", row, col, elementIndex)
                controller.setElementFocus(row, col, elementIndex);
            }
        }

        if(elements.length == 0) {
            // empty row.  Editing this will result in a new record
            return (
                <td onClick={setEditorToAdd}>
                </td>
                );
        } else {
            for(var i=0;i<elements.length;i++) {
                var e = elements[i];
                var elKey = "e"+i;

                if(e.type == "editor") {
                    results.push(
                        <ElementEditor key="editor" value={editorState.editorValue} onChange={controller.elementUpdated}/>
                    );
                } else {
                    var lastElement = (i == (elements.length-1));
                    if(lastElement) {
                        results.push(
                            <div key={elKey} onClick={mkSetEditorToEdit(i)}>
                                {e.value}
                                <span className="add-button" onClick={setEditorToAdd}>+</span>
                            </div>
                        );
                    } else {
                        results.push(
                            <div key={elKey} onClick={mkSetEditorToEdit(i)}>
                                {e.value}
                            </div>
                        );
                    }
                }
            }
            return (
                <td>
                    {results}
                </td>
                );
        }
    }
});


var Table = React.createClass({
//        keyPress: function(event) {
//            console.log("keyPress", event.ctrlKey, event.charCode, event.key, event.keyCode);
//        },
        stopPropagation : function(event) {
                event.stopPropagation();
        },
        textEditorChanged: function(event) {
            this.props.controller.textEditorChanged(event.target.value);
        },
        setElementFocus: function(row, column, element) {
            var controller = this.props.controller;
            return function(event) {
                console.log("selected", row, column, element);
                controller.setElementFocus(row, column, element);
                event.stopPropagation();
            }
        },
        filterUpdates: function(instance, property, updates) {
            var filtered = [];
            for(var i=0;i<updates.length;i++) {
                var r = updates[i];
                if(r.instance == instance && r.property == property) {
                    filtered.push(r);
                }
            }
            return filtered;
        },
        render: function() {
            var editorState = this.props.editorState;
            var pendingChanges = this.props.pendingChanges;

            var tableRows = [];

            var headerCells = [];
            var columns = this.props.columns;
            for(var i=0;i<columns.length;i++) {
                var key="h"+i;
                headerCells.push(
                    <th key={key} className="table-town">{columns[i].name}</th>
                );
            }

            var rows = this.props.rows;
            var data = this.props.data;
            var committed = this.props.committed;
            var uncommitted = this.props.uncommitted;

            for(var i=0;i<rows.length;i++) {

                var tableCells = [];
                var row = data[i];
                var instance = rows[i].id;

                for(var col=0;col<row.length;col++) {
                    var property = columns[i].id;
                    var cell = row[col];
                    var cellKey = "c"+i+"."+col;

                    // only consider those records for this cell
                    cellUncommitted = []; //this.filterUpdates(instance, property, uncommitted);
                    cellCommitted = []; //this.filterUpdates(instance, property, committed);

                    tableCells.push(
                        <TableCell key={cellKey} row={i} col={col} cell={cell} uncommitted={cellUncommitted} committed={cellCommitted} editorState={editorState} controller={this.props.controller}/>
                    );
                }

                var rowKey = "r"+i;
                tableRows.push(
                    <tr key={rowKey}>
                        {tableCells}
                    </tr>
                )
            }

            return (
                <table className="table-town">
                    <thead>
                        <tr>
                            {headerCells}
                        </tr>
                    </thead>
                    <tbody>
                        {tableRows}
                    </tbody>
                </table>
            );
        }
    });

var TableCtl = React.createClass({
    getInitialState: function() {
        return this.props.initialState;
    },
    render: function() {
        return (
            <Table columns={this.state.columns} data={this.state.data} rows={this.state.rows} editorState={this.state.editorState} controller={this.props.controller} committed={this.state.pending} uncommitted={this.state.uncommitted} />
        );
    }
});

function mockUpdateProperty(id, property_id, values) {
    var p = new Promise(function(resolve, reject) {
        setTimeout(
            function() {
                resolve({id: id, property_id: property_id, values: values});
            }, 2000);
    });

    return p;
}




function initTableTown(tableDivId) {
    var editorState = {
        row: 1,
        column: 2,
        element: 0,
        editorValue: "x"
    }

    var s = emptyModel();
    s = applyAddProperty(s, "x")
    s = applyAddProperty(s, "y")
    s = applyAddProperty(s, "z")
    s = applyUpdate(s, {op: "AI", instance: "a"} )
    s = applyUpdate(s, {op: "AI", instance: "b"} )
    s = applyUpdate(s, {op: "AI", instance: "c"} )
    s = applyUpdate(s, {op: "AV", instance: "a", property:"x", value:"00"} )
    //s = applyUpdate(s, {op: "AV", instance: "c", property:"x", value:"20"} )
    s.editorState = editorState;
    s.pendingChanges = {};

    var state = s;
    var editor = null;

    // Mock db
    var db = {
        txnId: 1,
        transactions: [],
        update: function(ops) {
            var promise = new Promise(function(resolve, reject){
                // after 1 second report transaction id
                setTimeout(function(){
                    db.txnId++;
                    db.transactions.push({txn: db.txnId, ops: ops});
                    resolve({txn: db.txnId});
                }, 1000);
            });

            return promise;
        },
        queryUpdates: function(afterTxn) {
//            console.log("queryUpdates", afterTxn, db.transactions);
            var updates = [];
            for(var i=0;i<db.transactions.length;i++){
                var u = db.transactions[i];
                if(u.txn > afterTxn) {
                    console.log("found transaction", u);
                    updates = updates.concat(u.ops);
//                    for(var ui=0;ui<u.ops.length;ui++) {
//                        console.log("ui=",ui);
//                        updates.push(u.ops[ui]);
//                    }
                }
            }

            if(updates.length > 0){
            console.log(" queryUpdates update", updates);
            }

            var latestTxn = db.txnId;

            var promise = new Promise(function(resolve, reject){

                // after 1 second report updates
                setTimeout(function(){
                    resolve({txn: latestTxn, ops: updates});
                }, 1000);
            });

            return promise;
        }
    }

    var controller = {

        setElementFocus: function(row, column, element) {
            var oldEditorState = state.editorState;
            if(oldEditorState != null) {
                // update the data matrix with the value from the editor
                // there should be an attempt to commit all outstanding changes
                state = applyAddElement(state, oldEditorState.row, oldEditorState.column, oldEditorState.editorValue)
            }

            // now position the editor at the new element in the matrix
            var editorValue = "";
            var cell = state.rows[row].data[column];
            if(cell.length > element) {
                editorValue = cell[element];
            }

            var newEditorState = {row: row, column: column, element: element, editorValue: editorValue};
            state = React.addons.update(state, {editorState: {$set: newEditorState}})
            editor.setState(state);
        },
        // can we drop this?
        textEditorChanged: function(value) {
            state = React.addons.update(state, {editorState: {editorValue: {$set: value}}})
            editor.setState(state);
        },
        elementUpdated: function(value) {
            var eState = state.editorState;
            console.log("set element (", eState.row, ", ", eState.column, ", ", eState.element, ") to ", value);

            var updates = [];
            if(eState.element >= state.data[eState.row][eState.column].length) {
                // this is a new element, so don't remove anything
            } else {
                // this is the replacement of an existing element
                var oldValue = state.data[eState.row][eState.column][eState.element];
                updates.push({op: "DV", instance: state.rows[eState.row].id, property: state.columns[eState.column].id, value: oldValue})
            }
            updates.push({op: "AV", instance: state.rows[eState.row].id, property: state.columns[eState.column].id, value: value})

            db.update(updates).then(function(txn) {
                state = applyCommitted(state, txn, updates);
                console.log("updated state with committed", state);
            });
        }
    };

    editor = React.render(
        <TableCtl initialState={state} controller={controller}/>,
        document.getElementById(tableDivId));

/*
    setInterval(function() {
        db.queryUpdates(state.version).then(function(response) {

            if(state.version != response.txn) {
                console.log("apply updates from server response ", response);
                var updates = response.ops;
                for(var i=0;i<updates.length;i++) {
                    console.log("apply updates from server", updates[i]);
                    state = applyUpdate(state, updates[i] )
                }
                state = applySyncComplete(state, response.txn);
                editor.setState(state);
            }
        });
   }, 1000);
   */
}
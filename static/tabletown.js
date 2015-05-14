
var ElementEditor = React.createClass({displayName: "ElementEditor",
    componentDidMount: function() {
        React.findDOMNode(this).focus();
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
            React.createElement("div", {className: "pending-change", contentEditable: "true", onBlur: this.onBlur}, 
                this.props.value
            )
            );
    }
});

var TableCell = React.createClass({displayName: "TableCell",
    render: function() {
        var controller = this.props.controller;
        var row = this.props.row;
        var col = this.props.col;
        var cell = this.props.cell;
        var editorState = this.props.editorState;
        var uncommitted = this.props.uncommitted;
        var committed = this.props.committed;

        var cellKey="c"+row+"."+col;

        var elements = getCellElements(row, col, uncommitted, committed, cell, editorState);
        var results = [];

        var setEditorToAdd = function() {
                console.log("add", row, col);
            controller.setElementFocus(row, col, cell.length);
                console.log("stoop ev");
                // TODO: FIXME: this is not working.  the outer element is still receiving the event for some reason?!?!?!
                event.stopPropagation();
        };

        var mkSetEditorToEdit = function(elementIndex) {
            return function(event) {
                console.log("edit", row, col, elementIndex)
                controller.setElementFocus(row, col, elementIndex);
            }
        }

        if(elements.length == 0) {
            // empty row.  Editing this will result in a new record
            return (
                React.createElement("td", {onClick: setEditorToAdd}
                )
                );
        } else {
            for(var i=0;i<elements.length;i++) {
                var e = elements[i];
                var elKey = "e"+i;

                if(e.type == "editor") {
                    results.push(
                        React.createElement(ElementEditor, {key: "editor", value: editorState.value, onChange: function(value) { controller.updateEditorValue(value); controller.acceptEditorValue() }})
                    );
                } else {
                    var lastElement = (i == (elements.length-1));
                    if(lastElement) {
                        results.push(
                            React.createElement("div", {key: elKey, onClick: mkSetEditorToEdit(i)}, 
                                e.value, 
                                React.createElement("span", {className: "add-button", onClick: setEditorToAdd}, "+")
                            )
                        );
                    } else {
                        results.push(
                            React.createElement("div", {key: elKey, onClick: mkSetEditorToEdit(i)}, 
                                e.value
                            )
                        );
                    }
                }
            }
            return (
                React.createElement("td", null, 
                    results
                )
                );
        }
    }
});


var Table = React.createClass({displayName: "Table",
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
                    React.createElement("th", {key: key, className: "table-town"}, columns[i].name)
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
                        React.createElement(TableCell, {key: cellKey, row: i, col: col, cell: cell, uncommitted: cellUncommitted, committed: cellCommitted, editorState: editorState, controller: this.props.controller})
                    );
                }

                var rowKey = "r"+i;
                tableRows.push(
                    React.createElement("tr", {key: rowKey}, 
                        tableCells
                    )
                )
            }

            return (
                React.createElement("table", {className: "table-town"}, 
                    React.createElement("thead", null, 
                        React.createElement("tr", null, 
                            headerCells
                        )
                    ), 
                    React.createElement("tbody", null, 
                        tableRows
                    )
                )
            );
        }
    });

var TableCtl = React.createClass({displayName: "TableCtl",
    getInitialState: function() {
        return this.props.initialState;
    },
    render: function() {
        return (
            React.createElement(Table, {columns: this.state.columns, data: this.state.data, rows: this.state.rows, editorState: this.state.editorState, controller: this.props.controller, committed: this.state.pending, uncommitted: this.state.uncommitted})
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
    var s = emptyModel();
    s = applyAddProperty(s, "x")
    s = applyAddProperty(s, "y")
    s = applyAddProperty(s, "z")
    s = applyUpdate(s, {op: "AI", instance: "a"} )
    s = applyUpdate(s, {op: "AI", instance: "b"} )
    s = applyUpdate(s, {op: "AI", instance: "c"} )
    s = applyUpdate(s, {op: "AV", instance: "a", property:"x", value:"00"} )
    //s = applyUpdate(s, {op: "AV", instance: "c", property:"x", value:"20"} )

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

    var controller = new TableController(state, db);

    editor = React.render(
        React.createElement(TableCtl, {initialState: state, controller: controller}),
        document.getElementById(tableDivId));

    controller.addListener(function(state) {
        console.log("updating editor with state", state);
        editor.setState(state)
        } );

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

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
            for(var i=0;i<rows.length;i++) {

                var tableCells = [];
                var row = rows[i].data;

                for(var col=0;col<row.length;col++) {
                    var cell = row[col];
                    var cellKey="c"+i+"."+col;

                    var elements = [];
                    var cellCount = cell.length;
                    if(editorState.row == i && editorState.column == col && editorState.element >= cellCount ) {
                        cellCount = editorState.element + 1;
                        console.log("adding extra cell", cellCount);
                    }
                    for(var d=0;d<cellCount;d++) {
                        var elKey = cellKey+"."+d;

                        if (elKey in pendingChanges) {
                            var pendingChange = pendingChanges[elKey];
                            elements.push(
                                React.createElement("div", {key: elKey, className: "pending-change"}, 
                                    pendingChange
                                )
                            );
                        } else if(editorState.row == i && editorState.column == col && editorState.element == d) {
                            if(editorState.editorValue == null) {
                                var element = cell[d];
                                elements.push(
                                    React.createElement("div", {key: elKey, className: "table-focus"}, 
                                        element
                                    )
                                );
                            } else {
                                elements.push(
                                    React.createElement("input", {key: elKey, value: editorState.editorValue, onChange: this.textEditorChanged, onClick: this.stopPropagation})
                                );
                            }
                        } else {
                                var element = cell[d];
                            elements.push(
                                React.createElement("div", {key: elKey, onClick: this.setElementFocus(i, col, d)}, 
                                    element
                                )
                            );
                        }
                    }

                    tableCells.push(
                        React.createElement("td", {key: cellKey, onClick: this.setElementFocus(i, col, cell.length)}, 
                            elements
                        )
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
                React.createElement("table", {className: "table table-bordered"}, 
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
            React.createElement(Table, {columns: this.state.columns, rows: this.state.rows, editorState: this.state.editorState, controller: this.props.controller, pendingChanges: this.state.pendingChanges})
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
    var columns = [ {name: "col1"}, {name: "col2"}, {name: "col3"} ] ; // need column definition which will control how the elements in row will be rendered
    // initially add support for formatting strings and numbers
    // column name, format, prop id.
    // row needs id
    var data = [
        [ ["a"], [], ["c"] ],
        [ ["a2"], ["a2", "b2"], ["a2"] ],
        [ ["a3"], ["a3"], ["a3"] ]
    ];

    var editorState = {
        row: 1,
        column: 2,
        element: 0,
        editorValue: "x"
    }

    var state = {
        columns: columns,
        rows: [{id: "x"}, {id: "y"}, {id: "z"}],
        data: data,
        editorState: editorState,
        pendingChanges: {},
        instanceToRow:{x: 0, y: 1, z: 2},
        propertyToRow:{col1: 0, col2: 1, col3: 2}
        };

    var editor = null;


    var controller = {

        setElementFocus: function(row, column, element) {
            var oldEditorState = state.editorState;
            if(oldEditorState != null) {
                // update the data matrix with the value from the editor
                state = applyChange(state, oldEditorState.row, oldEditorState.column, oldEditorState.element, oldEditorState.editorValue);
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
        textEditorChanged: function(value) {
            state = React.addons.update(state, {editorState: {editorValue: {$set: value}}})
            editor.setState(state);
        }
    };

    editor = React.render(
        React.createElement(TableCtl, {initialState: state, controller: controller}),
        document.getElementById(tableDivId));
}

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

            for(var i=0;i<rows.length;i++) {

                var tableCells = [];
                var row = data[i];

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
                                <div key={elKey} className="pending-change">
                                    {pendingChange}
                                </div>
                            );
                        } else if(editorState.row == i && editorState.column == col && editorState.element == d) {
                            if(editorState.editorValue == null) {
                                var element = cell[d];
                                elements.push(
                                    <div key={elKey} className="table-focus">
                                        {element}
                                    </div>
                                );
                            } else {
                                elements.push(
                                    <div key={elKey} className="pending-change" contentEditable="true">
                                        {pendingChange}
                                    </div>
                                );
                                //                                     <input key={elKey} value={editorState.editorValue} onChange={this.textEditorChanged} onClick={this.stopPropagation}/>

                            }
                        } else {
                                var element = cell[d];
                            elements.push(
                                <div key={elKey} onClick={this.setElementFocus(i, col, d)}>
                                    {element}
                                </div>
                            );
                        }
                    }

                    tableCells.push(
                        <td key={cellKey} onClick={this.setElementFocus(i, col, cell.length)}>
                            {elements}
                        </td>
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
            <Table columns={this.state.columns} data={this.state.data} rows={this.state.rows} editorState={this.state.editorState} controller={this.props.controller} pendingChanges={this.state.pendingChanges} />
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

    var applyChange = function(state, row, column, element, newValue) {
        if(newValue == "") {
            // if empty, delete the element
            var update1 = {$splice: [[element, 1]]};
            var update2 = {};
            update2[column] = update1;
            var update3 = {};
            update3[row] = {data: update2};
            var fullUpdate = {rows: update3};
        } else {
            // otherwise, set the value
            var update0 = {$set: newValue};
            var update1 = {};
            update1[element] = update0;
            var update2 = {};
            update2[column] = update1;
            var update3 = {};
            update3[row] = {data: update2};
            var fullUpdate = {rows: update3};
        }

        return React.addons.update(state, fullUpdate);
    };

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
        <TableCtl initialState={state} controller={controller}/>,
        document.getElementById(tableDivId));

    setInterval(function() {
        console.log("exec apply")
        var elements = state.data[2][0];
        var i = 0;
        if(elements.length > 0) {
            state = applyUpdate(state, {op: "DV", instance: "c", property:"x", value:elements[0]} )
            i = parseInt(elements[0]);
        }
        state = applyUpdate(state, {op: "AV", instance: "c", property:"x", value:""+(i+1)} )
        editor.setState(state)
    }, 3000);
}
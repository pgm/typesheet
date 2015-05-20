var ElementEditor = React.createClass({
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
            <div className="pending-change" contentEditable="true" onBlur={this.onBlur}>
                {this.props.value}

            </div>
            );
    }
});

var ElementEditorSelection = React.createClass({
    mkSelectOption: function(newValue) {
        var onChange = this.props.onChange;
        return function() {
            onChange(newValue);
        }
    },
    render: function() {
        var optionsNodes = [];
        var options = this.props.options;
        console.log("options", options);
        for(var i=0;i<options.length;i++) {
            var option = options[i];
            optionsNodes.push(
                <li onClick={this.mkSelectOption(option.value)}>{option.text}</li>
            );
        }

        return (
            <div>
                <input type="text" value={this.props.value}/>
                <ul className="tt-autocomplete">
                    {optionsNodes}
                </ul>
            </div>
            );
    }
});


var TableCell = React.createClass({
    render: function() {
        var controller = this.props.controller;
        var row = this.props.row;
        var col = this.props.col;
        var column = this.props.column;
        var cell = this.props.cell;
        var editorState = this.props.editorState;
        var uncommitted = this.props.uncommitted;
        var committed = this.props.committed;
        var cache = this.props.cache;

        var cellKey="c"+row+"."+col;

        var elements = getCellElements(row, col, uncommitted, committed, cell, editorState);
        if(row == 0 && col == 0) {
            console.log("getCellElements state: ", this.props);
            console.log("getCellElements elements: ", elements);
        }
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

        var applyValue = function(value) {
            controller.updateEditorValue(value);
            controller.acceptEditorValue();
            console.log("after apply value", controller.state);
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
                    if(editorState.options) {
                        console.log("adding option editor")
                        results.push(
                            <ElementEditorSelection key="editor" value={editorState.value} options={editorState.options} onChange={applyValue} />
                        );
                    } else {
                        results.push(
                            <ElementEditor key="editor" value={editorState.value} onChange={applyValue}/>
                        );
                    }
                } else {
                    var lastElement = (i == (elements.length-1));
                    var className = "";
                    if(e.type == "uncommitted") {
                        className = "uncommitted";
                    } else if(e.type == "committed") {
                        className = "committed";
                    }

                    var value = formatValueForDisplay(column, cache, e.value);

                    if(lastElement) {
//                            <div key={elKey} onClick={mkSetEditorToEdit(i)}>
                        results.push(
                            <div key={elKey} className={className}>
                                {value}
                                <button className="add-button" onClick={setEditorToAdd}>+</button>
                            </div>
                        );
                    } else {
                        results.push(
                            <div key={elKey} onClick={mkSetEditorToEdit(i)} className={className}>
                                {value}
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
                    console.log("match", r.instance, instance, r.property, property);
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
            var colTags = [];
            var columns = this.props.columns;
            for(var i=0;i<columns.length;i++) {
                var key="h"+i;
                var colKey="c"+i;
                headerCells.push(
                    <th key={key} className="table-town">{columns[i].name}</th>
                );
                colTags.push(
                    <col key={colKey} />
                );
            }

            var rows = this.props.rows;
            var data = this.props.data;
            var committed = this.props.committed;
            var uncommitted = this.props.uncommitted;
            var cache = this.props.cache;

            for(var i=0;i<rows.length;i++) {
                var tableCells = [];
                var row = data[i];
                var instance = rows[i].id;

                for(var col=0;col<row.length;col++) {
                    var property = columns[col].id;
                    var cell = row[col];
                    var cellKey = "c"+i+"."+col;

                    // only consider those records for this cell
                    cellUncommitted = this.filterUpdates(instance, property, uncommitted);
                    cellCommitted = this.filterUpdates(instance, property, committed);

                    tableCells.push(
                        <TableCell key={cellKey} cache={cache} column={columns[col]} row={i} col={col} cell={cell} uncommitted={cellUncommitted} committed={cellCommitted} editorState={editorState} controller={this.props.controller}/>
                    );
                }

                var rowKey = "r"+i;
                tableRows.push(
                    <tr key={rowKey}>
                        {tableCells}
                    </tr>
                )
            }

            // add one extra line which is used for entering new records
            var tableCells = [];
            for(var col=0;col<columns.length;col++) {
                var property = columns[col].id;
                var cellKey = "ce"+col;

                tableCells.push(
                    <TableCell key={cellKey} cache={cache} column={columns[col]} row={rows.length} col={col} cell={[]} uncommitted={[]} committed={[]} editorState={editorState} controller={this.props.controller}/>
                );
            }
            var rowKey = "re";
            tableRows.push(
                <tr key={rowKey}>
                    {tableCells}
                </tr>
            )

            return (
                <table className="table-town">
                    <colgroup>
                        {colTags}
                    </colgroup>
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
/*
var PropertySelector = React.createClass({
    render: function() {
        this.prop.cache;

        var typesDivs = [];
        for(var i=0;i<;i++) {

        }
    }
})
*/

var TableCtl = React.createClass({
    getInitialState: function() {
        return emptyModel();
    },
    render: function() {
        console.log("TableCtl.render", this.state);
//                <PropertySelector controller={this.props.controller} cache={this.state.cache} />

        return (
            <div>
                <Table cache={this.state.cache} columns={this.state.columns} data={this.state.data} rows={this.state.rows} editorState={this.state.editorState} controller={this.props.controller} committed={this.state.pending} uncommitted={this.state.uncommitted} />
            </div>
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
//    var s = ;
//    s = applyAddProperty(s, "x")
//    s = applyAddProperty(s, "y")
//    s = applyAddProperty(s, "z")
//    s = applyUpdate(s, {op: "AI", instance: "a"} )
//    s = applyUpdate(s, {op: "AI", instance: "b"} )
//    s = applyUpdate(s, {op: "AI", instance: "c"} )
//    s = applyUpdate(s, {op: "AV", instance: "a", property:"x", value:"00"} )
    //s = applyUpdate(s, {op: "AV", instance: "c", property:"x", value:"20"} )

//    var state = s;
    var editor = null;

    // Mock db
    var db = {
        txnId: 1,
        transactions: [],
        queryType: function(typeId) {
            var thingTypeDef = {
                id: "Core/Thing",
                name: "Thing",
                description: "Thing Description",
                includedTypeIds: [],
                propertyIds: ["Core/Thing/Name"],
                nameIsUnique: true
                };

            var extraTypeDef = {
                id: typeId,
                name: "name",
                description: "description",
                includedTypeIds: ["Core/Thing"],
                propertyIds: ["word"],
                nameIsUnique: true
                };

            var namePropDef = {
                id: "Core/Thing/Name",
                name: "Name",
                description: "Description",
                expectedTypeId: "Core/String",
                reversePropertyId: null,
                isUnique: false
            };

            var wordPropDef = {
                id: "word",
                name: "Word",
                description: "Description",
                expectedTypeId: "Core/String",
                reversePropertyId: null,
                isUnique: false
            };

            var response = {
                types: [thingTypeDef, extraTypeDef],
                properties: [namePropDef, wordPropDef],
                txn: 1,
                rowIds: ["a", "b"],
                rows: [
                    [["name1"], ["blue","brown"]],
                    [["name2"], ["green"]]
                ]
            };

            var promise = new Promise(function(resolve, reject){
                // after 1 second return response
                setTimeout(function(){
                    resolve(response);
                }, 1000);
            });

            return promise;
        },
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
                console.log(" queryUpdates(",afterTxn," update", updates);
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

    var controller = new TableController(emptyModel(), db);

    editor = React.render(
        <TableCtl controller={controller}/>,
        document.getElementById(tableDivId));

    controller.addListener(function(state) {
        console.log("updating editor with state", state);
        editor.setState(state)
        } );

    db.queryType("extraType").then(function(response){
        controller.loadFromQueryTypeResponse(response);
        var es = {
            row: 0,
            column: 0,
            element: 0,
            editorValue: "x",
            options:[ {text: "Abc", value: "abc"}, {text: "baaaah", value: "2"} ]
        }

        controller.setState(React.addons.update(controller.state, {editorState: {$set: es}}));
    });

    setInterval(function() {
        db.queryUpdates(controller.state.version).then(function(response) {
            controller.applySync(response.txn, response.ops);
        });
   }, 1000);

}
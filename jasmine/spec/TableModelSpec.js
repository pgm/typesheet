//describe("TableTypes", function () {
//    var c;
//
//    beforeEach(function () {
//        var s = emptyModel();
//        var mockDb = {update: function () {
//            return new Promise(function (s, f) {
//            });
//        } };
//
//        c = new TableController(s, mockDb);
//    });
//
//    it("looks up element names for custom types", function() {
//       var namePropDef = {
//                id: "prop",
//                name: "Prop",
//                description: "PropDescription",
//                expectedTypeId: "custom",
//                reversePropertyId: null,
//                isUnique: false
//            };
//        c.setState(addToTypeCache(c.state, [], [namePropDef]));
//        c.setState(applyAddProperty(c.state, "prop"));
//        c.setState(applyUpdate(c.state, {op: "AI", instance: "a"}));
//        c.setState(applyUpdate(c.state, {op: "AV", instance: "a", property: "prop", value: "B"}));
//        c.setState(updateInstancesForType(c.state, "custom", [{id: "A", name: "NameA"}, {id: "B", name: "NameB"}]))
//
//        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
//        expect(els).toEqual([{type: "data", value: "NameB"}]);
//    });
//});

describe("LoadSheet", function () {
    var c;

    beforeEach(function () {
        var s = emptyModel();

        var mockDb = {loadSheet: mockLoadSheet};
        c = new TableController(s, mockDb);
    });

    it("can load a sheet where columns reference a 2nd sheet", function (done) {
        c.loadSheet("sheet1").then(function () {
            console.log("postLoad", c.state);
            expect(formatValueForDisplay("colorProp", c.state.cache, "red")).toEqual("Red");
            expect(makeValueSuggestions("colorType", c.state)).toEqual([{value: "red", text: "Red"}])
        }).then(done)
            .catch(function (error) {
                console.error(error);
                expect(error).toBeUndefined();
                done();
            });
    });
});

describe("TableController", function () {
    var c;

    beforeEach(function () {
        var s = emptyModel();
        s = applyAddProperty(s, "x")
        s = applyAddProperty(s, "y")
        s = applyUpdate(s, {op: "AI", instance: "a"})
        s = applyUpdate(s, {op: "AI", instance: "b"})

        var mockDb = {update: function () {
            return new Promise(function (s, f) {
            });
        } };

        c = new TableController(s, mockDb);
    });

    it("updates an earlier value shows the right number of elements", function () {
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "0"})
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "1"})

        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"},
            {type: "data", value: "1"}
        ]);

        // edit first element
        c.setElementFocus(0, 0, 0);
        c.updateEditorValue("2");
        c.acceptEditorValue();
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "1"},
            {type: "uncommitted", value: "2"}
        ]);

        c.applyCommitted(1, c.state.uncommitted);
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "1"},
            {type: "committed", value: "2"}
        ]);

        c.applySync(1, c.state.pending);
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "1"},
            {type: "data", value: "2"}
        ]);
    })
});


describe("TableController2", function () {
    var c;

    beforeEach(function () {
        var s = emptyModel();
        s = applyAddProperty(s, "x")
        s = applyAddProperty(s, "y")
        s = applyUpdate(s, {op: "AI", instance: "a"})
        s = applyUpdate(s, {op: "AI", instance: "b"})

        var mockDb = {update: function () {
            return new Promise(function (s, f) {
            });
        } };

        c = new TableController(s, mockDb);
    });

    it("clicking on an empty row results in creating a new instance", function () {
        c.setElementFocus(2, 0, 0);

        var elements = getCellElements(2, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(elements).toEqual([
            {type: "editor", value: ""}
        ])

        c.updateEditorValue("value");
        c.acceptEditorValue();
        expect(c.state).toBeConsistent();
        expect(c.state.rows.length).toBe(3);

        var newInstance = c.state.rows[2];

        expect(c.state.uncommitted).toEqual([
            {op: "AV", instance: newInstance, property: "x", value: "value"}
        ]);

        var elements = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(elements).toEqual([
            {type: "uncommitted", value: "value"}
        ])
    });

    it("clicking on empty cell results in adding element", function () {
        console.log("state", c.state);
        c.setElementFocus(0, 0, 0);

        var elements = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(elements).toEqual([
            {type: "editor", value: ""}
        ])

        c.updateEditorValue("value");
        c.acceptEditorValue();

        expect(c.state.uncommitted).toEqual([
            {op: "AV", instance: "a", property: "x", value: "value"}
        ]);

        var elements = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(elements).toEqual([
            {type: "uncommitted", value: "value"}
        ])
    });

    it("clicking on existing cell results in remove and add", function () {
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "0"})

        c.setElementFocus(0, 0, 0);

        var elements = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(elements).toEqual([
            {type: "editor", value: "0"}
        ])

        c.updateEditorValue("1");
        c.acceptEditorValue();
        expect(c.state.uncommitted).toEqual([
            {op: "DV", instance: "a", property: "x", value: "0"},
            {op: "AV", instance: "a", property: "x", value: "1"}
        ])

        var elements = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(elements).toEqual([
            {type: "uncommitted", value: "1"}
        ])
    });

    it("clicking on plus on a cell with a value results in add", function () {
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "0"})

        c.setElementFocus(0, 0, 1);

        var elements = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(elements).toEqual([
            {type: "data", value: "0"},
            {type: "editor", value: ""}
        ])

        c.updateEditorValue("1");
        c.acceptEditorValue();
        expect(c.state.uncommitted).toEqual([
            {op: "AV", instance: "a", property: "x", value: "1"}
        ])

        var elements = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(elements).toEqual([
            {type: "data", value: "0"},
            {type: "uncommitted", value: "1"}
        ])
    });

    it("setting a value to an empty string results in deleting value", function () {
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "0"})

        c.setElementFocus(0, 0, 0);
        c.updateEditorValue("");
        c.acceptEditorValue();
        expect(c.state.uncommitted).toEqual([
            {op: "DV", instance: "a", property: "x", value: "0"}
        ])
    });

    it("setting a value to the same value is a no-op", function () {
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "0"})

        c.setElementFocus(0, 0, 0);
        c.updateEditorValue("0");
        c.acceptEditorValue();
        expect(c.state.uncommitted).toEqual([
        ])
    });

    it("can abort an edit", function () {
        c.setElementFocus(0, 0, 0);
        c.updateEditorValue("1");
        c.abortEdit();
        expect(c.state.editorState).toBeNull();
        expect(c.state.uncommitted).toEqual([]);
    });

    it("setting a value to the same value is a no-op", function () {
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "0"})

        c.setElementFocus(0, 0, 0);
        c.updateEditorValue("0");
        c.acceptEditorValue();
        expect(c.state.uncommitted).toEqual([
        ])
    });

    it("updates an earlier value shows the right number of elements", function () {
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "0"})
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "1"})

        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"},
            {type: "data", value: "1"}
        ]);

        // edit first element
        c.setElementFocus(0, 0, 0);
        c.updateEditorValue("2");
        c.acceptEditorValue();
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "1"},
            {type: "uncommitted", value: "2"}
        ]);

        c.applyCommitted(1, c.state.uncommitted);
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "1"},
            {type: "committed", value: "2"}
        ]);

        c.applySync(1, c.state.pending);
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "1"},
            {type: "data", value: "2"}
        ]);
    })

    it("can import from 'type' query", function () {
        var thingTypeDef = {
            id: "Core/Thing",
            name: "Thing",
            description: "Thing Description",
            includedTypeIds: [],
            propertyIds: ["Core/Thing/Name"],
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

        var response = {
            types: [thingTypeDef],
            properties: [namePropDef],
            txnId: 10,
            rowIds: ["a", "b"],
            rows: [
                [
                    ["name1"]
                ],
                [
                    ["name2"]
                ]
            ]
        };

        c.setState(emptyModel());
        c.loadFromQueryTypeResponse(response);
        var s = c.state;
        expect(s.version).toBe(10);
        expect(s.data).toEqual([
            [
                ["name1"]
            ],
            [
                ["name2"]
            ]
        ]);
        expect(s).toBeConsistent();
    });

    it("shows the right number of elements", function () {
        c.state = applyUpdate(c.state, {op: "AV", instance: "a", property: "x", value: "0"})

        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"}
        ]);

        // add an element
        c.setElementFocus(0, 0, 1);

        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"},
            {type: "editor", value: ""}
        ]);

        c.updateEditorValue("1");
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"},
            {type: "editor", value: "1"}
        ]);

        c.acceptEditorValue();
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"},
            {type: "uncommitted", value: "1"}
        ]);

        c.applyCommitted(1, c.state.uncommitted);
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"},
            {type: "committed", value: "1"}
        ]);

        c.applySync(1, c.state.pending);
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"},
            {type: "data", value: "1"}
        ]);

        // add a 3rd element
        c.setElementFocus(0, 0, 2);
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"},
            {type: "data", value: "1"},
            {type: "editor", value: ""}
        ]);

        c.updateEditorValue("2");
        c.acceptEditorValue();
        var els = getCellElements(0, 0, c.state.uncommitted, c.state.pending, c.state.data[0][0], c.state.editorState);
        expect(els).toEqual([
            {type: "data", value: "0"},
            {type: "data", value: "1"},
            {type: "uncommitted", value: "2"}
        ]);
    });

});

describe("TableModel", function () {
    var s;

    beforeEach(function () {
        s = emptyModel();
    });

    it("has add/remove operations which use \"set\" semantics", function () {
        s = applyAddProperty(s, "x")
        s = applyUpdate(s, {op: "AI", instance: "a"})

        s = applyUpdate(s, {op: "AV", instance: "a", property: "x", value: "0"})
        expect(s.data[0][0]).toEqual(["0"])

        // adding same value should have no change
        s = applyUpdate(s, {op: "AV", instance: "a", property: "x", value: "0"})
        expect(s.data[0][0]).toEqual(["0"])

        // adding different value should work
        s = applyUpdate(s, {op: "AV", instance: "a", property: "x", value: "1"})
        expect(s.data[0][0]).toEqual(["0", "1"])

        s = applyUpdate(s, {op: "DV", instance: "a", property: "x", value: "0"})
        expect(s.data[0][0]).toEqual(["1"])
    })

    it("stays consistent over operations", function () {
        expect(s).toBeConsistent();

        // a, b, c used for instance ids, x,y,z for properties

        s = applyAddProperty(s, "x")
        expect(s.columns.length).toBe(1)
        expect(s).toBeConsistent()

        s = applyAddProperty(s, "y")
        expect(s).toBeConsistent()
        expect(s.columns.length).toBe(2)

        s = applyUpdate(s, {op: "AI", instance: "a"})
        expect(s).toBeConsistent()
        expect(s.rows.length).toBe(1)

        s = applyUpdate(s, {op: "AI", instance: "b"})
        expect(s).toBeConsistent()
        expect(s.rows.length).toBe(2)

        // at this point we have a 2x2 grid
        s = applyUpdate(s, {op: "AV", instance: "a", property: "x", value: "00"})
        expect(s).toBeConsistent()
        expect(s.data[0][0]).toEqual(["00"])

        s = applyUpdate(s, {op: "AV", instance: "a", property: "x", value: "001"})
        expect(s).toBeConsistent()
        expect(s.data[0][0]).toEqual(["00", "001"])

        // put values on bottom left
        s = applyUpdate(s, {op: "AV", instance: "b", property: "x", value: "10"})
        expect(s).toBeConsistent()
        expect(s.data[1][0]).toEqual(["10"])

        // bottom right
        s = applyUpdate(s, {op: "AV", instance: "b", property: "y", value: "11"})
        expect(s).toBeConsistent()
        expect(s.data[1][1]).toEqual(["11"])

        // remove row
        s = applyUpdate(s, {op: "DI", instance: "a"})
        expect(s).toBeConsistent()
        expect(s.data[0][0]).toEqual(["10"])
        expect(s.rows.length).toBe(1)

        // remove column
        s = applyDelProperty(s, "x")
        expect(s).toBeConsistent()
        expect(s.data[0][0]).toEqual(["11"])
        expect(s.columns.length).toBe(1)
    });
});



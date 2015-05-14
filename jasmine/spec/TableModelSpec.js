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

    it("can abort an edit", function () {
        c.setElementFocus(0, 0, 0);
        c.updateEditorValue("1");
        c.abortEdit();
        expect(c.state.editorState).toBeNull();
        expect(c.state.uncommitted).toEqual([]);
    });

//    test
//    add / del
//    with value in pending
//        }
//    )
//    ;

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



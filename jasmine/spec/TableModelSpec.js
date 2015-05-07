describe("TableModel", function() {
  var s;
    
  beforeEach(function() {
    s = emptyModel();
  });

  it("stays consistent over operations", function() {
    expect(s).toBeConsistent();

    // a, b, c used for instance ids, x,y,z for properties

    s = applyAddProperty(s, "x")
    expect(s.columns.length).toBe(1)
    expect(s).toBeConsistent()

    s = applyAddProperty(s, "y")
    expect(s).toBeConsistent()
    expect(s.columns.length).toBe(2)

    s = applyUpdate(s, {op: "AI", instance: "a"} )
    expect(s).toBeConsistent()
    expect(s.rows.length).toBe(1)

    s = applyUpdate(s, {op: "AI", instance: "b"} )
    expect(s).toBeConsistent()
    expect(s.rows.length).toBe(2)

    // at this point we have a 2x2 grid
    s = applyUpdate(s, {op: "AV", instance: "a", property:"x", value:"00"} )
    expect(s).toBeConsistent()
    expect(s.data[0][0]).toEqual(["00"])

    s = applyUpdate(s, {op: "AV", instance: "a", property:"x", value:"001"} )
    expect(s).toBeConsistent()
    expect(s.data[0][0]).toEqual(["00", "001"])

    // put values on bottom left
    s = applyUpdate(s, {op: "AV", instance: "b", property:"x", value:"10"} )
    expect(s).toBeConsistent()
    expect(s.data[1][0]).toEqual(["10"])

    // bottom right
    s = applyUpdate(s, {op: "AV", instance: "b", property:"y", value:"11"} )
    expect(s).toBeConsistent()
    expect(s.data[1][1]).toEqual(["11"])

    // remove row
    s = applyUpdate(s, {op: "DI", instance: "a"} )
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




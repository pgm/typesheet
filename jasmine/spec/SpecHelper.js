var findInconsistency = function(s) {
    console.log("isStateConsistent", s);

    if(s.rows.length != s.data.length)
        return "# of rows and data rows mismatch";

    for(var i=0;i<s.rows.length;i++) {
        if(s.columns.length != s.data[i].length)
            return "# of columns and data columns mismatch";
    }

    for(var k in s.instanceToRow) {
        if(k != s.rows[ s.instanceToRow[k] ].id )
            return "row -> instanceToRow -> row mismatch";
    }

    for(var k in s.propertyToColumn) {
        if(k != s.columns[ s.propertyToColumn[k] ].id )
            return "column -> instanceToColumn -> column mismatch";
    }

    for(var i=0;i<s.columns.length;i++) {
        if(i != s.propertyToColumn[ s.columns[i].id ])
            return "propertyToColumn -> column -> propertyToColumn mismatch";
    }

    for(var i=0;i<s.rows.length;i++) {
        if(i != s.instanceToRow[ s.rows[i].id ])
            return "instanceToRow -> row -> instanceToRow";
    }

    return null;
}


beforeEach(function () {
  jasmine.addMatchers({
    toBeConsistent: function () {
      return {
        compare: function (actual) {
          var message = findInconsistency(actual);
          return {
            pass: message == null,
            message: message
          };
        }
      };
    }
  });
});

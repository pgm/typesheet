var TypeSelector = React.createClass({
    render: function() {
        return (
            <select>
                <option value="Core/Text">Text</option>
                <option value="Core/Number">Number</option>
            </select>
            );
    }
});

var PropertyEditor = React.createClass({
    render: function() {
        return (
            <div>
                <label>Name</label> <input type="text" />
                <label>Description</label> <input type="text" />
                <label>Expected type</label> <TypeSelector />
                <label>Reverse property</label> <input type="text"/>
                <label>Is unique</label> <input type="checkbox"/>
            </div>
            );
    }
});

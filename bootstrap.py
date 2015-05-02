__author__ = 'pgm'

from model import Type, Property
import constants as c

core_types = [
    Type("core/Thing", "Thing", "Shared type for all instances", [], ["core/Thing/ID", "core/Thing/Label", "core/Thing/Description", "core/Thing/instanceOf"]),
    Type("core/Type", "Type", "Type definition", ["core/Thing"], ["core/Type/IncludedType", "core/Type/Property"]),
    Type("core/Property", "Property", "Property definition", ["core/Thing"], ["core/Property/ExpectedType", "core/Property/ReverseProperty", "IsUnique"])
    ]

core_properties = [
    Property(c.ID, "ID", "ID", "string", None, False),
    Property(c.NAME, "Label", "Label", "string", None, False),
    Property(c.DESCRIPTION, "Description", "Description", None, False),
    Property(c.INSTANCE_OF, "Instance of", "Instance of", "core/Type", False)
    #"core/Type/IncludedType", "core/Type/Property"
    #"core/Property/ExpectedType", "core/Property/ReverseProperty", "IsUnique"
]

def bootstrap(storage):
    for t in core_types:
        props = convert_type_to_props(t)
        storage.insert(t.id, props, None)

    for p in core_properties:
        props = convert_property_to_props(p)
        storage.insert(p.id, props, None)

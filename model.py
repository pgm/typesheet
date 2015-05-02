__author__ = 'pgm'

import sql_storage
import constants as c
import collections

class Type(object):
    def __init__(self, id, name, description="", included_type_ids=[], property_ids=[], name_is_unique=False):
        self.id = id
        self.name = name
        self.description = description
        self.included_type_ids = included_type_ids
        self.property_ids = property_ids
        self.name_is_unique = name_is_unique

class Property(object):
    def __init__(self, id, name, expected_type_id, description="", reverse_property_id=None, is_unique=False):
        # skipped for now: units, cardinality
        self.id = id
        self.name = name
        self.description = description
        self.expected_type_id = expected_type_id
        self.reverse_property_id = reverse_property_id
        self.is_unique = is_unique

def extract_id_from_refs(refs):
    return [ref.id for ref in refs]

CORE_TYPES = {
    c.THING: Type(id=c.THING,
         name="Thing",
         description="Thing",
         included_type_ids=[],
         property_ids=[c.NAME, c.DESCRIPTION, c.INSTANCE_OF]
         ),
    c.TYPE: Type(id=c.THING,
         name="Thing",
         description="Thing",
         included_type_ids=[],
         property_ids=[c.INCLUDED_TYPE, c.PROPERTY]
         ),
    c.PROPERTY_TYPE: Type(c.PROPERTY_TYPE,
         name="Property",
         description="Property",
         property_ids=[c.EXPECTED_TYPE, c.IS_UNIQUE, c.REVERSE_PROPERTY])
}

CORE_PROPS = {
    c.NAME : Property(id=c.NAME,
        name="Name",
        description="Name",
        expected_type_id=c.STRING),
    c.DESCRIPTION: Property(id=c.DESCRIPTION,
        name="Description",
        description="Description",
        expected_type_id=c.STRING),
    c.INSTANCE_OF: Property(id=c.INSTANCE_OF,
        name="Instance of",
        description="is an instance of the given type",
        expected_type_id=c.TYPE),
    c.INCLUDED_TYPE: Property(id=c.INCLUDED_TYPE,
        name="INCLUDED_TYPE",
        expected_type_id=c.TYPE),
    c.PROPERTY: Property(id=c.PROPERTY,
        name="PROPERTY",
        expected_type_id=c.PROPERTY_TYPE),
    c.EXPECTED_TYPE: Property(id=c.EXPECTED_TYPE,
        name="EXPECTED_TYPE",
        expected_type_id=c.TYPE),
    c.IS_UNIQUE: Property(id=c.IS_UNIQUE,
        name="IS_UNIQUE",
        expected_type_id=c.BOOLEAN),
    c.REVERSE_PROPERTY: Property(id=c.REVERSE_PROPERTY,
        name="REVERSE_PROPERTY",
        expected_type_id=c.PROPERTY_TYPE)
}

class Dictionary(object):
    # TODO: add support to clear cache on changes to types
    def __init__(self, storage):
        self.storage = storage
        self.type_cache = {}
        self.property_cache = {}

    def get_type(self, id):
        if id in self.type_cache:
            return self.type_cache[id]

        if id in CORE_TYPES:
            type_instance = CORE_TYPES[id]
        else:
            row = self.storage.get_by_id(id)
            type_instance = Type(id=row.get(c.ID),
                                 name=row.get(c.NAME),
                                 description=row.get(c.DESCRIPTION),
                                 included_type_ids=extract_id_from_refs(row.get_list(c.INCLUDED_TYPE)),
                                 property_ids=extract_id_from_refs(row.get_list(c.PROPERTY))
                                 )
        self.type_cache[id] = type_instance
        return type_instance

    def get_property(self, id):
        if id in self.property_cache:
            return self.property_cache[id]

        if id in CORE_PROPS:
            property_instance = CORE_PROPS[id]
        else:
            row = self.storage.get_by_id(id)
            property_instance = Property(id=id,
                                 name=row.get(c.NAME),
                                 description=row.get(c.DESCRIPTION),
                                 expected_type_id=row.get(c.EXPECTED_TYPE, type="ref_id"),
                                 reverse_property_id=row.get(c.REVERSE_PROPERTY, type="ref_id"),
                                 is_unique=row.get(c.IS_UNIQUE, type=bool))
        self.property_cache[id] = property_instance
        return property_instance

class InstanceRef(object):
    def __init__(self, id):
        self.id = id
    def __repr__(self):
        return "<InstanceRef %r>" % (self.id, )

class Binding(object):
    def __init__(self, property_id, values):
        "values - list of either float, str or InstanceRef"
        self.property_id = property_id
        self.values = values

def validate_values(prop_id, expected_type, values):
    failures = []
    for value in values:
        if not isinstance(value, expected_type):
            failures.append("%s expected %s but was %s (%r)" % (prop_id, expected_type, type(value), value))
    return failures

def validate_instance_ref_values(prop_id, expected_type, values, instance_types):
    failures = validate_values(prop_id, InstanceRef, values)
    if len(failures) == 0:
        for value in values:
            types = instance_types[value.id]
            if not (expected_type in types):
                failures.append("%s expected ref %s but was %r (%r)" % (prop_id, expected_type, types, value.id))
    return failures

def validate(type_props, bindings, instance_types):
    failures = []

    bindings_dict = collections.defaultdict(lambda: [])
    for b in bindings:
        bindings_dict[b.property_id] = b.values

    for prop_id in type_props.keys():
        prop_def = type_props[prop_id]
        if prop_def.expected_type_id == c.STRING:
            failures.extend(validate_values(prop_id, str, bindings_dict[prop_id]))
        elif prop_def.expected_type_id == c.INTEGER:
            failures.extend(validate_values(prop_id, int, bindings_dict[prop_id]))
        elif prop_def.expected_type_id == c.REAL:
            failures.extend(validate_values(prop_id, float, bindings_dict[prop_id]))
        else:
            failures.extend(validate_instance_ref_values(prop_id, prop_def.expected_type_id, bindings_dict[prop_id], instance_types))

    return failures

class Storage(object):
    def __init__(self, db):
        self.db = db
        self.dictionary = Dictionary(self)

    def insert_property(self, prop_def):
        bindings = [
            Binding(c.NAME, [prop_def.name]),
            Binding(c.DESCRIPTION, [prop_def.description]),
            Binding(c.EXPECTED_TYPE, [InstanceRef(prop_def.expected_type_id)]),
            Binding(c.REVERSE_PROPERTY, [InstanceRef(prop_def.reverse_property_id)]),
            Binding(c.IS_UNIQUE, [str(prop_def.is_unique)]),
            Binding(c.INSTANCE_OF, [InstanceRef(c.PROPERTY_TYPE)])
        ]
        self._insert( prop_def.id, bindings, None)

    def insert_type(self, type_def):
        bindings = [
            Binding(c.NAME, [type_def.name]),
            Binding(c.DESCRIPTION, [type_def.description]),
            Binding(c.INCLUDED_TYPE, [InstanceRef(property_id) for property_id in type_def.included_type_ids]),
            Binding(c.PROPERTY, [InstanceRef(property_id) for property_id in type_def.property_ids] ),
            Binding(c.INSTANCE_OF, [InstanceRef(c.TYPE)])
        ]
        self._insert( type_def.id, bindings, None)

    def _insert(self, id, bindings, uk_properties):
        self.db.insert(id, bindings, uk_properties)

    def _find_referenced_instance_types(self, bindings):
        instance_types = {}
        for binding in bindings:
            for value in binding.values:
                if isinstance(value, InstanceRef):
                    row = self.get_by_id(value.id, [c.INSTANCE_OF])
                    instance_types[value.id] = row.get_list(c.INSTANCE_OF)
        return instance_types

    def insert(self, id, bindings):
        # find types
        failures = []

        type_ids = set([c.THING])

        for binding in bindings:
            if binding.property_id == c.INSTANCE_OF:
                type_ids.update([v.id for v in binding.values])

        if len(type_ids) == 0:
            failures.append("Missing type")

        print "type_ids", type_ids

        instance_types = self._find_referenced_instance_types(bindings)
        type_props = {}
        for type_id in type_ids:
            assert type(type_id) == str or type(type_id) == unicode
            type_def = self.dictionary.get_type(type_id)
            type_props.update([(type_prop_id, self.dictionary.get_property(type_prop_id)) for type_prop_id in type_def.property_ids])

        failures.extend(validate(type_props, bindings, instance_types))

        # make sure we don't have any extra bindings
        for binding in bindings:
            if not (binding.property_id in type_props):
                failures.append("Property %s not in any of %r" % (binding.property_id, type_ids))

        print "failures", failures
        if len(failures) == 0:
            self._insert(id, bindings, None)

        return failures

    def delete(self, id):
        # validate fks?
        self.db.delete(id)

    def query(self, properties, instance_predicate):
        "if properties is None, then all properties are fetched"
        return self.db.query(properties, instance_predicate)

    def get_by_id(self, id, properties=None):
        rows = self.query(properties, sql_storage.WithId(id))
        assert len(rows) == 1, ("Expected one entry with id %r, found %d" % (id, len(rows)))
        return rows[0]

__author__ = 'pgm'

import sql_storage
from model import InstanceRef
import model
import constants as c

def create_storage():
    db = sql_storage.create_in_memory_database()
    s = model.Storage(sql_storage.Storage(db))
    return s

def test_define_class_and_insert_instance():
    s = create_storage()

    s.insert_property(model.Property("PropA", "Prop A", c.STRING))
    s.insert_type(model.Type("ClassA", "Class A", property_ids=["PropA"]))

    with s.db.engine.begin() as db:
        print ">>>>>>>>>>>>>"
        rows = db.execute(sql_storage.select([sql_storage.instances])).fetchall()
        for row in rows:
            print ">> ", row

    failures = s.insert("InstanceA", [model.Binding("PropA", ["a"]), model.Binding(c.INSTANCE_OF, [InstanceRef("ClassA")])])
    assert len(failures) == 0

    rows = s.query(["PropA"], sql_storage.WithPropValue(c.INSTANCE_OF, InstanceRef("ClassA")))
    assert len(rows) == 1
    row = rows[0]
    row.id == "InstanceA"
    assert len(row.get("PropA")) == 1
    value = row.get("PropA")
    assert value == "a"

def test_extra_properties_rejects():
    s = create_storage()

    s.insert_property(model.Property("PropA", "Prop A", c.STRING))
    s.insert_type(model.Type("ClassA", "Class A", property_ids=["PropA"]))

    failures = s.insert("InstanceA", [model.Binding("PropB", ["a"]), model.Binding(c.INSTANCE_OF, [InstanceRef("ClassA")])])
    assert len(failures) > 0


def test_unique_value_enforcement():
    s = create_storage()

    s.insert_property(model.Property("key", "key", c.STRING, is_unique=True))
    s.insert_type(model.Type("ClassA", "Class A", property_ids=["PropA"]))

    failures = s.insert("InstanceA", [model.Binding("key", ["a"]), model.Binding(c.INSTANCE_OF, [InstanceRef("ClassA")])])
    assert len(failures) == 0

    failures = s.insert("InstanceB", [model.Binding("key", ["a"]), model.Binding(c.INSTANCE_OF, [InstanceRef("ClassA")])])
    assert len(failures) > 0

def test_included_type():
    s = create_storage()

    s.insert_property(model.Property("PropA", "Prop A", c.STRING))
    s.insert_property(model.Property("PropB", "Prop B", c.STRING))
    s.insert_type(model.Type("ClassA", "Class A", property_ids=["PropA"]))
    s.insert_type(model.Type("ClassB", "Class B", property_ids=["PropB"], included_type_ids=["ClassA"]))

    failures = s.insert("InstanceA", [
        model.Binding("PropA", ["a"]),
        model.Binding("PropB", ["b"]),
        model.Binding(c.INSTANCE_OF, [InstanceRef("ClassA")])])
    len(failures) == 0

def test_name_is_unique():
    s = create_storage()

    s.insert_type(model.Type("ClassA", "Class A", name_is_unique=True))

    failures = s.insert("InstanceA", [model.Binding(c.NAME, ["a"]), model.Binding(c.INSTANCE_OF, [InstanceRef("ClassA")])])
    assert len(failures) == 0

    failures = s.insert("InstanceB", [model.Binding(c.NAME, ["a"]), model.Binding(c.INSTANCE_OF, [InstanceRef("ClassA")])])
    assert len(failures) > 0

def test_reverse_property():
    s = create_storage()

    s.insert_type(model.Type("ClassB", "Class B", name_is_unique=True))
    s.insert_property(model.Property("AtoB", "A to B", "ClassB"))
    s.insert_property(model.Property("BtoA", "B to A", "ClassA"))
    s.insert_type(model.Type("ClassA", "Class A", property_ids=["AtoB"], name_is_unique=True))

    failures = s.insert("InstanceB", [model.Binding(c.INSTANCE_OF, [InstanceRef("ClassB")])])
    assert len(failures) == 0
    failures = s.insert("InstanceA", [model.Binding("AtoB", [model.InstanceRef("InstanceB")]), model.Binding(c.INSTANCE_OF, [InstanceRef("ClassA")])])
    assert len(failures) == 0

    rows = s.query(["AtoB"], sql_storage.WithPropValue(c.INSTANCE_OF, "ClassA"))
    assert len(rows) == 1
    row = rows[0]
    row.id == "InstanceA"
    value = row.get("AtoB")
    assert value == model.InstanceRef("InstanceB")

    rows = s.query(["BtoA"], sql_storage.WithPropValue(c.INSTANCE_OF, "ClassB"))
    assert len(rows) == 1
    row = rows[0]
    row.id == "InstanceB"
    value = row.get("BtoA")
    assert value == model.InstanceRef("InstanceA")

def test_expected_type_ref_mismatch():
    s = create_storage()

    s.insert_type(model.Type("ClassA", "Class A", name_is_unique=True))
    s.insert_type(model.Type("ClassB", "Class B", name_is_unique=True))
    s.insert_type(model.Type("ClassC", "Class C", name_is_unique=True))
    s.insert_property(model.Property("AtoB", "A to B", "ClassB"))

    failures = s.insert("InstanceB", [model.Binding(c.INSTANCE_OF, [InstanceRef("ClassB")])])
    assert len(failures) == 0

    failures = s.insert("InstanceC", [model.Binding(c.INSTANCE_OF, [InstanceRef("ClassC")])])
    assert len(failures) == 0

    failures = s.insert("InstanceA", [model.Binding("AtoB", [model.InstanceRef("InstanceC")]), model.Binding(c.INSTANCE_OF, [model.InstanceRef("ClassA")])])
    assert len(failures) > 0


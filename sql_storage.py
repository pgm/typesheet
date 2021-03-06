__author__ = 'pgm'

import sqlite3
import os.path
from sqlalchemy import create_engine
import model
import collections
import datetime

from sqlalchemy import Table, Column, Numeric, Integer, String, TIMESTAMP, MetaData, ForeignKey, select , and_

metadata = MetaData()
instance = Table("instance", metadata,
  Column("instance", String),
  Column("property", String),
  Column("str_value", String),
  Column("num_value", Numeric),
  Column("ref_value", String)
  )

unique_constraint = Table("unique_constraint", metadata,
  Column("type_instance", String, primary_key=True),
  Column("property", String),
  Column("value", String),
  Column("instance", String),
)

owner = Table("owner", metadata,
  Column('id', Integer, primary_key=True),
  Column('name', String)
)

transaction = Table("transaction", metadata,
  Column('txn', Integer, primary_key=True),
  Column('owner_id', None, ForeignKey("owner.id")),
  Column('time', TIMESTAMP)
)

journal = Table("journal", metadata,
  Column('id', Integer, primary_key=True),
  Column('txn', None, ForeignKey("transaction.txn")),
  Column("operation", String),
  Column("instance", String),
  Column("property", String),
  Column("str_value", String),
  Column("num_value", Numeric),
  Column("ref_value", String)
)

OP_ADD_VALUE = "AV"
OP_DEL_VALUE = "DV"
OP_ADD_INSTANCE = "AI"
OP_DEL_INSTANCE = "DI"

def unimp():
    raise Exception("unimp")

def create_schema(engine):
    metadata.create_all(engine)

def create_in_memory_database():
    engine = create_engine('sqlite:///:memory:')
    create_schema(engine)
    return engine

def open_database(filename):
    new_db = os.path.exists(filename)
    connection = sqlite3.connect(filename)
    if new_db:
        create_schema(connection)
    return connection

def expand_value(value):
    if isinstance(value, str):
        return (value, None, None)
    if isinstance(value, model.InstanceRef):
        return (None, None, value.id)
    if isinstance(value, float):
        return (None, value, None)

class WithPropValue(object):
    def __init__(self, property_id, value):
        assert type(property_id) == str
        self.property_id = property_id
        self.value = value

    def make_sql_predicate(self):
        check_property = instance.c.property == self.property_id
        if type(self.value) == str:
            return and_(check_property, instance.c.str_value == self.value)
        elif type(self.value) == int or type(self.value) == float:
            return and_(check_property, instance.c.num_value == self.value)
        else:
            assert isinstance(self.value, model.InstanceRef)
            return and_(check_property, instance.c.ref_value == self.value.id)

class WithId(object):
    def __init__(self, id):
        assert type(id) == str or type(id) == unicode, "expected %r to be str" % (id,)
        self.id = id

    def make_sql_predicate(self):
        return instance.c.instance == self.id

class Row(object):
    def __init__(self, id, properties, map):
        self.properties = properties
        self.map = map
        self.id = id

    def get(self, property_id, type=None):
        if property_id in self.map:
            values = self.map[property_id]
            assert len(values) == 1
            value = values[0]
            if type == bool:
                value = (value == "True")
            elif type == "ref_id":
                assert isinstance(value, model.InstanceRef)
                value = value.id
            else:
                assert type == None
            return value
        return None

    def get_list(self, property_id):
        return self.map[property_id]

class Storage(object):
    def __init__(self, engine):
        self.engine = engine

    def delete(self, id):
        with self.engine.begin() as db:
            db.execute("DELETE FROM instance WHERE instance = ?", (id,))
            db.execute("DELETE FROM unique_constraint WHERE instance = ?", (id,))

    def insert(self, id, props, unique_value_properties, property_to_inverse_property):
        """id - instance id
           props - list of Bindings
           uk_props - list of (type_id, property_id) for each property which is defined as unique """
        assert unique_value_properties != None
        assert isinstance(unique_value_properties, dict)
        print "property_to_inverse_property", property_to_inverse_property

        with self.engine.begin() as db:
            result = db.execute(transaction.insert().values(time=datetime.datetime.now()))
            txn_id = result.inserted_primary_key[0]

            db.execute(journal.insert().values(txn=txn_id, operation=OP_ADD_INSTANCE, instance=id))
            for prop in props:
                property_id = prop.property_id
                inv_property_id = property_to_inverse_property.get(property_id)

                for value in prop.values:
                    str_value, num_value, ref_value = expand_value(value)

                    db.execute(journal.insert().values(txn=txn_id, operation=OP_ADD_VALUE, instance=id, property=property_id, str_value=str_value, num_value=num_value, ref_value=ref_value))
                    db.execute(instance.insert().values(instance=id, property=property_id, str_value=str_value, num_value=num_value, ref_value=ref_value))

                    # store inverse properties
                    if inv_property_id != None:
                        assert ref_value != None
                        db.execute(instance.insert().values(instance=ref_value, property=inv_property_id, str_value=str_value, num_value=num_value, ref_value=id))

                    # insert into table to detect uk violations
                    if property_id in unique_value_properties:
                        for type_instance in unique_value_properties[property_id]:
                            db.execute(unique_constraint.insert().values(type_instance=type_instance, instance=id, property=property_id, value=repr(value)))

    def query(self, properties=None, predicate=None):
        s = select([instance.c.instance])
        if predicate != None:
            s = s.where(predicate.make_sql_predicate())

        with self.engine.begin() as db:
            print "finding ids: ", str(s)
            ids = db.execute(s).fetchall()
            print "fetched ids: ", ids

            rec_filter = instance.c.instance.in_([x[0] for x in ids])
            if properties != None:
                rec_filter = and_(rec_filter,
                     instance.c.property.in_(properties))
            s = select([instance.c.instance, instance.c.property, instance.c.num_value, instance.c.str_value, instance.c.ref_value]).where(
                rec_filter
            )
            print s
            records = db.execute(s).fetchall()


            by_id = collections.defaultdict(lambda: collections.defaultdict(lambda: []))

            for id, property_id, num_value, str_value, ref_value in records:
                if num_value != None:
                    assert str_value == None and ref_value == None
                    value = num_value
                elif str_value != None:
                    assert num_value == None and ref_value == None
                    value = str_value
                else:
                    assert str_value == None and num_value == None
                    value = model.InstanceRef(ref_value)

                by_id[id][property_id].append(value)

            rows = [Row(id, properties, bindings) for id, bindings in by_id.items()]

            return rows
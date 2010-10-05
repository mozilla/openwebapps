#
# Database model for demonstration store
#
# Make sure to set up database environment variables; see 
# config.py for what to set.
#
import logging
import re
import os
import subprocess
try:
  import simplejson as json
except:
  import json

from datetime import datetime

import sqlalchemy
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from sqlalchemy import ForeignKey, Unicode, DateTime, Column, MetaData, Integer, Text, Boolean, String
from sqlalchemy.orm import relationship, backref
import sqlalchemy.exc

# Configuration, including database handle
# If you want to use sqlite, postgres, or mysql look in 
# config.py to see how to set up your environment.
from config import engine, session

# SQLAlchemy setup:
metadata = MetaData(engine)
Base = declarative_base(metadata=metadata)

# Validation regexes:
manifest_id_re = re.compile(r'^[a-z0-9_]+$', re.I)


# Object Developer
class Developer(Base):      
    __tablename__ = "developers"
    
    id = Column(Integer, primary_key=True)
    name = Column(Text)
    apps = relationship("Application", backref='developer')
    members = relationship("User", backref='developer')

    def __repr__(self):
      return "<Developer(%d, %s)>" % (self.id, self.name)

# Object User
class User(Base):      
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(Text)
    developer_id = Column(Integer, ForeignKey("developers.id"))
    identities = relationship("Identity", backref="user")
    approvalreviews = relationship("ApprovalReview", backref="user")  
    purchases = relationship("Purchase", backref="user")  
    
    def __repr__(self):
      return "<User(%d, %s)>" % (self.id, self.name)

# Object Identity
class Identity(Base):      
    __tablename__ = "identities"

    id = Column(Integer, primary_key=True)
    identifier = Column(String(256), unique=True)
    displayName = Column(Text)
    email = Column(Text)
    photoURL = Column(Text)
    verifiedDate = Column(DateTime)
    user_id = Column(Integer, ForeignKey("users.id"))

    def __init__(self, uid, identifier, displayName, email, date):
      self.user_id = uid
      self.identifier = identifier
      self.displayName = displayName
      self.email = email
      self.verifiedDate = date

    def __repr__(self):
      return "<Identity(%d, %s)>" % (self.id, self.identifier)

# Object Category
class Category(Base):      
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(Text)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    children = relationship("Category", backref="parent", remote_side=id) #sqlalchemy incantation to create hierarchical key
    apps = relationship("Application", backref="category")

    def __init__(self, name, parent):
      self.name = name
      if parent: self.parent_id = parent

    def __repr__(self):
      return "<Category(%d, %s)>" % (self.id, self.name)


# Object Application
class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True)
    name = Column(Text)
    price = Column(Integer, default=0)
    manifest = Column(Text, nullable=False)
    manifestText = Column(Text, nullable=False) # source of manifest, can include whitespace and comments
    launchURL = Column(String(1000), nullable=False, unique=True)
    updated = Column(DateTime, nullable=False)
    approved = Column(Boolean)
    icon96URL = Column(Text)
    description = Column(Text)

    developer_id = Column(Integer, ForeignKey("developers.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    approvalreviews = relationship("ApprovalReview", backref="app")
    purchases = relationship("Purchase", backref="app")  
     # TODO it may make sense to keep a version history here.

    def __init__(self, name, manifest, manifestText, launchURL, updated, icon96, description):
      self.name = name
      self.manifest = manifest
      self.manifestText = manifestText
      self.launchURL = launchURL
      self.updated = updated
      self.icon96URL = icon96
      self.approved = False
      self.description = description

    
    def __repr__(self):
      return "<Application(%d, %d, %s)>" % (self.id, self.developer, self.updated)

    def save(self):
      session.commit()

# Object ApprovalReview
class ApprovalReview(Base):
  __tablename__ = "approvalreview"

  id = Column(Integer, primary_key=True)
  date = Column(DateTime)
  status = Column(Integer)
  comment = Column(Text)
  reviewer_id = Column(Integer, ForeignKey("users.id")) 
  app_id = Column(Integer, ForeignKey("applications.id"))

  def __repr__(self):
    return "<ApprovalReview(%d, %s)>" % (self.id, self.reviewer)

# Object Purchase
class Purchase(Base):
  __tablename__ = "purchase"

  id = Column(Integer, primary_key=True)
  app_id = Column(Integer, ForeignKey("applications.id"))
  user_id = Column(Integer, ForeignKey("users.id"))
  date = Column(DateTime)

  def __init__(self, uid, appid, time):
    self.app_id = appid
    self.user_id = uid
    self.date = time

  def __repr__(self):
    return "<Purchase(%d, %s, %s)>" % (self.id, self.app_id, self.user_id)


# If this is our first run, go take care of housekeeping
metadata.create_all(engine) 
    
    
def createUser():
  try:
    u = User()
    session.add(u)
    session.commit()
    return u

  except sqlalchemy.exc.IntegrityError, e:
    logging.exception(e)  
    session.rollback()
    raise ValueError("Unable to create user")

def user(id):
  return session.query(User).filter(User.id == id).first()
    

def addIdentity(uid, identifier, displayName, email):
  try:
    id = Identity(uid, identifier, displayName, email, datetime.now())
    session.add(id)
    session.commit()
    return id

  except sqlalchemy.exc.IntegrityError, e:
    logging.exception(e)
    session.rollback()
    raise ValueError("Unable to create identity")

def identity_by_identifier(identifier):
  return session.query(Identity).filter(Identity.identifier == identifier).first()
    
def applications():
  return session.query(Application).all()

def application(id):
  return session.query(Application).filter(Application.id == int(id)).one()

def createApplication(manifestText, manifestSrc, manifestObj = None):
  try:
    if not manifestObj:
      manifestObj = json.loads(manifestSrc)
      
    name = manifestObj['name']
    launchURL = manifestObj['app']['launch']['web_url']
    icon96 = None
    if 'icons' in manifestObj:
      if '96' in manifestObj['icons']:
        icon96 = manifestObj['icons']['96']
      else:
        key = manifestObj['icons'].keys()[0]
        icon96 = manifestObj['icons'][key]

    description = manifestObj['description']

    a = Application(name, manifestSrc, manifestText, launchURL, datetime.now(), icon96, description)
    session.add(a)
    session.commit()
    return a

  except sqlalchemy.exc.IntegrityError:
    session.rollback()
    raise ValueError("An application is already registered for that launch URL.")

def save(obj):
  session.add(obj)
  session.commit()


def categories(parent=None):
  q = session.query(Category)
  if parent: q = q.filter(Category.parent_id == parent)
  return q.all()

def createCategory(name, parent=None):
  try:
    if parent and (len(parent) == 0 or parent == 0):
        parent = None
    c = Category(name, parent=parent)
    session.add(c)
    session.commit()
    return c
  except Exception, e:
    session.rollback()
    raise ValueError("Error while creating category: %s" % e)



def purchase(id):
  return session.query(Purchase).filter(Purchase.id == id).one()

def purchase_for_user_app(userid, appid):
  return session.query(Purchase).filter(Purchase.user_id == userid).filter(Purchase.app_id == appid).first()

def createPurchaseForUserApp(uid, appid):
  try:
    p = Purchase(uid, appid, datetime.now())
    session.add(p)
    session.commit()
    return p

  except sqlalchemy.exc.IntegrityError, e:
    logging.exception(e)
    session.rollback()
    raise ValueError("Unable to create purchase")



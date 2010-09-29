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
import simplejson as json
from datetime import datetime

import sqlalchemy
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from sqlalchemy import ForeignKey, Unicode, DateTime, Column, MetaData, Integer, Text, Boolean
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
    
    def __repr__(self):
      return "<User(%d, %s)>" % (self.id, self.name)

# Object Identity
class Identity(Base):      
    __tablename__ = "identities"

    id = Column(Integer, primary_key=True)
    identifier = Column(Text, unique=True)
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
    manifest = Column(Text, nullable=False)
    manifestText = Column(Text, nullable=False) # source of manifest, can include whitespace and comments
    launchURL = Column(Text, nullable=False, unique=True)
    updated = Column(DateTime, nullable=False)
    approved = Column(Boolean)
    icon96URL = Column(Text)

    developer_id = Column(Integer, ForeignKey("developers.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    approvalreviews = relationship("ApprovalReview", backref="app")
     # TODO it may make sense to keep a version history here.

    def __init__(self, manifest, manifestText, launchURL, updated, icon96):
      self.manifest = manifest
      self.manifestText = manifestText
      self.launchURL = launchURL
      self.updated = updated
      self.icon96URL = icon96
      self.approved = False

    
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
  return session.query(Application).filter(Application.id == id).one()

def createApplication(manifestText, manifestSrc, manifestObj = None):
  try:
    if not manifestObj:
      manifestObj = json.loads(manifestSrc)
      
    launchURL = manifestObj['app']['launch']['web_url']
    icon96 = None
    if 'icons' in manifestObj and '96' in manifestObj['icons']:
      icon96 = manifestObj['icons']['96']

    a = Application(manifestSrc, manifestText, launchURL, datetime.now(), icon96)
    session.add(a)
    session.commit()
    return a

  except sqlalchemy.exc.IntegrityError:
    session.rollback()
    raise ValueError("An application is already registered for that launch URL.")


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



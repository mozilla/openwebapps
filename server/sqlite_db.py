import sqlite3
import time
import os.path

DATABASE_FILE = "server_data.sqlite"

def create_database():
  c = g_database_conn.cursor()

  c.execute("""CREATE TABLE user (\
                  id INTEGER PRIMARY KEY AUTOINCREMENT, \
                  username TEXT,\
                  passwordHash TEXT)""")

  c.execute("""CREATE TABLE developer (\
                  id INTEGER PRIMARY KEY AUTOINCREMENT, \
                  name TEXT)""")

  c.execute("""CREATE TABLE developer_user (\
                  id INTEGER PRIMARY KEY AUTOINCREMENT, \
                  dev_id INTEGER,\
                  user_id INTEGER)""")

  # Note brittleness between this schema and the one in server.py
  c.execute("""CREATE TABLE app (\
                  id INTEGER PRIMARY KEY AUTOINCREMENT, \
                  name TEXT,\
                  domain TEXT,\
                  description BLOB,\
                  icon96 BLOB,\
                  icon192 BLOB,\
                  category TEXT,\
                  developer INTEGER,\
                  homeURL TEXT,\
                  verifyURL TEXT,\
                  releaseDate DATETIME,\
                  UNIQUE(name) ON CONFLICT FAIL)""")

  # imagine a cool category tree
  # and a "product" table, some of which are apps, and others of which are
  # bundles of other productIDs
  # plus support for in-app purchasing

  c.execute("""CREATE TABLE purchase (\
                  id INTEGER PRIMARY KEY AUTOINCREMENT, \
                  user INTEGER, \
                  app INTEGER, \
                  purchaseDate DATETIME,\
                  expireDate DATETIME,\
                  UNIQUE(user, app) ON CONFLICT FAIL)""")

  # Temporary associations for authentications
  c.execute("""CREATE TABLE authAssocs (\
                  id INTEGER PRIMARY KEY AUTOINCREMENT, \
                  nonce TEXT, \
                  user INTEGER, \
                  app INTEGER, \
                  expireDate DATETIME,\
                  UNIQUE(user, app) ON CONFLICT REPLACE)""")

  # Messages
  c.execute("""CREATE TABLE message (\
                  id INTEGER PRIMARY KEY AUTOINCREMENT, \
                  app INTEGER, \
                  user INTEGER, \
                  sendDate DATETIME,\
                  text TEXT)""")

  g_database_conn.commit()
  c.close()

# User:
def user_exists(name):
  c = g_database_conn.cursor()
  c.execute("SELECT id FROM user where username = ?", (name,))
  result = c.fetchall()
  c.close()
  if result:
    return True
  else:
    return False

def insert_person(username, passwordHash):
  c = g_database_conn.cursor()
  c.execute("INSERT INTO user (username, passwordHash) VALUES(?,?)", (username, passwordHash,))
  c.execute("SELECT last_insert_rowid()")
  result = c.fetchone()
  val = result[0]
  c.close()
  g_database_conn.commit()
  return val

def select_user(uid):
  c = g_database_conn.cursor()
  c.execute("SELECT * FROM user where rowid = ?", (uid,))
  result = c.fetchone()
  c.close()
  return result

def select_user_with_hash(username, hash):
  c = g_database_conn.cursor()
  c.execute("SELECT * FROM user where username = ? and passwordHash = ?", (username, hash))
  result = c.fetchone()
  c.close()
  return result

def select_user_with_name(username):
  c = g_database_conn.cursor()
  c.execute("SELECT * FROM user where username = ?", (username,))
  result = c.fetchone()
  c.close()
  return result

# Developer
def select_developers():
  c = g_database_conn.cursor()
  c.execute("SELECT * from developer")
  result = c.fetchall()
  c.close()
  return result

def select_developer(devid):
  c = g_database_conn.cursor()
  c.execute("SELECT * from developer WHERE rowid = ?", (int(devid),))
  result = c.fetchone()
  c.close()
  return result

def select_developer_by_name(devname):
  c = g_database_conn.cursor()
  c.execute("SELECT * from developer WHERE name = ?", (devname,))
  result = c.fetchone()
  c.close()
  return result

def insert_developer(name):
  c = g_database_conn.cursor()
  c.execute("INSERT INTO developer (name) VALUES(?)", (name,))
  c.execute("SELECT last_insert_rowid()")
  result = c.fetchone()
  val = result[0]
  c.close()
  g_database_conn.commit()
  return val

def delete_developer(devid):
  c = g_database_conn.cursor()
  c.execute("DELETE FROM developer_user where dev_id = ? ", (devid))
  c.execute("DELETE FROM developer where rowid = ? ", (devid))
  c.close()
  g_database_conn.commit()


# Developer-User
def select_developer_users(devid):
  c = g_database_conn.cursor()
  c.execute("SELECT * from developer_user WHERE dev_id = ?", (devid,))
  result = c.fetchall()
  c.close()
  return result

def select_user_developer_memberships(userid):
  c = g_database_conn.cursor()
  c.execute("SELECT * from developer_user WHERE user_id = ?", (userid,))
  result = c.fetchall()
  c.close()
  return result

def insert_developer_user(devid, userid):
  c = g_database_conn.cursor()
  c.execute("INSERT INTO developer_user (dev_id, user_id) VALUES(?,?)", (devid, userid))
  c.close()
  g_database_conn.commit()

def delete_developer_user(devid, userid):
  c = g_database_conn.cursor()
  c.execute("DELETE FROM developer_user where dev_id = ? AND user_id = ?", (devid, userid))
  c.close()
  g_database_conn.commit()

# App
def select_apps():
  c = g_database_conn.cursor()
  c.execute("SELECT * from app")
  result = c.fetchall()
  c.close()
  return result

def select_app(appid):
  c = g_database_conn.cursor()
  c.execute("SELECT * from app WHERE rowid = ?", (appid,))
  result = c.fetchone()
  c.close()
  return result

def select_apps_for_domain(domain):
  c = g_database_conn.cursor()
  c.execute("SELECT * from app WHERE domain = ?", (domain,))
  result = c.fetchall()
  c.close()
  return result

def select_apps_for_developer(devid):
  c = g_database_conn.cursor()
  c.execute("SELECT * from app WHERE developer = ?", (int(devid),))
  result = c.fetchall()
  c.close()
  return result

def select_apps_in_category(category):
  c = g_database_conn.cursor()
  c.execute("SELECT * from app WHERE category = ?", (category,))
  result = c.fetchall()
  c.close()
  return result

def insert_app(name, domain, category, desc, icon96, icon192, developer, homeURL, verifyURL, releaseDate):
  c = g_database_conn.cursor()
  c.execute("INSERT INTO app (name, domain, category, description, icon96, icon192, developer, homeURL, verifyURL, releaseDate) VALUES(?,?,?,?,?,?,?,?,?,?)",
    (name, domain, category, desc, icon96, icon192, developer, homeURL, verifyURL, releaseDate))
  c.execute("SELECT last_insert_rowid()")
  result = c.fetchone()
  val = result[0]
  c.close()
  g_database_conn.commit()
  return val


# Purchase
def select_purchase(uid, appid):
  c = g_database_conn.cursor()
  c.execute("SELECT * FROM purchase where user = ? and app = ?", (uid, appid))
  result = c.fetchone()
  c.close()
  return result

def select_user_purchases(uid):
  c = g_database_conn.cursor()
  c.execute("SELECT * FROM purchase where user = ?", (uid,))
  result = c.fetchall()
  c.close()
  return result

def insert_user_purchase(uid, appid, purchaseDate, expireDate):
  c = g_database_conn.cursor()
  c.execute("INSERT INTO purchase (user, app, purchaseDate, expireDate) VALUES(?,?,?,?)", (uid, appid, purchaseDate, expireDate))
  c.execute("SELECT last_insert_rowid()")
  result = c.fetchone()
  val = result[0]
  c.close()
  g_database_conn.commit()
  return val


# Associations
def insert_auth_association(uid, appid, nonce, expireDate):
  c = g_database_conn.cursor()
  c.execute("INSERT INTO authAssocs (nonce, user, app, expireDate) VALUES(?,?,?,?)", (nonce, uid, appid, expireDate))
  c.execute("SELECT last_insert_rowid()")
  result = c.fetchone()
  val = result[0]
  c.close()
  g_database_conn.commit()
  return val

def select_auth_association(uid, appid, nonce):
  c = g_database_conn.cursor()
  c.execute("SELECT * FROM authAssocs WHERE uid = ? AND appid = ? AND nonce = ?)", (nonce, uid, appid))
  result = c.fetchone()
  c.close()
  return result

def delete_auth_assocation(uid, appid, nonce):
  c = g_database_conn.cursor()
  c.execute("DELETE FROM authAssocs WHERE uid = ? AND appid = ? AND nonce = ?)", (nonce, uid, appid))
  c.close()
  g_database_conn.commit()

# Messages
def insert_message(app, user, sendDate, text):
  c = g_database_conn.cursor()
  c.execute("INSERT INTO message (app, user, sendDate, text) VALUES(?,?,?,?)", (app, user, sendDate, text))
  c.execute("SELECT last_insert_rowid()")
  result = c.fetchone()
  val = result[0]
  c.close()
  g_database_conn.commit()
  return val

def select_messages_for_user(user, sinceDate=None):
  c = g_database_conn.cursor()
  if sinceDate:
    c.execute("SELECT * FROM message WHERE user = ? and sinceDate > ?", (user, sinceDate))
  else:
    c.execute("SELECT * FROM message WHERE user = ?", (user,))
  result = c.fetchall()
  c.close()
  return result


if not os.path.exists(DATABASE_FILE):
  g_database_conn = sqlite3.connect(DATABASE_FILE)
  create_database()
else:
  g_database_conn = sqlite3.connect(DATABASE_FILE)

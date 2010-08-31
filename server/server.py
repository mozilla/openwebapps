#!/usr/bin/env python
#
import logging
import sys
import tornado.httpserver
import tornado.ioloop
import tornado.web
import subprocess
import hashlib
import datetime
import os
import re
import time
import traceback
import logging
import datetime
import cStringIO
import json
import cgi
import sqlite_db as db
import random

random.seed()

SERVER_API_URL = "http://webappstore.mozilla.org"

class User(object):
  def __init__(self, dbData):
    self.id = int(dbData[0])
    self.username = dbData[1]
    self.passwordHash = dbData[2]

  def getDeveloperMemberships(self):
    return db.select_user_developer_memberships(self.id)


class Application(object):
  def __init__(self, dbData):
    self.id = int(dbData[0])
    self.name = dbData[1]
    self.domain = dbData[2]
    self.description = dbData[3]
    self.icon96 = dbData[4]
    self.icon192 = dbData[5]
    self.category = dbData[6]
    self.developer = int(dbData[7])
    self.homeURL = dbData[8]
    self.verifyURL = dbData[9]
    self.releaseDate = dbData[10]

class Purchase(object):
  def __init__(self, dbData):
    self.id = int(dbData[0])
    self.user = int(dbData[1])
    self.app = int(dbData[2])
    self.purchaseDate = dbData[3]
    self.expireDate = dbData[4]

class Developer(object):
  def __init__(self, dbData):
    self.id = int(dbData[0])
    self.name = dbData[1]

  def getUsers(self):
    return db.select_developer_users(self.id)

  def getApps(self):
    return db.select_apps_for_developer(self.id)

class DeveloperUser(object):
  def __init__(self, dbData):
    self.id = int(dbData[0])
    self.devid = int(dbData[1])
    self.userid = int(dbData[2])

class Message(object):
  def __init__(self, dbData):
    self.id = int(dbData[0])
    self.appid = int(dbData[1])
    self.userid = int(dbData[2])
    self.sendDate = dbData[3]
    self.text = dbData[4]




# Helper function to get the user object, if a session exists
def getUserObject(req):
  uid = req.get_secure_cookie("uid")
  if uid:
    userData = db.select_user(uid)
    if userData:
      return User(userData)
  return None

class RootHandler(tornado.web.RequestHandler):
  def get(self):
    self.render("index.html", user=getUserObject(self))

class BrowseAppsHandler(tornado.web.RequestHandler):
  def get(self):
    all_apps = db.select_apps() # release the hounds!  obviously this won't work for real
    categories = {}
    for app in all_apps:
      cat = Application(app).category
      if not cat in categories:
        categories[cat] = 1
    self.render("app_directory.html", categories = categories.keys(), user=getUserObject(self))

class BrowseCategoryHandler(tornado.web.RequestHandler):
  def get(self, category):
    appsData = db.select_apps_in_category(category)
    apps = [Application(appData) for appData in appsData]
    for app in apps:
      app.releaseDateObj = datetime.date.fromtimestamp(app.releaseDate)
    self.render("app_cat_directory.html", category = category, apps=apps, user=getUserObject(self))

class BrowseDevelopersHandler(tornado.web.RequestHandler):
  def get(self):
    all_devs = db.select_developers() # won't work for real
    self.render("dev_directory.html", devs = [Developer(x) for x in all_devs], user=getUserObject(self))

class AccountHandler(tornado.web.RequestHandler):
  def do_render(self, user, error=None):
    userDevIDs = db.select_user_developer_memberships(user.id)
    devs = [Developer(db.select_developer(DeveloperUser(ud).devid)) for ud in userDevIDs]
    purchases = db.select_user_purchases(user.id)
    apps = [Application(db.select_app(Purchase(purchaseData).app)) for purchaseData in purchases]
    self.render("user_account.html", user=user, devs=devs, apps=apps)

  def post(self):
    user = getUserObject(self)
    if not user or not "action" in self.request.arguments:
      logging.debug("Strange AccountHandler post: user is %s; action-exists is %s" % (str(user), "action" in self.request.arguments))
      return self.redirect("/")

    action = self.request.arguments["action"][0].strip()

    if action== "add_developer":
      if not "devname" in self.request.arguments:
        return self.redirect("/")

      devname = self.request.arguments["devname"][0].strip()
      devData = db.select_developer_by_name(devname)
      if not devData:
        return self.do_render(user=user, error="No developer with that name found.")
      dev = Developer(devData)
      db.insert_developer_user(dev.id, user.id)

      self.do_render(user)


  def get(self):
    user = getUserObject(self)
    if not user:
      return self.redirect("/")
    self.do_render(user)

class AppDetailHandler(tornado.web.RequestHandler):
  def get(self):
    if not 'id' in self.request.arguments:
      return self.redirect("/")

    id = self.request.arguments["id"][0].strip()
    appData = db.select_app(id)
    if not appData:
      return self.render("error.html", error="Illegal or missing application ID", user=getUserObject(self))

    app = Application(appData)
    app.releaseDateObj = datetime.date.fromtimestamp(app.releaseDate)
    dev = Developer(db.select_developer(app.developer))
    self.render("app_detail.html", app=app, dev=dev, user=getUserObject(self))

class AppRegisterHandler(tornado.web.RequestHandler):
  def do_render(self, user, error=None):
    userDevIDs = db.select_user_developer_memberships(user.id)
    devs = [Developer(db.select_developer(DeveloperUser(ud).devid)) for ud in userDevIDs]
    self.render("app_register.html", user=user, devs=devs, error=error)

  def post(self):
    user = getUserObject(self)
    if not user:
      return self.do_render(error="You must be signed in (to a developer account) to register an app.", user=None)
    logging.debug(self.request.arguments)
    if not 'appname' in self.request.arguments:
      return self.do_render(error="Missing required application name", user=user)
    if not 'domain' in self.request.arguments:
      return self.do_render(error="Missing required application domain", user=user)
    if not 'category' in self.request.arguments:
      return self.do_render(error="Missing required application category", user=user)
    if not 'desc' in self.request.arguments:
      return self.do_render(error="Missing required application description", user=user)
    if not 'homeurl' in self.request.arguments:
      return self.do_render(error="Missing required application homeURL", user=user)
    if not 'verifyurl' in self.request.arguments:
      return self.do_render(error="Missing required application verifyURL", user=user)


    # TODO Sanitize all fields for HTML injections

    developer = self.request.arguments['developer'][0].strip()
    name = self.request.arguments['appname'][0].strip()
    domain = self.request.arguments['domain'][0].strip()
    category = self.request.arguments['category'][0].strip()
    desc = self.request.arguments['desc'][0].strip()
    icon = None
    iconlarge = None
    if 'icon' in self.request.arguments:
      icon = self.request.arguments['icon'][0].strip()
    if 'iconlarge' in self.request.arguments:
      iconlarge = self.request.arguments['iconlarge'][0].strip()
    homeURL = self.request.arguments['homeurl'][0].strip()
    verifyURL = self.request.arguments['verifyurl'][0].strip()
    if len(name) == 0:
      return self.do_render(error="Missing required application name", user=user)
    if len(homeURL) == 0:
      return self.do_render(error="Missing required application homeURL", user=user)
    if len(verifyURL) == 0:
      return self.do_render(error="Missing required application verifyURL", user=user)
    if len(domain) == 0:
      return self.do_render(error="Missing required application domain ", user=user)

    appid = db.insert_app(name, domain, category, desc, icon, iconlarge, developer, homeURL, verifyURL, time.time())
    self.redirect("/browse?id=%s" % appid)

  def get(self):
    user = getUserObject(self)
    if not user:
      return self.render("app_register.html",
        error="You must be signed in (to a developer account) to register an app.",
        user=None)
    else:
      self.do_render(user=user)

class AppInstallHandler(tornado.web.RequestHandler):
  def post(self):
    if not 'id' in self.request.arguments:
      return self.redirect("/")
    appid = self.request.arguments["id"][0].strip()

    uid = self.get_secure_cookie("uid")
    if not uid:
      return self.redirect("/detail?id=%s" % id)

    appData = db.select_app(appid)
    if not appData:
      return self.render("error.html", error="Illegal or missing application ID", user=getUserObject(self))
    userData = db.select_user(uid)
    if not appData:
      return self.render("error.html", error="Unable to load user data", user=getUserObject(self))

    app = Application(appData)
    user = User(userData)

    # Verify commerce here... this probably
    # will mean creating a purchasePending table
    # or something like that.

    purchaseData = db.select_purchase(uid, appid)
    if purchaseData:
      # User already has this; this is simply a reinstall
      # TODO: Verify expiration now?
      purchase = Purchase(purchaseData)
      expiry = purchase.expireDate
    else:
      # Just assume a year for now
      expiry = datetime.datetime.now()
      expiry = expiry.replace(year = expiry.year + 1)
      expiry = time.mktime(expiry.timetuple())
      db.insert_user_purchase(uid, appid, time.time(), expiry)

    # Create ticket
    ticket = {
      "user": user.username,
      "app": app.id,
      "name": app.name,
      "icon96": app.icon96,
      "domain": app.domain,
      "homeURL": app.homeURL,
      "verifyURL": app.verifyURL,
      "expires": expiry,
      "server": SERVER_API_URL
    }
    self.render("install.html", app=app, ticket=json.dumps(ticket), user=user)


class UserRegisterHandler(tornado.web.RequestHandler):
  def post(self):
    uid = self.get_secure_cookie("uid")

    if uid:
      userData = db.select_user(uid) # deal with deleted user
      if not userData:
        self.set_cookie("uid", "", expires=datetime.datetime(1970,1,1,0,0,0,0))
      return self.redirect("/")

    if not 'un' in self.request.arguments:
      return self.render("user_register.html", error="Missing required username")
    if not 'pw' in self.request.arguments or not 'pw2' in self.request.arguments:
      return self.render("user_register.html", error="Missing required password")

    logging.debug(self.request.arguments)
    un = self.request.arguments["un"][0].strip()
    pw = self.request.arguments["pw"][0].strip()
    pw2 = self.request.arguments["pw2"][0].strip()

    if pw != pw2:
      logging.debug("Password mismatch: %s %s" % (pw, pw2))
      return self.render("user_register.html", error="Password and password verification do not match")
    if pw == "password":
      return self.render("user_register.html", error="You can't use 'password' as your password.")
    if len(pw) < 8:
      return self.render("user_register.html", error="Password must be at least eight characters")
    if len(pw) > 31:
      return self.render("user_register.html", error="Password must be shorter than 32 characters.")
    if db.user_exists(un):
      return self.render("user_register.html", error="Username is already in use.")

    hash = hashlib.sha1(pw).hexdigest()
    id = db.insert_person(un, hash)
    logging.debug("Created new user '%s'; id is %s" % (un, id))

    self.set_secure_cookie("uid", "%d" % id)
    self.redirect("/")

  def get(self):
    uid = self.get_secure_cookie("uid")
    if uid:
      userData = db.select_user(uid) # deal with deleted user
      if not userData:
        self.set_cookie("uid", "", expires=datetime.datetime(1970,1,1,0,0,0,0))
      return self.redirect("/")

    self.render("user_register.html", error=None)


class UserLoginHandler(tornado.web.RequestHandler):
  def get(self):
    self.render("user_login.html", error=None)

  def post(self):
    if self.get_secure_cookie("uid"):
      return self.redirect("/")

    if not 'un' in self.request.arguments:
      return self.render("user_register.html", error="Missing required username")
    if not 'pw' in self.request.arguments:
      return self.render("user_register.html", error="Missing required password")

    un = self.request.arguments["un"][0].strip()
    pw = self.request.arguments["pw"][0].strip()

    hash = hashlib.sha1(pw).hexdigest()
    userData = db.select_user_with_hash(un, hash)
    if userData:
      self.set_secure_cookie("uid", "%d" % (User(userData).id))
    else:
      return self.render("user_login.html", error="That username and password do not match a user.")

    self.redirect("/")

class UserLogoutHandler(tornado.web.RequestHandler):
  def get(self):
    self.set_cookie("uid", "", expires=datetime.datetime(1970,1,1,0,0,0,0))
    self.redirect("/")

class UserVerifyHandler(tornado.web.RequestHandler):
  def handle(self):
    user =None

    # Figure out which app we're talking about
    if not 'domain' in self.request.arguments:
      raise tornado.web.HTTPError(400, "Missing required 'domain'")
    if not 'app' in self.request.arguments:
      raise tornado.web.HTTPError(400, "Missing required 'app'")
    if not 'user' in self.request.arguments:
      raise tornado.web.HTTPError(400, "Missing required 'user'")

    verifyUser = self.request.arguments["user"][0] # this is who we're being asked to verify
    domain = self.request.arguments["domain"][0]
    app = self.request.arguments["app"][0]
    appData = db.select_app(app)
    if not appData:
      raise tornado.web.HTTPError(400, "Invalid application ID")
    app = Application(appData)

    # We may be authenticating...
    if 'un' in self.request.arguments and 'pw' in self.request.arguments:
      un = self.request.arguments["un"][0].strip()
      pw = self.request.arguments["pw"][0].strip()
      hash = hashlib.sha1(pw).hexdigest()
      userData = db.select_user_with_hash(un, hash)
      if userData:
        userObj = User(userData)
        userID = userObj.id
        self.set_secure_cookie("uid", "%d" % userObj.id)
      else:
        return self.render("user_authenticate_for_verify.html", app=app, domain=domain, user=verifyUser, error="That username and password do not match a user.")
    else:
      # or we may be using a cookie:
      uid = self.get_secure_cookie("uid")
      if not uid:
        return self.render("user_authenticate_for_verify.html", app=app, domain=domain, user=verifyUser, error=None)

      # make sure the user matches; if not, go reauthenticate
      userData = db.select_user(uid)
      if userData:
        userObj = User(userData)

    # Verify user match to session (note that the user could hack the login form to
    # change this, but that would simply allow them to impersonate as themselves)
    if userObj.username != verifyUser: # or do an alias lookup here
      # User switch!  Clear cookie, and reauth
      self.set_cookie("uid", "", expires=datetime.datetime(1970,1,1,0,0,0,0))
      return self.render("user_authenticate_for_verify.html", app=app, domain=domain, user=verifyUser, error=None)

    # Find the application(s) for the requested domain
    apps = db.select_apps_for_domain(domain)
    if not apps or len(apps) == 0:
      raise tornado.web.HTTPError(400, "No applications for that domain")

    # Looks good: go ahead and report all the apps the user has purchased
    # For now we just have to assume that the verifyURL of all the apps
    # for the domain is identical.  That is a problematic assumption and we'll
    # have to get some clarity on the domain-app mapping at some point.
    appList = [Application(a) for a in apps];
    logging.debug("Successful verification by user " + verifyUser + " of app " + appList[0].name)
    appIDArray = ",".join(["%s" % a.id for a in appList])

    # For now assume we're using the stateless approach -
    # go create an association for this verification.  Using a key would
    # be better.
    nonce = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ") + ''.join(random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890") for x in range(64))
    expiry = datetime.datetime.now()
    expiry = expiry.replace(minute = expiry.minute + 1)
    expiry = time.mktime(expiry.timetuple())
    assoc = db.insert_auth_association(userObj.id, app.id, nonce, expiry)
    targetURL = appList[0].verifyURL + "?result=ok&apps=%s&user=%s&assoc_handle=%d" % (appIDArray, verifyUser, assoc)
    self.redirect(targetURL)

  def post(self):
    self.handle()

  def get(self):
    self.handle()


class DeveloperRegisterHandler(tornado.web.RequestHandler):
  def post(self):
    user = getUserObject(self)
    if not user:
      return self.render("dev_register.html",
        error="You must be signed in register a developer ID.",
        user=None)
    logging.debug(self.request.arguments)
    if not 'name' in self.request.arguments:
      return self.render("dev_register.html", error="Missing required developer name")

    # TODO sanitize name for HTML
    name = self.request.arguments['name'][0].strip()
    if len(name) == 0:
      return self.render("dev_register.html", error="Missing required developer name")

    devid = db.insert_developer(name)
    self.redirect("/developer/%s" % devid)

  def get(self):
    user = getUserObject(self)
    if not user:
      return self.render("dev_register.html",
        error="You must be signed in to register a developer ID.",
        user=None)
    else:
      self.render("dev_register.html", user=user, error=None)


class DeveloperHandler(tornado.web.RequestHandler):
  def get(self, id):
    devData = db.select_developer(id)
    user = getUserObject(self)
    dev = Developer(devData)
    appsData = dev.getApps()
    apps = [Application(appData) for appData in appsData]
    for app in apps:
      app.releaseDateObj = datetime.date.fromtimestamp(app.releaseDate)
    self.render("dev_detail.html", dev=dev, apps=apps, user=user)


class SelfMessageHandler(tornado.web.RequestHandler):
  def get(self):
    user = getUserObject(self)
    if not user:
      return self.redirect("/")

    format = "json"
    if 'format' in self.request.arguments:
      format = self.request.arguments['format'][0].strip()

    msgs = db.select_messages_for_user(user.id)
    if format == "xml":
      self.render("messages.xml", msgs=[Message(m) for m in msgs])
    else:
      self.render("messages.json", msgs=[Message(m) for m in msgs])

class MessageHandler(tornado.web.RequestHandler):
  def get(self, id):
    # TODO I suppose we could let other users see some of my messages, maybe?
    raise tornado.web.HTTPError(403, "Forbidden")

  def post(self, id):
    # TODO require an API key before apps can post!
    if not 'app' in self.request.arguments:
      raise tornado.web.HTTPError(400, "Missing required 'app'")
    if not 'user' in self.request.arguments:
      raise tornado.web.HTTPError(400, "Missing required 'user'")
    if not 'msg' in self.request.arguments:
      raise tornado.web.HTTPError(400, "Missing required 'msg'")

    app = self.request.arguments['app'][0].strip()
    user = self.request.arguments['user'][0].strip()
    msg = self.request.arguments['msg'][0].strip()

class TestMessageHandler(tornado.web.RequestHandler):
  def post(self):
    app = self.request.arguments['app'][0].strip()
    user = self.request.arguments['user'][0].strip()
    msg = self.request.arguments['msg'][0].strip()

    userData = db.select_user_with_name(user)
    if not userData:
      self.write("Error: Unknown user")
    else:
      db.insert_message(app, User(userData).id, time.time(), msg)
      self.write("Message sent")

  def get(self):
    all_apps = db.select_apps()
    apps = [Application(a) for a in all_apps]
    self.render("testmessage.html", apps=apps)

class DeveloperAccountHandler(tornado.web.RequestHandler):
  def get(self):
    pass
class AdminUserDetailHandler(tornado.web.RequestHandler):
  def get(self):
    pass
class AdminProductDetailHandler(tornado.web.RequestHandler):
  def get(self):
    pass
class AdminDeveloperDetailHandler(tornado.web.RequestHandler):
  def get(self):
    pass
class AdminPurchaseDetailHandler(tornado.web.RequestHandler):
  def get(self):
    pass


##################################################################
# Main Application Setup
##################################################################

settings = {
    "static_path": os.path.join(os.path.dirname(__file__), "static"),
    "cookie_secret": "big_sekrit_12345_abcd",
    "login_url": "/login",
    "debug":True
#    "xsrf_cookies": True,
}

application = tornado.web.Application([
		(r"/", RootHandler),
		(r"/browse", BrowseAppsHandler),
		(r"/browse/(.*)", BrowseCategoryHandler),
		(r"/browsedevs", BrowseDevelopersHandler),
		(r"/detail", AppDetailHandler),
		(r"/install", AppInstallHandler),
		(r"/appregister", AppRegisterHandler),
		(r"/register", UserRegisterHandler),
		(r"/login", UserLoginHandler),
		(r"/logout", UserLogoutHandler),
		(r"/verify", UserVerifyHandler),
		(r"/account", AccountHandler),
		(r"/messages", SelfMessageHandler),
		(r"/messages/(.*)", MessageHandler),
		(r"/testmessage", TestMessageHandler),
		(r"/devregister", DeveloperRegisterHandler),
		(r"/developer/(.*)", DeveloperHandler),
		(r"/developeraccount", DeveloperAccountHandler),
		(r"/admin/user", AdminUserDetailHandler),
		(r"/admin/product", AdminProductDetailHandler),
		(r"/admin/developer", AdminDeveloperDetailHandler),
		(r"/admin/purchase", AdminPurchaseDetailHandler),
	], **settings)

def run(port):
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(port)
    tornado.ioloop.IOLoop.instance().start()

if __name__ == '__main__':
  logging.basicConfig(level = logging.DEBUG)
  port = 8080
  print 'Running on http://127.0.0.1:%s' % port
  run(port)

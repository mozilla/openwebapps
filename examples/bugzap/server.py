#!/usr/bin/env python
#
import logging
import sys
import tornado.httpserver
import tornado.httpclient
import tornado.ioloop
import tornado.escape
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
import random

BUGZILLA_SERVER = "https://api-dev.bugzilla.mozilla.org/latest"

class SearchResult(object):
  def __init__(self, input):
    self.title = "Bug #%d  (%s: %s, %s)" % (input["id"], input["product"], input["component"], input["priority"])
    self.category = "Bug"
    self.link = "https://bugzilla.mozilla.org/show_bug.cgi?id=%d" % (input["id"])
    self.updated = input["last_change_time"]
    self.summary=input["summary"]

class SearchHandler(tornado.web.RequestHandler):
  @tornado.web.asynchronous
  def get(self):
  
    if not "Authorization" in self.request.headers:
      self.set_header("WWW-Authenticate", "Basic realm=\"bugzapp.mozillalabs.com\"")
      self.set_status(401)
      self.write("Please provide a username and password.  These will be the same as your " +
        "bugzilla username and password.  Bugzapp will never keep your username and password, " +
        "but we do need your credentials to perform a search as you, since bugzilla does not support " +
        "a federated login right now.")
      self.finish()
      return

    auth= self.request.headers["Authorization"]
    http = tornado.httpclient.AsyncHTTPClient()

    if "q" in self.request.arguments:
      q = self.request.arguments["q"][0]
    else:
      self.render("search_result.json", title="Bugzapp Search Results", results=[], encode=tornado.escape.json_encode)
      self.finish()
      return

    bugRequest = tornado.httpclient.HTTPRequest(
      BUGZILLA_SERVER + "/bug?summary=%s" % (q,),
      headers={"Authorization": auth, "Accept": "application/json", "Content-Type": "application/json"})

# i.e. "https://api-dev.bugzilla.mozilla.org/latest/bug?product=Bugzilla&priority=P1&severity=blocker",

    http.fetch(bugRequest,
           callback=self.async_callback(self.onBugResponse))
    
      
  def onBugResponse(self, response):
#    logging.debug(response.body)
    try:
      result = {
        "title": "Bugzapp Search Results",
        "results": [ ]
      }
      # now iterate over response body and populate result
      respJSON = json.loads(response.body)
      resultObjects = None
      if "bugs" in respJSON:
        resultObjects = [SearchResult(b) for b in respJSON["bugs"]]

      for b in resultObjects:
        thisBug = {}
        thisBug["title"] = b.title
        thisBug["category_term"] = b.category
        thisBug["link"] =  b.link
        thisBug["updated"] = b.updated
        thisBug["summary"] = b.summary
        result["results"].append(thisBug)

      self.set_status(200)
      self.set_header("Content-Type", "application/json")
      self.write(json.dumps(result))
      self.finish()
    except Exception, e:
      self.set_status(500)
      self.write("Sorry, an error occured: %s" % e)
      self.finish()


class NotificationHandler(tornado.web.RequestHandler):
  def get(self):
    pass

class AppConduitHandler(tornado.web.RequestHandler):
  def get(self):
    self.render("appconduit.html")

class AppConduitJSHandler(tornado.web.RequestHandler):
  def get(self):
    self.render("appconduit.js")

class AppConduitJSChannelHandler(tornado.web.RequestHandler):
  def get(self):
    self.render("jschannel.js")

class AppConduitJQueryHandler(tornado.web.RequestHandler):
  def get(self):
    self.render("jquery-min.js")

class IndexHandler(tornado.web.RequestHandler):
  def get(self):
    self.render("index.html")

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
		(r"/", IndexHandler),
		(r"/appconduit", AppConduitHandler),
		(r"/appconduit.js", AppConduitJSHandler),
		(r"/jschannel.js", AppConduitJSChannelHandler),
		(r"/jquery-min.js", AppConduitJQueryHandler),
		(r"/search", SearchHandler),
		(r"/notifications", NotificationHandler)
	], **settings)

def run():
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(8200)
    tornado.ioloop.IOLoop.instance().start()
		
if __name__ == '__main__':
  logging.basicConfig(level = logging.DEBUG)
  run()
	
	

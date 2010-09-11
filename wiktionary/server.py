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
import datetime
import cStringIO
import json
import cgi
import random

WIKTIONARY_SERVER = "http://en.wiktionary.org/wiki/" # set?action=raw

import re

def dewikify(input):
  input = re.sub("\\{\\{([^}])*?\\}\\}", "", input) # remove {{ template }}
  input = re.sub(r"\[\[([^]]*)\]\]", lambda x:x.group(1).rsplit("|").pop(), input) # remove [[(item|)label]]
  input = re.sub(r"<ref>.*</ref>", "", input)
  return input

class SearchResult(object):
  def __init__(self, term, definition):
    self.title = definition
    self.category = "Definition"
    self.link = WIKTIONARY_SERVER + term
    self.updated = None
    self.summary=""

WORD_TYPES = {
  "Noun":1,
  "Pronoun":1,
  "Adjective":1,
  "Verb":1,
  "Adverb":1,
  "Preposition":1,
  "Particle":1,
  "Preposition":1,
  "Interjection":1,
  "Conjunction":1
}

class SearchHandler(tornado.web.RequestHandler):
  @tornado.web.asynchronous
  def get(self):
    http = tornado.httpclient.AsyncHTTPClient()

    if "q" in self.request.arguments:
      q = self.request.arguments["q"][0]

    request = tornado.httpclient.HTTPRequest(
      WIKTIONARY_SERVER + "%s?action=raw" % q)
    request.query = q

    http.fetch(request,
           callback=self.async_callback(self.onResponse))
    
      
  def onResponse(self, response):
    try:
      if response.code == 404:
        self.set_status(404)
        self.write("404!")
        self.finish()
      else:
        # Split the page into word types, pull the definitions, etc....
        
        #isNoun = (response.body.find("===Noun===") >= 0)
        #isVerb = (response.body.find("===Verb===") >= 0)
        #isAdjective = (response.body.find("===Adjective===") >= 0)
        #isAdverb = (response.body.find("===Adverb===") >= 0)
        # and so on... O(N) search for the lose!!

        resultObjects = []
        wordType = None
        language = None
        for l in response.body.splitlines():
          if len(l) == 0: continue
        
          if l.find("==") == 0 and l[2] != '=':
            language = l[2:l.rfind("==")]
            #logging.debug("Language: " + language)
          elif language and language == "English":
            try:
              if l[0] == '=':
                i = 0
                while l[i] == '=': i += 1
                heading = l[i:l.rfind(l[0:i])]
                #logging.debug("heading: " + heading)
                if WORD_TYPES[heading]:
                  wordType = heading
                else:
                  wordType = None
              elif wordType:
                #logging.debug("line: %s" % str(l))
                if l[0] == "#" and len(l)>1 and (l[1] != ":" and l[1] != '*'):
                  defn = dewikify(l[1:].strip())
                  if len(defn):
                    resultObjects.append(SearchResult(response.request.query, wordType + ": " + defn))
            except Exception, e:
              logging.debug(e)
               
        self.render("search_result.json", title="Wiktionary Search Results", results=resultObjects, encode=tornado.escape.json_encode)
        self.set_status(200)
        self.set_header("Content-Type", "text/plain")
        self.render("search_result.json", title="Bugzapp Search Results", results=resultObjects, encode=tornado.escape.json_encode)
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
		(r"/appconduit", AppConduitHandler),
		(r"/appconduit.js", AppConduitJSHandler),
		(r"/search", SearchHandler),
		(r"/notifications", NotificationHandler),
	], **settings)

def run():
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(8201)
    tornado.ioloop.IOLoop.instance().start()
		
if __name__ == '__main__':
  logging.basicConfig(level = logging.DEBUG)
  run()
	
	
#!/usr/bin/env python
#
import logging
import sys
import os
import cStringIO
import json
import cgi
import urlparse
import base64

# And here's the stuff you probably have to compile:
import tornado.httpclient
import tornado.httpserver
import tornado.ioloop
import tornado.web
import PIL.Image
import BeautifulSoup

class SiteInspection(object):
  def __init__(self, scheme, domain):
    self.scheme = scheme
    self.domain = domain
    
    self.title = domain
    if self.title.find("www.") == 0:
      self.title = self.title[4:]
    idx = self.title.find(".com")
    if idx > 0:
      self.title = self.title[:idx]
    self.title = self.title[0].upper() + self.title[1:].lower()
    
    self.iconData = None
    self.processedFavicon = False
    self.processedIndex = False
    
  
  def setFavicon(self, faviconData):
    if faviconData:
      io = cStringIO.StringIO(faviconData)
      
      try:
        # Make a 48x48 pixel PNG
        logging.debug("Got %d bytes of icon data" % len(faviconData))
        im = PIL.Image.open(io)
        #im.thumbnail(48, PIL.Image.ANTIALIAS)
        
        out = cStringIO.StringIO()
        im.save(out, format="png")
        self.iconData = "data:image/png;base64,%s" % base64.b64encode(out.getvalue())
        logging.debug("Processed icon data")
      except Exception, e:
        logging.warn("Error processing icon data: %s" % e)
      
    self.processedFavicon = True

  def setIndexPage(self, pageData):
    logging.debug("Got index page with %d bytes of data" % len(pageData))
    if pageData:
      try:
        soup = BeautifulSoup.BeautifulSoup(pageData)
        # actually, I don't like this.
        #if soup.title:
        #  self.title = soup.title.string
        
      except:
        pass

    self.processedIndex = True
    
  def isDone(self):
    return self.processedIndex and self.processedFavicon
  
  def renderManifest(self):
    manifest = {
      "name": self.title,
      "app": {
        "urls": [ self.scheme + "://" + self.domain ],
        "launch": {
          "web_url": self.scheme + "://" + self.domain
        }
      },
    }
    if self.iconData:
      manifest["icons"] = {
        "48": self.iconData
      }
    return manifest;


class AppifyAppHandler():
  def appify(self, url):
    # check for obviously malformed inputs...
    parsed = urlparse.urlparse(url)
    if parsed.scheme == None or len(parsed.scheme) == 0 or parsed.netloc == None or len(parsed.netloc) == 0:
      self.fatal_error("Please provide a full URL, e.g. http://targethost.com/")
    if parsed.scheme != "http" and parsed.scheme != "https":
      self.fatal_error("Only http and https URLs are supported.")

    targeturl = parsed.scheme + "://" + parsed.netloc

    http = tornado.httpclient.AsyncHTTPClient()
    
    inspector = SiteInspection(parsed.scheme, parsed.netloc)
    faviconRequest = tornado.httpclient.HTTPRequest(targeturl + "/favicon.ico")
    faviconRequest.inspector = inspector
    indexRequest = tornado.httpclient.HTTPRequest(targeturl + "/")
    indexRequest.inspector = inspector
    
    http.fetch(faviconRequest,
               callback=self.on_favicon_response)
    http.fetch(indexRequest,
               callback=self.on_index_response)
  
  def on_favicon_response(self, response):
    if response.error: 
      self.fatal_error("Unable to contact this server, sorry.")

    if response.code == 200:
      response.request.inspector.setFavicon(response.body)
    else:
      response.request.inspector.setFavicon(None)
    if response.request.inspector.isDone():
      self.renderInstall(response.request.inspector)
  
  def on_index_response(self, response):
    if response.error: 
      self.fatal_error("Unable to contact this server, sorry.")

    if response.code == 200:
      response.request.inspector.setIndexPage(response.body)
    else:
      response.request.inspector.setIndexPage(None)

    if response.request.inspector.isDone():
      self.renderInstall(response.request.inspector)

  def renderInstall(self, inspector):
    manifest = inspector.renderManifest()
    print json.dumps(manifest)
    tornado.ioloop.IOLoop.instance().stop()	

  def fatal_error(self, error_string):
    print json.dumps({
      "status": "error",
      "details": error_string
    })
    tornado.ioloop.IOLoop.instance().stop()    
    raise SystemExit(1)
	
if len(sys.argv) != 2:
    print json.dumps({
      "status": "error",
      "details": "missing required url parameter"
    })
    raise SystemExit(1)

url = sys.argv[1] 

appifier = AppifyAppHandler()
appifier.appify(url)
tornado.ioloop.IOLoop.instance().start()

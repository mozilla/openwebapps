#!/usr/bin/env python
#
import tornado.httpserver
import tornado.auth
import tornado.ioloop
import tornado.httpclient
import tornado.web
import logging
import os
import urllib
import urlparse
import json

class GetManifestHandler(tornado.web.RequestHandler):
  @tornado.web.asynchronous
  def get(self):
    url = self.get_argument("url", None)
    if not url:
      self.set_status(400)  # 400 Bad Request
      self.write("""{"status":"error", "message":"Missing required 'url' parameter"}""")
      self.finish()
      return

    # TODO Check for cached copy (use normal web cache-control semantics)
    # Also, we could apply a blacklist here if we have known bad actors.
    http = tornado.httpclient.AsyncHTTPClient()
    http.fetch(url, callback=self.on_response)

  def on_response(self, response):
    if response.error:
      self.set_status(502)  # 502 Bad Gateway
      message = str(response.error)
      url = response.request.url
      self.write(json.dumps(dict(
        status="error",
        message="Unable to contact remote server (%s): %s" % (url, message))))
      self.finish()
      return

    # Parse it and make sure it's valid
    try:
      logging.error(response.body)
      manifest = json.loads(response.body)
      # TODO Validate manifest schema?
      # TODO Should we reserialize or pass through verbatim?  Verbatim allows hashing
      # but might allow sneaky content encoding trickery.
      if "Content-Type" in response.headers:
        self.set_header("Content-Type", response.headers["Content-Type"])
      self.write(json.dumps(manifest))
    except Exception, e:
      logging.exception(e)
      self.set_status(500)  # 500 Server Error (not quite right?)
      self.write("""{"status":"error", "message":"Application manifest is malformed."}""")
    self.finish()

settings = {
  "static_path": os.path.join(os.path.dirname(__file__), "static"),
  "debug":True
}

application = tornado.web.Application([
    (r"/getmanifest", GetManifestHandler)
	], **settings)


def run():
  http_server = tornado.httpserver.HTTPServer(application)
  http_server.listen(8700)
  tornado.ioloop.IOLoop.instance().start()

if __name__ == '__main__':
  logging.basicConfig(level = logging.DEBUG)
  run()

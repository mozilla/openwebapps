import json
import os
from oauth import oauth
from cStringIO import StringIO
import tornado.httpserver
import tornado.auth
import tornado.ioloop
import tornado.web
import urllib
import urllib2
import poster
import httplib

from dropbox import client, rest, auth
import webconfig

SERVER_BASE = "http://localhost:8500"

# A NOTE ON SECURITY
#
# For this demonstration, our server application sees the username and password of
# the user.  This is NOT how we want it to work - in a real deployment, this server
# would be provided by Dropbox itself, so the user's credentials would only be
# shared with the Dropbox server.

config = auth.Authenticator.load_config("config.ini")

class NamedCStringIO(object):
  def __init__(self, data):
    self.inner = StringIO(data)
    self.name = None

  def fileno(self):
    raise AttributeError("can't do that")
  def seek(self, a, b=None):
    return self.inner.seek(a, b)
  def tell(self):
    return self.inner.tell()
  

class MyDropboxClient(client.DropboxClient):
  def put_named_data(self, root, to_path, file_name, data):
      """
      Exactly the same as put_file, but with a provided name.
      """
      assert root in ["dropbox", "sandbox"]

      path = "/files/%s%s" % (root, to_path)

      params = { "file" : file_name, }
      url, headers, params = self.request(self.content_host, "POST", path, params, None)

      # params['file'] = {poster.encode.MultipartParam("file",  data
      data, mp_headers = poster.encode.multipart_encode([
        poster.encode.MultipartParam("file",  data, file_name, len(data))
      ])
      
      # logging.debug(params)
      if 'Content-Length' in mp_headers:
          mp_headers['Content-Length'] = str(mp_headers['Content-Length'])
      headers.update(mp_headers)

      conn = httplib.HTTPConnection(self.content_host, self.port)
      conn.request("POST", url, "".join(data), headers)

      resp = rest.RESTResponse(conn.getresponse())
      conn.close()
      return resp


class DropboxRequestHandler(tornado.web.RequestHandler):
  pass

class IndexHandler(DropboxRequestHandler):
  def get(self):
    self.render("dropbox_storage_index.htm")

class WebappManifestHandler(DropboxRequestHandler):
  def get(self):
    self.set_header("Content-Type", "application/x-web-app-manifest+json")
    self.render("dropbox_storage.webapp")

class ServiceHandler(DropboxRequestHandler):
  def get(self):
    self.render("dropbox_storage_service.htm")
  
class AuthorizeRedirectHandler(DropboxRequestHandler):
  def get(self):
    dba = auth.Authenticator(config)
    token = dba.obtain_request_token();# synchronous, boo
    url = dba.build_authorize_url(token, callback="%s/auth_callback" % SERVER_BASE)
    self.redirect(url)

class AuthorizeCallbackHandler(DropboxRequestHandler):
  def get(self):
    logging.debug("AuthorizeCallbackHandler: %s" % self)
    verif_token = self.get_argument("oauth_token")
    logging.debug("AuthorizeCallbackHandler: token is %s" % verif_token)
    dba = auth.Authenticator(config)

    tokenObj = oauth.OAuthToken(verif_token, config['consumer_secret']) #  oauth.OAuthToken.from_string(data)


    access_token = dba.obtain_access_token(tokenObj, "") # empty verifier as required by docs
    self.render("authed.htm", access_token = access_token)
    
  
class GetTokenHandler(DropboxRequestHandler):
  def post(self):
    username = self.get_argument("u")
    password = self.get_argument("p")

    dba = auth.Authenticator(config)
    try:
      access_token = dba.obtain_trusted_access_token(username, password)
    except AssertionError, ae:
      # currently assuming this is a bad account
      self.write("""{"status":"error", "msg":"Invalid Dropbox username/password"}\n""")
      return
    except Exception, e:
      self.write("""{"status":"error", "msg":"Networking error"}\n""")
      return
    self.write("""{"status":"ok", "token": "%s"}""" % access_token)
    

class PutFileHandler(DropboxRequestHandler):
  def post(self):
    token = self.get_argument("token")
    filename = self.get_argument("name")
    data = self.get_argument("data")

    tokenObj = oauth.OAuthToken.from_string(token)
    dba = auth.Authenticator(config)
    db_client = MyDropboxClient(config['server'], config['content_server'], config['port'], dba, tokenObj)
    root = config['root']

    target_dir = "/"
    resp = db_client.put_named_data(root, target_dir, filename, unicode(data))
    
    if resp.status == 200:
      self.write("""{"status":"ok"}\n""")
    else:
      logging.error(resp.body)
      self.write("""{"status":"error", "msg":"Error %d while talking with Dropbox"}\n""" % resp.status)
    
##################################################################
# Main Application Setup
##################################################################

settings = {
    "static_path": os.path.join(os.path.dirname(__file__), "static"),
    "cookie_secret": webconfig.cookie_secret,
    "login_url": "/login",
    "debug":True,
    "xheaders":True,
#    "xsrf_cookies": True,
}

application = tornado.web.Application([
    (r"/auth", AuthorizeRedirectHandler),
    (r"/auth_callback", AuthorizeCallbackHandler),
    (r"/token", GetTokenHandler),
    (r"/put", PutFileHandler),
    (r"/service", ServiceHandler),
    (r"/dropbox_storage.webapp", WebappManifestHandler),
    (r"/", IndexHandler),
	], **settings)


def run():
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(8500)
    
    print "Starting server on 8500"
    tornado.ioloop.IOLoop.instance().start()
		
import logging
import sys
if __name__ == '__main__':
	if '-test' in sys.argv:
		import doctest
		doctest.testmod()
	else:
		logging.basicConfig(level = logging.DEBUG)
		run()

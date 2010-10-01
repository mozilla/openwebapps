#!/usr/bin/env python
#
import tornado.httpserver
import tornado.ioloop
import os.path
import tornado.web
import logging
import config
import sys

# This is the ID that we were assigned when we listed our application in the
# Mozilla demonstration app store.
MOZILLA_STORE_APP_ID = 1

# Simple base class for web handlers:
class WebHandler(tornado.web.RequestHandler):
  def get_current_user(self):
    return self.get_secure_cookie("uid")

  def get_error_html(self, status_code, **kwargs):
    self.render("error.html", code = status_code, message = kwargs['exception'])
            

# A simple object to keep track of the stores we're selling through
class StoreRegistry(object):

  # We simply hard-code our stores here; new distribution deals
  # are quite uncommon so we'll avoid fancy data structures here.
  def verify_request(self, request):
    if request.get_argument("moz_store.status", None):
      return self.verify_moz_store(request)
    return None
    
    
  # Mozilla demonstration app store: a simple token with RSA-SHA1 signature
  def verify_moz_store(self, request):
    status = request.get_argument("moz_store.status", None)
    if status == "ok":
      verification_token = self.get_argument("verification")
      signature = self.get_argument("signature")

      # Simple single-key crypto verification routine here; replace with a more
      # sophisticated cert management as needed.
      if crypto.verify_verification_token(verification_token, signature):
        # Signature checks out - now check app ID and timestamp
        appID, userID, timestamp = verification_token.split("|")

        if appID != MOZILLA_STORE_APP_ID:
          logging.info("Store verification failure: application ID should be %d" % appID)
          return None
          
        time = datetime.datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%S.%f")
        now = datetime.datetime.now()
        logging.error("Parsed time to %s" % time)

        # Allow up to 5 minutes of clock drift
        delta = abs(now - time)
        if delta.days > 0 or delta.seconds > 300:
          logging.info("Store verification failure: timestamp is %d seconds from current time." % delta )
          return None

        return userID
      else:
        # signature does not match
        logging.info("Store verification failure: token is %s; signature does not verify" % verification_token)
        return None

  

class MainHandler(WebHandler):

  def get(self):
    # A request at our front page could be:
    #   A user-agent arriving from the internet who knows nothing about the app
    #   A user that has installed the app, arriving "cold"
    #   A user returning from a store bearing a validation token
    #   A user that has previously arrived bearing a validation token, returning with a cookie
    #     (in this example, we simply accept the cookie.  we could time-limit it, or
    #      put the IP address into a hash and revalidate if the user arrives on a new IP)
  
    user_id = None
    verifiedUser = StoreRegistry().verify_request(self)
    if verifiedUser: # we just got a new validation; that overrides any previous data
      self.set_secure_cookie(str("ttracker_uid", verifiedUser))

      # and redirect the user to this page so they don't accidentally bookmark the validation
      self.redirect("/")
      return
    else:
      cookie_user = self.get_secure_cookie("ttracker_uid")
      if cookie_user:
        user_id = cookie_user
      else:
        # no verification in the request, no cookie - we don't know who this is yet.
        # We'll ask the browser to check for an install when we render the page
        pass

    if user_id:
      self.render("user_index.html", user_id = user_id)
    else:
      self.render("no_user_index.html")


##################################################################
# Main Application Setup
##################################################################

settings = {
    "static_path": os.path.join(os.path.dirname(__file__), "static"),
    "cookie_secret": config.cookie_secret,
    "login_url": "/login",
    "debug":True,
}

application = tornado.web.Application([
    (r"/", MainHandler),
 
	], **settings)


def run():
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(8500)
    tornado.ioloop.IOLoop.instance().start()
		
if __name__ == '__main__':
  logging.basicConfig(level = logging.DEBUG)
  run()
	
	
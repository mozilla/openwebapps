"""
 crypto.py
 
 crypto functions for demonstration Web App Store
 
>>> verify_verification_token("user|appid|timestamp", sign_verification_token("user|appid|timestamp"))
True
>>> verify_verification_token("user|appid|timestamp", sign_verification_token("user|appid|timestamp").replace("a","b"))
False

"""

from M2Crypto import BIO, RSA, EVP

pubkey = None
privkey = None

try:
  pubkey = EVP.PKey()
  pubkey.assign_rsa(RSA.load_pub_key("pubkey.pem"))
except Exception, e:
  pass
  
try:
  privkey = EVP.load_key("privkey.pem")
except Exception, e:
  pass


def sign_verification_token(verificationToken):
  privkey.sign_init()
  privkey.sign_update(verificationToken)
  signature = privkey.sign_final()
  return signature
  
def verify_verification_token(verificationToken, signature):
  # we are using RSA-SHA1
  pubkey.reset_context(md='sha1')
  pubkey.verify_init()
  pubkey.verify_update(verificationToken)
  
  result = pubkey.verify_final(signature)  
  # result of 1 means signature checked out
  
  return (result == 1)


import logging
import sys
if __name__ == '__main__':
  import doctest
  doctest.testmod()

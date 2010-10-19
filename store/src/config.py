import os
import os.path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Example values include 
#   "sqlite:///:memory:"

echo = False
if 'CONFIG_SQLALCHEMY_ECHO' in os.environ:
  echo = os.environ['CONFIG_SQLALCHEMY_ECHO'] == "true"

engine = create_engine(os.environ['CONFIG_SQLALCHEMY'], echo=echo, pool_recycle=120, echo_pool=True)

Session = sessionmaker(bind=engine)
session = Session()

# If store.cfg exists, we will get cookie_secret from it;
# otherwise we will use a trivial secret.  Never run in
# production with the trivial secret.
try:
  f = open("../store.cfg/cookie_secret")
  cookie_secret = f.read()
  f.close()
except:
  cookie_secret = "E57AF6AA-F756-4EC7-A48B-883507DC84A6"

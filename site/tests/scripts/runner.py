from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.keys import Keys
import os
import site
import subprocess
import time
import platform 
import sys

test_files = ['typed-storage.html','manifest.html', 'conduits.html','repo_api.html']
node_server = os.environ.get('NODE_SERVER') 
jstest_server = os.environ.get('JSTESTS_SERVER')
browser_types = os.environ.get('BROWSERS').split(',') 
browsers = []

def get_url():
  return jstest_server + 'work'

def get_browser(browser_type):
  browser = None
  if (browser_type == 'extension'):
     profile = webdriver.FirefoxProfile()
     profile.add_extension(os.environ.get('WORKSPACE') + "/openwebapps.xpi")
     profile.set_preference("general.useragent.override", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.6; rv:8.0) Gecko/20100101 firefox/100.0")
     browser = webdriver.Firefox(profile) # Load Extension, and get local session of firefox
     browser.get(get_url()) # Load pagea
     browser_types[browser_types.index('extension')] = 'firefox'

  elif (browser_type == 'ie'):
     browser = webdriver.ie() # Currently we haven't implemented this as of yet 
     browser.get(get_url()) # Load page
  elif (browser_type == 'firefox'):
     browser = webdriver.Firefox() # Get local session of firefox
     browser.get(get_url()) # Load page
  elif (browser_type == 'chrome'):
     browser = webdriver.Chrome() # Get local session of Chrome
     browser.get(get_url()) # Load page
  return browser

def run_test(name,args):
  foo = subprocess.call("python run_jstests.py --jstests-url " + 
                  "http://" + node_server + ":60172/tests/spec/" +
                  name +
                  "?runnerType=jstestnet " +
                  "--xunit-file=nosetests.xml " + args, shell=True)
  return int(foo)
def test_args():
  args = '-v --with-xunit --with-jstests --jstests-server ' + jstest_server + \
         ' --jstests-suite typed --jstests-token $JSTESTS_TOKEN --jstests-browsers ' + \
         ','.join(browser_types) + ' --debug nose.plugins.jstests'
  return args

for browser_type in browser_types:
  browsers.append(get_browser(browser_type))

for browser in browsers:
  assert "Test Worker" in browser.title

time.sleep(3)

exit_code = 0 


for test_file in test_files:
  try:
    exit_code += run_test(test_file,test_args())
    print exit_code
  except:
    exit_code = 1
    print "Error running test file:" + test_file

for browser in browsers:
  browser.quit()

sys.exit(exit_code)

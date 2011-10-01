# This script should be called from within Hudson

VENV=$WORKSPACE/venv
LOG=$WORKSPACE/jstests-runserver.log

echo "Starting build on executor $EXECUTOR_NUMBER..." `date`


if [ ! -d "$VENV/bin" ]; then
echo "No virtualenv found. Making one..."
  virtualenv $VENV
fi

source $VENV/bin/activate

# Create paths we want for addons

echo "Installing Jstestnetlib Requirements" 
pushd $WORKSPACE/openwebapps/site/tests/jstestnetlib && pip install -q -r requirements.txt
popd

echo "Starting nodejs "


cd $WORKSPACE/openwebapps/site/tests/ 
forever stop 0 
sleep 4
forever start run.js
echo "Starting JS tests..." `date`


cd $WORKSPACE/openwebapps/site/tests/scripts
# Some of these env vars are set in the Jenkins build step.
BROWSERS=firefox
XARGS="-v --with-xunit --with-jstests --jstests-server $JSTESTS_SERVER --jstests-suite typed --jstests-token $JSTESTS_TOKEN --jstests-browsers $BROWSERS --debug nose.plugins.jstests"
echo '**************** /qunit/ ****************'
python run_jstests.py --jstests-url http://$HOSTNAME:60172/tests/spec/typed-storage.html?runnerType=jstestnet --xunit-file=nosetests.xml $XARGS
python run_jstests.py --jstests-url http://$HOSTNAME:60172/tests/spec/manifest.html?runnerType=jstestnet --xunit-file=nosetests.xml $XARGS
python run_jstests.py --jstests-url http://$HOSTNAME:60172/tests/spec/conduits.html?runnerType=jstestnet --xunit-file=nosetests.xml $XARGS
pushd $WORKSPACE/openwebapps/site/tests/ && forever stop 0

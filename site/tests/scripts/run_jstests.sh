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

pushd $WORKSPACE/site/tests/jstestnetlib && pip install -r requirements.txt && python setup.py install
popd

pip install -U selenium

echo "Starting nodejs "


pushd $WORKSPACE/site/tests 
forever stop 0 
sleep 4
forever start run.js -ip $NODE_SERVER
popd
echo "Starting JS tests..." `date`

cd $WORKSPACE/site/tests/scripts
# Some of these env vars are set in the Jenkins build step.
if [ -z "$BROWSERS" ]; then
  BROWSERS="firefox"
fi
XARGS="-v --with-xunit --with-jstests --jstests-server $JSTESTS_SERVER --jstests-suite typed --jstests-token $JSTESTS_TOKEN --jstests-browsers $BROWSERS --debug nose.plugins.jstests"
echo "******** $BROWSERS  ******** launching browsers & running the unit tests"
python runner.py 

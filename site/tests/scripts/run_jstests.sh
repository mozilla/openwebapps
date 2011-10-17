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

echo "Starting nodejs "


pushd $WORKSPACE/site/tests 
forever stop 0 
sleep 4
forever start run.js
popd
echo "Starting JS tests..." `date`

cd $WORKSPACE/site/tests/scripts
# Some of these env vars are set in the Jenkins build step.
if [ -z "$BROWSERS" ]; then
  BROWSERS="firefox"
fi
XARGS="-v --with-xunit --with-jstests --jstests-server $JSTESTS_SERVER --jstests-suite typed --jstests-token $JSTESTS_TOKEN --jstests-browsers $BROWSERS --debug nose.plugins.jstests"
echo "******** $BROWSERS  ******** running the unit tests"
A=python run_jstests.py --jstests-url http://$HOSTNAME:60172/tests/spec/typed-storage.html?runnerType=jstestnet --xunit-file=nosetests.xml $XARGS
B=python run_jstests.py --jstests-url http://$HOSTNAME:60172/tests/spec/manifest.html?runnerType=jstestnet --xunit-file=nosetests.xml $XARGS
C=python run_jstests.py --jstests-url http://$HOSTNAME:60172/tests/spec/conduits.html?runnerType=jstestnet --xunit-file=nosetests.xml $XARGS
D=python run_jstests.py --jstests-url http://$HOSTNAME:60172/tests/spec/repo_api.html?runnerType=jstestnet --xunit-file=nosetests.xml $XARGS
forever stop 0
E=`expr $A + $B + $C + $D`
echo "Exit Code: $E"
exit $E

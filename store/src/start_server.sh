#!/bin/bash

echo "trying to pull in database credentials"
. ../creds.sh

echo "starting server..."
python server.py 2>&1 > ../tornado.log &
echo $! > ../tornado.pid
disown

#!/bin/bash

echo "trying to pull in database credentials"
. ../creds.sh

echo "starting server..."
python server.py > ../tornado.log 2>&1 &
echo $! > ../tornado.pid
disown

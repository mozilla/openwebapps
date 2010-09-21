#!/bin/bash

echo "starting server..."
python server.py 2>&1 > ../tornado.log &
echo $! > ../tornado.pid
disown

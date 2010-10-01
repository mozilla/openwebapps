#!/bin/bash
# Trivial control daemon...

echo "stopping server..."
echo "killing pid: " `cat ../tornado.pid`
kill `cat ../tornado.pid`
echo success: $?
rm ../tornado.pid

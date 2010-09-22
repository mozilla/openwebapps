#!/bin/bash

echo "stopping server..."
echo "killing pid: " `cat ../tornado.pid`
kill `cat ../tornado.pid`
echo success: $?
rm ../tornado.pid

#!/bin/bash

if [ ! -d jslibs ]; then
    mkdir jslibs
fi
cp ../../jslibs/{repo,eventmixin,jquery-1.4.4.min,manifest,urlmatch}.js jslibs

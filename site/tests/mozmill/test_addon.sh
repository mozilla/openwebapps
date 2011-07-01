#!/bin/sh

pwd=`pwd`

echo 'Creating XPI from source'

cd ../../../addons/jetpack
cfx xpi
cp openwebapps.xpi $pwd
cd $pwd

echo 'Starting MozMill'
mozmill --addons=openwebapps.xpi -t repo_api_jetpack.js


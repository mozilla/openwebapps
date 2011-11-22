#!/bin/sh
##
## testy.sh
##
## Made by Ian Bicking
## Login   <ianb@ianb-T>
##
## Started on  Tue Nov 15 13:57:03 2011 Ian Bicking
## Last update Tue Nov 15 13:57:03 2011 Ian Bicking
##

set -e

dir=$(pwd)/..
version=$(cat VERSION)
mkdir -p ~/tmp/
cd ~/tmp
rm -rf myapps
mkdir myapps
cd myapps
mkdir myapps-$version
cd myapps-$version
cp -L -r $dir/* .
find . -name .git -o -name '#*' -exec rm {} \;
rm -rf tests
cd ..
rm -f ~/rpmbuild/SOURCES/myapps*
rm -rf /home/ianb/rpmbuild/BUILDROOT/myapps-*
tar cfz ~/rpmbuild/SOURCES/myapps-$version.tar.gz myapps-$version
cd $dir/tools
rpmbuild -ba -v myapps.spec

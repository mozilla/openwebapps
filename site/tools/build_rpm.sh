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
rpms=$dir/../rpms
version=$(cat VERSION)
buildroot=/tmp/rpmbuild

rm -rf ../../rpms
mkdir ../../rpms
rm -rf $buildroot
mkdir -p $buildroot

cd $buildroot
mkdir BUILD
mkdir BUILDROOT
mkdir RPMS
mkdir SOURCES
mkdir SPECS
mkdir SRPMS
mkdir myapps

cd myapps
mkdir myapps-$version
cd myapps-$version
cp -L -r $dir/* .
find . -name .git -o -name '#*' -exec rm {} \;
rm -rf tests
cd ..
rm -f $buildroot/SOURCES/myapps*
rm -rf $buildroot/BUILDROOT/myapps-*
tar cfz $buildroot/SOURCES/myapps-$version.tar.gz myapps-$version
cd $dir/tools
rpmbuild -ba --buildroot $buildroot -v myapps.spec

mv $buildroot/RPMS/*.rpm $rpms/

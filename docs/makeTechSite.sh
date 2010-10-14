#!/bin/bash

pages=( tech_intro manifest app_repo web_or_native mobile verification security integration )
titles=( "Introduction" "Application Manifests" "Application Repositories" "Web vs. Browser Repositories" "Mobile Platforms" "Registered and Paid Apps" "Security and Privacy" "Integration Between Apps" )
count=0

for page in ${pages[@]}
do
echo "<html><head><title>Installable Web Applications: " > $page.html
echo ${titles[${count}]} >> $page.html
echo "</title>" >> $page.html
cat techSiteHeader.html >> $page.html
echo "<style>.nav$page {font-weight:bold}</style>" >> $page.html
markdown `echo $page | tr "[:lower:]" "[:upper:]"`.md >> $page.html
cat techSiteFooter.html >> $page.html
count=$count+1
done


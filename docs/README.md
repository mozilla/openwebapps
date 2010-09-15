# Installable Web Applications - An Overview

"Bookmarks" are the primary tool available today to help users manage
the collection of sites that they are interested in.  Bookmarks are a
good mechanism, but lack granularity -- there's a huge difference
between a site the user visits several times every day (like their
webmail, facebook, or twitter), and a site that "may potentially be
useful in the future".  Bookmarks seem to be optimized for the latter
case, leaving us without tools for managing our most important websites.

Enter *Installable Web Applications* (IWAs).  For the sites that are
most important to a user, she may now "install them".  Installing a
web app makes it easier to access via prominent buttons in your
browser, and also indicates to the browser that this site is important
to you.  This makes it easier to search your content within the site,
lets the site push you notifications, and more.

This document is to serve as a technical overview of what an
installable web application consist of and is capable of, so that you
might build one yourself.

## Goals

Mozilla's effort to help define what installable web applications are is
technically motivated by the following goals:

1. *Portability* - Modern browsers support amazing things.  We will
   not needlessly lock neither the platforms to support IWAs nor the
   IWAs themselves to any one browser.

2. *Minimalism* - The Web Is Enough to make great applications.  Our
   goal is to add a minimal amount of packaging around existing
   websites to support a great user experience.

3. *Standards & Precedent* - Wherever prudent and possible we'll use
   other folks ideas about how to represent, communicate, and secure
   information.

## Target Browser Support

At present, the IWA platform and applications require the following technologies to
function:

1. [local storage](http://dev.w3.org/html5/webstorage/)
2. [cross document messaging](http://dev.w3.org/html5/postmsg/#web-messaging)
3. [native JSON parsing](http://wiki.ecmascript.org/doku.php?id=es3.1:json_support)
4. (OPTIONAL) [canvas](http://www.w3.org/TR/html5/the-canvas-element.html)
5. (OPTIONAL) Application tabs

Given these requirements, we'll initially support the following browsers:
IE8+, Chrome 5+, Firefox 3.6+, latest Opera, and latest Safari.

## The Ecosystem

In the world we envision, there are several distinct entities:

<dl>
<dt>Stores</dt>
<dd> These are web front stores that users may have a direct relationship with.
These stores host directories of free and/or paid applications that users may
install.  There can be any number of application stores run by entities ranging
from hobbyists to corporations.  Each store will establish its own policies
around application publishing and interaction with developers.  Finally, where 
required stores will 

</dd>

<dt>IWAs</dt>
<dd> 
Installable Web Applications are hosted web applications.  They can be
installed via any number of application stores, or can be installed
directly from any informal webpage.  All web applications are
*hosted*, so the resources that comprise the application all reside undern
</dd>

<dt>(Application) Dashboard</dt>
<dd> A tool that lets the user interact with, manage, and launch their
installed applications.  The dashboard can be implemented entirely as
a web site, or can be enriched with UA "add-ons" or native UA support.
</dd>
</dl>

## Further Reading

IWA.md - an introduction to the components of Installable Web Applications.

DASHBOARD.md - an introduction to the application dashboard, including the various
ways to interact with it.

STORES.md - topics important to the authors of IWA stores

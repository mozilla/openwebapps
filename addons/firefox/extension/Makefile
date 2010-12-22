#
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Weave code.
#
# The Initial Developer of the Original Code is
# Mozilla Corporation
# Portions created by the Initial Developer are Copyright (C) 2008
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Dan Mills <thunder@mozilla.com> (original author)
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

ifeq ($(TOPSRCDIR),)
  export TOPSRCDIR = $(shell pwd)
endif

# Build into "dist", construct staging in "stage", package into "xpi"
objdir=$(TOPSRCDIR)/dist
stage_dir=$(objdir)/stage
xpi_dir=$(objdir)/xpi
error=exit 1

# Must match install.rdf
openwebapps_version := 0.1

# We serve the update from mhanson's personal directory right now.
ifeq ($(release_build),)
  xpi_type := dev
  update_url := https://people.mozilla.com/~mhanson/contacts/update.rdf
else
  xpi_type := rel
  update_url :=
endif

ifeq ($(update_url),)
  update_url_tag :=
else
  update_url_tag := <em:updateURL>$(update_url)</em:updateURL>
endif

xpi_name := openwebapps-$(openwebapps_version)-$(xpi_type).xpi
xpi_files := chrome chrome.manifest components defaults install.rdf modules

ifeq ($(buildid),)
  date    := $(shell date -u +%Y%m%d%H%M)
  buildid := $(date)
  buildid_short := $(date)
endif

ifeq ($(MAKECMDGOALS),xpi)
  unpacked =\#
  jar=
  chrometarget=xpi
else
  unpacked=
  jar=\#
  chrometarget=
endif

subst_names := \
  openwebapps_version \
  compatible_version \
  buildid \
  buildid_short \
  server_url \
  update_url \
  update_url_tag \
  unpacked \
  jar
export $(subst_names)
export substitute = perl -pe 's/@([^@]+)@/defined $$$$ENV{$$$$1} ? $$$$ENV{$$$$1} : $$$$&/ge'

SLINK = ln -sf
ifneq ($(findstring MINGW,$(shell uname -s)),)
  SLINK = cp -r
  export NO_SYMLINK = 1
endif

all: build

.PHONY: setup build test xpi clean $(xpi_files)

test: build
	$(MAKE) -k -C tests/unit

setup:
	mkdir -p $(objdir)
	mkdir -p $(stage_dir)
	mkdir -p $(xpi_dir)

build: setup
	mkdir -p $(stage_dir)/components
	cp -r components/* $(stage_dir)/components
	test -d $(stage_dir)/chrome || $(SLINK) $(TOPSRCDIR)/chrome $(stage_dir)/chrome
	test -d $(stage_dir)/chrome.manifest || $(SLINK) $(TOPSRCDIR)/chrome.manifest $(stage_dir)/chrome.manifest
	test -d $(stage_dir)/components || $(SLINK) $(TOPSRCDIR)/components $(stage_dir)/components
	test -d $(stage_dir)/defaults || $(SLINK) $(TOPSRCDIR)/components $(stage_dir)/defaults
	test -d $(stage_dir)/install.rdf || $(SLINK) $(TOPSRCDIR)/install.rdf $(stage_dir)/install.rdf
	test -d $(stage_dir)/modules || $(SLINK) $(TOPSRCDIR)/modules $(stage_dir)/modules

xpi: build
	rm -f $(xpi_dir)/$(xpi_name)
	cd $(stage_dir);zip -9r $(xpi_name) $(xpi_files)
	mv $(stage_dir)/$(xpi_name) $(xpi_dir)/$(xpi_name)

clean:
	rm -rf $(objdir)
	$(MAKE) -C native clean

help:
	@echo Targets:
	@echo build
	@echo "test (runs tests, runs a build first)"
	@echo "xpi (sets manifest to use jars, make build to undo)"
	@echo clean
	@echo
	@echo Variables:
	@echo sdkdir
	@echo "release_build (set to 1 when not building a snapshot)"
	@echo "rebuild_native (set to 1 when building a new native binary)"
	@echo
	@echo Substitutions for .in files:
	@echo $(subst_names)

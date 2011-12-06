PYTHON = python

MAKELAUNCHER =
SYS := $(shell uname -s)
ifeq ($(SYS), Darwin)
	MAKELAUNCHER := ${MAKE} -C addons/jetpack/mac/
endif

ifeq ($(TOPSRCDIR),)
  export TOPSRCDIR = $(shell pwd)
endif
profile :=
ifneq ($(OWA_PROFILE),)
  profile := --profiledir="$(OWA_PROFILE)"
endif

deps  := $(TOPSRCDIR)/deps
ifneq ($(DEPSDIR),)
  deps := $(DEPSDIR)
endif

binary  := 
ifneq ($(MOZ_BINARY),)
  binary := -b "$(MOZ_BINARY)"
endif

addon_sdk := $(deps)/addon-sdk/bin
oauthorizer := $(deps)/oauthorizer
openwebapps := $(TOPSRCDIR)/addons/jetpack
activities := $(TOPSRCDIR)/addons/activities

ifeq ($(TARGET),activities)
  pkgdir := $(activities)
  cfx_args :=  --pkgdir=$(pkgdir) $(binary) $(profile) --package-path=$(oauthorizer) --package-path=$(openwebapps) --binary-args="-console -purgecaches $(BINARYARGS)"
else
  pkgdir := $(openwebapps)
  cfx_args :=  --pkgdir=$(pkgdir) $(binary) $(profile) --binary-args="-console -purgecaches $(BINARYARGS)"
endif
native_xpi := 

test_args :=
ifneq ($(TEST),)
    test_args := -f $(TEST)
endif

# might be useful for symlink handling...
SLINK = ln -sf
ifneq ($(findstring MINGW,$(shell uname -s)),)
  SLINK = cp -r
  export NO_SYMLINK = 1
endif

all: xpi

# this step builds a jetpack, which strips down to the files from addon-sdk
# that we actually use, then extracts that into our XUL app template
nativeapp:
	$(addon_sdk)/cfx xpi --pkgdir=$(TOPSRCDIR)/addons/nativeapp
	mkdir -p $(openwebapps)/data/native-install/XUL/app-sdk
	unzip -o nativeapp.xpi -x install.rdf -d $(openwebapps)/data/native-install/XUL/app-sdk/
# -x harness-options.json install.rdf bootstrap.js 

xpi:    pull
	$(addon_sdk)/cfx xpi $(cfx_args)

pull:
	$(PYTHON) build.py -p $(pkgdir)/package.json
	$(MAKELAUNCHER)
	nativeapp

test:
	$(addon_sdk)/cfx test -v $(cfx_args) $(test_args)

run: nativeapp
	$(MAKELAUNCHER)
	$(addon_sdk)/cfx run $(cfx_args)	

build_rpms:
	cd site/tools; ./build_rpm.sh

.PHONY: xpi clean pull test run build_rpms

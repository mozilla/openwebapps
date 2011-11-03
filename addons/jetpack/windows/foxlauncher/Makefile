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
# The Original Code is Open Web Apps for Firefox.
#
# The Initial Developer of the Original Code is The Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2011
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Tim Abraldes <tabraldes@mozilla.com>
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
# ***** END LICENSE BLOCK ***** */

CC = cl
LINK = link
MANIFEST_TOOL = mt
CP = cp

FINAL_PATH = ../../data/native-install/windows
OUTPUT_FILENAME = Foxlauncher.exe

SRCS = \
foxlauncher

CPP_FILES = $(foreach file,$(SRCS),$(file).cpp)

OBJ_FILES = $(foreach file,$(SRCS),$(file).obj)

PREPROC_DEFINES_SHARED = \
-DWIN32=1 \
-D_WINDOWS=1 \
-D_UNICODE=1 \
-DUNICODE=1

PREPROC_DEFINES_DEBUG = $(PREPROC_DEFINES_SHARED) \
-D_DEBUG=1

PREPROC_DEFINES_RELEASE = $(PREPROC_DEFINES_SHARED)

COMPILER_FLAGS_SHARED = \
-nologo \
-c \
-EHa \
-W4 \
-WX \
-Zi \
-errorReport:none

COMPILER_FLAGS_DEBUG = $(COMPILER_FLAGS_SHARED) \
-Od \
-MDd

COMPILER_FLAGS_RELEASE = $(COMPILER_FLAGS_SHARED) \
-O1 \
-Os \
-MD

LINKER_FLAGS_SHARED = \
-NOLOGO \
-DYNAMICBASE \
-SUBSYSTEM:WINDOWS \
-MANIFEST \
-MANIFESTUAC:"level='asInvoker' uiAccess='false'" \
-ERRORREPORT:NONE

LINKER_FLAGS_DEBUG = $(LINKER_FLAGS_SHARED) \
-DEBUG

LINKER_FLAGS_RELEASE = $(LINKER_FLAGS_SHARED) \
-INCREMENTAL:NO

LINK_LIBS = \
Shell32.lib

MANIFEST_OPTIONS = \
-nologo \
-manifest $(OUTPUT_FILENAME).manifest \
-outputresource:"$(OUTPUT_FILENAME);\#1"

debug:
	$(CC) $(COMPILER_FLAGS_DEBUG) $(PREPROC_DEFINES_DEBUG) $(CPP_FILES)
	$(LINK) $(LINKER_FLAGS_DEBUG) $(LINK_LIBS) $(OBJ_FILES)
	$(MANIFEST_TOOL) $(MANIFEST_OPTIONS)
	$(CP) $(OUTPUT_FILENAME) $(FINAL_PATH)

release:
	$(CC) $(COMPILER_FLAGS_RELEASE) $(PREPROC_DEFINES_RELEASE) $(CPP_FILES)
	$(LINK) $(LINKER_FLAGS_RELEASE) $(LINK_LIBS) $(OBJ_FILES)
	$(MANIFEST_TOOL) $(MANIFEST_OPTIONS)
	$(CP) $(OUTPUT_FILENAME) $(FINAL_PATH)

# OS
sys := $(shell uname -s)

#ifeq ($(sys), Darwin)
#  os = Darwin
#  compiler = gcc
#  cxx = g++
#  so = dylib
#  teh = Mac
#else
ifeq ($(sys), MINGW32_NT-6.1)
  os = WINNT
  compiler = msvc
  cxx = cl
  so = dll
  teh = Win
#else
#ifeq ($(sys), Linux)
#  os = Linux
#  compiler = gcc
#  cxx = g++
#  so = so
#  teh = Nix
else
  $(error Sorry, your os is unknown/unsupported: $(sys))
endif
#endif
#endif

# Arch
machine := $(shell uname -m)

ifeq ($(machine), i386)
  arch = x86
else
ifeq ($(machine), i586)
  arch = x86
else
ifeq ($(machine), i686)
  arch = x86
else
ifeq ($(machine), x86_64)
  arch = x86
else
  $(error: Sorry, your architecture is unknown/unsupported: $(machine))
endif
endif
endif
endif

# Target and objects
target = libhotkey
so_target = $(target:=.$(so))

# source and path configurations
idl = IGlobalHotkeys.idl
cpp_sources = HotkeyModule.cpp $(os)/GlobalHotkeys.cpp

sdkdir ?= ${MOZSDKDIR}
xpidl = $(sdkdir)/bin/xpidl

# FIXME: we don't actually require this for e.g. clean
ifeq ($(sdkdir),)
  $(warning No 'sdkdir' variable given)
  $(warning It should point to the location of the Gecko SDK)
  $(warning For example: "make sdkdir=/foo/bar/baz")
  $(warning Or set the MOZSDKDIR environment variable to point to it)
  $(error )
endif

idl_headers = $(idl:.idl=.h)
idl_typelib = $(idl:.idl=.xpt)
cpp_objects = $(cpp_sources:.cpp=.o)
so_target = $(target:=.$(so))
cppflags = -DRAINBOW_$(teh)

headers = -I. -I$(os) -I$(sdkdir)/include \
    -I$(sdkdir)/include/system_wrappers \
    -I$(sdkdir)/include/xpcom \
    -I$(sdkdir)/include/string \
    -I$(sdkdir)/include/content \
    -I$(sdkdir)/include/dom \
    -I$(sdkdir)/include/nspr \
    -I$(sdkdir)/sdk/include

# libraries
libdirs := $(sdkdir)/lib $(sdkdir)/bin
libs := xpcomglue_s xpcom nspr4 mozalloc plds4 plc4

# compiler and Linker Flags
ifeq ($(os), WINNT)
  libdirs := $(patsubst %,-LIBPATH:%,$(libdirs))
  libs := $(patsubst %,$(sdkdir)/lib/%.lib,$(libs))

  ifeq ($(debug),1)
    cppflags += -MTd -DDEBUG
    ldops = -DEBUG msvcrtd.lib \
        /NODEFAULTLIB:libcmt /NODEFAULTLIB:msvcrt /NODEFAULTLIB:libcmtd
  else
    cppflags += -MT
    ldops = msvcrt.lib /NODEFAULTLIB:libcmt
  endif

  cppflags += -c -nologo -O1 -GR- -TP -Zc:wchar_t- -W3 -Gy $(headers) \
    -DTRIMMED -D_CRT_SECURE_NO_DEPRECATE=1 \
    -D_CRT_NONSTDC_NO_DEPRECATE=1 -DWINVER=0x500 -D_WIN32_WINNT=0x500 \
    -D_WIN32_IE=0x0500 -DX_DISPLAY_MISSING=1 -DMOZILLA_VERSION=\"1.9pre\" \
    -DMOZILLA_VERSION_U=1.9pre -DHAVE_SNPRINTF=1 -D_WINDOWS=1 -D_WIN32=1 \
    -DWIN32=1 -DXP_WIN=1 -DXP_WIN32=1 -DHW_THREADS=1 -DSTDC_HEADERS=1 \
    -DWIN32_LEAN_AND_MEAN=1 -DNO_X11=1 -DHAVE_MMINTRIN_H=1 \
    -DHAVE_OLEACC_IDL=1 -DHAVE_ATLBASE_H=1 -DHAVE_WPCAPI_H=1 -D_X86_=1 \
    -DD_INO=d_ino -DMOZ_NO_MOZALLOC=1 -EHsc
  ldflags += -DLL -NOLOGO -SUBSYSTEM:WINDOWS -NXCOMPAT -SAFESEH \
    -IMPLIB:fake.lib \
    $(libdirs) $(libs) \
    oleaut32.lib user32.lib advapi32.lib winmm.lib $(ldops)
rcflags := -r $(headers)
endif

######################################################################

.PHONY: all build clean

all: build

build: $(so_target) $(idl_typelib)

clean:
	rm -f $(so_target) $(cpp_objects) \
  $(idl_typelib) $(idl_headers) \
	$(target:=.res) fake.lib fake.exp $(target).pdb $(target).ilk

# rules to build the c headers and .xpt from idl
$(idl_headers): $(idl)
	$(xpidl) -m header -I$(sdkdir)/idl $(@:.h=.idl)

$(idl_typelib): $(idl)
	$(xpidl) -m typelib -I$(sdkdir)/idl $(@:.xpt=.idl)


ifeq ($(os), WINNT)
  $(cpp_objects): $(cpp_sources)
	$(cxx) -Fo$@ -Fd$(@:.o=.pdb) $(cppflags) $(@:.o=.cpp)

  $(so_target): $(idl_headers) $(cpp_objects)
	link -OUT:$@ -PDB:$(@:.dll=.pdb) $(cpp_objects) $(ldflags)
	chmod +x $@
endif


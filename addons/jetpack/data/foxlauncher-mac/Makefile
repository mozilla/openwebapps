LD=gcc
LIBHEADERS =-I/System/Library/Frameworks/AppKit.framework/Headers -I/System/Library/Frameworks/Foundation.framework/Headers 

CFLAGS= -c $(LIBHEADERS) -fPIC -m64 
#				 -isysroot /Developer/SDKs/MacOSX10.6.sdk
# /usr/libexec/gcc/i686-apple-darwin10/4.2.1/cc1 -quiet -v -imultilib x86_64 -D__DYNAMIC__ testmain.c -fPIC -quiet -dumpbase testmain.c 
#-mmacosx-version-min=10.6.7 -m64 -mtune=core2 -auxbase testmain -version -o /var/folders/0A/0A78iplZFxChIh+g37kvY++++TI/-Tmp-//cc2ptuB5.s

LDFLAGS= -dynamic -arch x86_64 -framework CoreFoundation -framework AppKit

# /usr/libexec/gcc/i686-apple-darwin10/4.2.1/collect2 -dynamic -arch x86_64 -macosx_version_min 10.6.7 -weak_reference_mismatches non-weak -o a.out
# -lcrt1.10.6.o -L/usr/lib/gcc/i686-apple-darwin10/4.2.1/x86_64 -L/usr/lib/gcc/i686-apple-darwin10/4.2.1/x86_64 -L/usr/lib/i686-apple-darwin10/4.2.1 -L/usr/lib/gcc/i686-apple-darwin10/4.2.1 -L/usr/lib/gcc/i686-apple-darwin10/4.2.1 -L/usr/lib/gcc/i686-apple-darwin10/4.2.1/../../../i686-apple-darwin10/4.2.1 -L/usr/lib/gcc/i686-apple-darwin10/4.2.1/../../.. /var/folders/0A/0A78iplZFxChIh+g37kvY++++TI/-Tmp-//ccgQ1PXt.o -lSystem 
#-lgcc -lSystem

LIBS = -lc -lobjc -lSystem

OBJS = foxlauncher.o

all: build

clean:
	rm $(OBJS)

build: foxlauncher.o foxlauncher

.m.o:
	gcc $(CFLAGS) $(@:.o=.m)
#-o $@ 
.c.o:
	gcc $(CFLAGS) $(@:.o=.c)
# -o $@

foxlauncher: $(OBJS)
	gcc $(LDFLAGS) $(LIBS) -L. foxlauncher.o -o foxlauncher

.o.a:
	ar rcs $@ $(@:.a=.o)

#iconsetter.dylib:
#	gcc -shared $(LDFLAGS) -o iconsetter.dylib iconsetter.o


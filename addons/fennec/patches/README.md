To build a custom version of Fennec with support for OpenWebApps, you must
apply the patches in this directory to mozilla-central. The easy way to do
this is use mercurial patch queues. To enable mq, add the line

  hgext.mq =

to your .hgrc. Subsequently, copy all the patches in this directory to
.hg/patches/ in your mozilla-central checkout. To apply them:

  hg qpush -a

then build mozilla-central as normal. The .mozconfig for a debug fennec
build is:

  mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/objdir-android

  ac_add_options --with-android-sdk=/path/to/android/platforms/android-8
  ac_add_options --with-android-ndk=/path/to/android/ndk-r4c
  ac_add_options --with-android-tools=/path/to/android/tools

  ac_add_options --enable-application=mobile
  ac_add_options --target=arm-android-eabi
  ac_add_options --with-endian=little

  ac_add_options --disable-tests
  ac_add_options --enable-debug
  ac_add_options --enable-logging
  export MOZ_DEBUG_SYMBOLS=1

Enabling ccache is recommended for faster builds. More detailed instructions
on building fennec is available at: https://wiki.mozilla.org/Mobile/Fennec/Android

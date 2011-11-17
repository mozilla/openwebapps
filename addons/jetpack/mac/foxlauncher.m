#include <stdio.h>
#include <Cocoa/Cocoa.h>
#include <Foundation/Foundation.h>

int main(int argc, char **argv)
{
  NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];
  const char *appdir = [[[NSBundle mainBundle] bundlePath] UTF8String];
  
  char bigBuf[4096];
  snprintf(bigBuf, 4096, "%s/XUL/application.ini", appdir);
  char *newargv[4];
  newargv[0] = "firefox-bin";
  newargv[1] = "-app";
  newargv[2] = bigBuf;
  newargv[3] = NULL;

  NSString *FirefoxRoot = [[NSWorkspace sharedWorkspace] absolutePathForAppBundleWithIdentifier:@"org.mozilla.firefox"];
  
  if (![FirefoxRoot length]) 
  {
    printf("Error: could not locate Firefox");
  }
  else 
  {
    NSString *fullpath = [FirefoxRoot stringByAppendingString: @"/Contents/MacOS/firefox-bin"];
    //printf("Execing: %s %s %s %s\n", [fullpath UTF8String], newargv[0], newargv[1], newargv[2]);
    execv([fullpath UTF8String], (char **)newargv);
  }

  [pool drain];
}
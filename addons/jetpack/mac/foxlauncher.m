#include <stdio.h>
#include <Cocoa/Cocoa.h>
#include <Foundation/Foundation.h>

int main(int argc, char **argv)
{
  //make an allocation pool
  NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];
  //get the directory we are running from  
  NSString* appdir = [[NSBundle mainBundle] bundlePath];

  //printf up a path to the application.ini file
  char bigBuf[4096];
  snprintf(bigBuf, 4096, "%s/XUL/application.ini", [appdir UTF8String]);
  char *newargv[4];
  newargv[0] = "xulrunner-bin";
  newargv[1] = "-app";
  newargv[2] = bigBuf;
  newargv[3] = NULL;

  //load the path to the xulrunner binary, which we saved during creation time of the web app, and saved in webRT.config
  NSError *error;
  NSString *xulPath = [NSString stringWithContentsOfFile:[appdir stringByAppendingString:@"/webRT.config"] 
                                  encoding:NSASCIIStringEncoding error:&error];

  //if we don't have one, oops! fail
  if (xulPath == nil) 
  {
    NSLog(@"OWA:: Error: could not locate xulrunner");
  }
  else 
  {
    NSString *fullpath = [xulPath stringByAppendingString: @"/xulrunner-bin"];
    NSLog(@"OWA:: Execing: %s %s %s %s\n", [fullpath UTF8String], newargv[0], newargv[1], newargv[2]);
    execv([fullpath UTF8String], (char **)newargv);
  }

  [pool drain];
}
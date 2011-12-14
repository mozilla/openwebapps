/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Open Web Apps for Firefox.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    Michael Hanson <mhanson@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <dirent.h>
#include <sys/stat.h>

#include <Cocoa/Cocoa.h>
#include <Foundation/Foundation.h>

const char *ENVIRONMENT_DIR = "env";
const char *FIREFOX_EXECUTABLE = "firefox-bin";
const char *VERSION_FILE = "ffx.version";

void launchApplication();

NSString *pathToCurrentFirefox();

int updateApplicationEnvironment(char *firefoxPath, char *appEnvDirPath);

int deleteApplicationEnvironment(char *appEnvDirPath);
int buildApplicationEnvironment(char *firefoxPath, char *appEnvDirPath);

char *readFirefoxVersion(char *firefoxPath);
char *currentEnvironmentVersion(char *appEnvDirPath);
void displayErrorAlert(CFStringRef title, CFStringRef message);


int gVerbose = 0;



/*
  * What is the current newest non-beta Firefox
    * Or if -p is set, use that
  * Do we have a symlink directory?
    * If yes, does it point to the directory of Firefox that I found above
      * If yes, is it the same version as when I made the symlinks? (XX: Need to stash a version code)
        * If yes, happy days, execute
  * If no on ANYTHING:
    * Delete symlink directory
    * Make new one (iterate all contents of Firefox directly making links)
    * Execute

*/

int main(int argc, char **argv)
{
  int i;
  NSString *firefoxPath = NULL;    
  for (i=1;i < argc;i++)
  {
    if (!strcmp(argv[i], "-v")) {
      gVerbose = 1;
    } else if (!strcmp(argv[i], "-p")) {
      if (i+1 < argc) {
        firefoxPath = [[NSString alloc] initWithCString:argv[i+1]];
        i++;
      }
    }
  }

  NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];  
  if (!firefoxPath) {
    firefoxPath = pathToCurrentFirefox(); // XXX developer feature to specify other firefox here
    if (!firefoxPath) {
      // Launch a dialog to explain to the user that there's no compatible web runtime
      displayErrorAlert(CFSTR("Cannot start"),
        CFSTR("Cannot start application.  This application requires that Firefox be installed.\n\nDownload it from http://getfirefox.com"));
      return 0;
    }
  }
  if (gVerbose) {
      printf("Using Firefox at path %s\n", [firefoxPath UTF8String]);
  }
  
  char appEnvDirPath[4096];
  char firefoxMacPath[4096];
  
  snprintf(appEnvDirPath, 4096, "%s/Contents/MacOS/%s", [[[NSBundle mainBundle] bundlePath] UTF8String], ENVIRONMENT_DIR);
  snprintf(firefoxMacPath, 4096, "%s/Contents/MacOS", [firefoxPath UTF8String]);

  int rc = updateApplicationEnvironment(firefoxMacPath, appEnvDirPath);
  if (rc) {
    exit(-1);
  }
  launchApplication();
  [pool drain];
  exit(1);
}


void displayErrorAlert(CFStringRef title, CFStringRef message)
{
  CFUserNotificationDisplayNotice(0, kCFUserNotificationNoteAlertLevel, 
    NULL, NULL, NULL, 
    title,
    message,
    CFSTR("Quit")
    );
}

void displayGenericFirefoxErrorAlert()
{
  displayErrorAlert(CFSTR("Cannot start"),
    CFSTR("Cannot start application.  It may be damaged, or your Firefox installation may contain errors.  Try reinstalling the application."));

}

/* Find the currently installed Firefox, if any, and return
 * an absolute path to it. */
NSString *pathToCurrentFirefox()
{
  NSString *firefoxRoot = [[NSWorkspace sharedWorkspace] absolutePathForAppBundleWithIdentifier:@"org.mozilla.firefox"];
  if (firefoxRoot) {
    return firefoxRoot;
  } else {
    return NULL;
  }
}

/* Reads the currently installed version from the local environment directory*/
char *currentEnvironmentVersion(char *appEnvDirPath)
{
  char appVersionPath[4096];
  snprintf(appVersionPath, 4096, "%s/%s", appEnvDirPath, VERSION_FILE);
  
  FILE *fp = fopen(appVersionPath, "r");
  if (!fp) {
    return "";
  }  
  if (fp) {
    char buf[512];
    size_t read = fread(buf, 1, 511, fp);
    if (read > 0) {
      buf[read] = 0;
      fclose(fp);
      return strdup(buf);
    }
    fclose(fp);
    return NULL;
  }
  return NULL;
}

char *readFirefoxVersion(char *firefoxPath)
{
  char appIniPath[4096];
  snprintf(appIniPath, 4096, "%s/application.ini", firefoxPath);
  FILE *fp = fopen(appIniPath, "r");
  if (!fp) {
    return "";
  }
  
  // Scan for Version= line
  if (fp) {
    while (1) {
      char lineBuf[1024];
      char *line = fgets(lineBuf, 1024, fp);
      if (!line) break;
      if (strncmp(line, "Version=", 8) == 0) {
        int trim = strlen(line)-1;
        while (trim > 0) {
          if (line[trim] == '\n') {
            line[trim] = 0;
            trim--;
          } else break;
        }

        fclose(fp);
        return strdup(line+8);
      }
    }
    fclose(fp);
  }
  return NULL;
}

int applicationVersionsMatch(char *appEnvDirPath, char *firefoxPath)
{
  char *envVer = currentEnvironmentVersion(appEnvDirPath);
  if (gVerbose) printf("Local environment version is %s\n", envVer);
  
  char *ffxVer = readFirefoxVersion(firefoxPath);
  if (!envVer) return 0;
  if (gVerbose) printf("Current Firefox version is %s\n", ffxVer);
  
  if (ffxVer && envVer && strcmp(ffxVer, envVer) == 0) return 1;
  return 0;
}

int updateApplicationEnvironment(char *firefoxPath, char *appEnvDirPath)
{
  int rc;
  struct stat my_stat;
  rc = stat(appEnvDirPath, &my_stat);

  if (rc < 0 && errno == ENOENT) {
    // doesn't exist - that's okay
  } else if (rc == 0) {
    // exists - check it
    if ((my_stat.st_mode & S_IFDIR) == 0) {
      fprintf(stderr, "Error while updating application environment: env is not a directory\n");
      displayGenericFirefoxErrorAlert();
      return -1;      
    }
    
    if (applicationVersionsMatch(appEnvDirPath, firefoxPath)) {
      if (gVerbose) printf("Application environment version match\n");
      // To be super-careful we could check whether all the symlinks are
      // still the same...
      return 0;
    }
      
    if (gVerbose) printf("Deleting application environment\n");
    rc = deleteApplicationEnvironment(appEnvDirPath);
    if (rc) return rc;
    // carry on and create the new one...

  } else {
    // anything else is bad.
    fprintf(stderr, "Error while updating application environment: %s (%d)\n", strerror(errno), rc);
    displayGenericFirefoxErrorAlert();
    return rc;
  }
  rc = buildApplicationEnvironment(firefoxPath, appEnvDirPath);
  return rc;
}

int deleteApplicationEnvironment(char *appEnvDirPath)
{
  struct dirent *dp = NULL;
  int rc;

  DIR *dirp = opendir(appEnvDirPath);
  if (dirp == NULL) {
    fprintf(stderr, "Error while deleting application environment: cannot open directory\n");
    displayGenericFirefoxErrorAlert();
    return;
  }
  
  while ((dp = readdir(dirp)) != NULL)
  {
    // Skip '.' and '..'
    if (strcmp(dp->d_name, ".") == 0 || strcmp(dp->d_name, "..") == 0)
      continue;

    // Unlink the rest
    char delPath[4096];
    snprintf(delPath, 4096, "%s/%s", appEnvDirPath, dp->d_name);
    rc = unlink(delPath);
    if (rc) {
      fprintf(stderr, "Error while deleting application environment: %s (%d)\n", strerror(errno), errno);
      displayGenericFirefoxErrorAlert();
      (void)closedir(dirp);
      return rc;
    }
  }

  // And delete the directory:
  (void)closedir(dirp);
  rc = rmdir(appEnvDirPath);
  if (rc) {
    fprintf(stderr, "Error while deleting application environment: %s (%d)\n", strerror(errno), errno);
    displayGenericFirefoxErrorAlert();
    return rc;
  }
  return 0;
}

int buildApplicationEnvironment(char *firefoxPath, char *appEnvDirPath)
{
  struct dirent *dp = NULL;
  if (gVerbose) printf("Building new application environment\n");
    
  int rc = mkdir(appEnvDirPath, 0755); // rwxr_xr_x
  if (rc) {
    fprintf(stderr, "Error while creating application environment: %s (%d)\n", strerror(errno), errno);
    displayGenericFirefoxErrorAlert();
    return rc;
  }

  DIR *dirp = opendir(firefoxPath);
  if (dirp == NULL) {
    fprintf(stderr, "Error while creating application environment: can't open Firefox bundle\n");
    displayGenericFirefoxErrorAlert();
    return -1;
  }

  while ((dp = readdir(dirp)) != NULL)
  {
    char sourcePath[4096], destPath[4096];
    // Skip '.' and '..'
    if (strcmp(dp->d_name, ".") == 0 || strcmp(dp->d_name, "..") == 0)
      continue;

    snprintf(sourcePath, 4096, "%s/%s", firefoxPath, dp->d_name);
    snprintf(destPath, 4096, "%s/%s", appEnvDirPath, dp->d_name);
    int rc = symlink(sourcePath, destPath);
    if (rc) {
      fprintf(stderr, "Error while constructing application environment: %s (%d)\n", strerror(errno), rc);
      displayGenericFirefoxErrorAlert();    
      (void)closedir(dirp);
      return rc;
    }
  }
  (void)closedir(dirp);

  // Write the version:
  char versionPath[4096];
  snprintf(versionPath, 4096, "%s/%s", appEnvDirPath, VERSION_FILE);
  FILE *fp = fopen(versionPath, "w");
  if (fp) {
    fprintf(fp, "%s", readFirefoxVersion(firefoxPath));
    fclose(fp);
  }
  return 0;
}

void launchApplication()
{
  const char *appdir = [[[NSBundle mainBundle] bundlePath] UTF8String];

  char launchPath[1024];
  snprintf(launchPath, 1024, "%s/Contents/MacOS/%s/%s", appdir, ENVIRONMENT_DIR, FIREFOX_EXECUTABLE);
  
  char xulPath[1024];
  snprintf(xulPath, 1024, "%s/XUL/application.ini", appdir);

  char *newargv[4];
  newargv[0] = "firefox-bin";
  newargv[1] = "-app";
  newargv[2] = xulPath;
  newargv[3] = NULL;

  execv(launchPath, (char **)newargv);
}

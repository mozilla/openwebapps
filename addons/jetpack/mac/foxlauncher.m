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

NSString *pathToCurrentFirefox();
int updateApplicationEnvironment(NSString *firefoxPath, char *appEnvDirPath);
int deleteApplicationEnvironment(char *appEnvDirPath);
int buildApplicationEnvironment(NSString *firefoxPath, char *appEnvDirPath);
void launchApplication();
char *readAppEnvVersion(char *appEnvDirPath);

int gVerbose = 0;

int main(int argc, char **argv)
{
  if (argc > 1 && !strcmp(argv[1], "-v")) {
    gVerbose = 1;
  }

  NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];  
  NSString *firefoxPath = pathToCurrentFirefox(); // XXX developer feature to specify other firefox here
  if (!firefoxPath) {
    // Launch a dialog to explain to the user that there's no compatible web runtime
    return 0;
  }

  char appEnvDirPath[4096];
  snprintf(appEnvDirPath, 4096, "%s/Contents/MacOS/%s", [[[NSBundle mainBundle] bundlePath] UTF8String], ENVIRONMENT_DIR);

  int rc = updateApplicationEnvironment(firefoxPath, appEnvDirPath);
  if (rc) {
    exit(-1);
  }
  launchApplication();
  [pool drain];
  exit(-1);
}

NSString *pathToCurrentFirefox()
{
  NSString *firefoxRoot = [[NSWorkspace sharedWorkspace] absolutePathForAppBundleWithIdentifier:@"org.mozilla.firefox"];
  if (firefoxRoot) {
    return firefoxRoot;
  } else {
    return NULL;
  }
}
  
// const char *appdir = [[[NSBundle mainBundle] bundlePath] UTF8String];
//  NSString *FirefoxRoot = [[NSWorkspace sharedWorkspace] absolutePathForAppBundleWithIdentifier:@"org.mozilla.firefox"];

char *currentAppVersion()
{
  char appVersionPath[4096];
  snprintf(appVersionPath, 4096, "%s/Contents/MacOS/%s/%s", [[[NSBundle mainBundle] bundlePath] UTF8String], ENVIRONMENT_DIR, VERSION_FILE);
  FILE *fp = fopen(appVersionPath, "r");
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

int updateApplicationEnvironment(NSString *firefoxPath, char *appEnvDirPath)
{
  int rc;
  struct stat my_stat;
  rc = stat(appEnvDirPath, &my_stat);

  if (rc < 0 && errno == ENOENT) {
    // doesn't exist - that's okay
  } else if (rc == 0) {
    // exists - check it
    if ((my_stat.st_mode & S_IFDIR) == 0) {
      fprintf(stderr, "Error while updating application environment: env is not a directory");
      return -1;      
    }
    
    if (applicationVersionsMatch(appEnvDirPath)) {
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
    fprintf(stderr, "Error while updating application environment: %s (%d)", strerror(errno), rc);
    return rc;
  }
  rc = buildApplicationEnvironment(firefoxPath, appEnvDirPath);
  return rc;
}

int applicationVersionsMatch(char *appEnvDirPath)
{
  char *curVer = currentAppVersion();
  char *envVer = readAppEnvVersion(appEnvDirPath);
  if (curVer && envVer && strcmp(curVer, envVer) == 0) return 1;
  return 0;
}

char *readAppEnvVersion(char *appEnvDirPath)
{
  char appIniPath[4096];
  snprintf(appIniPath, 4096, "%s/application.ini", appEnvDirPath);
  FILE *fp = fopen(appIniPath, "r");
  if (fp) {
    while (1) {
      char lineBuf[1024];
      char *line = fgets(lineBuf, 1024, fp);
      if (!line) break;
      if (strncmp(line, "Version=", 8) == 0) {
        fclose(fp);
        return strdup(line+8);
      }
    }
    fclose(fp);
  }
  return NULL;
}

int deleteApplicationEnvironment(char *appEnvDirPath)
{
  struct dirent *dp = NULL;
  int rc;

  DIR *dirp = opendir(appEnvDirPath);
  if (dirp == NULL) return;
  
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
      fprintf(stderr, "Error while deleting application environment: %s (%d)", strerror(errno), errno);
      (void)closedir(dirp);
      return rc;
    }
  }

  // And delete the directory:
  (void)closedir(dirp);
  rc = rmdir(appEnvDirPath);
  if (rc) {
    fprintf(stderr, "Error while deleting application environment: %s (%d)", strerror(errno), errno);
    return rc;
  }
  return 0;
}

int buildApplicationEnvironment(NSString *firefoxPath, char *appEnvDirPath)
{
  struct dirent *dp = NULL;
  if (gVerbose) printf("Building new application environment\n");
    
  int rc = mkdir(appEnvDirPath, 0755); // rwxr_xr_x
  if (rc) {
    fprintf(stderr, "Error while creating application environment: %s (%d)", strerror(errno), errno);
    return rc;
  }

  char firefoxBundlePath[4096];
  snprintf(firefoxBundlePath, 4096, "%s/Contents/MacOS", [firefoxPath UTF8String]);
  DIR *dirp = opendir(firefoxBundlePath);
  if (dirp == NULL) {
    fprintf(stderr, "Error while creating application environment: can't open Firefox bundle");
    return -1;
  }

  while ((dp = readdir(dirp)) != NULL)
  {
    char sourcePath[4096], destPath[4096];
    // Skip '.' and '..'
    if (strcmp(dp->d_name, ".") == 0 || strcmp(dp->d_name, "..") == 0)
      continue;

    snprintf(sourcePath, 4096, "%s/%s", firefoxBundlePath, dp->d_name);
    snprintf(destPath, 4096, "%s/%s", appEnvDirPath, dp->d_name);
    int rc = symlink(sourcePath, destPath);
    if (rc) {
      fprintf(stderr, "Error while constructing application environment: %s (%d)", strerror(errno), rc);
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
    fprintf(fp, "%s", readAppEnvVersion(appEnvDirPath));
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


/*

  * What is the current newest non-beta Firefox
    * (FUTURE: Way for developer to specify beta, alpha, nightly)
  * Do we have a symlink directory?
    * If yes, does it point to the directory of Firefox that I found above
      * If yes, is it the same version as when I made the symlinks? (XX: Need to stash a version code)
        * If yes, happy days, execute
  * If no on ANYTHING:
    * Delete symlink directory
    * Make new one (iterate all contents of Firefox directly making links)
    * Execute

*/
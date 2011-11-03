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
# The Original Code is an NSIS installer/uninstaller for Open Web Apps
#
# The Initial Developer of the Original Code is
# Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2011
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Tim Abraldes <tabraldes@mozilla.com>
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

!include "FileFunc.nsh"

SetCompressor /SOLID /FINAL lzma
CRCCheck on
RequestExecutionLevel user

Var appName
Var appURL
Var appDesc
Var createDesktopShortcut
Var createStartMenuShortcut

Name $appName
OutFile ..\..\data\native-install\windows\installer\install.exe

Function .onInit
  Push $0
  ClearErrors
  ${GetParameters} $0
  readAppName:
  ${GetOptions} $0 "-appName=" $appName
  IfErrors 0 setOutDir
    SetErrors
    Goto cleanup
  setOutDir:
  StrCpy $INSTDIR $EXEDIR
  SetOutPath $INSTDIR\$appName
  readOptionalInfo:
  ${GetOptions} $0 "-appURL=" $appURL
  ${GetOptions} $0 "-appDesc=" $appDesc
  ${GetOptions} $0 "-createDesktopShortcut=" $createDesktopShortcut
  ${GetOptions} $0 "-createStartMenuShortcut=" $createStartMenuShortcut
  ClearErrors
  cleanup:
  Pop $0
  IfErrors 0 done
    Abort
  done:
FunctionEnd

Function WriteRegKeys
  DetailPrint "Writing registry keys"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "DisplayName" \
              $appName
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "UninstallString" \
              "$INSTDIR\uninstall.exe -appName=$appName"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "InstallLocation" \
              $OUTDIR
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "DisplayIcon" \
              $OUTDIR\$appName.exe,0
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "HelpLink" \
              "https://apps.mozillalabs.com/"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "URLUpdateInfo" \
              "https://apps.mozillalabs.com/"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "URLInfoAbout" \
              "$appURL"
  WriteRegDWORD HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "NoModify" \
              0x1
  WriteRegDWORD HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "NoRepair" \
              0x1
  DetailPrint "Done"
FunctionEnd

Function CreateShortcuts
  Push $0
  Push $1
  ClearErrors
  DetailPrint "Looking up uninstall-files.dat"
  GetFullPathName $0 uninstall-files.dat
  IfErrors 0 foundUninstallFiles
    DetailPrint "Failed looking up uninstall-files.dat"
    StrCpy $0 ""
    Goto maybeCreateDesktopShortcut
  foundUninstallFiles:
  DetailPrint "Full path to uninstall-files.dat: $0"
  openUninstallFiles:
  DetailPrint "Opening uninstall-files.dat"
  FileOpen $1 $0 a
  FileSeek $1 0 END
  IfErrors 0 successfullyOpenedUninstallFiles
    DetailPrint "Failed to open uninstall-files.dat"
    StrCpy $0 ""
    Goto maybeCreateDesktopShortcut
  successfullyOpenedUninstallFiles:
  DetailPrint "Uninstall-files.dat opened"
  maybeCreateDesktopShortcut:
  StrCmp $createDesktopShortcut "y" 0 maybeCreateStartMenuShortcut
  CreateShortcut $DESKTOP\$appName.lnk \
                 $OUTDIR\$appName.exe \
                 "" \
                 $OUTDIR\$appName.exe \
                 0 \
                 "" \
                 "" \
                 $appDesc
  StrCmp $0 "" maybeCreateStartMenuShortcut
  FileWrite $1 $DESKTOP\$appName.lnk$\n
  maybeCreateStartMenuShortcut:
  StrCmp $createStartMenuShortcut "y" 0 cleanup
  CreateShortcut $SMPROGRAMS\$appName.lnk \
                 $OUTDIR\$appName.exe \
                 "" \
                 $OUTDIR\$appName.exe \
                 0 \
                 "" \
                 "" \
                 $appDesc
  StrCmp $0 "" cleanup
  FileWrite $1 $SMPROGRAMS\$appName.lnk$\n
  cleanup:
  StrCmp $0 "" popRegisters closeFile
  closeFile:
  FileClose $1
  popRegisters:
  Pop $1
  Pop $0
FunctionEnd

Section Install
  Call WriteRegKeys
  Call CreateShortcuts
  WriteUninstaller $EXEDIR\uninstall.exe
SectionEnd

Function un.onInit
  Push $0
  ClearErrors
  ${GetParameters} $0
  readAppName:
  ${GetOptions} $0 "-appName=" $appName
  IfErrors 0 setUpPaths
    SetErrors
    Goto cleanup
  setUpPaths:
  SetOutPath $INSTDIR\$appName
  ClearErrors
  cleanup:
  Pop $0
  IfErrors 0 done
    Abort
  done:
FunctionEnd

Function un.RemoveLineEnding
  Exch $0
  Push $1
  loop:
  StrCpy $1 $0 1 -1
  StrCmp $1 $\r doTrim
  StrCmp $1 $\n doTrim
  Goto done
  doTrim:
  StrCpy $0 $0 -1
  Goto loop
  done:
  Pop $1
  Exch $0
FunctionEnd

Function un.RemoveFiles
  Push $0
  Push $1
  Push $2
  ClearErrors
  DetailPrint "Looking up uninstall-files.dat"
  GetFullPathName $2 uninstall-files.dat
  IfErrors 0 openUninstallFiles
    DetailPrint "Error looking up uninstall-files.dat"
    Goto cleanup
  openUninstallFiles:
  DetailPrint "Full path to uninstall-files.dat: $2"
  FileOpen $0 $2 r
  IfErrors 0 successfullyOpenedUninstallFiles
    DetailPrint "Unable to open uninstall-files.dat"
    Goto cleanup
  successfullyOpenedUninstallFiles:
  DetailPrint "Uninstall-files.dat opened"
  processNextFile:
  FileRead $0 $1
  IfErrors closeDatFile 0
  Push $1
  # Tracking down messed up line endings was a special kind of hell
  Call un.RemoveLineEnding
  Pop $1
  DetailPrint "Processing entry: $1"
  GetFullPathName $1 $1
  IfErrors 0 checkFileExists
    DetailPrint "Error getting full path to file"
    Goto processNextFile
  checkFileExists:
  DetailPrint "Full path: $1"
  IfFileExists $1 0 fileWasNonExistent
    Delete $1
    IfErrors 0 processNextFile
      DetailPrint "Error deleting $1"
      Goto processNextFile
  fileWasNonExistent:
    DetailPrint "File did not exist"
    Goto processNextFile
  closeDatFile:
  DetailPrint "Closing uninstall-files.dat"
  FileClose $0
  Delete $2
  cleanup:
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

Function un.RemoveDirs
  push $0
  push $1
  push $2
  ClearErrors
  DetailPrint "Looking up uninstall-dirs.dat"
  GetFullPathName $2 uninstall-dirs.dat
  IfErrors 0 openUninstallDirs
    DetailPrint "Error looking up uninstall-dirs.dat"
    Goto cleanup
  openUninstallDirs:
  DetailPrint "Full path to uninstall-dirs.dat: $2"
  FileOpen $0 $2 r
  IfErrors 0 successfullyOpenedUninstallDirs
    DetailPrint "Unable to open uninstall-dirs.dat"
    Goto cleanup
  successfullyOpenedUninstallDirs:
  DetailPrint "Uninstall-dirs.dat opened"
  processNextDir:
  FileRead $0 $1
  IfErrors closeDatFile 0
  Push $1
  Call un.RemoveLineEnding
  Pop $1
  DetailPrint "Processing entry: $1"
  GetFullPathName $1 $1
  IfErrors 0 checkDirExists
    DetailPrint "Error getting full path to dir"
    Goto processNextDir
  checkDirExists:
  DetailPrint "Full path: $1"
  IfFileExists $1\*.* 0 dirWasNonExistent
    RMDIR $1
    IfErrors 0 processNextDir
      DetailPrint "Error deleting $1"
      Goto processNextDir
  dirWasNonExistent:
    DetailPrint "Directory did not exist"
    Goto processNextDir
  closeDatFile:
  DetailPrint "Closing uninstall-dirs.dat"
  FileClose $0
  Delete $2
  cleanup:
  # Change the current working dir since that can't be deleted
  SetOutPath $TEMP
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

Function un.RemoveRegKeys
  ClearErrors
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName"
FunctionEnd

Section un.Install
  Call un.RemoveFiles
  Call un.RemoveDirs
  Call un.RemoveRegKeys
  RMDIR $INSTDIR\$appName
SectionEnd

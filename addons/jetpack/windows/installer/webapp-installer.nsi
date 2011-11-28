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
Var appID
Var appURL
Var appDesc
Var iconPath
Var createDesktopShortcut
Var createStartMenuShortcut
Var FFPath

Name $appName
OutFile ..\..\data\native-install\windows\installer\install.exe

Function .onInit
  ClearErrors
  ReadINIStr $appID $EXEDIR\install.ini required appID
  IfErrors error doneReadingAppID
  doneReadingAppID:
  ReadINIStr $appName $EXEDIR\install.ini required appName
  IfErrors error doneReadingAppName
  doneReadingAppName:
  ReadINIStr $INSTDIR $EXEDIR\install.ini required instDir
  IfErrors error doneReadingInstDir
  doneReadingInstDir:
  SetOutPath $INSTDIR
  ReadINIStr $FFPath $EXEDIR\install.ini required FFPath
  IfErrors error doneReadingFFPath
  error:
  Abort
  doneReadingFFPath:
  ReadINIStr $appURL $EXEDIR\install.ini optional appURL
  ReadINIStr $appDesc $EXEDIR\install.ini optional appDesc
  ReadINIStr $iconPath $EXEDIR\install.ini optional iconPath
  ReadINIStr $createDesktopShortcut $EXEDIR\install.ini optional createDesktopShortcut
  ReadINIStr $createStartMenuShortcut $EXEDIR\install.ini optional createStartMenuShortcut
FunctionEnd

Function WriteRegKeys
  DetailPrint "Writing registry keys"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
              "DisplayName" \
              $appName
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
              "UninstallString" \
              "$OUTDIR\uninstall.exe"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
              "InstallLocation" \
              "$OUTDIR"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
              "HelpLink" \
              "https://apps.mozillalabs.com/"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
              "URLUpdateInfo" \
              "https://apps.mozillalabs.com/"
  WriteRegDWORD HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
              "NoModify" \
              0x1
  WriteRegDWORD HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
              "NoRepair" \
              0x1
  StrCmp $appURL "" doneWritingAppURL writeAppURL
  writeAppURL:
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
              "URLInfoAbout" \
              "$appURL"
  doneWritingAppURL:
  StrCmp $iconPath "" doneWritingIconPath writeIconPath
  writeIconPath:
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
              "DisplayIcon" \
              "$iconPath"
  doneWritingIconPath:
  DetailPrint "Done"
FunctionEnd

Function CreateShortcuts
  ClearErrors
  CreateShortcut $OUTDIR\$appName.lnk \
                 $FFPath \
                 '-app "$OUTDIR\application.ini"' \
                 $iconPath \
                 0 \
                 "" \
                 "" \
                 $appDesc
  StrCmp $createDesktopShortcut "y" writeDesktopShortcut doneWritingDesktopShortcut
  writeDesktopShortcut:
  CreateShortcut $DESKTOP\$appName.lnk \
                 $OUTDIR\$appName.lnk \
                 "" \
                 $iconPath \
                 0 \
                 "" \
                 "" \
                 $appDesc
  doneWritingDesktopShortcut:
  StrCmp $createStartMenuShortcut "y" writeStartMenuShortcut doneWritingStartMenuShortcut
  writeStartMenuShortcut:
  CreateShortcut $SMPROGRAMS\$appName.lnk \
                 $OUTDIR\$appName.lnk \
                 "" \
                 $iconPath \
                 0 \
                 "" \
                 "" \
                 $appDesc
  doneWritingStartMenuShortcut:
FunctionEnd

Section Install
  Call WriteRegKeys
  Call CreateShortcuts
  WriteUninstaller $OUTDIR\uninstall.exe
SectionEnd

Function un.onInit
  ClearErrors
  ReadINIStr $appID $INSTDIR\uninstall.ini required appID
  IfErrors error doneReadingAppID
  doneReadingAppID:
  ReadRegStr $OUTDIR \
             HKCU \
            "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
            "InstallLocation"
  IfErrors error doneReadingOutDir
  doneReadingOutDir:
  ReadRegStr $appName \
             HKCU \
            "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID" \
            "DisplayName"
  IfErrors error doneReadingAppName
  error:
  Abort
  doneReadingAppName:
FunctionEnd

Function un.RemoveAppDir
  ClearErrors
  RMDir /r $OUTDIR
  RMDir $OUTDIR
FunctionEnd

Function un.RemoveAppData
  ClearErrors
  RMDir /r $APPDATA\Mozilla\$appName
  RMDir $APPDATA\Mozilla\$appName
FunctionEnd

Function un.RemoveShortcuts
  ClearErrors
  Delete $SMPROGRAMS\$appName.lnk
  Delete $DESKTOP\$appName.lnk
FunctionEnd

Function un.RemoveRegKeys
  ClearErrors
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appID"
FunctionEnd

Section un.Install
  Call un.RemoveAppDir
  Call un.RemoveAppData
  Call un.RemoveShortcuts
  Call un.RemoveRegKeys
SectionEnd

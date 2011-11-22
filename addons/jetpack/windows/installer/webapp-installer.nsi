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
Var iconPath
Var createDesktopShortcut
Var createStartMenuShortcut
Var FFPath

Name $appName
OutFile ..\..\data\native-install\windows\installer\install.exe

Function .onInit
  ClearErrors
  readAppName:
  ReadINIStr $appName $EXEDIR\install.ini required appName
  IfErrors 0 setOutDir
    SetErrors
    Goto cleanup
  setOutDir:
  StrCpy $INSTDIR $APPDATA\$appName
  SetOutPath $INSTDIR
  readFFPath:
  ReadINIStr $FFPath $EXEDIR\install.ini required FFPath
  IfErrors 0 readOptionalInfo
    SetErrors
    Goto cleanup
  readOptionalInfo:
  ReadINIStr $appURL $EXEDIR\install.ini optional appURL
  ReadINIStr $appDesc $EXEDIR\install.ini optional appDesc
  ReadINIStr $iconPath $EXEDIR\install.ini optional iconPath
  ReadINIStr $createDesktopShortcut $EXEDIR\install.ini optional createDesktopShortcut
  ReadINIStr $createStartMenuShortcut $EXEDIR\install.ini optional createStartMenuShortcut
  ClearErrors
  cleanup:
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
              "$OUTDIR\uninstall.exe"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "InstallLocation" \
              "$OUTDIR"
  WriteRegStr HKCU \
              "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
              "DisplayIcon" \
              "$iconPath"
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
  ClearErrors
  CreateShortcut $OUTDIR\$appName.lnk \
                 $FFPath \
                 '-app "$OUTDIR\application.ini"' \
                 $iconPath \
                 0 \
                 "" \
                 "" \
                 $appDesc
  maybeCreateDesktopShortcut:
  StrCmp $createDesktopShortcut "y" 0 maybeCreateStartMenuShortcut
  CreateShortcut $DESKTOP\$appName.lnk \
                 $OUTDIR\$appName.lnk \
                 "" \
                 $iconPath \
                 0 \
                 "" \
                 "" \
                 $appDesc
  maybeCreateStartMenuShortcut:
  StrCmp $createStartMenuShortcut "y" 0 cleanup
  CreateShortcut $SMPROGRAMS\$appName.lnk \
                 $OUTDIR\$appName.lnk \
                 "" \
                 $iconPath \
                 0 \
                 "" \
                 "" \
                 $appDesc
  cleanup:
FunctionEnd

Section Install
  Call WriteRegKeys
  Call CreateShortcuts
  WriteUninstaller $OUTDIR\uninstall.exe
SectionEnd

Function un.onInit
  ClearErrors
  readAppName:
  ReadINIStr $appName $INSTDIR\uninstall.ini required appName
  IfErrors 0 setUpPaths
    SetErrors
    Goto cleanup
  setUpPaths:
  ReadRegStr $INSTDIR \
             HKCU \
            "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName" \
            "InstallLocation"
  IfErrors 0 cleanup
    StrCpy $INSTDIR "$APPDATA\$appName"
  cleanup:
  IfErrors 0 done
    Abort
  done:
FunctionEnd

Function un.RemoveAppDir
  RMDir /r $INSTDIR
  RMDir $INSTDIR
FunctionEnd

Function un.RemoveAppData
  RMDir /r $APPDATA\Mozilla\$appName
  RMDir $APPDATA\Mozilla\$appName
FunctionEnd

Function un.RemoveShortcuts
  Delete $SMPROGRAMS\$appName.lnk
  Delete $DESKTOP\$appName.lnk
FunctionEnd

Function un.RemoveRegKeys
  ClearErrors
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$appName"
FunctionEnd

Section un.Install
  Call un.RemoveAppDir
  Call un.RemoveAppData
  Call un.RemoveShortcuts
  Call un.RemoveRegKeys
  RMDIR $INSTDIR\$appName
SectionEnd

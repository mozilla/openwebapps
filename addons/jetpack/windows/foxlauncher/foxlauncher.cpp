/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-*/
/* vim: set ts=2 et sw=2 tw=80: */
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
 *   Tim Abraldes <tabraldes@mozilla.com>
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

#include <process.h>

// Windows headers
#include "windows.h"
//#include "Shellapi.h"

int WINAPI WinMain(HINSTANCE,
                   HINSTANCE,
                   LPSTR,
                   int) {

  wchar_t fullAppPath[MAX_PATH];
  wchar_t xulAppDir[_MAX_DIR];
  wchar_t xulAppDrive[_MAX_DRIVE];

  ::GetModuleFileNameW(NULL, fullAppPath, MAX_PATH);
  // TODO: Check for errors
  // TODO: Maybe normalize path for splitpath?
  _wsplitpath_s(fullAppPath,
                xulAppDrive,
                _MAX_DRIVE,
                xulAppDir,
                _MAX_DIR,
                NULL,         // Filename (don't need)
                0,            // NumElements of filename buffer
                NULL,         // Extension (don't need)
                0);           // NumElements of extension buffer
  // TODO: Check for errors
  


  SHELLEXECUTEINFO sei;
  sei.cbSize = sizeof(sei);
  sei.fMask = SEE_MASK_NOCLOSEPROCESS // hProcess receives handle
              | SEE_MASK_NOASYNC      // ShellExecuteEx does not return until
                                      // DDE operation has completed
              //TODO: | SEE_MASK_ICON
              | SEE_MASK_NO_CONSOLE;  // inherit console (IS THIS NEEDED?)
  sei.hwnd = NULL; // TODO: Create a window and put its hwnd here
  sei.lpVerb = L"open";
  sei.lpFile = L"firefox.exe";
  sei.lpParameters = L"-app \"XUL\\application.ini\"";
  sei.lpDirectory = xulAppDir;
  sei.nShow = SW_SHOWDEFAULT;
  // TODO: sei.hIcon = 

  ::ShellExecuteExW(&sei);

  return 0;
}

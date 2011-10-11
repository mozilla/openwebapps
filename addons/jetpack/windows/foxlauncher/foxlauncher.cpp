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

#include "resource.h"
#include "windows.h"

#include <iostream>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
  static const DWORD EXPAND_BUF_LEN = MAX_PATH;

  WCHAR pathToFirefox[EXPAND_BUF_LEN];
  DWORD dwExpandRet = ::ExpandEnvironmentStrings(L"%PROGRAMFILES%\\Mozilla Firefox\\firefox.exe",pathToFirefox,EXPAND_BUF_LEN);
  if(EXPAND_BUF_LEN < dwExpandRet) {
    // TODO: The buffer was too small
  } else if(0 == dwExpandRet) {
    std::wcerr << L"::ExpandEnvironmentStrings() failed: " << ::GetLastError() << std::endl;
    return 1;
  }

  WCHAR commandLineArgs[EXPAND_BUF_LEN];
  dwExpandRet = ::ExpandEnvironmentStrings(L"firefox.exe -app \"XUL\\application.ini\"",commandLineArgs,EXPAND_BUF_LEN);
  if(EXPAND_BUF_LEN < dwExpandRet) {
    // TODO: The buffer was too small
  } else if(0 == dwExpandRet) {
    std::wcerr << L"::ExpandEnvironmentStrings() failed: " << ::GetLastError() << std::endl;
    return 1;
  }

  STARTUPINFO si;
  PROCESS_INFORMATION pi;

  ZeroMemory( &si, sizeof(si) );
  si.cb = sizeof(si);
  ZeroMemory( &pi, sizeof(pi) );

  if(0 == ::CreateProcessW(
        pathToFirefox,
        commandLineArgs,
        NULL,
        NULL,
        FALSE,
        0,
        NULL,
        NULL,
        &si,
        &pi)) {
    std::wcerr << L"::CreateProcess() failed: " << ::GetLastError() << std::endl;
    return 1;
  }	

}

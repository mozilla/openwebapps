/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Shell Link Creator.
 *
 * The Initial Developer of the Original Code is
 *   Tim Abraldes <tabraldes@mozilla.com>
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

// System headers
#include "objbase.h"
#include "objidl.h"
#include "shlguid.h"
#include "shobjidl.h"
#include "windows.h"
#include "winnls.h"

// Project headers
// (none)

// The following ifdef block is the standard way of creating macros which make exporting 
// from a DLL simpler. All files within this DLL are compiled with the SHELLLINKCREATOR_EXPORTS
// symbol defined on the command line. this symbol should not be defined on any project
// that uses this DLL. This way any other project whose source files include this file see 
// SHELLLINKCREATOR_API functions as being imported from a DLL, whereas this DLL sees symbols
// defined with this macro as being exported.
#ifdef SHELLLINKCREATOR_EXPORTS
#define SHELLLINKCREATOR_API __declspec(dllexport)
#else
#define SHELLLINKCREATOR_API __declspec(dllimport)
#endif

BOOL APIENTRY DllMain(HMODULE hModule,
                      DWORD  ul_reason_for_call,
                      LPVOID lpReserved) {
  switch (ul_reason_for_call) {
    case DLL_PROCESS_ATTACH:
    case DLL_THREAD_ATTACH:
    case DLL_THREAD_DETACH:
    case DLL_PROCESS_DETACH:
      break;
  }
  return TRUE;
}

class FreeOnReturn {
  private:
    void* m_toFree;
  public:
    FreeOnReturn(void* toFree)
      : m_toFree(toFree) { }
    ~FreeOnReturn() {
      free(m_toFree);
    }
};

class ReleaseOnReturn {
  private:
    IUnknown* m_toRelease;

  public:
    ReleaseOnReturn(IUnknown* toRelease)
      : m_toRelease(toRelease) { }

    ~ReleaseOnReturn() {
      m_toRelease->Release();
    }
};

class CoUninitializeOnReturn {
  public:
    CoUninitializeOnReturn() { }
    ~CoUninitializeOnReturn() {::CoUninitialize();}
};


#define RETURN_IF_FAILED(hr) if(FAILED(hr)) {return hr;}

extern "C"
HRESULT SHELLLINKCREATOR_API CreateLink(LPCWSTR target, LPCWSTR loc, LPCWSTR description) 
{
  RETURN_IF_FAILED(::CoInitialize(NULL));
  CoUninitializeOnReturn unnamed;

  IShellLink* psl;
  RETURN_IF_FAILED(::CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, IID_IShellLink, (LPVOID*)&psl));
  ReleaseOnReturn pslReleaser(psl);

  psl->SetPath(target);

  size_t numChars = wcslen(target);
  wchar_t* workingDir = (wchar_t*)malloc((numChars+1)*sizeof(wchar_t));
  FreeOnReturn workingDirReleaser(workingDir);
  wcsncpy_s(workingDir,numChars+1,target,numChars);

  wchar_t* lastSlash = wcsrchr(workingDir,L'\\');
  if(NULL != lastSlash) {
    *lastSlash = L'\0';
    psl->SetWorkingDirectory(workingDir);
  }

  psl->SetDescription(description);

  IPersistFile* ppf; 
  RETURN_IF_FAILED(psl->QueryInterface(IID_IPersistFile, (LPVOID*)&ppf));
  ReleaseOnReturn ppfReleaser(ppf);

  RETURN_IF_FAILED(ppf->Save(loc, TRUE));

  return S_OK;
}

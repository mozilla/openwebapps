/*
//
// BEGIN SONGBIRD GPL
// 
// This file is part of the Songbird web player.
//
// Copyright(c) 2005-2008 POTI, Inc.
// http://songbirdnest.com
// 
// This file may be licensed under the terms of of the
// GNU General Public License Version 2 (the "GPL").
// 
// Software distributed under the License is distributed 
// on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either 
// express or implied. See the GPL for the specific language 
// governing rights and limitations.
//
// You should have received a copy of the GPL along with this 
// program. If not, go to http://www.gnu.org/licenses/gpl.html
// or write to the Free Software Foundation, Inc., 
// 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
// 
// END SONGBIRD GPL
//
 */

/** 
* \file  GlobalHotkeys.h
* \brief Global Hotkeys Manager.
*/

#pragma once


// INCLUDES ===================================================================

#include <nsStringGlue.h>

#ifdef XP_WIN
#include <windows.h>
#endif

#include "IGlobalHotkeys.h"
#include <list>

#ifdef XP_WIN
#define HOTKEY_HANDLE int
#else
// set types for other platforms
#define HOTKEY_HANDLE int
#endif

// DEFINES ====================================================================
#define SONGBIRD_GLOBALHOTKEYS_CONTRACTID  "@songbirdnest.com/Songbird/GlobalHotkeys;1"
#define SONGBIRD_GLOBALHOTKEYS_CLASSNAME   "Songbird Global Hotkeys Manager"

// {284E14BF-5CE4-4434-A733-4379D27D799E}
#define SONGBIRD_GLOBALHOTKEYS_CID { 0x284e14bf, 0x5ce4, 0x4434, { 0xa7, 0x33, 0x43, 0x79, 0xd2, 0x7d, 0x79, 0x9e } }

// CLASSES ====================================================================

class GlobalHotkeyEntry
{
public:
  HOTKEY_HANDLE m_handle;
  nsString m_keyid;
  sbIGlobalHotkeyCallback *m_callback;
};

class CGlobalHotkeys : public sbIGlobalHotkeys
{
public:
  CGlobalHotkeys();
  virtual ~CGlobalHotkeys();

  NS_DECL_ISUPPORTS
  NS_DECL_SBIGLOBALHOTKEYS

#ifdef XP_WIN
  LRESULT WndProc(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam);
#endif
  
protected:
#ifdef XP_WIN
  HWND m_window;
  static PRInt32 m_autoinc;
  UINT makeWin32Mask(PRBool altKey, PRBool ctrlKey, PRBool shiftKey, PRBool metaKey);
#endif  

  HOTKEY_HANDLE registerHotkey(PRInt32 keyCode, PRBool altKey, PRBool ctrlKey, PRBool shiftKey, PRBool metaKey);
  void unregisterHotkey(HOTKEY_HANDLE handle);
  GlobalHotkeyEntry *findHotkeyById(const nsAString &keyid);
  GlobalHotkeyEntry *findHotkeyByHandle(HOTKEY_HANDLE handle);
  void removeEntry(GlobalHotkeyEntry *entry);
  
  static std::list<GlobalHotkeyEntry*> m_hotkeys;
};


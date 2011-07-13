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
 * The Original Code is AMQP 0-9-1 Client Library.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Alex Amariutei <aamariutei@mozilla.com>
 *  Philipp von Weitershausen <philipp@weitershausen.de>
 *  Paul Sawaya <me@paulsawaya.com>
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

var toExport = {

    PROTOCOL_VERSION: [0, 9, 1],

    SIZE_OCTET: 1,
    SIZE_SHORT: 2,
    SIZE_LONG: 4,
    SIZE_LONGLONG: 8,
    MAX_SIZE_SHORTSTR: 255,

    MAX_FRAME_SIZE: 131072,

    FRAME_TYPE_METHOD: 1,
    FRAME_TYPE_HEADER: 2,
    FRAME_TYPE_BODY: 3,
    FRAME_TYPE_HEARTBEAT: 8,

    FRAME_END: 0xce,

    CONNECTION_CLASS: 10,
    CONNECTION_START: 10,
    CONNECTION_STARTOK: 11,
    CONNECTION_TUNE: 30,
    CONNECTION_TUNEOK: 31,
    CONNECTION_OPEN: 40,  
    CONNECTION_OPENOK: 41,

    CHANNEL_CLASS: 20,
    CHANNEL_OPEN: 10,
    CHANNEL_OPENOK: 11,

    QUEUE_CLASS: 50,
    QUEUE_DECLARE: 10,
    QUEUE_DECLAREOK: 11,

    BASIC_CLASS: 60,
    BASIC_CONSUME: 20, 
    BASIC_CONSUMEOK: 21,
    BASIC_DELIVER: 60, 
    BASIC_ACK: 80,
    STREAM_SEGMENT_SIZE: 1024,
    PR_UINT32_MAX: 0xffffffff,

    STARTING_CHANNEL: 1,
    RESERVED_CHANNEL: 0,

    DATA_TYPE: {
      BOOL:             "t",
      SHORT_SHORT_INT:  "b", //erratum?
      SHORT_SHORT_UINT: "B", //erratum?
      SHORT_INT:        "U",
      SHORT_UINT:       "u",
      LONG_INT:         "I",
      LONG_UINT:        "i",
      LONG_LONG_INT:    "L",
      LONG_LONG_UINT:   "l",
      FLOAT:            "f",
      DOUBLE:           "d",
      DECIMAL:          "D",
      SHORT_STRING:     "s",
      LONG_STRING:      "S",
      FIELD_ARRAY:      "A",
      TIMESTAMP:        "T",
      FIELD_TABLE:      "F",
      VOID:             "V"
    }
};

for ([key, val] in Iterator(toExport))
    exports[key] = val;
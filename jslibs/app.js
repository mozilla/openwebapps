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
 * The Original Code is app.js
 *
 * Contributor(s):
 *   Michael Hanson <mhanson@mozilla.com>
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

/*
 * Library functions to support web app clients
 */

/*
* The basic decision tree supported by installed web apps is:
*
* Is this app installed in the current client?
*   If not, and this is a problem, guide the user to a preview, install flow, etc.
*   If it's not a problem, carry on, nothing to see here.
* 
* Does the manifest that the client is using match the
* app's most-current manifest?
*   If not, and if this is a problem, update the manifest.
*   (Note that the security policy of the client may require confirmation for some updates)
*
* If the app cares about receipts (for single-sign-on or proof-of-purchase),
* does the app have an installed receipt?
*   If not, and this is a problem, guide the user to a recovery flow.  
*   (For single signon, this could be just fine; for proof-of-purchase,
*   this requires more work; are we dealing with an upgrade from a free
*   app to a paid app?  may need to guide the user back to the marketplace)
*  
* Once the receipt is in-hand, is it well-formed?
*   If not, this is an error.
*
* If the receipt has a user identity in it, does the app want to
* verify the identity?
*   If so, use navigator.id to get an assertion proving the identity.
*   The assertion will then need to be sent to the server for proofing.
*
* Does the app want to verify the receipt?
*   Locally?  If so, need the public key from the receipt issuer.  If
*      the client doesn't support secure crypto, this is not all that real.
*   At the receipt issuer?  Need to hit the verifyURL.
*   At the server?  Need to send the receipt to the server for proofing.
*
* If the user identity and the receipt are both to be verified at the server,
* it would be performant to combine those uploads into a single transaction.
* This is a nice-to-have.
*/

/*
* options is an object which optionally contains:
*   - checkManifest: if defined, the manifest is compared to the manifest provided in
*        this field; mismatches will cause the onManifestOutOfDate method to run.
*        comparison is for JavaScript object equality, not string match.  if no
*        onManifestOutOfDate is provided, a mismatched manifest will cause a failure.
*   - checkReceipt: if true, the receipt flow is followed
*   - checkIdentity: if true, the identity verification flow is followed
*        (ignored unless checkReceipt is true)
*   - verifyURL: if defined (as a relative path on my server), the receipt and
*         optional identity assertion will be POSTed to this URL for verification.
*         the server must return XXX.
* 
* behavior is an object which optionally contains the following named functions:
*
*   - onNotInstalled: called if the current app is not installed
*           return value is ignored.
*   - onManifestOutOfDate: called if checkManifest is true and the manifest isn't current
*           if the function returns TRUE, checking continues
*           if the function returns FALSE, processing completes.
*   - onNoReceipt: called if checkReceipt was true and no receipt is found
*   - onMalformedReceipt: called if checkReceipt was true, and a receipt is found but is malformed
*   - onVerifyReceipt: called with arguments (receipt, [ identityAssertion ]).
*           identityAssertion will be sent only if checkIdentity was true.
*   - onInvalidReceipt: called with string argument "invalid", "refunded", "revoked"
*   - onInvalidIdentity: called with XXX?
*   - onFailure: called when verifyURL returns an error
*   - onSuccess: called when all the checks and verify steps have completed successfully.
*/

if (typeof(moz) == "undefined") {
	var moz = {};
}

// XXX need polyfill for JSON.parse

moz.appStartup = (function() {
	function base64urldecode(arg) {
	  var s = arg;
	  s = s.replace(/-/g, '+'); // 62nd char of encoding
	  s = s.replace(/_/g, '/'); // 63rd char of encoding
	  switch (s.length % 4) // Pad with trailing '='s
	  {
	  case 0: break; // No pad chars in this case
	  case 2: s += "=="; break; // Two pad chars
	  case 3: s += "="; break; // One pad char
	  default: throw new InputException("Illegal base64url string!");
	  }
	  return window.atob(s); // Standard base64 decoder
	}

	function parseReceipt(rcptData) {
		// rcptData is a JWT.  We should use a JWT library.
		var data = rcptData.split(".");
		if (data.length != 3) throw new Exception("Malformed receipt - not a valid JWT");

		// convert base64url to base64
		var payload = base64urldecode(data[1]);
		var parsed = JSON.parse(payload);

		return parsed;
	}
	return function(options, behavior)
	{
		navigator.mozApps.amInstalled(function(installRecord) {
			
			if (!installRecord) {
				// app is not installed
				if (behavior.onNotInstalled) {
					behavior.onNotInstalled();
				}
				return;
			}

			if (options.checkManifest) {
				if (!objectsEqual(behavior.checkManifest, installRecord.manifest)) {
					if (behavior.onManifestOutOfDate) {
						var outOfDateRetVal = behavior.onManifestOutOfDate(installRecord.manifest);
						if (!outOfDateRetVal) {
							return;
						}
					} else {
						// no handler, just bail out
						return;
					}
				}
			}

			if (options.checkReceipt) {
				if (installRecord.install_data) {
					try {
						if (typeof installRecord.install_data !== "object") {
							var installDataJS = JSON.parse(installRecord.install_data);
						} else {
							var installDataJS = installRecord.install_data;
						}
					} catch (e) {
						if (behavior.onMalformedReceipt) {
							behavior.onMalformedReceipt(e.toString());
						}
						return;
					}

					if (!installDataJS.receipt) {
						if (behavior.onMalformedReceipt) {
							behavior.onMalformedReceipt("No receipt");
						}						
						return;
					}
					try {
						var rcpt = parseReceipt(installDataJS.receipt);

						if (options.checkIdentity) {
							if (!rcpt.user) {
								if (behavior.onInvalidIdentity) {
									behavior.onInvalidIdentity("No identity in receipt");
								}
								return;
							}
							console.log("Launching navigator.id");
							navigator.id.getVerifiedEmail(function(assertion) {
								if (assertion) {
									if (options.verifyURL) {
										var xhr = new XmlHttpRequest();
										xhr.open("POST", options.verifyURL),
									    xhr.onreadystatechange = function(aEvt) {
									     	if (xhr.readyState == 4) {
									        	if (xhr.status == 200) {
									        		if (behavior.onSuccess) {
									        			behavior.onSuccess(xhr.responseText);
									        		}
									        	} else {
									        		if (behavior.onFailure) {
									        			behavior.onFailure(xhr.responseText);
									        		}
									       	 	}
									      	}
									    };
										xhr.send(JSON.serialize({receipt: rcpt, id: assertion}));
									}	
								} else {
									if (behavior.onInvalidIdentity) {
										behavior.onInvalidIdentity("No BrowserID returned");
									}
									return;
								}
							});
						}

					} catch (e) {
						if (behavior.onMalformedReceipt) {
							behavior.onMalformedReceipt(e.toString());
						}
						return;						
					}
				} else {
					if (behavior.onMalformedReceipt) {
						behavior.onMalformedReceipt("No installed data");
					}
					return;					
				}
			} else {
				if (behavior.onSuccess) {
					behavior.onSuccess();
				}
			}

		});
	}
})();
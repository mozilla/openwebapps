EXPORTED_SYMBOLS = [ "BadCertHandler", "checkCert" ];

const Ce = Components.Exception;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

/**
 * Checks if the connection must be HTTPS and if so, only allows built-in
 * certificates and validates application specified certificate attribute
 * values.
 * See bug 340198 and bug 544442.
 *
 * @param  aChannel
 *         The nsIChannel that will have its certificate checked.
 * @param  aAllowNonBuiltInCerts (optional)
 *         When true certificates that aren't builtin are allowed. When false
 *         or not specified the certificate must be a builtin certificate.
 * @param  aCerts (optional)
 *         An array of JS objects with names / values corresponding to the
 *         channel's expected certificate's attribute names / values. If it
 *         isn't null or not specified the the scheme for the channel's
 *         originalURI must be https.
 * @throws NS_ERROR_UNEXPECTED if a certificate is expected and the URI scheme
 *         is not https.
 *         NS_ERROR_ILLEGAL_VALUE if a certificate attribute name from the
 *         cert param does not exist or the value for a certificate attribute
 *         from the aCerts  param is different than the expected value.
 *         NS_ERROR_ABORT if the certificate issuer is not built-in.
 */
function checkCert(aChannel, aAllowNonBuiltInCerts, aCerts) {
  if (!aChannel.originalURI.schemeIs("https")) {
    // Require https if there are certificate values to verify
    if (aCerts) {
      throw new Ce("SSL is required and URI scheme is not https.",
                   Cr.NS_ERROR_UNEXPECTED);
    }
    return;
  }

  var cert =
      aChannel.securityInfo.QueryInterface(Ci.nsISSLStatusProvider).
      SSLStatus.QueryInterface(Ci.nsISSLStatus).serverCert;

  if (aCerts) {
    for (var i = 0; i < aCerts.length; ++i) {
      var error = false;
      var certAttrs = aCerts[i];
      for (var name in certAttrs) {
        if (!(name in cert)) {
          error = true;
          Cu.reportError("Expected attribute '" + name + "' not present in " +
                         "certificate.");
          break;
        }
        if (cert[name] != certAttrs[name]) {
          error = true;
          Cu.reportError("Expected certificate attribute '" + name + "' " +
                         "value incorrect, expected: '" + certAttrs[name] +
                         "', got: '" + cert[name] + "'.");
          break;
        }
      }

      if (!error)
        break;
    }

    if (error) {
      const certCheckErr = "Certificate checks failed. See previous errors " +
                           "for details.";
      Cu.reportError(certCheckErr);
      throw new Ce(certCheckErr, Cr.NS_ERROR_ILLEGAL_VALUE);
    }
  }

  if (aAllowNonBuiltInCerts ===  true)
    return;

  var issuerCert = cert;
  while (issuerCert.issuer && !issuerCert.issuer.equals(issuerCert))
    issuerCert = issuerCert.issuer;

  const certNotBuiltInErr = "Certificate issuer is not built-in.";
  if (!issuerCert)
    throw new Ce(certNotBuiltInErr, Cr.NS_ERROR_ABORT);

  issuerCert = issuerCert.QueryInterface(Ci.nsIX509Cert3);
  var tokenNames = issuerCert.getAllTokenNames({});

  if (!tokenNames || !tokenNames.some(isBuiltinToken))
    throw new Ce(certNotBuiltInErr, Cr.NS_ERROR_ABORT);
}

function isBuiltinToken(tokenName) {
  return tokenName == "Builtin Object Token";
}

/**
 * This class implements nsIBadCertListener.  Its job is to prevent "bad cert"
 * security dialogs from being shown to the user.  It is better to simply fail
 * if the certificate is bad. See bug 304286.
 *
 * @param  aAllowNonBuiltInCerts (optional)
 *         When true certificates that aren't builtin are allowed. When false
 *         or not specified the certificate must be a builtin certificate.
 */
function BadCertHandler(aAllowNonBuiltInCerts) {
  this.allowNonBuiltInCerts = aAllowNonBuiltInCerts;
}
BadCertHandler.prototype = {

  // nsIChannelEventSink
  asyncOnChannelRedirect: function(oldChannel, newChannel, flags, callback) {
    if (this.allowNonBuiltInCerts) {
      callback.onRedirectVerifyCallback(Components.results.NS_OK);
      return;
    }

    // make sure the certificate of the old channel checks out before we follow
    // a redirect from it.  See bug 340198.
    // Don't call checkCert for internal redirects. See bug 569648.
    if (!(flags & Ci.nsIChannelEventSink.REDIRECT_INTERNAL))
      checkCert(oldChannel);
    
    callback.onRedirectVerifyCallback(Components.results.NS_OK);
  },

  // Suppress any certificate errors
  notifyCertProblem: function(socketInfo, status, targetSite) {
    return true;
  },

  // Suppress any ssl errors
  notifySSLError: function(socketInfo, error, targetSite) {
    return true;
  },

  // nsIInterfaceRequestor
  getInterface: function(iid) {
    return this.QueryInterface(iid);
  },

  // nsISupports
  QueryInterface: function(iid) {
    if (!iid.equals(Ci.nsIChannelEventSink) &&
        !iid.equals(Ci.nsIBadCertListener2) &&
        !iid.equals(Ci.nsISSLErrorListener) &&
        !iid.equals(Ci.nsIInterfaceRequestor) &&
        !iid.equals(Ci.nsISupports))
      throw Cr.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

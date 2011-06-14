
var jwt = {};

var JWTInternals = (function() {

  // convert a base64url string to hex
  var b64urlmap="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function b64urltohex(s) {
    var ret = ""
    var i;
    var k = 0; // b64 state, 0-3
    var slop;
    for(i = 0; i < s.length; ++i) {
      var v = b64urlmap.indexOf(s.charAt(i));
      if(v < 0) continue;
      if(k == 0) {
        ret += int2char(v >> 2);
        slop = v & 3;
        k = 1;
      }
      else if(k == 1) {
        ret += int2char((slop << 2) | (v >> 4));
        slop = v & 0xf;
        k = 2;
      }
      else if(k == 2) {
        ret += int2char(slop);
        ret += int2char(v >> 2);
        slop = v & 3;
        k = 3;
      }
      else {
        ret += int2char((slop << 2) | (v >> 4));
        ret += int2char(v & 0xf);
        k = 0;
      }
    }
    if(k == 1)
      ret += int2char(slop << 2);
    return ret;
  }

  function hex2b64urlencode(arg) {
    return hex2b64(arg).split('=')[0]
      .replace(/\+/g, '-')  // 62nd char of encoding
      .replace(/\//g, '_'); // 63rd char of encoding
  }

  function base64urlencode(arg)
  {
    // used to be window.btoa.
    var s = btoa(arg); // Standard base64 encoder
    s = s.split('=')[0]; // Remove any trailing '='s
    s = s.replace(/\+/g, '-'); // 62nd char of encoding
    s = s.replace(/\//g, '_'); // 63rd char of encoding
    // TODO optimize this; we can do much better
    return s;
  }

  function base64urldecode(arg)
  {
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
    // used to be window.atob
    return atob(s); // Standard base64 decoder
  }

  function NoSuchAlgorithmException(message) {
    this.message = message;
    this.toString = function() { return "No such algorithm: "+this.message; };
  }
  function NotImplementedException(message) {
    this.message = message;
    this.toString = function() { return "Not implemented: "+this.message; };
  }
  function MalformedWebTokenException(message) {
    this.message = message;
    this.toString = function() { return "Malformed JSON web token: "+this.message; };
  }
  function InputException(message) {
    this.message = message;
    this.toString = function() { return "Malformed input: "+this.message; };
  }

  function WebToken(objectStr, algorithm)
  {
    this.objectStr = objectStr;
    this.pkAlgorithm = algorithm;
  }

  var WebTokenParser = {

    parse: function _parse(input)
    {
      var parts = input.split(".");
      if (parts.length != 3) {
        throw new MalformedWebTokenException("Must have three parts");
      }
      var token = new WebToken();
      token.headerSegment = parts[0];
      token.payloadSegment = parts[1];
      token.cryptoSegment = parts[2];

      token.pkAlgorithm = base64urldecode(parts[0]);
      return token;
    }
  }

  function jsonObj(strOrObject)
  {
    if (typeof strOrObject == "string") {
      return JSON.parse(strOrObject);
    }
    return strOrObject;
  }

  function constructAlgorithm(jwtAlgStr, key)
  {
    if ("ES256" === jwtAlgStr) {
      throw new NotImplementedException("ECDSA-SHA256 not yet implemented");
    } else if ("ES384" === jwtAlgStr) {
      throw new NotImplementedException("ECDSA-SHA384 not yet implemented");
    } else if ("ES512" === jwtAlgStr) {
      throw new NotImplementedException("ECDSA-SHA512 not yet implemented");
    } else if ("HS256" === jwtAlgStr) {
      return new HMACAlgorithm("sha256", key);
    } else if ("HS384" === jwtAlgStr) {
      throw new NotImplementedException("HMAC-SHA384 not yet implemented");
    } else if ("HS512" === jwtAlgStr) {
      throw new NotImplementedException("HMAC-SHA512 not yet implemented");
    } else if ("RS256" === jwtAlgStr) {
      return new RSASHAAlgorithm("sha256", key);
    } else if ("RS384" === jwtAlgStr) {
      throw new NotImplementedException("RSA-SHA384 not yet implemented");
    } else if ("RS512" === jwtAlgStr) {
      throw new NotImplementedException("RSA-SHA512 not yet implemented");
    } else {
      throw new NoSuchAlgorithmException("Unknown algorithm: " + jwtAlgStr);
    }
  }

  WebToken.prototype =
  {
    serialize: function _serialize(key)
    {
      var header = jsonObj(this.pkAlgorithm);
      var jwtAlgStr = header.alg;
      var algorithm = constructAlgorithm(jwtAlgStr, key);
      var algBytes = base64urlencode(this.pkAlgorithm);
      var jsonBytes = base64urlencode(this.objectStr);

      var stringToSign = algBytes + "." + jsonBytes;
      algorithm.update(stringToSign);
      var digestValue = algorithm.finalize();

      var signatureValue = algorithm.sign();
      return algBytes + "." + jsonBytes + "." + signatureValue;
    },

      getJSONObject: function _get_json_obj()
      {
          return JSON.parse(base64urldecode(this.payloadSegment));
      },
    
    verify: function _verify(key)
    {
      var header = jsonObj(this.pkAlgorithm);
      var jwtAlgStr = header.alg;
      var algorithm = constructAlgorithm(jwtAlgStr, key);
      algorithm.update(this.headerSegment + "." + this.payloadSegment);
      algorithm.finalize();
      return algorithm.verify(this.cryptoSegment);
    }
  }
  
  jwt.WebToken = WebToken;
  jwt.WebTokenParser = WebTokenParser;
  jwt.base64urlencode = base64urlencode;
  jwt.base64urldecode = base64urldecode;
})();

var EXPORTED_SYMBOLS = ["jwt"];
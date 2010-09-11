<?
require_once("OAuth.php");

// handling of server secret:
// * webserver cannot serve up contents of .inc files (lest creds can be stolen)
// * authcreds.inc cannot be checked in, it's only on the server
include('authcreds.inc'); 
$key = $twitter_oauth_consumer_key;
$secret = $twitter_oauth_consumer_secret;
$callback_url = "https://tweetsup.mozillalabs.com/~lhilaiel/appetizer/examples/tweetsup/auth/";
$test_consumer = new OAuthConsumer($key, $secret, $callback_url);

$request_endpoint = "https://api.twitter.com/oauth/request_token";
$authorize_endpoint = "https://api.twitter.com/oauth/authorize";
$access_token_endpoint = "https://api.twitter.com/oauth/access_token";

session_start(); 

if (array_key_exists('token_secret', $_SESSION) &&
    array_key_exists('oauth_token', $_GET) &&
    array_key_exists('oauth_verifier', $_GET) )
{
  // now we need to turn the returned *request token* into an access token.
  // a pretty useless aspect of oauth for our purposes.  whatever.
  $token = new OAuthToken($_GET['oauth_token'], md5(md5($_SESSION['token_secret'])));
  $params = array('oauth_verifier' => $_GET['oauth_verifier']);
  $acc_req = OAuthRequest::from_consumer_and_token($test_consumer, $token, "GET",
						   $access_token_endpoint, $params);
  $acc_req->sign_request(new OAuthSignatureMethod_HMAC_SHA1(), $test_consumer, $token);

  // create a new cURL resource
  $ch = curl_init();

  // set URL and other appropriate options
  curl_setopt($ch, CURLOPT_URL, "$acc_req");
  curl_setopt($ch, CURLOPT_HEADER, 0);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

  // grab URL and pass it to the browser
  $res = curl_exec($ch);

  // close cURL resource, and free up system resources
  curl_close($ch);

  $tok = array();
  parse_str($res, $tok);

  // we've now got all we need to issue secured requests!  all we gotta do is
  // stuff this stuff into localStorage and send the user on their way (back
  // to the myapps dashboard)
  
  // first, set up the variables that the store_secrets_in_local_storage.inc file
  // will store for us
  $token = $tok['oauth_token'];
  $token_secret = $tok['oauth_token_secret'];

  // XXX: what is verifier?
  
  // now include the page
  include("store_secrets_in_local_storage.inc");

} else if(array_key_exists('doauth', $_GET)) {
  // STEP 2:
  // the page logic has confirmed that we do acutally need to do authentication
  // so we'll build a request and redirect the user

  $params = array( 'oauth_callback' => $callback_url );
  $req_req = OAuthRequest::from_consumer_and_token($test_consumer, NULL, "GET", $request_endpoint, $params);
  $req_req->sign_request(new OAuthSignatureMethod_HMAC_SHA1(), $test_consumer, NULL);

  // create a new cURL resource
  $ch = curl_init();

  // set URL and other appropriate options
  curl_setopt($ch, CURLOPT_URL, "$req_req");
  curl_setopt($ch, CURLOPT_HEADER, 0);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

  // grab URL and pass it to the browser
  $res = curl_exec($ch);

  // close cURL resource, and free up system resources
  curl_close($ch);

  $tok = array();
  parse_str($res, $tok);
  $_SESSION['token_secret'] = $tok['oauth_token_secret'];

  $token = $tok['oauth_token'];

  // now $tok has oauth_token and oauth_token_secret
  // let's send our happy user to get authorized.
  $auth_url = $authorize_endpoint . "?oauth_token=$token";

  header("Location: $auth_url" );
} else {
  // STEP 1:
  // user just landed here, presumably by being redirected by myapps upon user clicking on "authorize"
  // let's send down the logic required to check and see if we have the authentication tokens we
  // require in local storage.  this page will kick the user back to us with the 'doauth' get variable
  // set if the oauth creds haven't yet been sent.
  readfile("check_for_auth_tokens.html");
}
?>

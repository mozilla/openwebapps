<?
// an itty bitty script you can connect to over https, pass some tokens to, and it'll 
// mix in consumer private data to execute a query to twitter.  OAuth is hard,
// let's go shopping!
require_once("OAuth.php");

// handling of server secret:
// * webserver cannot serve up contents of .inc files (lest creds can be stolen)
// * authcreds.inc cannot be checked in, it's only on the server
include('../authcreds.inc'); 
$cons_key = $twitter_oauth_consumer_key;
$cons_secret = $twitter_oauth_consumer_secret;

$twitter_api = 'http://api.twitter.com/1/';

/* this stuff is passed from the client */
$oauth_token = $_GET['token'];
$token_secret = $_GET['secret'];
$api_path = $_GET['path'];

/* XXX: validate? */

$cons_obj = new OAuthConsumer($cons_key, $cons_secret, $callback_url);
$token = new OAuthToken($oauth_token, $token_secret);
$url = $twitter_api . $api_path;
$params = array();

$res_req = OAuthRequest::from_consumer_and_token($cons_obj, $token, "GET", $url, $params);
$res_req->sign_request(new OAuthSignatureMethod_HMAC_SHA1(), $cons_obj, $token);

/* hit the twit and spit out the results */
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $res_req);
curl_exec($ch);
curl_close($ch);
?>
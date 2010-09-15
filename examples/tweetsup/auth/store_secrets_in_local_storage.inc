<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
          "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
  <title></title>
</head>
<body style="position:relative">
   <?= $token; ?> 
   <?= $token_secret; ?> 
</body>
<script type="text/javascript">

var storage = window.localStorage;
storage.setItem("oauth_token", "<?= $token; ?>");
storage.setItem("oauth_secret", "<?= $token_secret; ?>");
document.location = "https://tweetsup.mozillalabs.com";

</script>
</html>

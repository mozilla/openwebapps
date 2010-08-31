<?php
$url = "";
if (array_key_exists('url', $_GET)) { $url = $_GET['url']; } 
passthru("./appify.py " . escapeshellarg($url));
?>

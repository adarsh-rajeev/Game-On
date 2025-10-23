<?php
$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = '9995';          
$DB_NAME = 'mg_db';
$db_port = 3306; // default MySQL port


$conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
if ($conn->connect_error) {
  http_response_code(500);
  die('DB connection failed: ' . $conn->connect_error);
}
?>

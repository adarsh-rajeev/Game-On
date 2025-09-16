<?php
// server/register.php - REGISTER ONLY (errors if user exists)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST');

require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
$username = isset($input['username']) ? trim($input['username']) : '';
$password = isset($input['password']) ? (string)$input['password'] : '';

if ($username === '' || $password === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Missing username or password']);
  exit;
}
if (mb_strlen($username) > 50) {
  http_response_code(422);
  echo json_encode(['ok' => false, 'error' => 'Username too long']);
  exit;
}
if (strlen($password) < 6) {
  http_response_code(422);
  echo json_encode(['ok' => false, 'error' => 'Password must be at least 6 characters']);
  exit;
}

$check = $conn->prepare('SELECT 1 FROM users WHERE username=? LIMIT 1');
$check->bind_param('s', $username);
$check->execute();
$check->store_result();

if ($check->num_rows > 0) {
  $check->close();
  echo json_encode(['ok' => false, 'error' => 'Username already exists. Please log in.']);
  $conn->close();
  exit;
}
$check->close();

$hash = password_hash($password, PASSWORD_DEFAULT);
$ins = $conn->prepare('INSERT INTO users (username, password) VALUES (?, ?)');
$ins->bind_param('ss', $username, $hash);
if ($ins->execute()) {
  echo json_encode(['ok' => true]);
} else {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Registration failed']);
}
$ins->close();
$conn->close();
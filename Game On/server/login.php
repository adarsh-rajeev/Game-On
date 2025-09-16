<?php
// server/login.php - LOGIN ONLY (no auto-register)
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

$stmt = $conn->prepare('SELECT password FROM users WHERE username=? LIMIT 1');
$stmt->bind_param('s', $username);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 0) {
  $stmt->close();
  echo json_encode(['ok' => false, 'error' => 'Account not found. Please register.']);
  $conn->close();
  exit;
}

$stmt->bind_result($hash);
$stmt->fetch();
$stmt->close();

if (!password_verify($password, $hash)) {
  echo json_encode(['ok' => false, 'error' => 'Incorrect password.']);
  $conn->close();
  exit;
}

echo json_encode(['ok' => true]);
$conn->close();
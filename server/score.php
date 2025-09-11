<?php
// server/score.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
$name = isset($input['name']) ? trim($input['name']) : '';
$score = isset($input['score']) ? intval($input['score']) : 0;

if ($name === '' || $score < 0) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid name or score']);
  exit;
}

if (mb_strlen($name) > 50) {
  $name = mb_substr($name, 0, 50);
}

$stmt = $conn->prepare('INSERT INTO highscores (player_name, score) VALUES (?, ?)');
$stmt->bind_param('si', $name, $score);

if ($stmt->execute()) {
  echo json_encode(['ok' => true, 'id' => $stmt->insert_id]);
} else {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'DB insert failed']);
}

$stmt->close();
$conn->close();
?>

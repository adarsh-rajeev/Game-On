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
$username = isset($input['username']) ? trim($input['username']) : '';
$score = isset($input['score']) ? intval($input['score']) : 0;

if ($username === '' || $score < 0) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid username or score']);
  exit;
}

if (mb_strlen($username) > 50) {
  $username = mb_substr($username, 0, 50);
}

// Save only if score is higher than previous
$stmt = $conn->prepare('SELECT score FROM highscores WHERE username=?');
$stmt->bind_param('s', $username);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
  $stmt->bind_result($oldscore);
  $stmt->fetch();
  if ($score > $oldscore) {
    $stmt->close();
    $update = $conn->prepare('UPDATE highscores SET score=?, created_at=NOW() WHERE username=?');
    $update->bind_param('is', $score, $username);
    $ok = $update->execute();
    $update->close();
    echo json_encode(['ok' => $ok]);
  } else {
    $stmt->close();
    echo json_encode(['ok' => true]);
  }
} else {
  $stmt->close();
  $insert = $conn->prepare('INSERT INTO highscores (username, score) VALUES (?, ?)');
  $insert->bind_param('si', $username, $score);
  $ok = $insert->execute();
  $insert->close();
  echo json_encode(['ok' => $ok]);
}
$conn->close();
?>
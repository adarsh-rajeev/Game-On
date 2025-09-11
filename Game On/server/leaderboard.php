<?php
// server/leaderboard.php
require_once __DIR__ . '/config.php';

$result = $conn->query('SELECT player_name, score, created_at FROM highscores ORDER BY score DESC, created_at ASC LIMIT 50');
$rows = [];
if ($result) {
  while ($r = $result->fetch_assoc()) {
    $rows[] = $r;
  }
}
$conn->close();
?>
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Leaderboard</title>
  <link rel="stylesheet" href="../public/style.css" />
</head>
<body>
  <div class="container">
    <h1>Leaderboard</h1>
    <table class="board">
      <thead>
        <tr><th>Rank</th><th>Name</th><th>Score</th><th>When</th></tr>
      </thead>
      <tbody>
        <?php
          $rank = 1;
          foreach ($rows as $row) {
            $name = htmlspecialchars($row['player_name'], ENT_QUOTES, 'UTF-8');
            $score = intval($row['score']);
            $when = htmlspecialchars($row['created_at'], ENT_QUOTES, 'UTF-8');
            echo "<tr><td>{$rank}</td><td>{$name}</td><td>{$score}</td><td>{$when}</td></tr>";
            $rank++;
          }
          if (count($rows) === 0) {
            echo "<tr><td colspan='4'>No scores yet. Be the first!</td></tr>";
          }
        ?>
      </tbody>
    </table>
    <p><a class="btn" href="../public/index.html">Back to Game</a></p>
  </div>
</body>
</html>

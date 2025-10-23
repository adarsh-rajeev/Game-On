<?php
require_once __DIR__ . '/config.php';

/**
 * Helper escaping
 */
function esc($s) {
  return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

/**
 * Get total distinct players
 */
function getTotalPlayers(mysqli $conn): int {
  $res = $conn->query("SELECT COUNT(DISTINCT username) AS c FROM highscores");
  if ($res && $row = $res->fetch_assoc()) return (int)$row['c'];
  return 0;
}

/**
 * Get top N rows
 */
function getTopRows(mysqli $conn, int $limit = 50): array {
  $sql = "SELECT username, score, created_at
          FROM highscores
          ORDER BY score DESC, created_at ASC
          LIMIT ?";
  $stmt = $conn->prepare($sql);
  $stmt->bind_param('i', $limit);
  $stmt->execute();
  $res = $stmt->get_result();
  $rows = [];
  while ($r = $res->fetch_assoc()) {
    $rows[] = $r;
  }
  $stmt->close();
  return $rows;
}

/**
 * Get a user's best score & rank (rank = count of higher scores + 1)
 * Tie handling: users with same score share consecutive ranks (simple approach).
 */
function getUserRank(mysqli $conn, string $username): array {
  $bestStmt = $conn->prepare("SELECT score FROM highscores WHERE username=? ORDER BY score DESC LIMIT 1");
  $bestStmt->bind_param('s', $username);
  $bestStmt->execute();
  $res = $bestStmt->get_result();
  if (!$res || !$res->num_rows) {
    $bestStmt->close();
    return [null, null];
  }
  $score = (int)$res->fetch_assoc()['score'];
  $bestStmt->close();

  $rankStmt = $conn->prepare("SELECT COUNT(*) AS higher FROM highscores WHERE score > ?");
  $rankStmt->bind_param('i', $score);
  $rankStmt->execute();
  $res2 = $rankStmt->get_result();
  $higher = 0;
  if ($res2 && $res2->num_rows) {
    $higher = (int)$res2->fetch_assoc()['higher'];
  }
  $rankStmt->close();
  $rank = $higher + 1;
  return [$score, $rank];
}

/* ----------- INPUTS ----------- */
$limit = 50;
$userParam = isset($_GET['user']) ? trim($_GET['user']) : '';

/* ----------- FETCH DATA (ONCE) ----------- */
$rows = getTopRows($conn, $limit);
$totalPlayers = getTotalPlayers($conn);

$userScore = null;
$userRank = null;
if ($userParam !== '') {
  [$userScore, $userRank] = getUserRank($conn, $userParam);
}

/* ----------- JSON MODE (RETURN EARLY) ----------- */
if (isset($_GET['json'])) {
  header('Content-Type: application/json');
  $payload = [];
  $i = 0;
  foreach ($rows as $r) {
    $i++;
    $payload[] = [
      'rank' => $i,
      'username' => $r['username'],
      'score' => (int)$r['score'],
      'created_at' => $r['created_at']
    ];
  }
  echo json_encode([
    'ok' => true,
    'rows' => $payload,
    'totalPlayers' => $totalPlayers,
    'user' => $userParam !== '' ? [
      'username' => $userParam,
      'score' => $userScore,
      'rank' => $userRank
    ] : null,
    'timestamp' => date('c')
  ]);
  $conn->close();
  exit;
}

$conn->close();
?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Leaderboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="stylesheet" href="../public/style.css?lb=3">
<style>
/* (Same styles as previous version – trimmed for brevity) */
/* You can keep your existing inlined styles. If you removed them earlier, paste the
   full style block from the previous message here. For clarity, only essential parts kept. */
body.lb-body {
  min-height:100vh;background:radial-gradient(circle at 30% 30%,#132238 0%,#0f172a 70%);
  margin:0;color:var(--text,#e2e8f0);font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;
}
.lb-wrapper{max-width:1200px;margin:0 auto;padding:clamp(1.1rem,2vw,2.2rem)}
.lb-card{background:linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015));
backdrop-filter:blur(18px)saturate(160%);border:1px solid rgba(255,255,255,0.12);border-radius:22px;
padding:1.4rem 1.6rem 1.8rem;box-shadow:0 6px 26px -8px rgba(0,0,0,0.55),0 3px 10px -2px rgba(0,0,0,0.45);
display:flex;flex-direction:column;gap:1.15rem;animation:fadeIn .55s ease;position:relative;overflow:hidden}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
/* Keep the rest of the CSS from the earlier improved version if you want full styling */
</style>
</head>
<body class="lb-body">
  <div class="lb-wrapper">
    <div class="lb-card">
      <h1 style="margin:0 0 .5rem;font-size:1.9rem;letter-spacing:.5px;display:flex;align-items:center;gap:.6rem;">🏆 Leaderboard</h1>
      <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start;justify-content:space-between">
        <div style="font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;display:flex;flex-wrap:wrap;gap:1.1rem;font-weight:600">
          <span>Total Players: <strong style="color:#e2e8f0"><?php echo $totalPlayers; ?></strong></span>
          <span>Showing Top <strong style="color:#e2e8f0"><?php echo count($rows); ?></strong></span>
          <span id="lastUpdated">Loaded: <strong style="color:#e2e8f0"><?php echo date('H:i:s'); ?></strong></span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:.6rem;align-items:center">
          <div style="position:relative">
            <input id="filterInput" placeholder="Search user..." aria-label="Filter usernames"
                   style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.2);padding:.55rem .75rem;color:#e2e8f0;border-radius:10px;outline:none;width:200px;font:inherit;font-size:.75rem">
          </div>
          <button class="btn small" id="refreshBtn">Refresh</button>
          <a class="btn small" href="../public/index.html">Back to Game</a>
        </div>
      </div>

      <?php if ($userParam !== '' && $userRank !== null): ?>
        <div style="background:#334155;color:#e2e8f0;padding:.35rem .7rem;border-radius:10px;font-size:.6rem;font-weight:600;letter-spacing:.1em;display:inline-flex;gap:.4rem;">
          Your Rank: <strong style="color:#93c5fd">#<?php echo (int)$userRank; ?></strong>
          <span style="opacity:.7">(<?php echo esc($userParam); ?>)</span>
        </div>
      <?php endif; ?>

      <div style="overflow:auto;border:1px solid rgba(255,255,255,0.1);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015));">
        <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:.8rem;min-width:640px" id="lbTable">
          <thead>
            <tr style="background:#17263c;color:#94a3b8;font-size:.68rem;letter-spacing:.15em;text-align:left">
              <th style="padding:.65rem .75rem;width:80px;">Rank</th>
              <th style="padding:.65rem .75rem;">Username</th>
              <th style="padding:.65rem .75rem;width:120px;">Score</th>
              <th style="padding:.65rem .75rem;width:170px;">When</th>
            </tr>
          </thead>
          <tbody id="lbBody">
          <?php
            if (!count($rows)) {
              echo '<tr><td colspan="4" style="padding:2rem 1rem;text-align:center;color:#94a3b8;font-size:.8rem;">No scores yet.</td></tr>';
            } else {
              $i=0;
              foreach ($rows as $r) {
                $i++;
                $medal = $i===1?'🥇':($i===2?'🥈':($i===3?'🥉':''));
                $isYou = ($userParam !== '' && strcasecmp($r['username'],$userParam)===0);
                echo '<tr data-username="'.esc(strtolower($r['username'])).'"'.
                     ($isYou?' style="background:linear-gradient(90deg,rgba(56,189,248,0.25),rgba(59,130,246,0.05))"':'').'>';
                echo '<td style="padding:.55rem .75rem;font-weight:600;display:flex;align-items:center;gap:.4rem;">'.$i.
                     ($medal?'<span style="font-size:1rem">'.$medal.'</span>':'').'</td>';
                echo '<td style="padding:.55rem .75rem;"><strong>'.esc($r['username']).'</strong></td>';
                echo '<td style="padding:.55rem .75rem;font-weight:600;color:#93c5fd;">'.(int)$r['score'].'</td>';
                echo '<td style="padding:.55rem .75rem;"><small data-time="'.esc($r['created_at']).'">'.esc($r['created_at']).'</small></td>';
                echo '</tr>';
              }
            }
          ?>
          </tbody>
        </table>
      </div>

      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;font-size:.62rem;color:#94a3b8;letter-spacing:.09em;margin-top:.6rem;">
        <span>Higher score overwrites your previous entry.</span>
        <span>&copy; <?php echo date('Y'); ?> Game On</span>
      </div>
    </div>
  </div>

<script>
(function(){
  const filterInput = document.getElementById('filterInput');
  const tbody = document.getElementById('lbBody');
  const refreshBtn = document.getElementById('refreshBtn');
  const lastUpdatedEl = document.getElementById('lastUpdated');
  const userParam = new URLSearchParams(location.search).get('user') || '';
  let refreshing = false;

  function relTime(isoLike){
    const d = new Date(isoLike.replace(' ','T'));
    if(isNaN(d)) return isoLike;
    const s = (Date.now()-d.getTime())/1000;
    if(s<60) return 'just now';
    if(s<3600) return Math.floor(s/60)+'m ago';
    if(s<86400) return Math.floor(s/3600)+'h ago';
    if(s<604800) return Math.floor(s/86400)+'d ago';
    return d.toISOString().slice(0,10);
  }
  function updateTimes(){
    document.querySelectorAll('[data-time]').forEach(el=>{
      const raw=el.getAttribute('data-time');
      el.textContent = relTime(raw);
      el.title = raw;
    });
  }
  function filter(){
    const q = (filterInput.value || '').toLowerCase();
    [...tbody.querySelectorAll('tr')].forEach(tr=>{
      const u = tr.getAttribute('data-username')||'';
      tr.style.display = !q || u.includes(q) ? '' : 'none';
    });
  }
  async function refresh(){
    if(refreshing) return;
    refreshing=true;
    const orig=refreshBtn.textContent;
    refreshBtn.disabled=true;
    refreshBtn.textContent='...';
    try{
      const url = new URL(location.href);
      url.searchParams.set('json','1');
      if(userParam) url.searchParams.set('user', userParam);
      const res = await fetch(url.toString(), { headers:{'Accept':'application/json'} });
      const text = await res.text();
      if(!res.ok) throw new Error('HTTP '+res.status);
      let data;
      try { data = JSON.parse(text); }
      catch(e){ throw new Error('Server did not return JSON (got HTML or error).'); }
      if(!data.ok) throw new Error(data.error || 'Failed');

      tbody.innerHTML = data.rows.length ? data.rows.map(r=>{
        const medal = r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':'';
        const youClass = (userParam && r.username.toLowerCase()===userParam.toLowerCase());
        return `<tr data-username="${escapeHtml(r.username.toLowerCase())}" ${youClass?'style="background:linear-gradient(90deg,rgba(56,189,248,0.25),rgba(59,130,246,0.05))"':''}>
          <td style="padding:.55rem .75rem;font-weight:600;display:flex;align-items:center;gap:.4rem;">${r.rank}${medal?`<span style="font-size:1rem">${medal}</span>`:''}</td>
          <td style="padding:.55rem .75rem;"><strong>${escapeHtml(r.username)}</strong></td>
          <td style="padding:.55rem .75rem;font-weight:600;color:#93c5fd;">${r.score}</td>
          <td style="padding:.55rem .75rem;"><small data-time="${escapeHtml(r.created_at)}">${escapeHtml(r.created_at)}</small></td>
        </tr>`;
      }).join('') : '<tr><td colspan="4" style="padding:2rem 1rem;text-align:center;color:#94a3b8;font-size:.8rem;">No scores yet.</td></tr>';

      updateTimes();
      if(userParam){
        const you = tbody.querySelector('[data-username="'+CSS.escape(userParam.toLowerCase())+'"]');
        you && you.scrollIntoView({block:'nearest'});
      }
      lastUpdatedEl && (lastUpdatedEl.innerHTML='Loaded: <strong>'+new Date().toLocaleTimeString()+'</strong>');
    }catch(err){
      alert('Refresh failed: '+err.message);
    }finally{
      refreshBtn.disabled=false;
      refreshBtn.textContent=orig;
      refreshing=false;
    }
  }
  function escapeHtml(s){
    return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  filterInput && filterInput.addEventListener('input', filter);
  refreshBtn && refreshBtn.addEventListener('click', refresh);
  updateTimes();
  if(userParam){
    const you = tbody.querySelector('[data-username="'+CSS.escape(userParam.toLowerCase())+'"]');
    you && you.scrollIntoView({block:'nearest'});
  }
})();
</script>
</body>
</html>
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
<link rel="stylesheet" href="../public/style.css?lb=4">
<style>
/* Page base */
body.lb-body {
  min-height:100vh;
  background:
    radial-gradient(1100px 600px at 82% 12%, rgba(59,130,246,0.16), transparent 60%),
    radial-gradient(900px 700px at 12% 88%, rgba(16,185,129,0.14), transparent 65%),
    radial-gradient(circle at 30% 30%, #132238 0%, #0f172a 70%);
  margin:0;
  color:var(--text,#e2e8f0);
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* Vectors: blobs, orbs, grid (like landing/auth) */
.lb-vectors { pointer-events:none; position:fixed; inset:0; z-index:0; overflow:hidden; }
.lb-blob {
  position:absolute; filter: blur(36px); opacity:.35; mix-blend-mode: screen;
  animation: lbFloat 18s ease-in-out infinite; will-change: transform;
}
.lb-blob.a {
  width: 520px; height: 520px; right: -120px; top: -80px;
  background:
    radial-gradient(circle at 30% 30%, #3b82f6, rgba(59,130,246,0) 60%),
    radial-gradient(circle at 70% 70%, #10b981, rgba(16,185,129,0) 55%);
}
.lb-blob.b {
  width: 440px; height: 440px; left: -120px; bottom: -120px;
  background:
    radial-gradient(circle at 40% 40%, #f59e0b, rgba(245,158,11,0) 60%),
    radial-gradient(circle at 70% 30%, #22d3ee, rgba(34,211,238,0) 55%);
  animation-delay: -4s;
}
@keyframes lbFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }

.lb-orb {
  position:absolute; width: 10px; height: 10px; border-radius:999px;
  background:#93c5fd; box-shadow:0 0 14px #93c5fd; opacity:.65;
  animation: lbDrift 10s linear infinite;
}
.lb-orb.o1{ left: 12%; top: 22%; animation-duration: 12s; }
.lb-orb.o2{ left: 28%; top: 12%; animation-duration: 11s; }
.lb-orb.o3{ right: 22%; top: 20%; animation-duration: 13s; }
.lb-orb.o4{ right: 14%; bottom: 22%; animation-duration: 14s; }
@keyframes lbDrift { 0%{transform:translate(0,0)} 50%{transform:translate(10px,-16px)} 100%{transform:translate(0,0)} }

.lb-grid {
  position:absolute; inset:0;
  background-image:
    linear-gradient(to right, rgba(255,255,255,.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.04) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse at center, rgba(0,0,0,.55), transparent 70%);
}

/* Layout */
.lb-wrapper{max-width:1200px;margin:0 auto;padding:clamp(1.1rem,2vw,2.2rem); position:relative; z-index:1;}
.lb-card{
  background:linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015));
  backdrop-filter:blur(18px) saturate(160%);
  border:1px solid rgba(255,255,255,0.12);
  border-radius:22px;
  padding:1.4rem 1.6rem 1.8rem;
  box-shadow:0 6px 26px -8px rgba(0,0,0,0.55),0 3px 10px -2px rgba(0,0,0,0.45);
  display:flex;flex-direction:column;gap:1.15rem;animation:fadeIn .55s ease;position:relative;overflow:hidden
}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

/* Buttons: remove underline + hover spotlight + lift */
a.btn, a.btn:link, a.btn:visited { text-decoration: none; }
.btn { position: relative; overflow: hidden; }
.btn::before {
  content:'';
  position:absolute; inset:0;
  background: radial-gradient(220px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.24), transparent 40%);
  opacity:0; transition: opacity .22s ease; pointer-events:none;
}
.btn:hover::before{ opacity:.22; }
.btn:hover{ transform: translateY(-1px); box-shadow: 0 8px 22px rgba(0,0,0,0.35); }

/* Small variant to match top-right controls */
.btn.small { padding:.45rem .75rem; font-size:.85rem; border-radius:10px; }

/* Controls row */
.lb-controls{display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start;justify-content:space-between}
.lb-meta{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;display:flex;flex-wrap:wrap;gap:1.1rem;font-weight:600}

/* Inputs */
.lb-input{
  background:rgba(255,255,255,0.07);
  border:1px solid rgba(255,255,255,0.2);
  padding:.55rem .75rem;color:#e2e8f0;border-radius:10px;outline:none;
  width:200px;font:inherit;font-size:.75rem;transition:box-shadow .2s ease,transform .2s ease,background .2s ease;
}
.lb-input:focus{
  box-shadow:0 0 0 3px rgba(56,189,248,0.25),0 6px 16px rgba(56,189,248,0.15);
  transform: translateY(-1px);
  background: rgba(255,255,255,0.10);
}

/* Table */
.lb-table-wrap{overflow:auto;border:1px solid rgba(255,255,255,0.1);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015));}
table.lb-table{width:100%;border-collapse:separate;border-spacing:0;font-size:.8rem;min-width:640px}
table.lb-table thead tr{background:#17263c;color:#94a3b8;font-size:.68rem;letter-spacing:.15em;text-align:left}
table.lb-table th,table.lb-table td{padding:.65rem .75rem}
table.lb-table td strong{color:#e2e8f0}

/* Footer details */
.lb-foot{display:flex;flex-wrap:wrap;justify-content:space-between;font-size:.62rem;color:#94a3b8;letter-spacing:.09em;margin-top:.6rem}

/* Small trophy icon spacing */
.lb-title{display:flex;align-items:center;gap:.6rem;margin:0 0 .5rem;font-size:1.9rem;letter-spacing:.5px}
.lb-title .t{font-size:1.1rem}

/* Utility */
.hidden{display:none!important}
</style>
</head>
<body class="lb-body">
  <!-- Vector background -->
  <div class="lb-vectors" aria-hidden="true">
    <div class="lb-blob a"></div>
    <div class="lb-blob b"></div>
    <span class="lb-orb o1"></span>
    <span class="lb-orb o2"></span>
    <span class="lb-orb o3"></span>
    <span class="lb-orb o4"></span>
    <div class="lb-grid"></div>
  </div>

  <div class="lb-wrapper">
    <div class="lb-card">
      <h1 class="lb-title">🏆 <span>Leaderboard</span></h1>

      <div class="lb-controls">
        <div class="lb-meta">
          <span>TOTAL PLAYERS: <strong style="color:#e2e8f0"><?php echo $totalPlayers; ?></strong></span>
          <span>SHOWING TOP <strong style="color:#e2e8f0"><?php echo count($rows); ?></strong></span>
          <span id="lastUpdated">LOADED: <strong style="color:#e2e8f0"><?php echo date('H:i:s'); ?></strong></span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:.6rem;align-items:center">
          <input id="filterInput" class="lb-input" placeholder="Search user..." aria-label="Filter usernames">
          <button class="btn small glass" id="refreshBtn">Refresh</button>
          <!-- Back to Game without underline, styled as glass button -->
          <a class="btn small glass" id="backBtn" href="../public/index.html">Back to Game</a>
        </div>
      </div>

      <?php if ($userParam !== '' && $userRank !== null): ?>
        <div style="background:#334155;color:#e2e8f0;padding:.35rem .7rem;border-radius:10px;font-size:.6rem;font-weight:600;letter-spacing:.1em;display:inline-flex;gap:.4rem;">
          Your Rank: <strong style="color:#93c5fd">#<?php echo (int)$userRank; ?></strong>
          <span style="opacity:.7">(<?php echo esc($userParam); ?>)</span>
        </div>
      <?php endif; ?>

      <div class="lb-table-wrap">
        <table class="lb-table" id="lbTable">
          <thead>
            <tr>
              <th style="width:80px;">Rank</th>
              <th>Username</th>
              <th style="width:120px;">Score</th>
              <th style="width:170px;">When</th>
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
                     ($isYou?' style="background:linear-gradient(90deg,rgba(56,189,248,0.25),rgba(59,130,246,0.05))"':'').'>'.
                     '<td style="font-weight:600;display:flex;align-items:center;gap:.4rem;">'.$i.
                     ($medal?'<span style="font-size:1rem">'.$medal.'</span>':'').'</td>'.
                     '<td><strong>'.esc($r['username']).'</strong></td>'.
                     '<td style="font-weight:600;color:#93c5fd;">'.(int)$r['score'].'</td>'.
                     '<td><small data-time="'.esc($r['created_at']).'">'.esc($r['created_at']).'</small></td>'.
                     '</tr>';
              }
            }
          ?>
          </tbody>
        </table>
      </div>

      <div class="lb-foot">
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

  // Button hover spotlight (matches app buttons)
  document.querySelectorAll('.btn').forEach(btn=>{
    btn.addEventListener('pointermove', e=>{
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      btn.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

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
          <td style="font-weight:600;display:flex;align-items:center;gap:.4rem;">${r.rank}${medal?`<span style="font-size:1rem">${medal}</span>`:''}</td>
          <td><strong>${escapeHtml(r.username)}</strong></td>
          <td style="font-weight:600;color:#93c5fd;">${r.score}</td>
          <td><small data-time="${escapeHtml(r.created_at)}">${escapeHtml(r.created_at)}</small></td>
        </tr>`;
      }).join('') : '<tr><td colspan="4" style="padding:2rem 1rem;text-align:center;color:#94a3b8;font-size:.8rem;">No scores yet.</td></tr>';

      updateTimes();
      if(userParam){
        const you = tbody.querySelector('[data-username="'+CSS.escape(userParam.toLowerCase())+'"]');
        you && you.scrollIntoView({block:'nearest'});
      }
      lastUpdatedEl && (lastUpdatedEl.innerHTML='LOADED: <strong>'+new Date().toLocaleTimeString()+'</strong>');
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
<script>
  // Remove underline from any legacy link styles (safety)
  document.querySelectorAll('a').forEach(a => a.style.textDecoration = 'none');
</script>
</body>
</html>
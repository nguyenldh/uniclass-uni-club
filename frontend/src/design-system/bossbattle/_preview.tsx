/* ============================================================
   Săn Boss — Preview app (demo standalone).
   Loaded by "Săn Boss.html". Globals come from the bundles.
   ============================================================ */

const TIME_LIMIT = 30;     // CFG-05 (demo dùng 30s cho nhanh)
const BASE_POINT = 10;     // CFG-03
const MAX_BONUS  = 5;      // CFG-04
const HP_PER_HIT = 8;      // demo: mỗi câu đúng (cả khối) trừ ~8% máu
const START_HP   = 40;     // demo bắt đầu — run hoàn hảo sẽ hạ gục

const QUESTIONS = [
  { q: 'Số nào lớn nhất trong các số sau?', options: [
      { key:'A', label:'4.099' }, { key:'B', label:'4.901' },
      { key:'C', label:'4.910' }, { key:'D', label:'4.091' } ], correct:'C' },
  { q: 'Một hình vuông có cạnh 7cm. Chu vi của nó là?', options: [
      { key:'A', label:'14 cm' }, { key:'B', label:'28 cm' },
      { key:'C', label:'49 cm' }, { key:'D', label:'21 cm' } ], correct:'B' },
  { q: '"Mặt trời" trong câu "Mặt trời thức dậy" là?', options: [
      { key:'A', label:'Động từ' }, { key:'B', label:'Tính từ' },
      { key:'C', label:'Danh từ' }, { key:'D', label:'Đại từ' } ], correct:'C' },
  { q: '1 giờ 15 phút bằng bao nhiêu phút?', options: [
      { key:'A', label:'75 phút' }, { key:'B', label:'115 phút' },
      { key:'C', label:'105 phút' }, { key:'D', label:'90 phút' } ], correct:'A' },
  { q: 'Nước sôi ở nhiệt độ bao nhiêu (ở điều kiện thường)?', options: [
      { key:'A', label:'50°C' }, { key:'B', label:'80°C' },
      { key:'C', label:'100°C' }, { key:'D', label:'120°C' } ], correct:'C' },
];

const LB_BASE = [
  { rank:1,  name:'Thuỳ Linh',  meta:'Lớp 4A1', correctCount:34, totalCorrectTimeSec:212, pointsContributed:510 },
  { rank:2,  name:'Quang Huy',  meta:'Lớp 4A3', correctCount:33, totalCorrectTimeSec:240, pointsContributed:495 },
  { rank:3,  name:'Bảo Anh',    meta:'Lớp 4A2', correctCount:33, totalCorrectTimeSec:268, pointsContributed:490 },
  { rank:4,  name:'Minh Khôi',  meta:'Lớp 4A1', correctCount:31, totalCorrectTimeSec:255, pointsContributed:465, isMe:true },
  { rank:5,  name:'Gia Hân',    meta:'Lớp 4A4', correctCount:30, totalCorrectTimeSec:241, pointsContributed:450 },
  { rank:6,  name:'Đức Mạnh',   meta:'Lớp 4A2', correctCount:29, totalCorrectTimeSec:300, pointsContributed:435 },
  { rank:7,  name:'Phương Vy',  meta:'Lớp 4A3', correctCount:28, totalCorrectTimeSec:262, pointsContributed:420 },
  { rank:8,  name:'Tuấn Kiệt',  meta:'Lớp 4A1', correctCount:27, totalCorrectTimeSec:289, pointsContributed:405 },
  { rank:9,  name:'Hải Đăng',   meta:'Lớp 4A4', correctCount:26, totalCorrectTimeSec:270, pointsContributed:390 },
  { rank:10, name:'Khánh Vân',  meta:'Lớp 4A2', correctCount:25, totalCorrectTimeSec:255, pointsContributed:375 },
  { rank:11, name:'Ngọc Diệp',  meta:'Lớp 4A3', correctCount:24, totalCorrectTimeSec:301, pointsContributed:360 },
  { rank:12, name:'Trí Dũng',   meta:'Lớp 4A1', correctCount:22, totalCorrectTimeSec:312, pointsContributed:330 },
];
const MY_ENTRY = LB_BASE.find(e => e.isMe);

/* =====================================================================
   Interactive flow: Sảnh → Chiến đấu → Kết quả → BXH → Vinh danh
===================================================================== */
function FlowDemo() {
  const [screen, setScreen] = useState('lobby');     // lobby|battle|result|leaderboard|honor
  const [hp, setHp] = useState(START_HP);
  const [hpAtBattleStart, setHpAtBattleStart] = useState(START_HP);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState('answering');
  const [selected, setSelected] = useState(null);
  const [remaining, setRemaining] = useState(TIME_LIMIT);
  const [pips, setPips] = useState(Array(QUESTIONS.length).fill('pending'));
  const [lastDamage, setLastDamage] = useState(null);
  const [bossHit, setBossHit] = useState(false);
  const [tally, setTally] = useState({ correct: 0, time: 0, points: 0 });

  const cur = QUESTIONS[qi];
  const correctKey = cur.correct;

  // per-question countdown
  useEffect(() => {
    if (screen !== 'battle' || phase !== 'answering') return;
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [screen, phase, remaining]);

  useEffect(() => {
    if (screen === 'battle' && phase === 'answering' && remaining <= 0) reveal(null);
  }, [remaining, screen, phase]);

  function startBattle() {
    setHpAtBattleStart(hp);
    setQi(0); setPhase('answering'); setSelected(null);
    setRemaining(TIME_LIMIT);
    setPips(Array(QUESTIONS.length).fill('pending'));
    setTally({ correct: 0, time: 0, points: 0 });
    setScreen('battle');
  }

  function reveal(key) {
    if (phase !== 'answering') return;
    const spent = TIME_LIMIT - Math.max(0, remaining);
    const isCorrect = key === correctKey;
    setSelected(key);
    setPhase('revealing');
    setPips(p => p.map((v, i) => i === qi ? (isCorrect ? 'correct' : 'wrong') : v));
    setTally(t => ({
      correct: t.correct + (isCorrect ? 1 : 0),
      time: t.time + spent,
      points: t.points + (isCorrect ? Math.round(BASE_POINT + MAX_BONUS * Math.max(0, 1 - spent / TIME_LIMIT)) : 0),
    }));
    if (isCorrect) {
      const pts = Math.round(BASE_POINT + MAX_BONUS * Math.max(0, 1 - spent / TIME_LIMIT));
      setHp(h => Math.max(0, h - HP_PER_HIT));
      setLastDamage(pts);
      setBossHit(true);
      setTimeout(() => setBossHit(false), 450);
    } else {
      setLastDamage(null);
    }
  }

  function next() {
    if (qi < QUESTIONS.length - 1) {
      setQi(qi + 1); setPhase('answering'); setSelected(null);
      setRemaining(TIME_LIMIT); setLastDamage(null);
    } else {
      setScreen('result');
    }
  }

  function restart() { setHp(START_HP); setScreen('lobby'); }

  const bossDefeated = hp <= 0;

  let view = null;
  if (screen === 'lobby') {
    view = (
      <BossLobby
        bossName="Hắc Long Tri Thức" hpPercent={hp} grade="Khối 4"
        dailyDone={0} dailyTotal={5}
        ctaStatus={bossDefeated ? 'defeated' : 'ready'}
        onBattle={startBattle}
      />
    );
  } else if (screen === 'battle') {
    view = (
      <BossBattle
        bossName="Hắc Long Tri Thức" bossHpPercent={hp}
        index={qi + 1} total={QUESTIONS.length} pips={pips}
        remaining={remaining} timeLimit={TIME_LIMIT}
        question={cur.q} options={cur.options}
        phase={phase} selected={selected} correct={phase === 'revealing' ? correctKey : null}
        onSelect={reveal} lastDamage={lastDamage} bossHit={bossHit}
      />
    );
  } else if (screen === 'result') {
    view = (
      <BossResult
        correctCount={tally.correct} totalQuestions={QUESTIONS.length}
        totalTime={tally.time} pointsContributed={tally.points}
        hpBefore={hpAtBattleStart} hpAfter={hp}
        bossName="Hắc Long Tri Thức" bossDefeated={bossDefeated}
        onViewLeaderboard={() => setScreen('leaderboard')}
        extraActions={<GameButton color="ghost" onClick={restart}>Về sảnh</GameButton>}
      />
    );
  } else if (screen === 'leaderboard') {
    view = (
      <BossLeaderboard
        entries={LB_BASE} myEntry={MY_ENTRY} questionsPerWeek={35} grade="Khối 4"
        topRight={<GameButton size="sm" color="ghost" onClick={() => setScreen('honor')}>Vinh danh →</GameButton>}
      />
    );
  } else {
    view = (
      <BossHonor
        top10={LB_BASE.slice(0, 10)} grade="Khối 4"
        topRight={<GameButton size="sm" color="ghost" onClick={restart}>Về sảnh</GameButton>}
      />
    );
  }

  const steps = [
    ['lobby', 'Sảnh'], ['battle', 'Chiến đấu'], ['result', 'Kết quả'],
    ['leaderboard', 'BXH'], ['honor', 'Vinh danh'],
  ];

  return (
    <div className="flow">
      <div className="flow-toolbar">
        <div className="flow-steps">
          {steps.map(([k, lbl]) => (
            <button key={k} className={'flow-step' + (screen === k ? ' on' : '')}
              onClick={() => { if (k === 'battle') startBattle(); else setScreen(k); }}>
              {lbl}
            </button>
          ))}
        </div>
        <button className="flow-restart" onClick={restart}>↺ Chơi lại</button>
      </div>
      <div className="flow-stage">{view}</div>
    </div>
  );
}

/* =====================================================================
   Component showcase
===================================================================== */
function Block({ title, note, children }) {
  return (
    <div className="sc-block">
      <div className="sc-title">{title}</div>
      {note && <div className="sc-note">{note}</div>}
      {children}
    </div>
  );
}

function BossStatesShowcase() {
  const [hp, setHp] = useState(85);
  // bộ 5 mốc tuỳ biến để minh hoạ "số stage config được"
  const fiveStates = [
    { min:81, max:100, label:'NGỦ YÊN',  tone:'normal',  glyph:'🐉' },
    { min:61, max:80,  label:'THỨC GIẤC', tone:'normal',  glyph:'🐲' },
    { min:31, max:60,  label:'BỊ THƯƠNG', tone:'injured', glyph:'🐲' },
    { min:1,  max:30,  label:'CUỒNG NỘ',  tone:'rage',    glyph:'👹' },
    { min:0,  max:0,   label:'GỤC NGÃ',   tone:'defeated', glyph:'💀' },
  ];
  return (
    <div className="sc-states">
      <div className="sc-state-main">
        <div style={{ width: 220 }}>
          <BossDisplay hpPercent={hp} />
        </div>
        <div className="sc-state-ctl">
          <BossHpBar hpPercent={hp} />
          <input type="range" min="0" max="100" value={hp}
            onChange={(e) => setHp(+e.target.value)} className="sc-range" />
          <div className="sc-state-row">
            {[0, 15, 45, 85].map(v => (
              <button key={v} className={'sc-pill' + (hp === v ? ' on' : '')} onClick={() => setHp(v)}>{v}%</button>
            ))}
          </div>
          <div className="sc-mini">Bộ 5 mốc tuỳ biến (config được số stage):</div>
          <div className="sc-five">
            {[90, 70, 45, 15, 0].map(v => (
              <div key={v} className="sc-five-item">
                <div style={{ width: 76 }}><BossDisplay hpPercent={v} states={fiveStates} hideStateBadge /></div>
                <span>{bossStateFor(v, fiveStates).label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Showcase() {
  const answerOpts = [
    { key:'A', label:'4.099' }, { key:'B', label:'4.901' },
    { key:'C', label:'4.910' }, { key:'D', label:'4.091' },
  ];
  return (
    <div className="sc">
      <Block title="UI-101 · Boss Display + UI-102 · Máu Boss" note="Ảnh boss đổi theo % HP còn lại. Số mốc trạng thái cấu hình được (CFG-08) — kéo thanh để xem.">
        <BossStatesShowcase />
      </Block>

      <Block title="UI-103 · Daily Quota · UI-104 · Countdown · UI-105 · Battle CTA" note="Nút Chiến đấu có 3 trạng thái: sẵn sàng / đã hoàn thành hôm nay / Boss đã bị hạ.">
        <div className="sc-row">
          <DailyQuotaBadge done={2} total={5} />
          <DailyQuotaBadge done={5} total={5} />
          <WeeklyCountdown />
        </div>
        <div className="sc-row" style={{ marginTop: 12 }}>
          <BattleCTA status="ready" />
          <BattleCTA status="completed" />
          <BattleCTA status="defeated" />
        </div>
      </Block>

      <Block title="UI-201/202 · Câu hỏi & đáp án" note="Trạng thái đáp án: thường · đang chọn · ĐÚNG (xanh) · SAI (đỏ) · mờ. Letter theo kiểu Kahoot.">
        <div className="sc-paper">
          <BattleQuestionCard
            question="Số nào lớn nhất trong các số sau?"
            options={answerOpts} phase="revealing" selected="A" correct="C"
          />
        </div>
      </Block>

      <Block title="UI-203 · Timer · UI-204 · Question Index">
        <div className="sc-row sc-dark">
          <QuestionTimer remaining={26} total={30} />
          <QuestionTimer remaining={8} total={30} />
          <QuestionTimer remaining={3} total={30} />
          <span style={{ width: 24 }} />
          <QuestionIndex index={3} total={5} pips={['correct','wrong','current','pending','pending']} />
        </div>
      </Block>

      <Block title="UI-301/302/303 · Stat · UI-304 · Boss damage recap" note="Khối 3 chỉ số kết quả + recap máu boss tụt sau lượt.">
        <div className="sc-dark" style={{ display:'grid', gap:14 }}>
          <div className="bb-stats">
            <ResultStat label="Câu đúng" value={<>5<small>/5</small></>} />
            <ResultStat label="Tổng thời gian" value="42.0s" />
            <ResultStat label="Điểm đóng góp" value="+72" hero />
          </div>
          <BossDamageRecap hpBefore={40} hpAfter={0} bossName="Hắc Long Tri Thức" />
        </div>
      </Block>

      <Block title="UI-401 · Podium · UI-402 · Rank list · UI-403 · My Rank Card" note="Podium Top 3 vương miện Vàng/Bạc/Đồng. My Rank Card ghim đáy — có cả trạng thái 'Chưa xếp hạng'.">
        <div className="sc-dark" style={{ display:'grid', gap:16 }}>
          <Podium top3={LB_BASE.slice(0, 3)} />
          <RankList entries={LB_BASE.slice(3, 7)} questionsPerWeek={35} />
          <div style={{ display:'grid', gap:10 }}>
            <div style={{ position:'relative' }}><MyRankCard entry={MY_ENTRY} questionsPerWeek={35} /></div>
            <div style={{ position:'relative' }}><MyRankCard entry={null} questionsPerWeek={35} /></div>
          </div>
        </div>
      </Block>

      <Block title="UI-501 · Banner carousel · UI-502 · Avatar frame · UI-503 · Honor podium" note="Vinh danh Top 10 cuối tuần: banner luân phiên, khung avatar 'Dũng sĩ diệt Boss' (7 ngày), bục Top 3.">
        <div className="sc-dark sc-honor">
          <div style={{ display:'grid', gap:16 }}>
            <HonorBannerCarousel entries={LB_BASE.slice(0, 10)} />
            <Podium top3={LB_BASE.slice(0, 3)} />
          </div>
          <WeeklyAvatarFrame name="Thuỳ Linh" avatarBg="linear-gradient(135deg,#ffd76b,#e8a210)" />
        </div>
      </Block>
    </div>
  );
}

/* =====================================================================
   App shell
===================================================================== */
function App() {
  const [tab, setTab] = useState('flow');
  return (
    <div className="page">
      <IconSprites />
      <header className="page-head">
        <div className="brand"><span className="crest" aria-hidden>⚔️</span>
          <div>
            <div className="t">Săn Boss <span>· Boss Battle tuần</span></div>
            <div className="s">Uniclass · Game so tài — bộ component tách rời <code>bossbattle/</code></div>
          </div>
        </div>
        <div className="tabs">
          <button className={tab === 'flow' ? 'on' : ''} onClick={() => setTab('flow')}>Luồng demo</button>
          <button className={tab === 'lib' ? 'on' : ''} onClick={() => setTab('lib')}>Thư viện component</button>
        </div>
      </header>
      {tab === 'flow' ? <FlowDemo /> : <Showcase />}
      <footer className="page-foot">
        SCR-01…05 · UI-101…503 · Import: <code>{`import { BossLobby, BossBattle, BossResult, BossLeaderboard, BossHonor } from './bossbattle'`}</code>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

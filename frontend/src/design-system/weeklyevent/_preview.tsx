/* ============================================================
   Sự kiện tuần — Preview app (demo standalone).
   Loaded by "Sự kiện tuần.html". Globals come from the bundles.
   ============================================================ */

const WEEKLY_TITLE = 'Đấu Trường Số 47: Thử Thách Hình Học';
const GRADE = 5;
const PER_Q = 8;            // demo: 8s/câu (thực tế cấu hình theo tuần)
const REVEAL_GAP = 1100;    // ms khoá trước khi đồng bộ câu sau
const WAIT_SECS = 6;        // demo: phòng chờ 6s
const GRADE_BG = 'linear-gradient(135deg,#a3b4ff,#4b5ee8)';

const WE_QUESTIONS = [
  { stem:'Hình chữ nhật dài 8cm, rộng 5cm. Diện tích của nó là?', correct:'C',
    options:[{key:'A',label:'13 cm²'},{key:'B',label:'26 cm²'},{key:'C',label:'40 cm²'},{key:'D',label:'45 cm²'}] },
  { stem:'Số nào sau đây chia hết cho 9?', correct:'C',
    options:[{key:'A',label:'134'},{key:'B',label:'273'},{key:'C',label:'198'},{key:'D',label:'251'}] },
  { stem:'Ba phần tư (3/4) của 100 bằng bao nhiêu?', correct:'C',
    options:[{key:'A',label:'25'},{key:'B',label:'50'},{key:'C',label:'75'},{key:'D',label:'70'}] },
  { stem:'Một góc vuông có số đo là?', correct:'C',
    options:[{key:'A',label:'45°'},{key:'B',label:'60°'},{key:'C',label:'90°'},{key:'D',label:'180°'}] },
  { stem:'Kết quả của 1/2 + 1/4 là?', correct:'B',
    options:[{key:'A',label:'2/6'},{key:'B',label:'3/4'},{key:'C',label:'1/3'},{key:'D',label:'2/4'}] },
];

const LB = [
  { rank:1,  displayName:'Thuỳ Linh', correctCount:25, totalTimeMs:612000, avatarBg:'linear-gradient(135deg,#ffd76b,#e8a210)' },
  { rank:2,  displayName:'Quang Huy', correctCount:24, totalTimeMs:640000, avatarBg:'linear-gradient(135deg,#dfe8f5,#9fb2cc)' },
  { rank:3,  displayName:'Bảo Anh',   correctCount:24, totalTimeMs:705000, avatarBg:'linear-gradient(135deg,#e0ad77,#b5743a)' },
  { rank:4,  displayName:'Gia Hân',   correctCount:23, totalTimeMs:651000 },
  { rank:5,  displayName:'Minh Khôi', correctCount:22, totalTimeMs:668000, isMe:true, avatarBg:GRADE_BG },
  { rank:6,  displayName:'Đức Mạnh',  correctCount:21, totalTimeMs:700000 },
  { rank:7,  displayName:'Phương Vy', correctCount:20, totalTimeMs:662000 },
  { rank:8,  displayName:'Tuấn Kiệt', correctCount:19, totalTimeMs:689000 },
  { rank:9,  displayName:'Hải Đăng',  correctCount:18, totalTimeMs:670000 },
  { rank:10, displayName:'Khánh Vân', correctCount:17, totalTimeMs:655000 },
];

const CROWD = [
  { name:'Linh' }, { name:'Huy' }, { name:'Anh' }, { name:'Hân' }, { name:'Khôi' }, { name:'Vy' },
];

const ME_RESULT = {
  name:'Minh Khôi', avatarBg:GRADE_BG,
  correct:22, wrong:2, skipped:1, score:220, rank:5, totalTimeMs:668000,
};

const now = () => Date.now();

/* =====================================================================
   FLOW: Cổng → Phòng chờ → Làm bài → Chờ chấm → Vinh danh → Kết quả → Đóng
===================================================================== */
function FlowDemo(){
  const [screen, setScreen] = React.useState('entry'); // entry|waiting|exam|loading|leaderboard|result|closed
  const [startAt, setStartAt] = React.useState(() => now() + WAIT_SECS * 1000);
  const [qi, setQi] = React.useState(0);
  const [selected, setSelected] = React.useState(null);
  const [saved, setSaved] = React.useState(false);
  const [locked, setLocked] = React.useState(false);
  const [remaining, setRemaining] = React.useState(PER_Q);
  const [answeredCount, setAnsweredCount] = React.useState(0);

  // waiting auto-start
  React.useEffect(() => {
    if (screen !== 'waiting') return;
    const t = setTimeout(() => startExam(), WAIT_SECS * 1000);
    return () => clearTimeout(t);
  }, [screen]);

  // per-question countdown (lockstep)
  React.useEffect(() => {
    if (screen !== 'exam' || locked) return;
    if (remaining <= 0){ setLocked(true); return; }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [screen, locked, remaining]);

  // after lock → advance (synchronized for everyone)
  React.useEffect(() => {
    if (screen !== 'exam' || !locked) return;
    const t = setTimeout(() => advance(), REVEAL_GAP);
    return () => clearTimeout(t);
  }, [screen, locked]);

  function startWaiting(){ setStartAt(now() + WAIT_SECS * 1000); setScreen('waiting'); }
  function startExam(){
    setQi(0); setSelected(null); setSaved(false); setLocked(false);
    setRemaining(PER_Q); setAnsweredCount(0); setScreen('exam');
  }
  function pick(key){
    if (locked) return;
    const firstAnswer = selected == null;
    setSelected(key); setSaved(false);
    // simulate SOCK-EVT-S05 ack latency
    setTimeout(() => setSaved(true), 280);
    if (firstAnswer) setAnsweredCount((c) => c + 1);
  }
  function advance(){
    if (qi < WE_QUESTIONS.length - 1){
      setQi((i) => i + 1); setSelected(null); setSaved(false); setLocked(false); setRemaining(PER_Q);
    } else {
      setScreen('loading');
      setTimeout(() => setScreen('leaderboard'), 2600);
    }
  }
  function restart(){ setScreen('entry'); }

  const cur = WE_QUESTIONS[qi];
  let view = null;
  if (screen === 'entry'){
    view = <EventEntry status="open" weeklyTitle={WEEKLY_TITLE} grade={GRADE} onJoin={startWaiting} />;
  } else if (screen === 'waiting'){
    view = <WaitingRoom weeklyTitle={WEEKLY_TITLE} grade={GRADE} onlineCount={1284} startAt={startAt} faces={CROWD} />;
  } else if (screen === 'exam'){
    view = (
      <ExamScreen
        grade={GRADE} index={qi + 1} total={WE_QUESTIONS.length}
        question={cur.stem} options={cur.options}
        answeredCount={answeredCount} selected={selected} saved={saved} locked={locked}
        remaining={remaining} perQuestionSec={PER_Q} conn="connected"
        onSelect={pick}
      />
    );
  } else if (screen === 'loading'){
    view = <SubmissionLoading grade={GRADE} announceAt="10h27" />;
  } else if (screen === 'leaderboard'){
    view = (
      <LeaderboardScreen
        grade={GRADE} weeklyTitle={WEEKLY_TITLE} entries={LB} total={WE_QUESTIONS.length === 5 ? 25 : WE_QUESTIONS.length} me={ME_RESULT}
        right={<GameButton size="sm" color="ghost" onClick={() => setScreen('result')}>Kết quả của tôi →</GameButton>}
      />
    );
  } else if (screen === 'result'){
    view = (
      <PersonalResultScreen
        grade={GRADE} {...ME_RESULT} totalParticipants={1284} allowReview
        onLeaderboard={() => setScreen('leaderboard')}
        onReview={() => setScreen('leaderboard')}
      />
    );
  } else {
    view = <EventClosedScreen grade={GRADE} nextEventAt={now() + 6 * 86400000} onBackHome={restart} />;
  }

  const steps = [
    ['entry','Cổng'], ['waiting','Phòng chờ'], ['exam','Làm bài'],
    ['loading','Chờ chấm'], ['leaderboard','Vinh danh'], ['result','Kết quả'], ['closed','Đóng'],
  ];
  return (
    <div className="flow">
      <div className="flow-toolbar">
        <div className="flow-steps">
          {steps.map(([k, lbl]) => (
            <button key={k} className={'flow-step' + (screen === k ? ' on' : '')}
              onClick={() => { if (k === 'exam') startExam(); else if (k === 'waiting') startWaiting(); else setScreen(k); }}>
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
   COMPONENT LIBRARY
===================================================================== */
function Block({ title, note, children }){
  return (
    <div className="sc-block">
      <div className="sc-title">{title}</div>
      {note && <div className="sc-note">{note}</div>}
      {children}
    </div>
  );
}

/* interactive realtime / edge-case showcase */
function RealtimeShowcase(){
  const [conn, setConn] = React.useState('connected');
  const [disc, setDisc] = React.useState(false);
  const [resume, setResume] = React.useState(false);
  return (
    <div className="sc-dark" style={{ display:'grid', gap:14 }}>
      <div className="sc-ctl">
        <span className="sc-ctl-lab">UI-C-005 trạng thái:</span>
        {['connected','reconnecting','disconnected'].map((s) => (
          <button key={s} className={'sc-pill' + (conn === s ? ' on' : '')} onClick={() => setConn(s)}>{s}</button>
        ))}
        <span style={{ width:10 }} />
        <button className={'sc-pill' + (disc ? ' on' : '')} onClick={() => setDisc(!disc)}>UI-C-010 mất kết nối</button>
        <button className={'sc-pill' + (resume ? ' on' : '')} onClick={() => setResume(!resume)}>UI-C-009 khôi phục</button>
      </div>
      <div className="sc-row"><ConnectionStatus state={conn} /></div>
      {resume && <AutoResumeNotification remainingMin={12} restoredCount={8} />}
      {disc && <DisconnectWarningModal />}
    </div>
  );
}

function Showcase(){
  const opts = WE_QUESTIONS[0].options;
  return (
    <div className="sc-wrap">
      <Block title="UI-C-008 · Grade Room Badge · UI-C-002 · Online Counter" note="Nhãn 'Phòng Khối X' đổi màu theo khối (1–9). Bộ đếm online cập nhật qua SOCK-EVT-S02.">
        <div className="sc-row sc-dark">
          {[1,3,5,7,9].map((g) => <GradeRoomBadge key={g} grade={g} />)}
        </div>
        <div className="sc-row sc-dark" style={{ marginTop:12 }}>
          <OnlineCounter count={1284} />
          <OnlineCounter count={42} big />
        </div>
      </Block>

      <Block title="UI-C-001 · Countdown Timer" note="Đồng bộ server-time qua skewMs (SOCK-EVT-S09). Hai bố cục: số lớn (block) & gọn (inline). Tông khẩn cấp khi sắp hết.">
        <div className="sc-dark" style={{ display:'flex', gap:36, flexWrap:'wrap', alignItems:'flex-start' }}>
          <CountdownTimer to={now() + 5 * 60000} label="Phát đề sau" showDays={false} />
          <CountdownTimer to={now() + 40000} label="Sắp hết giờ" showDays={false} urgentBelowSec={60} />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <CountdownTimer to={now() + 6 * 86400000} label="Sự kiện tiếp theo" layout="inline" />
            <CountdownTimer to={now() + 2 * 60000} layout="inline" />
          </div>
        </div>
      </Block>

      <Block title="UI-C-004 · Progress Bar" note="Đã trả lời X/total — tăng khi nhận SOCK-EVT-S05 ack. Có biến thể thanh & dãy pip.">
        <div className="sc-dark" style={{ display:'grid', gap:18, maxWidth:520 }}>
          <ProgressBar answered={9} total={25} />
          <ProgressBar answered={6} total={10} pips currentIndex={7} />
        </div>
      </Block>

      <Block title="UI-C-003 · Question Card" note="Câu hỏi + 4 đáp án (đã trộn từ server). Lúc làm bài KHÔNG lộ đáp án đúng — chỉ 'đang chọn' + tick 'đã lưu'. Chế độ review mới tô đúng/sai.">
        <div className="sc-dark" style={{ display:'grid', gap:16 }}>
          <QuestionCard index={3} total={25} question="Ba phần tư (3/4) của 100 bằng bao nhiêu?" options={WE_QUESTIONS[2].options} selected="C" saved />
          <QuestionCard index={3} total={25} question="Ba phần tư (3/4) của 100 bằng bao nhiêu?" options={WE_QUESTIONS[2].options} selected="A" reveal correct="C" />
        </div>
      </Block>

      <Block title="UI-C-005 · Connection · UI-C-009 · Auto-resume · UI-C-010 · Disconnect" note="Trạng thái realtime/edge-case — bấm nút để giả lập.">
        <RealtimeShowcase />
      </Block>

      <Block title="UI-C-006 · Leaderboard Row" note="Một dòng BXH: hạng, avatar, tên + lớp, số câu đúng, thời gian. Dòng của HS hiện tại được highlight.">
        <div className="sc-dark"><div className="we-rows" style={{ maxWidth:560 }}>
          {LB.slice(3, 7).map((e) => <LeaderboardRow key={e.rank} entry={e} total={25} />)}
        </div></div>
      </Block>

      <Block title="UI-C-007 · Personal Stats Card" note="Đúng / Sai / Bỏ qua / Điểm / Hạng / Thời gian hoàn thành. Dùng ở UI-S-005 (ghim đáy) và UI-S-006.">
        <div className="sc-dark"><PersonalStatsCard {...ME_RESULT} /></div>
      </Block>

      <Block title="Header dùng chung (WeHeader / WeCrest)" note="Header chuẩn cho mọi màn — logo crest + badge khối.">
        <div className="sc-dark"><div style={{ background:'rgba(0,0,0,.25)', borderRadius:14, padding:'4px 14px' }}><WeHeader grade={5} /></div></div>
      </Block>
    </div>
  );
}

/* =====================================================================
   App shell
===================================================================== */
function App(){
  const [tab, setTab] = React.useState('flow');
  return (
    <div className="page">
      <IconSprites />
      <header className="page-head">
        <div className="brand">
          <span className="crest" aria-hidden>🏆</span>
          <div>
            <div className="t">Sự kiện tuần <span>· Weekly Event</span></div>
            <div className="s">Uniclass · Game so tài — bộ component tách rời <code>weeklyevent/</code></div>
          </div>
        </div>
        <div className="tabs">
          <button className={tab === 'flow' ? 'on' : ''} onClick={() => setTab('flow')}>Luồng demo</button>
          <button className={tab === 'lib' ? 'on' : ''} onClick={() => setTab('lib')}>Thư viện component</button>
        </div>
      </header>
      {tab === 'flow' ? <FlowDemo /> : <Showcase />}
      <footer className="page-foot">
        UI-S-001…007 · UI-C-001…010 · Bỏ qua CMS · Import: <code>{`import { EventEntry, WaitingRoom, ExamScreen, SubmissionLoading, LeaderboardScreen, PersonalResultScreen, EventClosedScreen } from './weeklyevent'`}</code>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

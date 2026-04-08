import { useState, useRef } from "react";

const T = {
  bg:"#FAF8F4", surface:"#FFFFFF", ink:"#1E1118", inkMid:"#4A3440",
  inkSoft:"#7A6B72", border:"#E2D9D0", terra:"#B85C38", terraLight:"#F2DDD5",
  cream:"#F5EFE8", sage:"#5A8A5E", sagePale:"#E8F2E8", rose:"#C47A7A",
  rosePale:"#FAF0F0", white:"#FFFFFF",
};

const G = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:${T.bg};}
  ::selection{background:${T.terraLight};}
  input[type="text"],input[type="email"]{outline:none;}
  input[type="text"]:focus,input[type="email"]:focus,textarea:focus{outline:2px solid ${T.terra};outline-offset:2px;}
  button{transition:opacity 0.15s,transform 0.1s;}
  button:active{transform:scale(0.98);}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  @keyframes dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
  @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
  .fu{animation:fadeUp 0.45s ease both;}
  .fu1{animation:fadeUp 0.45s 0.08s ease both;}
  .fu2{animation:fadeUp 0.45s 0.16s ease both;}
  .fu3{animation:fadeUp 0.45s 0.24s ease both;}
  .fu4{animation:fadeUp 0.45s 0.32s ease both;}
`;

const SYSTEM_PROMPT = `You are Sarah, Folia's perimenopause care guide. You are warm, grounded, and emotionally intelligent — never clinical, never robotic. You speak like a trusted modern wellness advisor.

Your FIRST message must always follow this exact structure — no greeting, go straight in:
- 1 sentence of emotional recognition (e.g. "Something shifted, and you noticed it.")
- 1 sentence of normalization (e.g. "Most women spend years trying to name exactly what you're feeling.")
- 1 short transition into the first question (e.g. "I'd love to understand where you are right now — what's your age range?")

After the opening, collect ALL of the following across 10–12 exchanges. Maximum 2 sentences before options. One question at a time.

CLINICAL QUESTIONS (collect first — required for provider):
1. Age range: 35–39 / 40–44 / 45–49 / 50 and older
2. Cycle status: regular / irregular / no period 3–11 months / no period 12+ months
   → If "12+ months": also ask how long (1–2 years / 3–5 years / 5+ years)
3. Symptoms + severity: guide toward hot flashes, night sweats, sleep disruption, mood/anxiety, brain fog, low libido, vaginal dryness, urinary urgency, joint aches, palpitations, weight gain, skin/hair changes. Ask severity (mild/moderate/severe) in the same message.
4. Uterus status: yes / hysterectomy / partial — explain this is one of the most important safety questions
5. Medical history in one message — Personal: blood clots (DVT/PE), stroke or heart attack, breast cancer, endometrial/ovarian cancer, liver disease, unexplained vaginal bleeding in past 6 months. Family (mother/sister): breast cancer before 50, blood clots, heart attack before 60
6. Medications: hormonal contraceptives, antidepressants/anti-anxiety, blood thinners, tamoxifen or aromatase inhibitors, seizure medications, St. John's Wort. ALSO ask blood pressure (normal/elevated/untreated high/unknown) and smoking status (no/occasionally/regularly) in the same message.

LIFESTYLE QUESTIONS (collect after clinical — builds daily protocol):
7. Sun exposure: Frame warmly as "now let's build your daily life protocol." Ask: how much direct sun do they get daily? Options: Very little — mostly indoors / Moderate — some outdoor time / High — outdoors most of the day / Intense — outdoor worker or athlete
8. Work + environment: Where do they spend most of their day? Options: Office or home / Mixed indoor/outdoor / Primarily outdoors / Active/physical work environment
9. Sleep + stress: How is your sleep and stress right now? Options: Sleep okay, stress manageable / Sleep disrupted, stress moderate / Both significantly affected / Stress high, sleep unpredictable
10. Current skincare routine: What does your skincare routine look like right now? Options: Minimal — cleanser and moisturizer / Basic — cleanser, serum, SPF / Layered — multiple actives / No consistent routine

SKIN QUESTION:
11. Skin concern (briefly): dryness / breakouts / pigmentation / sensitivity / hair thinning / none — frame as the last one

CRITICAL FLAGS:
- Tamoxifen: "Important — estrogen and tamoxifen cannot be taken together. Your provider will discuss non-hormonal options."
- Blood clots, stroke, breast cancer: "Thank you for sharing this. Some standard options may not be right for you, but your provider will discuss every safe alternative."

After collecting everything, output on its own line:
PROFILE_JSON:{"ageRange":"40-44","cycle":"regular","cycleMonths":"","symptoms":[],"severity":"moderate","hasUterus":true,"contraindications":[],"familyHistory":[],"medications":[],"bloodPressure":"normal","smoking":"no","sunExposure":"moderate","workEnvironment":"office","sleepStress":"moderate","skincareRoutine":"basic","skinConcern":"dryness","hasProvider":false,"phase":"early"}

Phase logic: pre-peri=regular cycle + mild + age<42; early=irregular OR 2-3 moderate symptoms; mid=3+ symptoms OR severe; late=stopped 12mo+ OR multiple severe

After PROFILE_JSON write one warm closing line like "You're in exactly the right place — let's build your system."

After each question include quick-reply options on the last line:
REPLIES:Option A|Option B|Option C|Option D

Never mention PROFILE_JSON or REPLIES to the user. Never use bullet points.`;

function parseMsg(raw) {
  let text = raw, replies = [], profile = null;
  const rm = raw.match(/REPLIES:([^\n]+)/);
  if (rm) { replies = rm[1].split("|").map(s => s.trim()); text = text.replace(/REPLIES:[^\n]+/,"").trim(); }
  const pm = raw.match(/PROFILE_JSON:(\{[^\n]+\})/);
  if (pm) { try { profile = JSON.parse(pm[1]); } catch {} text = text.replace(/PROFILE_JSON:[^\n]+/,"").trim(); }
  return { text, replies, profile };
}

const PHASES = {
  "pre-peri":{ label:"Pre-perimenopausal", short:"Early hormonal shift", color:T.sage, pale:T.sagePale, urgency:"proactive", desc:"Hormonal fluctuations are beginning — estrogen starting to vary cycle to cycle. You're identifying this early, which is exactly when care has the most impact." },
  "early":   { label:"Early perimenopause", short:"Active transition", color:T.terra, pale:T.terraLight, urgency:"recommended", desc:"Classic early perimenopause signals driven by estrogen fluctuation. You're in the ideal window to establish care and begin treatment." },
  "mid":     { label:"Mid perimenopause", short:"Active estrogen decline", color:"#A0622A", pale:"#FAF0E6", urgency:"important", desc:"Estrogen decline is now consistent. Symptoms are more persistent. Clinical care at this stage has meaningful long-term health implications." },
  "late":    { label:"Late perimenopause", short:"Menopause transition", color:T.inkMid, pale:T.cream, urgency:"strongly recommended", desc:"The window where FDA-approved hormone therapy has its strongest evidence base for bone, cardiovascular, and cognitive health." },
};

const PLANS = [
  { id:"aware", name:"Folia Aware", price:19, tagline:"Hormone insight + personalized profile", phases:["pre-peri"], includes:["Perimenopause phase assessment","Phase-matched skincare protocol","Symptom tracking","Care guide access"], note:"Does not include prescription or medication delivery", color:T.sage, pale:T.sagePale, stripe:"https://buy.stripe.com/aware" },
  { id:"active", name:"Folia Active", price:39, tagline:"Provider-reviewed care + treatment plan", phases:["early","mid"], recommended:true, includes:["Everything in Aware","Same-day provider review","Prescription + medication to your door in 4–6 days","Day-7 welcome call","30-day consultation pre-booked","Quarterly care reviews"], note:"7-day free trial · Cancel anytime", color:T.terra, pale:T.terraLight, stripe:"https://buy.stripe.com/active" },
  { id:"complete", name:"Folia Complete", price:59, tagline:"Full protocol, ongoing care, and continuous support", phases:["mid","late"], includes:["Everything in Active","Quarterly consultations included","Dedicated NAMS specialist","Layer SPF quarterly replenishment","Annual full care review"], note:"7-day free trial · Cancel anytime", color:T.inkMid, pale:T.cream, stripe:"https://buy.stripe.com/complete" },
];

const SKIN = {
  dryness:["Ceramide-rich moisturizer on damp skin","Hyaluronic acid serum underneath","Squalane or rosehip oil at night"],
  breakouts:["Niacinamide 10% + zinc serum (AM)","Gentle salicylic acid cleanser 2–3x/week","Avoid heavy occlusives on lower face"],
  pigmentation:["Azelaic acid 10% (evening, 2–3x/week)","Vitamin C serum in the morning","Mineral SPF 50+ daily — essential for melasma"],
  sensitivity:["Fragrance-free low-pH cleanser only","Bakuchiol 1% instead of retinol","Centella asiatica moisturizer for barrier repair"],
  default:["Mineral broad-spectrum SPF 50+ every day","Ceramide moisturizer for barrier repair","Bakuchiol 1% serum at night for collagen support"],
};

const SPF_RECS = {
  low:     { label:"Daily UV defense", rec:"Lightweight mineral SPF 30+ — for low daily exposure. Layer SPF Everyday formula.", urgency:"foundational" },
  moderate:{ label:"Active UV protection", rec:"Mineral SPF 50+ with Tinosorb S — for moderate outdoor exposure. Layer SPF Daily formula.", urgency:"recommended" },
  high:    { label:"Intensive UV protection", rec:"Broad-spectrum SPF 50+ with Tinosorb S — your sun exposure makes this non-negotiable. Layer SPF Intensive formula.", urgency:"essential" },
  intense: { label:"Professional UV defense", rec:"Water-resistant SPF 50+ with Tinosorb S — reapply every 90 minutes. Layer SPF Sport formula.", urgency:"critical" },
};

const SLEEP_RECS = {
  okay:     "Your sleep and stress baseline is manageable — your protocol focuses on maintenance and prevention.",
  moderate: "Moderate sleep disruption and stress are hallmark perimenopause signals. Your protocol includes targeted support.",
  affected: "Sleep and stress are both significantly affected — these are the symptoms most responsive to hormonal care. Your provider will prioritize these.",
  high:     "High stress with unpredictable sleep is a common and treatable pattern at this stage. Your care plan addresses this directly.",
};

const ROUTINE_RECS = {
  minimal: "We'll start simple and add one step at a time — your protocol is designed for ease, not complexity.",
  basic:   "You have the foundation. Your protocol builds on what you already do — one targeted addition.",
  layered: "You're already layering actives. Your protocol optimizes the order and targets the hormonal root cause.",
  none:    "No routine is a completely valid starting point. Your protocol begins with two steps and builds from there.",
};

const getSunRec = (sun="") => {
  const s = sun.toLowerCase();
  if(s.includes("intense")||s.includes("athlete")||s.includes("outdoor worker")) return SPF_RECS.intense;
  if(s.includes("high")||s.includes("most of the day")) return SPF_RECS.high;
  if(s.includes("moderate")||s.includes("some")) return SPF_RECS.moderate;
  return SPF_RECS.low;
};

const getRecs = (c="") => { const s=c.toLowerCase(); if(s.includes("dry"))return SKIN.dryness; if(s.includes("break")||s.includes("acne"))return SKIN.breakouts; if(s.includes("pig")||s.includes("spot"))return SKIN.pigmentation; if(s.includes("sens")||s.includes("red"))return SKIN.sensitivity; return SKIN.default; };

const LANGS = {
  en: { code:"EN", label:"English" },
  es: { code:"ES", label:"Español" },
  zh: { code:"中文", label:"Mandarin" },
  pt: { code:"PT", label:"Português" },
};

const TR = {
  en: {
    tagline:"Your body is changing. Your system should too.",
    sub:"Most women spend years naming what they're feeling. Folia maps your hormonal transition, connects it to your skin and daily life, and builds a care system around you — not a symptom list.",
    startBtn:"Start mapping my hormone profile →",
    learnMore:"Learn more about Folia",
    learnLess:"Close",
    footNote:"3–4 minutes · Your answers, your map · HIPAA protected",
    infoTitle:"How Folia works",
    infoQ1:"What is Folia?", infoA1:"Folia is a midlife body system — it maps your hormonal transition, builds a personalized skin and daily life protocol, and connects you with a licensed provider who can issue a prescription if appropriate.",
    infoQ2:"Who reviews my answers?", infoA2:"A licensed, NAMS-certified provider reviews your profile asynchronously — no appointment needed. They make all prescribing decisions independently.",
    infoQ3:"Is this confidential?", infoA3:"Yes. Everything you share is protected under HIPAA. Your data is never sold or used for advertising.",
    infoQ4:"What if I just want information, not a prescription?", infoA4:"That's completely fine. The Folia Aware plan gives you your hormone map, skincare protocol, and care guide access — no prescription required.",
    infoQ5:"How long does the intake take?", infoA5:"3 to 4 minutes. It's conversational — one question at a time. You can pause and come back.",
    infoClose:"Got it — start my profile →",
  },
  es: {
    tagline:"Tu cuerpo está cambiando. Tu sistema también debería.",
    sub:"La mayoría de las mujeres pasan años intentando nombrar lo que sienten. Folia mapea tu transición hormonal, la conecta con tu piel y tu vida diaria, y construye un sistema de cuidado centrado en ti.",
    startBtn:"Comenzar a mapear mi perfil hormonal →",
    learnMore:"Aprender más sobre Folia",
    learnLess:"Cerrar",
    footNote:"3–4 minutos · Tus respuestas, tu mapa · Protegido por HIPAA",
    infoTitle:"Cómo funciona Folia",
    infoQ1:"¿Qué es Folia?", infoA1:"Folia es un sistema de cuerpo para la mediana edad — mapea tu transición hormonal, crea un protocolo personalizado de piel y vida diaria, y te conecta con un médico con licencia.",
    infoQ2:"¿Quién revisa mis respuestas?", infoA2:"Un médico con licencia certificado en menopausia revisa tu perfil de forma asíncrona — sin cita necesaria. Ellos toman todas las decisiones de prescripción de forma independiente.",
    infoQ3:"¿Es confidencial?", infoA3:"Sí. Todo lo que compartes está protegido bajo HIPAA. Tus datos nunca se venden ni se usan para publicidad.",
    infoQ4:"¿Qué si solo quiero información, no una receta?", infoA4:"Está perfectamente bien. El plan Folia Aware te da tu mapa hormonal, protocolo de piel y acceso a una guía de cuidado — sin receta necesaria.",
    infoQ5:"¿Cuánto tiempo toma la evaluación?", infoA5:"3 a 4 minutos. Es conversacional — una pregunta a la vez. Puedes pausar y regresar.",
    infoClose:"Entendido — comenzar mi perfil →",
  },
  zh: {
    tagline:"你的身体正在改变。你的系统也应该随之改变。",
    sub:"大多数女性花了数年时间才能说清楚自己的感受。Folia 绘制你的激素变化图谱，将其与你的皮肤和日常生活联系起来，并围绕你建立一个护理系统。",
    startBtn:"开始绘制我的激素档案 →",
    learnMore:"了解更多关于 Folia",
    learnLess:"关闭",
    footNote:"3–4 分钟 · 你的答案，你的地图 · HIPAA 保护",
    infoTitle:"Folia 如何运作",
    infoQ1:"什么是 Folia？", infoA1:"Folia 是一个中年身体系统 — 它绘制你的激素变化图谱，构建个性化的皮肤和日常生活方案，并将你与持牌医生连接，必要时可以开具处方。",
    infoQ2:"谁来审查我的答案？", infoA2:"持牌的、NAMS 认证的医生会异步审查你的档案 — 无需预约。他们独立做出所有处方决定。",
    infoQ3:"这是保密的吗？", infoA3:"是的。你分享的一切都受 HIPAA 保护。你的数据不会被出售或用于广告。",
    infoQ4:"如果我只想要信息，不需要处方呢？", infoA4:"完全没问题。Folia Aware 计划为你提供激素图谱、护肤方案和护理指导 — 无需处方。",
    infoQ5:"评估需要多长时间？", infoA5:"3 到 4 分钟。采用对话形式 — 每次一个问题。你可以暂停后再回来。",
    infoClose:"明白了 — 开始我的档案 →",
  },
  pt: {
    tagline:"Seu corpo está mudando. Seu sistema também deveria.",
    sub:"A maioria das mulheres passa anos tentando nomear o que sente. O Folia mapeia sua transição hormonal, conecta-a à sua pele e vida diária, e constrói um sistema de cuidado centrado em você.",
    startBtn:"Começar a mapear meu perfil hormonal →",
    learnMore:"Saiba mais sobre o Folia",
    learnLess:"Fechar",
    footNote:"3–4 minutos · Suas respostas, seu mapa · Protegido por HIPAA",
    infoTitle:"Como o Folia funciona",
    infoQ1:"O que é o Folia?", infoA1:"O Folia é um sistema corporal para a meia-idade — mapeia sua transição hormonal, cria um protocolo personalizado de pele e vida diária, e conecta você com um médico licenciado.",
    infoQ2:"Quem analisa minhas respostas?", infoA2:"Um médico licenciado e certificado pela NAMS analisa seu perfil de forma assíncrona — sem necessidade de consulta. Eles tomam todas as decisões de prescrição de forma independente.",
    infoQ3:"É confidencial?", infoA3:"Sim. Tudo que você compartilha é protegido pela HIPAA. Seus dados nunca são vendidos ou usados para publicidade.",
    infoQ4:"E se eu quiser apenas informação, sem receita?", infoA4:"Tudo bem. O plano Folia Aware oferece seu mapa hormonal, protocolo de cuidados com a pele e acesso à guia de cuidados — sem receita necessária.",
    infoQ5:"Quanto tempo leva a avaliação?", infoA5:"3 a 4 minutos. É conversacional — uma pergunta por vez. Você pode pausar e voltar.",
    infoClose:"Entendi — iniciar meu perfil →",
  },
};
const Shell = ({children}) => <div style={{fontFamily:"'DM Sans',sans-serif",maxWidth:680,margin:"0 auto",padding:"0 2rem",minHeight:"100vh"}}>{children}</div>;
const Header = ({right,lang,setLang,onInfo}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.75rem 0 1.5rem",borderBottom:`1px solid ${T.border}`,marginBottom:"2rem"}}>
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <span style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:T.ink}}>Folia</span>
      <span style={{fontSize:11,color:T.terra,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:500}}/span>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {setLang&&(
        <div style={{display:"flex",gap:2,background:T.cream,borderRadius:8,padding:3}}>
          {Object.entries(LANGS).map(([code,l])=>(
            <button key={code} onClick={()=>setLang(code)} style={{padding:"0.2rem 0.45rem",background:lang===code?T.ink:"transparent",color:lang===code?T.white:T.inkSoft,border:"none",borderRadius:5,fontSize:11,fontWeight:lang===code?500:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>
              {l.code}
            </button>
          ))}
        </div>
      )}
      {onInfo&&<button onClick={onInfo} style={{width:28,height:28,borderRadius:"50%",background:T.cream,border:`1px solid ${T.border}`,color:T.inkMid,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"serif",flexShrink:0}}>?</button>}
      {right&&<span style={{fontSize:12,color:T.inkSoft}}>{right}</span>}
    </div>
  </div>
);
const Btn = ({onClick,disabled,children,color,outline}) => (
  <button onClick={disabled?undefined:onClick} style={{width:"100%",padding:"1.1rem",background:disabled?T.border:outline?"transparent":(color||T.ink),color:disabled?T.inkSoft:outline?(color||T.ink):T.white,border:outline?`2px solid ${color||T.ink}`:"none",borderRadius:14,fontSize:15,fontWeight:500,cursor:disabled?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.01em"}}>
    {children}
  </button>
);

function getCareTimeline() {
  const add=(d)=>{ const dt=new Date(); dt.setDate(dt.getDate()+d); return dt.toLocaleDateString("en-US",{month:"short",day:"numeric"}); };
  return [
    {day:0,  date:add(0),  label:"Intake complete",             sub:"Perimenopause profile generated",                          type:"done",      icon:"✓", color:T.sage},
    {day:1,  date:add(1),  label:"Provider reviews your profile",sub:"Licensed provider reviews async — no appointment needed",  type:"active",    icon:"●", color:T.terra},
    {day:2,  date:add(2),  label:"Prescription issued",          sub:"Same day if approved. Specialist offered if needed.",      type:"pending",   icon:"○", color:T.terra},
    {day:5,  date:add(5),  label:"Medication at your door",      sub:"Ships within 48hrs. Tracking sent to your phone.",         type:"pending",   icon:"○", color:T.terra},
    {day:7,  date:add(7),  label:"Welcome call with Sarah",      sub:"10 minutes. No agenda. Just making sure you have everything.", type:"scheduled",icon:"◈", color:T.rose},
    {day:14, date:add(14), label:"14-day symptom check-in",      sub:"How is your body responding? Quick app check-in.",        type:"scheduled", icon:"◈", color:T.inkSoft},
    {day:30, date:add(30), label:"First consultation",           sub:"Already booked. Provider reviews response + adjusts.",    type:"scheduled", icon:"◈", color:T.terra},
    {day:90, date:add(90), label:"Quarterly care review",         sub:"Provider + symptom comparison vs your baseline.",         type:"scheduled", icon:"◈", color:T.terra},
    {day:180,date:add(180),label:"Six-month milestone",           sub:"Layer SPF kit ships to your door. Before/after profile.", type:"gift",      icon:"♦", color:T.rose},
  ];
}

// ═══════════════════════════════════════════════════════════
export default function Folia() {
  const [view,setView]       = useState("welcome");
  const [agreed,setAgreed]   = useState(false);
  const [messages,setMessages] = useState([]);
  const [input,setInput]     = useState("");
  const [loading,setLoading] = useState(false);
  const [profile,setProfile] = useState(null);
  const [replies,setReplies] = useState([]);
  const [consent,setConsent] = useState({c1:false,c2:false,c3:false,c4:false,c5:false});
  const [activeTab,setActiveTab] = useState("timeline");
  const [selectedPlan,setSelectedPlan] = useState(null);
  const [lang,setLang] = useState("en");
  const [learnMore,setLearnMore] = useState(false);
  const [infoOpen,setInfoOpen] = useState(false);
  const t = TR[lang]||TR.en;
  const bottomRef = useRef(null);
  const scroll = () => setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),50);

  const allConsent = Object.values(consent).every(Boolean);

  async function callAPI(history,isFirst=false) {
    setLoading(true); setReplies([]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":"YOUR_API_KEY_HERE","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,system:SYSTEM_PROMPT,messages:history}),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text||"";
      const parsed = parseMsg(raw);
      const bot = {role:"assistant",content:raw,display:parsed.text};
      setMessages(prev=>isFirst?[bot]:[...prev,bot]);
      setReplies(parsed.replies);
      if(parsed.profile){
        setProfile(parsed.profile);
        setTimeout(()=>setView("consent"),1200);
      }
    } catch { setMessages(prev=>[...prev,{role:"assistant",content:"err",display:"Something went wrong — please refresh."}]); }
    setLoading(false); scroll();
  }

  async function startChat(){
    setView("chat");
    await callAPI([{role:"user",content:"Hi, I'm ready to start."}],true);
  }

  async function send(text){
    const val=text||input.trim(); if(!val||loading)return;
    setInput(""); setReplies([]);
    const hist=[...messages.map(m=>({role:m.role,content:m.content})),{role:"user",content:val}];
    setMessages(prev=>[...prev,{role:"user",content:val,display:val}]);
    scroll(); await callAPI(hist);
  }

  const ph = profile ? (PHASES[profile.phase]||PHASES["early"]) : null;
  const recommendedPlan = profile ? (PLANS.find(p=>p.phases.includes(profile.phase)&&p.recommended) || PLANS.find(p=>p.phases.includes(profile.phase)) || PLANS[1]) : PLANS[1];

  // ── INFO DRAWER ───────────────────────────────────────────
  const InfoDrawer = () => !infoOpen ? null : (
    <div style={{position:"fixed",top:0,right:0,width:"min(380px,100vw)",height:"100vh",background:T.surface,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",zIndex:1000,overflowY:"auto",padding:"1.5rem 1.5rem 3rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem",paddingBottom:"1rem",borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:T.ink}}>{t.infoTitle}</span>
        <button onClick={()=>setInfoOpen(false)} style={{background:"none",border:"none",fontSize:22,color:T.inkSoft,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
      </div>
      {[[t.infoQ1,t.infoA1],[t.infoQ2,t.infoA2],[t.infoQ3,t.infoA3],[t.infoQ4,t.infoA4],[t.infoQ5,t.infoA5]].map(([q,a],i)=>(
        <div key={i} style={{marginBottom:"1.25rem",paddingBottom:"1.25rem",borderBottom:i<4?`1px solid ${T.border}`:"none"}}>
          <p style={{fontSize:13,fontWeight:500,color:T.ink,marginBottom:"0.4rem"}}>{q}</p>
          <p style={{fontSize:13,color:T.inkMid,lineHeight:1.7,fontWeight:300}}>{a}</p>
        </div>
      ))}
      <button onClick={()=>setInfoOpen(false)} style={{width:"100%",padding:"0.875rem",background:T.ink,color:T.white,border:"none",borderRadius:12,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginTop:"0.5rem"}}>{t.infoClose}</button>
    </div>
  );

  // ── WELCOME ──────────────────────────────────────────────
  if(view==="welcome") return (
    <Shell><style>{G}</style>
      <InfoDrawer/>
      <Header lang={lang} setLang={setLang} onInfo={()=>setInfoOpen(true)}/>
      <div style={{marginBottom:"3rem"}}>
        <p className="fu" style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.18em",marginBottom:"1.25rem"}}>Folia Midlife Hormone System</p>
        <h1 className="fu1" style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(38px,6vw,58px)",fontWeight:700,color:T.ink,lineHeight:1.08,letterSpacing:"-0.025em",marginBottom:"1.5rem"}}>
          {lang==="zh"?<>你的身体正在改变。<br/><em style={{color:T.terra,fontStyle:"italic"}}>你的系统也应该随之改变。</em></>:lang==="es"?<>Tu cuerpo está cambiando.<br/><em style={{color:T.terra,fontStyle:"italic"}}>Tu sistema también debería.</em></>:lang==="pt"?<>Seu corpo está mudando.<br/><em style={{color:T.terra,fontStyle:"italic"}}>Seu sistema também deveria.</em></>:<>Your body is changing.<br/><em style={{color:T.terra,fontStyle:"italic"}}>Your system should too.</em></>}
        </h1>
        <p className="fu2" style={{fontSize:17,color:T.inkMid,lineHeight:1.75,maxWidth:520,marginBottom:"2rem",fontWeight:300}}>
          Most women spend years trying to name what's happening. Folia maps your hormonal transition, identifies your stage, and builds a care plan that combines clinical treatment, ongoing support, and targeted skin care.
        </p>

        {/* Four steps — compact, titles only */}
        <div className="fu3" style={{marginBottom:"2rem"}}>
          <p style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>Hormone care, clinically guided</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              ["01","Precision assessment"],
              ["02","Provider-reviewed care"],
              ["03","Treatment, delivered"],
              ["04","Ongoing support system"],
            ].map(([n,title])=>(
              <div key={n} style={{padding:"1rem 1.1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:11,color:T.terra,fontWeight:700,flexShrink:0,paddingTop:1}}>{n}</span>
                <span style={{fontSize:13,color:T.inkMid,lineHeight:1.5,fontWeight:400}}>{title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="fu3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"2rem"}}>
          {[{n:"73M",l:"U.S. women in perimenopause"},{n:"4–6yr",l:"Average wait for diagnosis"},{n:"4–6d",l:"Intake to medication"}].map(s=>(
            <div key={s.n} style={{padding:"1.1rem 0.75rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,textAlign:"center"}}>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:T.terra,marginBottom:"0.35rem"}}>{s.n}</p>
              <p style={{fontSize:10,color:T.inkSoft,lineHeight:1.5,fontWeight:300}}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Learn more — deep content on demand */}
        <div className="fu3" style={{marginBottom:"1.5rem"}}>
          <button onClick={()=>setLearnMore(v=>!v)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:learnMore?"10px 10px 0 0":"10px",padding:"0.75rem 1.25rem",fontSize:13,color:T.inkMid,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:400,width:"100%",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.2s"}}>
            <span>{learnMore ? "Close" : "Learn more about Folia"}</span>
            <span style={{fontSize:18,color:T.terra,transform:learnMore?"rotate(180deg)":"none",transition:"transform 0.25s",lineHeight:1}}>⌄</span>
          </button>
          {learnMore&&(
            <div style={{background:T.cream,borderRadius:"0 0 12px 12px",padding:"1.5rem",border:`1px solid ${T.border}`,borderTop:"none"}}>

              {/* Step descriptions */}
              <p style={{fontSize:10,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"1rem"}}>How it works</p>
              {[
                ["01 — Precision assessment","A conversational intake that identifies your perimenopause stage in minutes — based on cycle changes, symptoms, and risk profile."],
                ["02 — Provider-reviewed care","Licensed clinicians review your case the same day and determine the safest, most effective treatment — without requiring an appointment."],
                ["03 — Treatment, delivered","If appropriate, prescriptions are issued and shipped directly to your door within days."],
                ["04 — Ongoing support system","Structured follow-ups, care touchpoints, and continuous adjustments — designed to support you through every phase."],
              ].map(([title,desc],i)=>(
                <div key={i} style={{marginBottom:"1rem",paddingBottom:"1rem",borderBottom:i<3?`1px solid ${T.border}`:"none"}}>
                  <p style={{fontSize:13,fontWeight:500,color:T.ink,marginBottom:"0.3rem"}}>{title}</p>
                  <p style={{fontSize:13,color:T.inkMid,lineHeight:1.65,fontWeight:300}}>{desc}</p>
                </div>
              ))}

              {/* Education */}
              <div style={{marginTop:"1.25rem",paddingTop:"1.25rem",borderTop:`1px solid ${T.border}`}}>
                <p style={{fontSize:10,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem"}}>Understand what's happening</p>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:T.ink,marginBottom:"0.6rem",lineHeight:1.3}}>Perimenopause is not a single moment — it's a transition.</p>
                <p style={{fontSize:13,color:T.inkMid,lineHeight:1.65,fontWeight:300,marginBottom:"0.75rem"}}>Folia translates your symptoms into a clear hormonal picture:</p>
                {["Changes in estrogen and progesterone","Why sleep, mood, and energy shift","How your cycle reflects your current phase","What your body needs next"].map((item,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:"0.45rem",alignItems:"flex-start"}}>
                    <span style={{color:T.terra,fontSize:12,flexShrink:0,marginTop:2}}>◈</span>
                    <span style={{fontSize:13,color:T.inkMid,lineHeight:1.55,fontWeight:300}}>{item}</span>
                  </div>
                ))}
                <p style={{fontSize:12,fontWeight:500,color:T.ink,marginTop:"0.875rem",paddingTop:"0.875rem",borderTop:`1px solid ${T.border}`}}>This is not guesswork. It's clinically guided clarity.</p>
              </div>

              {/* Protocol */}
              <div style={{marginTop:"1.25rem",paddingTop:"1.25rem",borderTop:`1px solid ${T.border}`}}>
                <p style={{fontSize:10,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem"}}>Your personalized protocol</p>
                <p style={{fontSize:13,color:T.inkMid,lineHeight:1.65,fontWeight:300,marginBottom:"0.6rem"}}>Your plan is built around your body — not a generic checklist. Depending on your profile, your protocol may include hormone therapy, non-hormonal alternatives, sleep and mood support, and skin changes linked to hormonal decline.</p>
                <p style={{fontSize:12,color:T.inkSoft,lineHeight:1.65,fontStyle:"italic",fontWeight:300}}>Your skin changes are hormonal — not cosmetic. Your protocol includes a UV and skin care layer matched to your transition stage.</p>
              </div>

              {/* System */}
              <div style={{marginTop:"1.25rem",background:T.ink,borderRadius:10,padding:"1.25rem"}}>
                <p style={{fontSize:10,fontWeight:500,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.6rem"}}>Beyond treatment — a system</p>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:T.white,marginBottom:"0.6rem",lineHeight:1.3}}>Folia is not just a prescription. It's a structured care system designed for midlife.</p>
                {["Symptom and response tracking","Care timelines and scheduled reviews","Adjustments as your body changes","Ongoing provider oversight"].map((item,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:"0.4rem",alignItems:"flex-start"}}>
                    <span style={{color:T.terra,fontSize:12,flexShrink:0,marginTop:2}}>◈</span>
                    <span style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.5,fontWeight:300}}>{item}</span>
                  </div>
                ))}
                <p style={{fontSize:12,fontWeight:500,color:T.terra,marginTop:"0.875rem",paddingTop:"0.875rem",borderTop:"1px solid rgba(255,255,255,0.1)"}}>Because perimenopause evolves — and your care should too.</p>
              </div>

              {/* FAQ */}
              <div style={{marginTop:"1.25rem",paddingTop:"1.25rem",borderTop:`1px solid ${T.border}`}}>
                <p style={{fontSize:10,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.875rem"}}>Common questions</p>
                {[[t.infoQ1,t.infoA1],[t.infoQ2,t.infoA2],[t.infoQ3,t.infoA3],[t.infoQ4,t.infoA4],[t.infoQ5,t.infoA5]].map(([q,a],i)=>(
                  <div key={i} style={{marginBottom:"0.875rem",paddingBottom:"0.875rem",borderBottom:i<4?`1px solid ${T.border}`:"none"}}>
                    <p style={{fontSize:13,fontWeight:500,color:T.ink,marginBottom:"0.3rem"}}>{q}</p>
                    <p style={{fontSize:13,color:T.inkMid,lineHeight:1.65,fontWeight:300}}>{a}</p>
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>

        {/* Consent */}
        <div className="fu4" style={{padding:"1.25rem 1.5rem",background:T.cream,borderRadius:14,marginBottom:"1.75rem",display:"flex",gap:14,alignItems:"flex-start",borderLeft:`3px solid ${T.terra}`}}>
          <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{marginTop:4,width:16,height:16,accentColor:T.terra,flexShrink:0,cursor:"pointer"}}/>
          <p style={{fontSize:13,color:T.inkMid,lineHeight:1.7,fontWeight:300}}>
            I understand Folia connects me with independent licensed providers who make all prescribing decisions. I consent to my responses being used to build my hormone profile, protected under HIPAA.
          </p>
        </div>

        <div className="fu4">
          <Btn onClick={startChat} disabled={!agreed}>Start your assessment →</Btn>
          <p style={{fontSize:12,color:T.inkSoft,marginTop:"0.75rem",textAlign:"center"}}>You don't need to guess what's happening to your body. You need a system built for it.</p>
        </div>
      </div>
    </Shell>
  );

  // ── CHAT ─────────────────────────────────────────────────
  if(view==="chat") return (
    <Shell><style>{G}</style><InfoDrawer/><Header lang={lang} setLang={setLang} onInfo={()=>setInfoOpen(true)} right="Perimenopause intake"/>
      <div style={{display:"flex",gap:6,marginBottom:"1.5rem"}}>
        {[0,1,2,3,4,5,6,7,8,9].map(i=>(
          <div key={i} style={{height:3,flex:1,borderRadius:2,background:i<Math.min(messages.filter(m=>m.role==="assistant").length,10)?T.terra:T.border,transition:"background 0.3s"}}/>
        ))}
      </div>
      <div style={{padding:"0.75rem 1rem",background:T.cream,borderRadius:10,borderLeft:`3px solid ${T.terra}`,marginBottom:"1.5rem"}}>
        <p style={{fontSize:12,color:T.inkMid,fontWeight:300,lineHeight:1.6}}><strong style={{fontWeight:500}}>Mapping your hormone profile</strong> — your answers build a picture of where you are in your transition. There are no wrong answers.</p>
      </div>

      <div>
        {messages.map((m,i)=>{
          const bot=m.role==="assistant";
          return(
            <div key={i} className="fu" style={{display:"flex",justifyContent:bot?"flex-start":"flex-end",marginBottom:"1rem",alignItems:"flex-end",gap:10}}>
              {bot&&<div style={{width:36,height:36,borderRadius:"50%",background:T.ink,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Playfair Display',serif",fontSize:15,color:T.white,fontWeight:700}}>F</div>}
              <div style={{maxWidth:"74%",padding:"1rem 1.25rem",background:bot?T.surface:T.ink,color:bot?T.ink:T.white,borderRadius:bot?"4px 18px 18px 18px":"18px 4px 18px 18px",border:bot?`1px solid ${T.border}`:"none",fontSize:15,lineHeight:1.75,fontWeight:bot?300:400}}>
                {m.display}
              </div>
            </div>
          );
        })}

        {loading&&(
          <div style={{display:"flex",alignItems:"flex-end",gap:10,marginBottom:"1rem"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:T.ink,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:15,color:T.white,fontWeight:700,flexShrink:0}}>F</div>
            <div style={{padding:"1rem 1.25rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"4px 18px 18px 18px"}}>
              <div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.inkSoft,animation:`dot 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}</div>
            </div>
          </div>
        )}

        {replies.length>0&&!loading&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"flex-end",marginBottom:"1rem"}}>
            {replies.map(r=><button key={r} onClick={()=>send(r)} style={{padding:"0.55rem 1.1rem",border:`1.5px solid ${T.terra}`,borderRadius:40,background:"transparent",color:T.terra,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>{r}</button>)}
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <div style={{borderTop:`1px solid ${T.border}`,padding:"1rem 0 1.75rem",background:T.bg,position:"sticky",bottom:0}}>
        <div style={{display:"flex",gap:10}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type your answer…" disabled={loading} style={{flex:1,padding:"0.9rem 1.25rem",border:`1.5px solid ${T.border}`,borderRadius:12,fontSize:15,fontFamily:"'DM Sans',sans-serif",color:T.ink,background:T.surface,fontWeight:300}}/>
          <button onClick={()=>send()} disabled={loading||!input.trim()} style={{padding:"0.9rem 1.5rem",background:input.trim()&&!loading?T.ink:T.border,color:input.trim()&&!loading?T.white:T.inkSoft,border:"none",borderRadius:12,fontSize:14,fontWeight:500,cursor:input.trim()&&!loading?"pointer":"default",fontFamily:"'DM Sans',sans-serif"}}>Send</button>
        </div>
      </div>
    </Shell>
  );

  // ── CONSENT (medical) ────────────────────────────────────
  if(view==="consent"&&profile) return (
    <Shell><style>{G}</style><InfoDrawer/><Header lang={lang} setLang={setLang} onInfo={()=>setInfoOpen(true)} right="Review & confirm"/>
      <p className="fu" style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"0.75rem"}}>Before we build your profile</p>
      <h2 className="fu1" style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:T.ink,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:"0.5rem"}}>Almost there.</h2>
      <p className="fu2" style={{fontSize:15,color:T.inkMid,lineHeight:1.75,marginBottom:"2rem",fontWeight:300}}>A few confirmations so your licensed provider can safely review your profile.</p>

      <div className="fu3" style={{display:"flex",flexDirection:"column",gap:"0.75rem",marginBottom:"2rem"}}>
        {[
          {k:"c1", text:"Everything I shared is accurate and complete. I understand my provider uses this to make safe decisions about my care."},
          {k:"c2", text:"I understand Folia connects me with independent licensed providers who make all prescribing decisions. Folia maps — providers prescribe."},
          {k:"c3", text:"I'm okay with my profile being shared with the licensed provider reviewing my case, protected under HIPAA."},
          {k:"c4", text:"I understand hormone therapy has risks and benefits my provider will walk me through before anything is prescribed."},
          {k:"c5", text:"I am 18 or older and this profile reflects my own health."},
        ].map(item=>(
          <div key={item.k} style={{display:"flex",gap:14,alignItems:"flex-start",padding:"1rem 1.25rem",background:consent[item.k]?T.cream:T.surface,border:`1px solid ${consent[item.k]?T.terra:T.border}`,borderRadius:12,cursor:"pointer",transition:"all 0.15s"}} onClick={()=>setConsent(p=>({...p,[item.k]:!p[item.k]}))}>
            <div style={{width:20,height:20,borderRadius:4,border:`2px solid ${consent[item.k]?T.terra:T.border}`,background:consent[item.k]?T.terra:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.15s"}}>
              {consent[item.k]&&<span style={{color:T.white,fontSize:12,fontWeight:700}}>✓</span>}
            </div>
            <p style={{fontSize:13,color:T.inkMid,lineHeight:1.7,fontWeight:300}}>{item.text}</p>
          </div>
        ))}
      </div>

      <Btn onClick={()=>setView("results")} disabled={!allConsent}>
        {allConsent?"Build my hormone profile →":"Please confirm all items above"}
      </Btn>
      <div style={{height:"2rem"}}/>
    </Shell>
  );

  // ── RESULTS ──────────────────────────────────────────────
  if(view==="results"&&profile) return (
    <Shell><style>{G}</style><InfoDrawer/><Header lang={lang} setLang={setLang} onInfo={()=>setInfoOpen(true)} right="Your perimenopause profile"/>
      <div className="fu" style={{padding:"2rem",background:T.ink,borderRadius:20,marginBottom:"1.5rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:ph.color,opacity:0.12}}/>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"0.75rem"}}>Your hormone map</p>
        <span style={{...pill(ph.color+"30",ph.color),marginBottom:"1rem",display:"inline-block"}}>{ph.label}</span>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:T.white,marginBottom:"0.75rem",lineHeight:1.2}}>{ph.short}</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.6)",lineHeight:1.75,fontWeight:300}}>{ph.desc}</p>
      </div>

      {/* Clinical flags */}
      {profile.contraindications?.length>0&&!profile.contraindications.every(c=>!c||c==="none")&&(
        <div style={{padding:"1rem 1.25rem",background:"#FBF5EA",border:`1px solid #E8C8A0`,borderRadius:12,marginBottom:"1.25rem"}}>
          <p style={{fontSize:13,color:"#8A5A1A",lineHeight:1.65,fontWeight:300}}><strong style={{fontWeight:500}}>A note for your provider:</strong> You mentioned some health history worth discussing. Your provider will map out every option that's right for you — there's always a path forward.</p>
        </div>
      )}
      {profile.medications?.includes("tamoxifen")&&(
        <div style={{padding:"1rem 1.25rem",background:"#FBF5EA",border:`1px solid #E8C8A0`,borderRadius:12,marginBottom:"1.25rem"}}>
          <p style={{fontSize:13,color:"#8A5A1A",lineHeight:1.65,fontWeight:300}}><strong style={{fontWeight:500}}>Important:</strong> Tamoxifen and estrogen can't be combined. Your provider will map out non-hormonal options that work just as well for your symptoms.</p>
        </div>
      )}

      {profile.symptoms?.length>0&&(
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"1.25rem 1.5rem",marginBottom:"1.25rem"}}>
          <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"0.75rem"}}>What your body is telling us</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:profile.severity?"0.75rem":0}}>
            {profile.symptoms.map(s=><span key={s} style={pill(T.rosePale,T.rose,false)}>{s}</span>)}
          </div>
          {profile.severity&&<p style={{fontSize:14,color:T.inkSoft,fontWeight:300}}>Daily impact: <strong style={{color:T.ink,fontWeight:500}}>{profile.severity}</strong></p>}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:"2rem"}}>
        {[{label:"Hormone stage",value:ph.label},{label:"Medication to door",value:"4–6 days"},{label:"Care approach",value:ph.urgency},{label:"Recommended plan",value:recommendedPlan.name}].map(m=>(
          <div key={m.label} style={{padding:"1.25rem 1.5rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14}}>
            <p style={{fontSize:11,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.5rem"}}>{m.label}</p>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:T.ink,lineHeight:1.2}}>{m.value}</p>
          </div>
        ))}
      </div>

      <Btn onClick={()=>setView("pricing")}>Build my care system →</Btn>
    </Shell>
  );

  // ── PRICING ──────────────────────────────────────────────
  if(view==="pricing"&&profile) return (
    <Shell><style>{G}</style><InfoDrawer/><Header lang={lang} setLang={setLang} onInfo={()=>setInfoOpen(true)} right="Choose your plan"/>
      <p className="fu" style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"0.75rem"}}>Your Folia system</p>
      <h2 className="fu1" style={{fontFamily:"'Playfair Display',serif",fontSize:34,fontWeight:700,color:T.ink,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:"0.5rem"}}>Choose the depth<br/>that fits where you are.</h2>
      <p className="fu2" style={{fontSize:15,color:T.inkMid,lineHeight:1.75,marginBottom:"0.75rem",fontWeight:300}}>Based on your profile, we recommend <strong style={{color:T.ink,fontWeight:500}}>{recommendedPlan.name}</strong>.</p>
      <div className="fu2" style={{padding:"0.875rem 1.25rem",background:ph.pale,borderRadius:12,borderLeft:`3px solid ${ph.color}`,marginBottom:"2rem"}}>
        <p style={{fontSize:13,color:T.inkMid,fontWeight:300,lineHeight:1.65}}>Your hormone map shows: <strong style={{color:T.ink,fontWeight:500}}>{ph.label}</strong> — care is {ph.urgency}.</p>
      </div>

      <div className="fu3" style={{display:"flex",flexDirection:"column",gap:"1rem",marginBottom:"1.5rem"}}>
        {PLANS.map(plan=>{
          const isRec=plan.id===recommendedPlan.id;
          return(
            <div key={plan.id} style={{background:T.surface,border:`${isRec?2:1}px solid ${isRec?plan.color:T.border}`,borderRadius:18,padding:"1.5rem",position:"relative",cursor:"pointer"}} onClick={()=>setSelectedPlan(plan.id)}>
              {isRec&&<div style={{position:"absolute",top:-12,left:"1.5rem"}}><span style={{padding:"0.25rem 0.85rem",background:plan.color,color:T.white,borderRadius:20,fontSize:11,fontWeight:500,fontFamily:"'DM Sans',sans-serif"}}>Recommended for you</span></div>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"0.75rem"}}>
                <div>
                  <p style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:T.ink,marginBottom:"0.2rem"}}>{plan.name}</p>
                  <p style={{fontSize:13,color:T.inkSoft,fontWeight:300}}>{plan.tagline}</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:isRec?plan.color:T.ink}}>${plan.price}</p>
                  <p style={{fontSize:11,color:T.inkSoft,fontWeight:300}}>/month</p>
                </div>
              </div>
              {plan.includes.map((item,i)=>(
                <div key={i} style={{display:"flex",gap:10,marginBottom:"0.5rem",alignItems:"flex-start"}}>
                  <span style={{color:plan.color,fontSize:13,flexShrink:0,marginTop:2}}>✓</span>
                  <span style={{fontSize:13,color:T.inkMid,lineHeight:1.5,fontWeight:300}}>{item}</span>
                </div>
              ))}
              <button style={{width:"100%",padding:"0.875rem",marginTop:"1rem",background:isRec?plan.color:T.surface,color:isRec?T.white:T.ink,border:isRec?"none":`1.5px solid ${T.border}`,borderRadius:12,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                {isRec?`Start ${plan.name} →`:`Choose ${plan.name}`}
              </button>
              {plan.note&&<p style={{fontSize:11,color:T.inkSoft,textAlign:"center",marginTop:"0.6rem",fontWeight:300}}>{plan.note}</p>}
            </div>
          );
        })}
      </div>

      <div style={{padding:"1.25rem 1.5rem",background:T.cream,borderRadius:14,marginBottom:"2rem",borderLeft:`3px solid ${T.terra}`}}>
        <p style={{fontSize:14,fontWeight:500,color:T.ink,marginBottom:"0.3rem"}}>7-day free trial on Active and Complete</p>
        <p style={{fontSize:13,color:T.inkMid,lineHeight:1.65,fontWeight:300}}>Your provider review begins immediately. Medication can ship before your trial ends. Cancel before day 7 — no charge.</p>
      </div>

      <Btn onClick={()=>setView("protocol")}>See my full protocol →</Btn>
      <div style={{height:"2.5rem"}}/>
    </Shell>
  );

  if(view==="protocol"&&profile){
    const recs=getRecs(profile.skinConcern);
    const spfRec=getSunRec(profile.sunExposure||"");
    const sleepNote=SLEEP_RECS[profile.sleepStress?.includes("okay")?"okay":profile.sleepStress?.includes("moderate")?"moderate":profile.sleepStress?.includes("significantly")?"affected":"high"]||SLEEP_RECS.moderate;
    const routineNote=ROUTINE_RECS[profile.skincareRoutine?.includes("minimal")?"minimal":profile.skincareRoutine?.includes("layered")?"layered":profile.skincareRoutine?.includes("none")?"none":"basic"]||ROUTINE_RECS.basic;
    return(
      <Shell><style>{G}</style><InfoDrawer/><Header lang={lang} setLang={setLang} onInfo={()=>setInfoOpen(true)} right="Your protocol"/>
        <p className="fu" style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"0.75rem"}}>Your midlife body system</p>
        <h2 className="fu1" style={{fontFamily:"'Playfair Display',serif",fontSize:34,fontWeight:700,color:T.ink,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:"0.5rem"}}>Hormones first.<br/><span style={{color:T.inkSoft,fontWeight:400,fontSize:24,fontStyle:"italic"}}>Skin + life, connected.</span></h2>
        <p className="fu2" style={{fontSize:15,color:T.inkMid,lineHeight:1.75,marginBottom:"2.5rem",fontWeight:300}}>Your protocol is built from three inputs: your phase, your daily life, and your skin. Everything is connected.</p>

        {/* Fulfillment */}
        <div className="fu3" style={{background:T.ink,borderRadius:20,padding:"1.75rem",marginBottom:"1.25rem"}}>
          <p style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"1.25rem"}}>How you get your medication</p>
          {[
            {step:"01",time:"Today",label:"Provider reviews your profile",detail:"Licensed provider reviews your full medical intake asynchronously — no appointment. Specialist offered if your history requires it."},
            {step:"02",time:"Same day",label:"Prescription issued",detail:"FDA-approved HRT prescribed at provider discretion. Routed directly to pharmacy partner."},
            {step:"03",time:"48 hours",label:"Medication ships",detail:"Estradiol patch, gel, spray, or progesterone — shipped to your door with your personalized protocol card."},
            {step:"04",time:"Day 4–6",label:"Medication at your door",detail:"Tracking sent to your phone. Welcome kit includes your protocol card and a Layer SPF sample matched to your UV exposure."},
          ].map((s,i)=>(
            <div key={i} style={{display:"flex",gap:16,paddingBottom:i<3?"1.25rem":0,marginBottom:i<3?"1.25rem":0,borderBottom:i<3?"1px solid rgba(255,255,255,0.08)":"none"}}>
              <div style={{textAlign:"center",minWidth:40}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:13,color:T.terra,fontWeight:700}}>{s.step}</span>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:"0.25rem",whiteSpace:"nowrap"}}>{s.time}</p>
              </div>
              <div>
                <p style={{fontSize:15,fontWeight:500,color:T.white,marginBottom:"0.3rem"}}>{s.label}</p>
                <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.65,fontWeight:300}}>{s.detail}</p>
              </div>
            </div>
          ))}
          <div style={{marginTop:"1.5rem",paddingTop:"1.5rem",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            <button style={{width:"100%",padding:"1rem",background:T.terra,color:T.white,border:"none",borderRadius:12,fontSize:15,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Get my prescription reviewed →</button>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:"0.75rem",textAlign:"center",fontWeight:300}}>No appointment needed. Specialist offered if clinically indicated.</p>
          </div>
        </div>

        {/* Layer SPF — UV matched */}
        <div style={{background:T.surface,border:`2px solid ${T.terra}`,borderRadius:20,padding:"1.75rem",marginBottom:"1.25rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:"0.75rem"}}>
            <span style={{...pill(T.terraLight,T.terra,true)}}>{spfRec.urgency}</span>
            <span style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.1em"}}>{spfRec.label}</span>
          </div>
          <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:T.ink,marginBottom:"0.5rem"}}>Layer SPF — matched to your sun exposure</h3>
          <p style={{fontSize:14,color:T.inkMid,lineHeight:1.75,marginBottom:"1rem",fontWeight:300}}>{spfRec.rec}</p>
          <p style={{fontSize:12,color:T.inkSoft,lineHeight:1.65,fontWeight:300,fontStyle:"italic"}}>Tinosorb S is the only UV filter with published evidence for preventing melasma and photoaging in estrogen-depleted skin. Your Layer SPF kit ships at your six-month milestone.</p>
        </div>

        {/* Lifestyle protocol */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"1.75rem",marginBottom:"1.25rem"}}>
          <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"1.25rem"}}>Your daily life protocol</p>
          {[
            {label:"Sleep + stress", note:sleepNote, icon:"◐"},
            {label:"Skincare routine", note:routineNote, icon:"◈"},
            {label:"Work + environment", note:`${profile.workEnvironment||"Your environment"} — your protocol accounts for your daily UV and stress exposure.`, icon:"○"},
          ].map((item,i)=>(
            <div key={i} style={{display:"flex",gap:14,padding:"0.875rem 0",borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
              <span style={{color:T.terra,fontSize:16,flexShrink:0,marginTop:1}}>{item.icon}</span>
              <div>
                <p style={{fontSize:13,fontWeight:500,color:T.ink,marginBottom:"0.3rem"}}>{item.label}</p>
                <p style={{fontSize:13,color:T.inkSoft,lineHeight:1.6,fontWeight:300}}>{item.note}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Skin */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"1.75rem",marginBottom:"1.5rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:"1.25rem"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:T.border}}/>
            <span style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em"}}>Skin support — secondary track</span>
          </div>
          <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:600,color:T.inkMid,marginBottom:"0.4rem"}}>Your skin, supported</h3>
          <p style={{fontSize:14,color:T.inkSoft,lineHeight:1.75,marginBottom:"1.25rem",fontWeight:300}}>Estrogen decline is the root cause. These cosmetic steps address the surface.{profile.skinConcern&&<> Primary concern: <strong style={{color:T.ink,fontWeight:500}}>{profile.skinConcern}</strong>.</>}</p>
          {recs.map((rec,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"0.75rem 0",borderBottom:i<recs.length-1?`1px solid ${T.border}`:"none"}}>
              <span style={{color:T.terra,flexShrink:0,marginTop:2,fontSize:13}}>◈</span>
              <p style={{fontSize:14,color:T.inkMid,lineHeight:1.6,fontWeight:300}}>{rec}</p>
            </div>
          ))}
          <p style={{fontSize:11,color:T.inkSoft,marginTop:"1rem",padding:"0.75rem 1rem",background:T.cream,borderRadius:8,fontWeight:300,lineHeight:1.65}}>Cosmetic recommendations only. Prescription topical treatments discussed with your provider.</p>
        </div>

        <Btn onClick={()=>setView("onboarding")}>See my care plan →</Btn>
        <div style={{height:"2.5rem"}}/>
      </Shell>
    );
  }

  // ── ONBOARDING MESSAGE ───────────────────────────────────
  if(view==="onboarding"&&profile) return(
    <Shell><style>{G}</style><InfoDrawer/><Header lang={lang} setLang={setLang} onInfo={()=>setInfoOpen(true)} right="Welcome to Folia"/>
      <div className="fu" style={{background:T.ink,borderRadius:20,padding:"2rem",marginBottom:"1.5rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:"50%",background:T.terra,opacity:0.1}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:T.terra,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:18,color:T.white,fontWeight:700,flexShrink:0}}>S</div>
          <div>
            <p style={{fontSize:14,fontWeight:500,color:T.white}}>Sarah</p>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.45)",fontWeight:300}}>Your Folia care guide</p>
          </div>
        </div>
        <p style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:T.white,fontWeight:600,lineHeight:1.3,marginBottom:"1.25rem",fontStyle:"italic"}}>"You just mapped something most women spend years trying to name."</p>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.65)",lineHeight:1.8,fontWeight:300,marginBottom:"1rem"}}>I've looked at your hormone map. Your provider is reviewing it now — they'll reach out today, no appointment needed.</p>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.65)",lineHeight:1.8,fontWeight:300,marginBottom:"1rem"}}>I'll call you on day 7. Ten minutes, no agenda. I just want to know how you're settling in and make sure everything makes sense.</p>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.65)",lineHeight:1.8,fontWeight:300}}>Your full care year is already mapped out. You don't have to chase anything — we'll show up before you need to ask.</p>
        <div style={{marginTop:"1.5rem",paddingTop:"1.5rem",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.3)",fontWeight:300}}>Sarah · Folia Care Team · care@folia.com</p>
        </div>
      </div>

      <div className="fu1" style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"1.5rem",marginBottom:"1.25rem"}}>
        <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"1.25rem"}}>Your next 7 days, mapped</p>
        {[
          {time:"Next 2–4 hrs",label:"Provider maps your care options",detail:"Your hormone profile is reviewed. If a prescription makes sense, it's issued same day — no appointment.",icon:"●",color:T.terra},
          {time:"Tonight",label:"Tracking number in your inbox",detail:"Medication ships within 48 hours. Your Layer SPF sample is matched to your UV profile.",icon:"●",color:T.terra},
          {time:"Day 4–6",label:"Your system arrives at the door",detail:"Medication + protocol card + Layer SPF sample. Everything you need to start, already organized.",icon:"○",color:T.inkSoft},
          {time:"Day 7",label:"Sarah calls",detail:"Ten minutes. No agenda. Just checking in.",icon:"◈",color:T.rose},
        ].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:14,paddingBottom:i<3?"1.1rem":0,marginBottom:i<3?"1.1rem":0,borderBottom:i<3?`1px solid ${T.border}`:"none"}}>
            <div style={{minWidth:70}}><p style={{fontSize:11,color:item.color,fontWeight:500,lineHeight:1.4}}>{item.time}</p></div>
            <div>
              <p style={{fontSize:14,fontWeight:500,color:T.ink,marginBottom:"0.25rem"}}>{item.label}</p>
              <p style={{fontSize:13,color:T.inkSoft,lineHeight:1.65,fontWeight:300}}>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <Btn onClick={()=>setView("dashboard")}>View my full care calendar →</Btn>
      <div style={{height:"2.5rem"}}/>
    </Shell>
  );

  // ── DASHBOARD ────────────────────────────────────────────
  if(view==="dashboard"&&profile){
    const timeline=getCareTimeline();
    return(
      <Shell><style>{G}</style><InfoDrawer/><Header lang={lang} setLang={setLang} onInfo={()=>setInfoOpen(true)} right="Dashboard"/>
        <div style={{marginBottom:"0.5rem"}}><span style={pill(ph.pale,ph.color)}>{ph.label}</span></div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:T.ink,letterSpacing:"-0.02em",margin:"1rem 0 0.4rem",lineHeight:1.1}}>Your system, running.</h2>
        <p style={{fontSize:15,color:T.inkSoft,fontWeight:300,lineHeight:1.65,marginBottom:"2rem"}}>Every touchpoint pre-scheduled. We show up before you need to ask.</p>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"1.75rem"}}>
          {[{l:"Medication ETA",v:"4–6d"},{l:"Care touchpoints",v:"9"},{l:"Your guide",v:"Sarah"}].map(m=>(
            <div key={m.l} style={{padding:"1.25rem 1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,textAlign:"center"}}>
              <p style={{fontSize:10,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.5rem"}}>{m.l}</p>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:T.ink}}>{m.v}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:0,marginBottom:"1.5rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:4}}>
          {[["timeline","Care calendar"],["symptoms","Symptom tracker"],["skin","Skin tracker"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>setActiveTab(tab)} style={{flex:1,padding:"0.6rem 0.5rem",background:activeTab===tab?T.ink:"transparent",color:activeTab===tab?T.white:T.inkSoft,border:"none",borderRadius:9,fontSize:13,fontWeight:activeTab===tab?500:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s"}}>{label}</button>
          ))}
        </div>

        {/* Care Timeline */}
        {activeTab==="timeline"&&(
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"1.5rem",marginBottom:"1.25rem"}}>
            <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"0.5rem"}}>Your full care calendar</p>
            <p style={{fontSize:13,color:T.inkSoft,fontWeight:300,marginBottom:"1.5rem",lineHeight:1.6}}>Every touchpoint below is pre-scheduled. Nothing falls through the cracks.</p>
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:19,top:8,bottom:8,width:2,background:T.border,borderRadius:1}}/>
              {timeline.map((item,i)=>{
                const isDone=item.type==="done", isActive=item.type==="active", isGift=item.type==="gift";
                return(
                  <div key={i} style={{display:"flex",gap:16,marginBottom:i<timeline.length-1?"1.25rem":0,position:"relative"}}>
                    <div style={{width:40,height:40,borderRadius:"50%",background:isDone?T.sage:isActive?T.terra:isGift?T.rose:T.surface,border:isDone||isActive||isGift?"none":`2px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,zIndex:1,fontSize:isGift?14:16,color:isDone||isActive||isGift?T.white:T.inkSoft,animation:isActive?"pulse 2s ease-in-out infinite":"none"}}>
                      {isDone?"✓":isGift?"♦":isActive?"●":"○"}
                    </div>
                    <div style={{flex:1,paddingTop:"0.6rem"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"0.2rem"}}>
                        <p style={{fontSize:14,fontWeight:isDone||isActive?500:400,color:isDone||isActive?T.ink:T.inkMid}}>{item.label}</p>
                        <span style={{fontSize:11,color:isActive?T.terra:T.inkSoft,fontWeight:isActive?500:300,flexShrink:0,marginLeft:8}}>{item.date}</span>
                      </div>
                      <p style={{fontSize:12,color:T.inkSoft,lineHeight:1.6,fontWeight:300}}>{item.sub}</p>
                      {isGift&&<span style={{...pill(T.rosePale,T.rose,true),marginTop:4,display:"inline-block"}}>Layer SPF kit ships to your door</span>}
                      {isActive&&<span style={{...pill(T.terraLight,T.terra,true),marginTop:4,display:"inline-block",animation:"pulse 2s ease-in-out infinite"}}>In progress</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Symptom Tracker */}
        {activeTab==="symptoms"&&(
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"1.5rem",marginBottom:"1.25rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
              <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em"}}>Hormone symptom map</p>
              <span style={pill(T.terraLight,T.terra,true)}>Primary</span>
            </div>
            <p style={{fontSize:13,color:T.inkSoft,fontWeight:300,marginBottom:"1.25rem",lineHeight:1.6}}>Log daily. At 14 days your map updates — you'll see exactly what's shifting and what's holding steady.</p>
            {(profile.symptoms?.slice(0,4)||["Hot flashes","Sleep quality","Mood","Brain fog"]).map((sym,i)=>(
              <div key={sym} style={{marginBottom:"1.25rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.5rem"}}>
                  <span style={{fontSize:14,color:T.inkMid}}>{sym}</span>
                  <div style={{display:"flex",gap:6}}>
                    {[1,2,3,4,5].map(n=><div key={n} style={{width:28,height:28,borderRadius:"50%",background:n<=[3,2,4,3][i]?ph.color:T.border,cursor:"pointer",transition:"background 0.2s"}}/>)}
                  </div>
                </div>
                <p style={{fontSize:11,color:T.inkSoft,fontWeight:300}}>Baseline: <strong style={{fontWeight:500,color:T.inkMid}}>{profile.severity}</strong></p>
              </div>
            ))}
          </div>
        )}

        {/* Skin Tracker */}
        {activeTab==="skin"&&(
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"1.5rem",marginBottom:"1.25rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
              <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em"}}>Skin support tracker</p>
              <span style={pill(T.cream,T.inkSoft,true)}>Secondary</span>
            </div>
            {["Skin hydration","AM routine completed","SPF applied","PM routine completed"].map((sym,i)=>(
              <div key={sym} style={{marginBottom:"1rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.4rem"}}>
                  <span style={{fontSize:14,color:T.inkMid}}>{sym}</span>
                  <span style={{fontSize:12,color:T.terra,cursor:"pointer",fontWeight:500}}>Log today</span>
                </div>
                <div style={{height:5,background:T.border,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${[40,70,80,60][i]}%`,background:T.terra,borderRadius:3,opacity:0.5}}/>
                </div>
              </div>
            ))}
            <div style={{padding:"0.875rem 1rem",background:T.rosePale,borderRadius:10,marginTop:"0.75rem",borderLeft:`2px solid ${T.rose}`}}>
              <p style={{fontSize:12,color:T.inkMid,fontWeight:300,lineHeight:1.65}}>At your six-month milestone, your Layer SPF replenishment kit ships to your door — unprompted. A before/after skin profile is generated from your tracking data.</p>
            </div>
          </div>
        )}

        {/* Sarah card */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"1.5rem",marginBottom:"2rem"}}>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <div style={{width:48,height:48,borderRadius:"50%",background:T.terra,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:20,color:T.white,fontWeight:700,flexShrink:0}}>S</div>
            <div style={{flex:1}}>
              <p style={{fontSize:15,fontWeight:500,color:T.ink,marginBottom:"0.2rem"}}>Sarah — your care guide</p>
              <p style={{fontSize:13,color:T.inkSoft,fontWeight:300,lineHeight:1.55}}>Calling you on day 7. Available by message anytime. She has your full profile and follows your symptom trajectory.</p>
            </div>
          </div>
          <div style={{marginTop:"1rem",paddingTop:"1rem",borderTop:`1px solid ${T.border}`,display:"flex",gap:10}}>
            <button style={{flex:1,padding:"0.75rem",background:T.cream,color:T.ink,border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Message Sarah</button>
            <button style={{flex:1,padding:"0.75rem",background:T.ink,color:T.white,border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>View care calendar</button>
          </div>
        </div>

        <div style={{textAlign:"center",padding:"0.5rem 0 3rem"}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:T.ink,fontStyle:"italic",marginBottom:"0.5rem"}}>Your body always knew. Now it has a map.</p>
          <p style={{fontSize:13,color:T.inkSoft,lineHeight:1.75,maxWidth:400,margin:"0 auto",fontWeight:300}}>You matter enough for us to show up even when everything is fine.</p>
        </div>
      </Shell>
    );
  }

  return null;
}

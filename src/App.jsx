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

// ── SYSTEM PROMPT — medically complete, conversational ──────
const SYSTEM_PROMPT = `You are Folia's perimenopause intake guide. You collect the medical information a licensed provider needs to safely prescribe hormone therapy. You are warm, direct, and never clinical-sounding. Maximum 2 short sentences per response. Ask one thing at a time.

Collect ALL of the following across 8–10 exchanges:

1. First name (ask warmly to open)
2. Date of birth (explain it helps determine the safest options)
3. Cycle status: regular / irregular / no period 3-11 months / no period 12+ months
   → If "12+ months": also ask how long (1-2 years / 3-5 years / 5+ years)
4. Symptoms (guide toward: hot flashes, night sweats, sleep disruption, mood/anxiety, brain fog, low libido, vaginal dryness, urinary urgency, joint aches, palpitations, weight gain, skin/hair changes) + how severely they affect daily life (mild/moderate/severe) — ask both together conversationally
5. Uterus status: yes / hysterectomy / partial hysterectomy — explain this is one of the most important safety questions
6. Medical history — ask about ALL of these in one conversational message:
   Personal: blood clots (DVT/PE), stroke or heart attack, breast cancer, endometrial/ovarian cancer, liver disease, unexplained vaginal bleeding in past 6 months
   Family (mother/sister): breast cancer before 50, blood clots, heart attack before 60
7. Current medications — ask about: hormonal contraceptives, antidepressants/anti-anxiety, blood thinners, tamoxifen or aromatase inhibitors, seizure medications, St. John's Wort
   ALSO on the same message ask: blood pressure (normal/elevated/untreated high/unknown) and smoking status (no/occasionally/regularly)
8. Skin concern briefly (dryness / breakouts / pigmentation / sensitivity / hair thinning / none) — frame as "last one, this is for your skincare protocol"
9. Current provider: yes / no

CRITICAL FLAGS — if user mentions any of these, acknowledge gently and note that their provider will discuss safe alternatives:
- Tamoxifen: "Important — estrogen and tamoxifen cannot be taken together. Your provider will discuss non-hormonal options."
- Blood clots, stroke, breast cancer: "Thank you for sharing this. Some standard options may not be right for you, but your provider will discuss every safe alternative."

After collecting everything, output on its own line:
PROFILE_JSON:{"name":"","dob":"","cycle":"regular","cycleMonths":"","symptoms":[],"severity":"moderate","hasUterus":true,"contraindications":[],"familyHistory":[],"medications":[],"bloodPressure":"normal","smoking":"no","skinConcern":"dryness","hasProvider":false,"phase":"early"}

Phase logic: pre-peri=regular cycle + mild + age<42; early=irregular OR 2-3 moderate symptoms; mid=3+ symptoms OR severe; late=stopped 12mo+ OR multiple severe

After PROFILE_JSON write one warm closing line like "You're in exactly the right place."

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
  { id:"aware", name:"Folia Aware", price:19, tagline:"For the early transition", phases:["pre-peri"], includes:["Perimenopause phase assessment","Phase-matched skincare protocol","Symptom tracking","Care guide access"], note:"Does not include prescription or medication delivery", color:T.sage, pale:T.sagePale, stripe:"https://buy.stripe.com/aware" },
  { id:"active", name:"Folia Active", price:39, tagline:"For active perimenopause", phases:["early","mid"], recommended:true, includes:["Everything in Aware","Same-day provider review","Prescription + medication to your door in 4–6 days","Day-7 welcome call","30-day consultation pre-booked","Quarterly care reviews"], note:"7-day free trial · Cancel anytime", color:T.terra, pale:T.terraLight, stripe:"https://buy.stripe.com/active" },
  { id:"complete", name:"Folia Complete", price:59, tagline:"For mid to late perimenopause", phases:["mid","late"], includes:["Everything in Active","Quarterly consultations included","Dedicated NAMS specialist","Layer SPF quarterly replenishment","Annual full care review"], note:"7-day free trial · Cancel anytime", color:T.inkMid, pale:T.cream, stripe:"https://buy.stripe.com/complete" },
];

const SKIN = {
  dryness:["Ceramide-rich moisturizer on damp skin","Hyaluronic acid serum underneath","Squalane or rosehip oil at night"],
  breakouts:["Niacinamide 10% + zinc serum (AM)","Gentle salicylic acid cleanser 2–3x/week","Avoid heavy occlusives on lower face"],
  pigmentation:["Azelaic acid 10% (evening, 2–3x/week)","Vitamin C serum in the morning","Mineral SPF 50+ daily — essential for melasma"],
  sensitivity:["Fragrance-free low-pH cleanser only","Bakuchiol 1% instead of retinol","Centella asiatica moisturizer for barrier repair"],
  default:["Mineral broad-spectrum SPF 50+ every day","Ceramide moisturizer for barrier repair","Bakuchiol 1% serum at night for collagen support"],
};
const getRecs = (c="") => { const s=c.toLowerCase(); if(s.includes("dry"))return SKIN.dryness; if(s.includes("break")||s.includes("acne"))return SKIN.breakouts; if(s.includes("pig")||s.includes("spot"))return SKIN.pigmentation; if(s.includes("sens")||s.includes("red"))return SKIN.sensitivity; return SKIN.default; };

const pill = (bg,fg,sm) => ({ display:"inline-block", padding:sm?"0.2rem 0.65rem":"0.35rem 0.95rem", background:bg, color:fg, borderRadius:40, fontSize:sm?11:12, fontWeight:500, letterSpacing:"0.02em", fontFamily:"'DM Sans',sans-serif", marginBottom:4 });
const Shell = ({children}) => <div style={{fontFamily:"'DM Sans',sans-serif",maxWidth:680,margin:"0 auto",padding:"0 2rem",minHeight:"100vh"}}>{children}</div>;
const Header = ({right}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.75rem 0 2rem",borderBottom:`1px solid ${T.border}`,marginBottom:"2rem"}}>
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <span onClick={()=>setView("welcome")} style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:T.ink,cursor:"pointer"}}onClick={()=>setView("welcome")}>Folia</span>
      <span style={{fontSize:11,color:T.terra,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:500}}>Perimenopause platform</span>
    </div>
    {right&&<span style={{fontSize:12,color:T.inkSoft}}>{right}</span>}
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
  const bottomRef = useRef(null);
  const scroll = () => setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),50);

  const allConsent = Object.values(consent).every(Boolean);

  async function callAPI(history,isFirst=false) {
    setLoading(true); setReplies([]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
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

  // ── WELCOME ──────────────────────────────────────────────
  if(view==="welcome") return (
    <Shell><style>{G}</style><Header/>
      <div style={{marginBottom:"3rem"}}>
        <p className="fu" style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.18em",marginBottom:"1.25rem"}}>Perimenopause care, finally</p>
        <h1 className="fu1" style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(38px,6vw,58px)",fontWeight:700,color:T.ink,lineHeight:1.08,letterSpacing:"-0.025em",marginBottom:"1.5rem"}}>
          Your hormones changed,<br/><em style={{color:T.terra,fontStyle:"italic"}}>your care should too.</em>
        </h1>
        <p className="fu2" style={{fontSize:17,color:T.inkMid,lineHeight:1.75,maxWidth:500,marginBottom:"2rem",fontWeight:300}}>
          Most women wait 4–6 years for a diagnosis. Folia maps where you are, gets FDA-approved medication to your door in days, and follows up for the full year.
        </p>

        {/* Promise strip */}
        <div className="fu2" style={{display:"flex",gap:0,marginBottom:"2.5rem",borderRadius:14,overflow:"hidden",border:`1px solid ${T.border}`}}>
          {[{n:"Day 1",l:"Intake + profile"},{n:"Day 2",l:"Prescription issued"},{n:"Day 4–6",l:"Medication at your door"},{n:"Always",l:"Your care team"}].map((s,i)=>(
            <div key={i} style={{flex:1,padding:"1rem 0.75rem",background:i===2?T.ink:T.surface,textAlign:"",borderRight:i<3?`1px solid ${T.border}`:"none"}}>
              <p style={{fontSize:12,fontWeight:700,color:i===2?T.white:T.terra,marginBottom:"0.35rem",fontFamily:"'Playfair Display',serif"}}>{s.n}</p>
              <p style={{fontSize:11,color:i===2?"rgba(255,255,255,0.6)":T.inkSoft,lineHeight:1.4,fontWeight:300}}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="fu3" style={{marginBottom:"2.5rem"}}>
          <div style={{borderLeft:`3px solid ${T.terra}`,paddingLeft:"1.25rem",marginBottom:"1.5rem"}}>
            <p style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem"}}>Perimenopause care</p>
            {["Hormonal phase assessment — conversational, 3 minutes","Same-day provider review — prescription issued without an appointment","Medication at your door in 4–6 days via pharmacy partner","Proactive care team — welcome call, consultations, quarterly reviews, all pre-scheduled"].map((t,i)=>(
              <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:"0.7rem"}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:12,color:T.terra,fontWeight:700,minWidth:20,paddingTop:2}}>0{i+1}</span>
                <span style={{fontSize:14,color:T.inkMid,lineHeight:1.55,fontWeight:300}}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{borderLeft:`3px solid ${T.border}`,paddingLeft:"1.25rem"}}>
            <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem"}}>Skin support</p>
            {["Phase-matched skincare protocol — treating the hormonal root cause","Layer SPF kit included at your six-month milestone"].map((t,i)=>(
              <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:"0.7rem"}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:12,color:T.inkSoft,fontWeight:700,minWidth:20,paddingTop:2}}>0{i+5}</span>
                <span style={{fontSize:14,color:T.inkSoft,lineHeight:1.55,fontWeight:300}}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="fu3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"2.5rem"}}>
          {[{n:"73M",l:"U.S. women in perimenopause"},{n:"4–6yr",l:"Average wait for diagnosis"},{n:"4–6d",l:"Intake to medication"}].map(s=>(
            <div key={s.n} style={{padding:"1.25rem 1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,textAlign:"left"}}>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:T.terra,marginBottom:"0.4rem"}}>{s.n}</p>
              <p style={{fontSize:11,color:T.inkSoft,lineHeight:1.5,fontWeight:300}}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Consent */}
        <div className="fu4" style={{padding:"1.25rem 1.5rem",background:T.cream,borderRadius:14,marginBottom:"1.75rem",display:"flex",gap:14,alignItems:"flex-start",borderLeft:`3px solid ${T.terra}`}}>
          <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{marginTop:4,width:16,height:16,accentColor:T.terra,flexShrink:0,cursor:"pointer"}}/>
          <p style={{fontSize:13,color:T.inkMid,lineHeight:1.7,fontWeight:300}}>
            I understand Folia connects me with independent licensed providers — not medical advice. I consent to Folia processing my responses under HIPAA. All clinical care uses only FDA-approved treatments at provider discretion.
          </p>
        </div>

        <div className="fu4">
          <Btn onClick={startChat} disabled={!agreed}>Start my perimenopause assessment →</Btn>
          <p style={{fontSize:12,color:T.inkSoft,marginTop:"0.75rem",textAlign:"left"}}>3–4 minutes · Medically complete · HIPAA protected</p>
        </div>
      </div>
    </Shell>
  );

  // ── CHAT ─────────────────────────────────────────────────
  if(view==="chat") return (
    <Shell><style>{G}</style><Header right="Perimenopause intake"/>
      <div style={{display:"flex",gap:6,marginBottom:"1.5rem"}}>
        {[0,1,2,3,4,5,6,7,8,9].map(i=>(
          <div key={i} style={{height:3,flex:1,borderRadius:2,background:i<Math.min(messages.filter(m=>m.role==="assistant").length,10)?T.terra:T.border,transition:"background 0.3s"}}/>
        ))}
      </div>
      <div style={{padding:"0.75rem 1rem",background:T.cream,borderRadius:10,borderLeft:`3px solid ${T.terra}`,marginBottom:"1.5rem"}}>
        <p style={{fontSize:12,color:T.inkMid,fontWeight:300,lineHeight:1.6}}><strong style={{fontWeight:500}}>Perimenopause assessment</strong> — your licensed provider uses these answers to review your case. Answer honestly. Skin is the final question.</p>
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
    <Shell><style>{G}</style><Header right="Review & confirm"/>
      <p className="fu" style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"0.75rem"}}>Before we generate your profile</p>
      <h2 className="fu1" style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:T.ink,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:"0.5rem"}}>One last step.</h2>
      <p className="fu2" style={{fontSize:15,color:T.inkMid,lineHeight:1.75,marginBottom:"2rem",fontWeight:300}}>Your provider relies on these confirmations to review your case safely and legally.</p>

      <div className="fu3" style={{display:"flex",flexDirection:"column",gap:"0.75rem",marginBottom:"2rem"}}>
        {[
          {k:"c1", text:"The information I provided is accurate and complete to the best of my knowledge. I understand my provider relies on this to make safe prescribing decisions."},
          {k:"c2", text:"I understand Folia connects me with independent licensed providers who make all prescribing decisions at their sole discretion. Folia does not practice medicine."},
          {k:"c3", text:"I consent to my health information being shared with the licensed provider reviewing my case, protected under HIPAA."},
          {k:"c4", text:"I understand hormone therapy carries risks and benefits my provider will discuss with me before I accept any prescription."},
          {k:"c5", text:"I am 18 years of age or older and confirm this assessment reflects my own health information."},
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
        {allConsent?"Generate my perimenopause profile →":"Please confirm all items above"}
      </Btn>
      <div style={{height:"2rem"}}/>
    </Shell>
  );

  // ── RESULTS ──────────────────────────────────────────────
  if(view==="results"&&profile) return (
    <Shell><style>{G}</style><Header right="Your perimenopause profile"/>
      <div className="fu" style={{padding:"2rem",background:T.ink,borderRadius:20,marginBottom:"1.5rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:ph.color,opacity:0.12}}/>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"0.75rem"}}>Your perimenopause stage</p>
        <span style={{...pill(ph.color+"30",ph.color),marginBottom:"1rem",display:"inline-block"}}>{ph.label}</span>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:T.white,marginBottom:"0.75rem",lineHeight:1.2}}>{ph.short}</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.6)",lineHeight:1.75,fontWeight:300}}>{ph.desc}</p>
      </div>

      {/* Clinical flags */}
      {profile.contraindications?.length>0&&!profile.contraindications.every(c=>!c||c==="none")&&(
        <div style={{padding:"1rem 1.25rem",background:"#FBF5EA",border:`1px solid #E8C8A0`,borderRadius:12,marginBottom:"1.25rem"}}>
          <p style={{fontSize:13,color:"#8A5A1A",lineHeight:1.65,fontWeight:300}}><strong style={{fontWeight:500}}>For your provider:</strong> You mentioned health history that may affect which options are appropriate. Your provider will review all safe alternatives.</p>
        </div>
      )}
      {profile.medications?.includes("tamoxifen")&&(
        <div style={{padding:"1rem 1.25rem",background:"#FBF5EA",border:`1px solid #E8C8A0`,borderRadius:12,marginBottom:"1.25rem"}}>
          <p style={{fontSize:13,color:"#8A5A1A",lineHeight:1.65,fontWeight:300}}><strong style={{fontWeight:500}}>Important:</strong> Tamoxifen and estrogen cannot be taken together. Your provider will discuss non-hormonal options that are safe and effective.</p>
        </div>
      )}

      {profile.symptoms?.length>0&&(
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"1.25rem 1.5rem",marginBottom:"1.25rem"}}>
          <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"0.75rem"}}>Symptoms you mentioned</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:profile.severity?"0.75rem":0}}>
            {profile.symptoms.map(s=><span key={s} style={pill(T.rosePale,T.rose,false)}>{s}</span>)}
          </div>
          {profile.severity&&<p style={{fontSize:14,color:T.inkSoft,fontWeight:300}}>Daily impact: <strong style={{color:T.ink,fontWeight:500}}>{profile.severity}</strong></p>}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:"2rem"}}>
        {[{label:"Perimenopause stage",value:ph.label},{label:"Medication to door",value:"4–6 days"},{label:"Clinical care",value:ph.urgency},{label:"Recommended plan",value:recommendedPlan.name}].map(m=>(
          <div key={m.label} style={{padding:"1.25rem 1.5rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14}}>
            <p style={{fontSize:11,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.5rem"}}>{m.label}</p>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:T.ink,lineHeight:1.2}}>{m.value}</p>
          </div>
        ))}
      </div>

      <Btn onClick={()=>setView("pricing")}>Choose my plan →</Btn>
    </Shell>
  );

  // ── PRICING ──────────────────────────────────────────────
  if(view==="pricing"&&profile) return (
    <Shell><style>{G}</style><Header right="Choose your plan"/>
      <p className="fu" style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"0.75rem"}}>Perimenopause care plans</p>
      <h2 className="fu1" style={{fontFamily:"'Playfair Display',serif",fontSize:34,fontWeight:700,color:T.ink,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:"0.5rem"}}>Your plan, matched<br/>to your phase.</h2>
      <p className="fu2" style={{fontSize:15,color:T.inkMid,lineHeight:1.75,marginBottom:"0.75rem",fontWeight:300}}>Based on your profile, we recommend <strong style={{color:T.ink,fontWeight:500}}>{recommendedPlan.name}</strong>.</p>
      <div className="fu2" style={{padding:"0.875rem 1.25rem",background:ph.pale,borderRadius:12,borderLeft:`3px solid ${ph.color}`,marginBottom:"2rem"}}>
        <p style={{fontSize:13,color:T.inkMid,fontWeight:300,lineHeight:1.65}}>Your stage: <strong style={{color:T.ink,fontWeight:500}}>{ph.label}</strong> — clinical care is {ph.urgency}.</p>
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
              {plan.note&&<p style={{fontSize:11,color:T.inkSoft,textAlign:"left",marginTop:"0.6rem",fontWeight:300}}>{plan.note}</p>}
            </div>
          );
        })}
      </div>

      <div style={{padding:"1.25rem 1.5rem",background:T.cream,borderRadius:14,marginBottom:"2rem",borderLeft:`3px solid ${T.terra}`}}>
        <p style={{fontSize:14,fontWeight:500,color:T.ink,marginBottom:"0.3rem"}}>7-day free trial on Active and Complete</p>
        <p style={{fontSize:13,color:T.inkMid,lineHeight:1.65,fontWeight:300}}>Your provider review begins immediately. Medication can ship before your trial ends. Cancel before day 7 — no charge.</p>
      </div>

      <Btn onClick={()=>setView("protocol")}>Continue to my protocol →</Btn>
      <div style={{height:"2.5rem"}}/>
    </Shell>
  );

  // ── PROTOCOL ─────────────────────────────────────────────
  if(view==="protocol"&&profile){
    const recs=getRecs(profile.skinConcern);
    return(
      <Shell><style>{G}</style><Header right="Your protocol"/>
        <p className="fu" style={{fontSize:11,fontWeight:500,color:T.terra,textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"0.75rem"}}>Personalized perimenopause protocol</p>
        <h2 className="fu1" style={{fontFamily:"'Playfair Display',serif",fontSize:34,fontWeight:700,color:T.ink,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:"0.5rem"}}>Perimenopause first.<br/><span style={{color:T.inkSoft,fontWeight:400,fontSize:24,fontStyle:"italic"}}>Skin supported.</span></h2>
        <p className="fu2" style={{fontSize:15,color:T.inkMid,lineHeight:1.75,marginBottom:"2.5rem",fontWeight:300}}>Medication reviewed and issued same day. At your door in 4–6 days. Your care team follows up — always.</p>

        {/* Fulfillment */}
        <div className="fu3" style={{background:T.ink,borderRadius:20,padding:"1.75rem",marginBottom:"1.25rem"}}>
          <p style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"1.25rem"}}>How you get your medication</p>
          {[
            {step:"01",time:"Today",label:"Provider reviews your profile",detail:"Licensed provider reviews your full medical intake asynchronously — no appointment. Specialist offered if your history requires it."},
            {step:"02",time:"Same day",label:"Prescription issued",detail:"FDA-approved HRT prescribed at provider discretion. Routed directly to pharmacy partner."},
            {step:"03",time:"48 hours",label:"Medication ships",detail:"Estradiol patch, gel, spray, or progesterone — shipped to your door with your personalized protocol card."},
            {step:"04",time:"Day 4–6",label:"Medication at your door",detail:"Tracking sent to your phone. Welcome kit includes your protocol card and a Layer SPF sample."},
          ].map((s,i)=>(
            <div key={i} style={{display:"flex",gap:16,paddingBottom:i<3?"1.25rem":0,marginBottom:i<3?"1.25rem":0,borderBottom:i<3?"1px solid rgba(255,255,255,0.08)":"none"}}>
              <div style={{textAlign:"left",minWidth:40}}>
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
            <p style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:"0.75rem",textAlign:"left",fontWeight:300}}>No appointment needed. Specialist offered if clinically indicated.</p>
          </div>
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

        <Btn onClick={()=>setView("onboarding")}>Continue to my care plan →</Btn>
        <div style={{height:"2.5rem"}}/>
      </Shell>
    );
  }

  // ── ONBOARDING MESSAGE ───────────────────────────────────
  if(view==="onboarding"&&profile) return(
    <Shell><style>{G}</style><Header right="Welcome to Folia"/>
      <div className="fu" style={{background:T.ink,borderRadius:20,padding:"2rem",marginBottom:"1.5rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:"50%",background:T.terra,opacity:0.1}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:T.terra,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontSize:18,color:T.white,fontWeight:700,flexShrink:0}}>S</div>
          <div>
            <p style={{fontSize:14,fontWeight:500,color:T.white}}>Sarah</p>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.45)",fontWeight:300}}>Your Folia care guide</p>
          </div>
        </div>
        <p style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:T.white,fontWeight:600,lineHeight:1.3,marginBottom:"1.25rem",fontStyle:"italic"}}>"You just did something most women wait years to do."</p>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.65)",lineHeight:1.8,fontWeight:300,marginBottom:"1rem"}}>I've reviewed your perimenopause profile. Your provider is reviewing it now and will issue a prescription today if appropriate — no appointment needed.</p>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.65)",lineHeight:1.8,fontWeight:300,marginBottom:"1rem"}}>I'll call you personally on day 7. Just 10 minutes, no agenda — I want to know how you're feeling and make sure you have everything you need.</p>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.65)",lineHeight:1.8,fontWeight:300}}>Your entire care year is already planned. You don't have to remember to follow up — we'll be there before you need to ask.</p>
        <div style={{marginTop:"1.5rem",paddingTop:"1.5rem",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.3)",fontWeight:300}}>Sarah · Folia Care Team · care@folia.com</p>
        </div>
      </div>

      <div className="fu1" style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:"1.5rem",marginBottom:"1.25rem"}}>
        <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"1.25rem"}}>What happens next</p>
        {[
          {time:"Next 2–4 hrs",label:"Provider reviews your profile",detail:"You'll be notified when complete. Prescription issued if appropriate — specialist offered if needed.",icon:"●",color:T.terra},
          {time:"Tonight",label:"Tracking number in your inbox",detail:"Medication ships within 48hrs. FDA-approved formulation selected by your provider.",icon:"●",color:T.terra},
          {time:"Day 4–6",label:"Welcome kit at your door",detail:"Medication + protocol card + Layer SPF sample. Everything you need to start with confidence.",icon:"○",color:T.inkSoft},
          {time:"Day 7",label:"Sarah calls you",detail:"10 minutes. No agenda. Just making sure you have what you need.",icon:"◈",color:T.rose},
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
      <Shell><style>{G}</style><Header right="Dashboard"/>
        <div style={{marginBottom:"0.5rem"}}><span style={pill(ph.pale,ph.color)}>{ph.label}</span></div>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:T.ink,letterSpacing:"-0.02em",margin:"1rem 0 0.4rem",lineHeight:1.1}}>Your care, planned.</h2>
        <p style={{fontSize:15,color:T.inkSoft,fontWeight:300,lineHeight:1.65,marginBottom:"2rem"}}>Every touchpoint pre-scheduled. We show up before you need to ask.</p>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"1.75rem"}}>
          {[{l:"Medication ETA",v:"4–6d"},{l:"Care touchpoints",v:"9"},{l:"Your guide",v:"Sarah"}].map(m=>(
            <div key={m.l} style={{padding:"1.25rem 1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,textAlign:"left"}}>
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
              <p style={{fontSize:11,fontWeight:500,color:T.inkSoft,textTransform:"uppercase",letterSpacing:"0.12em"}}>Perimenopause symptom tracker</p>
              <span style={pill(T.terraLight,T.terra,true)}>Primary</span>
            </div>
            <p style={{fontSize:13,color:T.inkSoft,fontWeight:300,marginBottom:"1.25rem",lineHeight:1.6}}>Log daily. At 14 days we compare to your baseline and show you exactly what's changed.</p>
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

        <div style={{textAlign:"left",padding:"0.5rem 0 3rem"}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:T.ink,fontStyle:"italic",marginBottom:"0.5rem"}}>Always scheduled. Never reactive.</p>
          <p style={{fontSize:13,color:T.inkSoft,lineHeight:1.75,maxWidth:400,margin:"0 auto",fontWeight:300}}>You matter enough for us to show up even when everything is fine.</p>
        </div>
      </Shell>
    );
  }

  return null;
}

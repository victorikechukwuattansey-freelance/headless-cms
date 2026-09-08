'use strict';
// SECOND-ORDER AUDIT harness. Independent of monte-carlo.js; forks the flow with
// parameterized fare cards / demand / idle / vehicle knobs, then runs the
// experiments required by the second-order brief. Does NOT touch index.html.

const ZONES=[
  {n:'CBD',lat:9.058,lng:7.496,w:1.00,gr:'core'},{n:'Wuse 2',lat:9.077,lng:7.463,w:1.25,gr:'core'},
  {n:'Wuse 1',lat:9.070,lng:7.490,w:1.10,gr:'core'},{n:'Maitama',lat:9.083,lng:7.525,w:1.05,gr:'core'},
  {n:'Asokoro',lat:9.075,lng:7.495,w:0.95,gr:'core'},{n:'Garki',lat:9.040,lng:7.490,w:1.15,gr:'core'},
  {n:'Jabi',lat:9.067,lng:7.414,w:1.30,gr:'mall'},{n:'Utako',lat:9.060,lng:7.440,w:0.90,gr:'core'},
  {n:'Gwarinpa',lat:9.100,lng:7.420,w:1.05,gr:'sub'},{n:'Kubwa',lat:9.120,lng:7.320,w:0.80,gr:'sub'},
  {n:'Lugbe',lat:8.990,lng:7.380,w:0.60,gr:'sat'},{n:'Nyanya',lat:8.940,lng:7.530,w:0.70,gr:'sat'},
  {n:'Mararaba',lat:8.910,lng:7.560,w:0.50,gr:'sat'},{n:'Lokogoma',lat:9.000,lng:7.520,w:0.70,gr:'sub'},
  {n:'Airport',lat:9.007,lng:7.263,w:0.75,gr:'air'}];
const BAND={'0':{d:0.35,s:1.00},'1':{d:0.28,s:1.00},'2':{d:0.22,s:1.00},'3':{d:0.18,s:1.00},'4':{d:0.22,s:1.00},
  '5':{d:0.45,s:1.05},'6':{d:0.85,s:1.10},'7':{d:1.25,s:1.20},'8':{d:1.40,s:1.30},'9':{d:1.25,s:1.25},
  '10':{d:1.05,s:1.05},'11':{d:1.00,s:1.00},'12':{d:1.05,s:1.00},'13':{d:1.05,s:1.00},'14':{d:1.10,s:1.05},'15':{d:1.30,s:1.15},
  '16':{d:1.55,s:1.30},'17':{d:1.75,s:1.45},'18':{d:1.70,s:1.50},'19':{d:1.50,s:1.45},'20':{d:1.30,s:1.35},
  '21':{d:1.15,s:1.25},'22':{d:1.00,s:1.20},'23':{d:0.80,s:1.15}};
const OD={core:[{t:'intra-core',k:3.0,m:14,w:30},{t:'mall',k:5.0,m:16,w:14},{t:'cross',k:6.5,m:22,w:26},{t:'sub',k:13,m:32,w:18},{t:'sat',k:18,m:42,w:7},{t:'air',k:32,m:48,w:5}],
  mall:[{t:'intra-core',k:4.5,m:15,w:40},{t:'mall',k:4.0,m:12,w:12},{t:'core-return',k:5.5,m:18,w:30},{t:'sub',k:12,m:30,w:12},{t:'air',k:33,m:50,w:6}],
  sub:[{t:'commute',k:11,m:30,w:55},{t:'sub',k:7,m:24,w:20},{t:'mall',k:8,m:25,w:12},{t:'private',k:3.0,m:12,w:13}],
  sat:[{t:'commute',k:16,m:42,w:65},{t:'sat',k:8,m:26,w:18},{t:'mall',k:12,m:32,w:12},{t:'private',k:4,m:14,w:5}],
  air:[{t:'air',k:31,m:46,w:100}]};
const PREF={'intra-core':['core'],'mall':['core','mall'],'cross':['core'],'sub':['sub'],'sat':['sat'],'commute':['core'],'private':['core','sub'],'core-return':['core'],'air':['air']};
const CLASS_SPEED={'intra-core':{ff:30,pk:20},'mall':{ff:32,pk:21},'cross':{ff:34,pk:21},'sub':{ff:42,pk:26},'sat':{ff:48,pk:30},'air':{ff:55,pk:38},'core-return':{ff:32,pk:21},'commute':{ff:44,pk:27},'private':{ff:28,pk:19}};

const CARD_A={label:'A 2023-like',base:350,perKm:88,perMin:10,minFare:700};   // bigswich/bolt.eu 2023 reproduction
const CARD_B={label:'B 2024',base:884,perKm:152,perMin:25,minFare:1495};      // ACJ Aug-2024 official increase
const CARD_C={label:'C 2024+15%',base:1017,perKm:175,perMin:29,minFare:1720}; // hypothetical +15% (2025-26 scenario)

function def(o){return Object.assign({comm:0.20,fuelPrice:1299,shiftHours:12,shiftStart:6.5,baseHourlyRate:1.30,capture:1.07,accept:3.0,relocKm:2.6,relocProb:0.65,jitterDeg:0.004,dwellPostTrip:1.6,dwellOnSite:1.2,cancelP:0.06,rainP:0.12,rainSurge:1.15,eventP:0.02,eventSurge:1.55,l100:14.0,acFactor:1.04,idleLPerHr:1.5,engineOnIdleFrac:0.5,surgeJitter:0.10,airportShareFrac:0.045,peakWindow:[[6,10],[16,21]],fareCard:CARD_B,surgeMult:1.0,demandMult:1.0,unpaidFactor:1.0},o);}

function gc(a,b){const R=6371,dL=(b.lng-a.lng)*Math.PI/180,la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180,h=Math.sin((la2-la1)/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dL/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
const cl=(x,a,b)=>Math.min(b,Math.max(a,x));
function randN(mu,sd,r0,r1){const t=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());return cl(mu+sd*t,r0,r1);}

function drawOrigin(driver,A){
  if(Math.random()<0.72){
    const t=Math.random()*2*Math.PI,r=0.4+Math.random()*1.4;
    const p={lat:driver.lat+Math.cos(t)*(r/111),lng:driver.lng+Math.sin(t)*(r/111)/Math.cos(driver.lat*Math.PI/180)};
    let z=ZONES[0],md=1e9;for(const zz of ZONES){const d=gc(p,zz);if(d<md){md=d;z=zz;}}
    return {z,px:p};
  }
  const list=[];let sum=0;for(const z of ZONES){const w=z.w*Math.exp(-gc(driver,z)/5);list.push({z,w});sum+=w;}
  let r=Math.random()*sum;for(const e of list){r-=e.w;if(r<=0)return {z:e.z,px:{lat:e.z.lat+(Math.random()-.5)*2*A.jitterDeg,lng:e.z.lng+(Math.random()-.5)*2*A.jitterDeg}};}
  return {z:ZONES[0],px:{lat:ZONES[0].lat,lng:ZONES[0].lng}};
}
function drawDest(g,A){
  const list=OD[g]||OD.core;let sum=0;const airScale=(A.airportShareFrac||0.06)/0.06;
  for(const x of list)sum+=x.w*(x.t==='air'?airScale:1);
  let r=Math.random()*sum;for(const x of list){r-=x.w*(x.t==='air'?airScale:1);if(r<=0)return x;}
  return list[list.length-1];
}
function destFor(o,gr,cls){
  const pre=PREF[cls.t]||['core'],kLo=cls.k*0.35,kHi=cls.k*1.7,c=[];const op=o.px;
  for(const z of ZONES){const d=gc(op,z)*1.08;if(d<kLo||d>kHi)continue;c.push({z,d,c:(pre.includes(z.gr)?2:1)*z.w});}
  if(!c.length)for(const z of ZONES)c.push({z,d:gc(op,z)*1.08,c:z.w});
  let s=0;for(const x of c)s+=x.c;let r=Math.random()*s;for(const x of c){r-=x.c;if(r<=0)return x;}
  return c[c.length-1];
}
function surgeMult(h,dow,rain,event,A){
  let b=BAND[Math.floor(h)].s*A.surgeMult;if(event)b*=A.eventSurge;if(rain)b*=A.rainSurge;
  if((dow===0||dow===6)&&h>=21)b*=1.15;return b*(1+Math.random()*A.surgeJitter);
}

function daySim(opt){
  const A={...def(opt),fareCard:opt.fareCard||CARD_B};
  const R={gross:0,trips:0,rej:0,cancel:0,kmPaid:0,kmUnpaid:0,litresD:0,litresI:0,idleH:0,driveH:0,relocKm:0,pickMinT:0,rideMinT:0,dwellT:0};
  const dow=Math.floor(Math.random()*7),rain=Math.random()<A.rainP,event=Math.random()<A.eventP;
  const l100=randN(A.l100,A.l100*0.1,A.l100*0.9,A.l100*1.18);
  const start=A.shiftStart,end=start+A.shiftHours;
  let driver={lat:ZONES[Math.floor(Math.random()*5)].lat+(Math.random()-.5)*.02,lng:ZONES[Math.floor(Math.random()*5)].lng+(Math.random()-.5)*.02};
  for(let h=Math.floor(start);h<Math.floor(end);h++){
    const frac=Math.min(1,end-h),band=BAND[h],pk= ((h>=6&&h<10)||(h>=16&&h<21));
    const rate=A.baseHourlyRate*band.d*A.capture*A.demandMult*frac;
    const nReq=Math.floor(-Math.log(1-Math.random())*rate)+(Math.random()<rate%1?1:0);
    let batchMin=frac*60,tripThisHour=0;
    for(let q=0;q<nReq&&batchMin>0&&tripThisHour<3;q++){
      R.rej++;
      const o=drawOrigin(driver,A);
      const pickKm=Math.max(0.4,gc(driver,o.px)*1.25*A.unpaidFactor);
      if(pickKm> (A.accept*A.unpaidFactor))continue;
      const cls=drawDest(o.z.gr,A),dst=destFor(o,o.z.gr,cls);
      const spd=CLASS_SPEED[cls.t][pk?'pk':'ff']||30;
      const paidKm=Math.max(1.2,dst.d*(0.92+Math.random()*0.12));
      const rideMin=(paidKm/spd)*60;
      const pickMin=(pickKm/Math.max(20,spd*0.75))*60+1.5;
      const used=pickMin+A.dwellOnSite+rideMin+A.dwellPostTrip;
      if(used>batchMin)break;
      const surge=surgeMult(h,dow,rain,event,A),fc=A.fareCard;
      const fare=Math.max(fc.minFare,fc.base+fc.perKm*paidKm+fc.perMin*rideMin)*surge;
      R.gross+=fare;
      if(Math.random()<A.cancelP){R.cancel++;R.kmUnpaid+=pickKm;batchMin-=pickMin;R.pickMinT+=pickMin;continue;}
      R.trips++;R.kmPaid+=paidKm;R.kmUnpaid+=pickKm;
      R.driveH+=used/60;R.pickMinT+=pickMin;R.rideMinT+=rideMin;R.dwellT+=(A.dwellOnSite+A.dwellPostTrip);
      batchMin-=used;tripThisHour++;
      driver={lat:dst.z.lat+(Math.random()-.5)*.01,lng:dst.z.lng+(Math.random()-.5)*.01};
    }
    const idleM=Math.max(0,batchMin);R.idleH+=idleM/60;
    if(idleM>15&&Math.random()<A.relocProb){
      const best=ZONES.slice().sort((x,y)=>y.w-x.w).slice(0,3)[Math.floor(Math.random()*3)];
      const d=gc(driver,best);
      if(d>1){const m=Math.min(A.relocKm*A.unpaidFactor,d);driver={lat:driver.lat+(best.lat-driver.lat)*m/d,lng:driver.lng+(best.lng-driver.lng)*m/d};R.relocKm+=m;R.kmUnpaid+=m;}
    }
  }
  R.litresD=(R.kmPaid+R.kmUnpaid)/100*l100*A.acFactor;
  R.litresI=R.idleH*A.engineOnIdleFrac*A.idleLPerHr;
  const litres=R.litresD+R.litresI;
  R.after=R.gross*(1-A.comm);
  R.petrol=litres*A.fuelPrice;R.net=R.after-R.petrol;R.litres=litres;
  R.onlineH=R.driveH+R.idleH;R.captureR=R.trips/Math.max(1,R.trips+R.rej);
  return R;
}
function runDays(opt,n){const out=new Array(n);for(let i=0;i<n;i++)out[i]=daySim(opt);return out;}
function stats(arr){const n=arr.length;let s=0;for(let i=0;i<n;i++)s+=arr[i];const m=s/n;let ss=0;for(let i=0;i<n;i++)ss+=(arr[i]-m)*(arr[i]-m);
  const a=arr.slice().sort((x,y)=>x-y);return{mean:m,sd:Math.sqrt(ss/n),p5:a[Math.floor(n*.05)],p10:a[Math.floor(n*.10)],p50:a[Math.floor(n*.5)],p90:a[Math.floor(n*.90)],p95:a[Math.floor(n*.95)]};}
const fracOver=(arr,t)=>{let c=0;for(const v of arr)if(v>=t)c++;return c/arr.length;};
function monthSim(opt){let s=0;for(let d=0;d<26;d++)s+=daySim(opt).net;return s;}
function Pmonth(opt,ndays){const D=runDays(opt,ndays);let s=0;for(const d of D)s+=d.net;const m=s/ndays;const st=stats(D.map(d=>d.net));const z=(300000-m*26)/(st.sd*Math.sqrt(26));return{meanDay:m,sdDay:st.sd,monthMean:m*26,P300:1-0.5*(1+erf(z/Math.SQRT2))};}
function erf(x){const s=x<0?-1:1;x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y;}
const line=(x)=>console.log(x);
function reportDay(opt,n,label){
  const D=runDays(opt,n);
  const agg=k=>{let s=0;for(const d of D)s+=d[k];return s/n;};
  const nets=D.map(d=>d.net);const s=stats(nets);
  const kmP=agg('kmPaid'),kmU=agg('kmUnpaid');
  line(`  ${label}: gross=${agg('gross').toFixed(0)} after=${agg('after').toFixed(0)} petrol=${agg('petrol').toFixed(0)} net=${s.mean.toFixed(0)} [p5=${s.p5.toFixed(0)} p50=${s.p50.toFixed(0)} p95=${s.p95.toFixed(0)}] kmPaid=${kmP.toFixed(0)} kmUnpaid=${kmU.toFixed(0)} trips=${agg('trips').toFixed(1)} idleH=${agg('idleH').toFixed(1)} driveH=${agg('driveH').toFixed(1)} onlineH=${agg('onlineH').toFixed(1)} l/day=${agg('litres').toFixed(1)} afterCommPerTotalKm=${(agg('after')/(kmP+kmU)).toFixed(1)} fuelPerTotalKm=${(agg('petrol')/(kmP+kmU)).toFixed(1)}`);
  return{agg,nets,s,kmP,kmU};
}
const t0=Date.now();
const mark=(x)=>{line(`-- [${((Date.now()-t0)/1000).toFixed(1)}s] ${x}`);};

// ---- TASK 1: independent math verification ----
mark('TASK 1');
line('=== TASK 1: INDEPENDENT MATH CHECK (card B, C-config, 2000 days) ===');
{
  const r=reportDay({},2000,'cardB');
  const after=r.agg('after'),tot=r.kmP+r.kmU,litres=r.agg('litres');
  const afterPerKm=after/tot, litresPerKm=litres/tot, fuelPerKm=litresPerKm*1299;
  line(`  after-comm per TOTAL km = ${afterPerKm.toFixed(1)} NGN/km ; fuel per TOTAL km = ${fuelPerKm.toFixed(1)} NGN/km ; gap = ${(afterPerKm-fuelPerKm).toFixed(1)}`);
  line(`  break-even petrol price = ${(after/litres).toFixed(1)} NGN/L ; break-even l/100km = ${(afterPerKm/1299*100).toFixed(1)}`);
  line(`  time budget/day: ride ${r.agg('rideMinT').toFixed(1)}m pickup ${r.agg('pickMinT').toFixed(1)}m dwell ${r.agg('dwellT').toFixed(1)}m idle ${(r.agg('idleH')*60).toFixed(1)}m = total ${(r.agg('rideMinT')+r.agg('pickMinT')+r.agg('dwellT')+r.agg('idleH')*60).toFixed(1)}m vs 720m`);
}

// ---- TASK 2: fare-card scan ----
mark('TASK 2');
line('=== TASK 2: FARE CARD SCAN (C-config, 1500 days + 500 months each) ===');
{
  for(const card of [CARD_A,CARD_B,CARD_C]){
    const o={fareCard:card};
    reportDay(o,1500,card.label);
    const M=[];for(let i=0;i<500;i++)M.push(monthSim(o));
    const s=stats(M);
    line(`  month ${card.label}: mean=${s.mean.toFixed(0)} p5=${s.p5.toFixed(0)} p50=${s.p50.toFixed(0)} p95=${s.p95.toFixed(0)} P>=200k=${fracOver(M,200000).toFixed(4)} P>=250k=${fracOver(M,250000).toFixed(4)} P>=300k=${fracOver(M,300000).toFixed(4)}`);
  }
}

// ---- TASK 3: idle-target experiment (card B) ----
mark('TASK 3');
line('=== TASK 3: IDLE HOURS TARGET (card B, bisect demand to hit idle; 800 days + 300 months) ===');
{
  const bisect=(target)=>{
    let lo=0.4,hi=8.0;
    for(let it=0;it<22;it++){
      const mid=(lo+hi)/2;
      const D=runDays({demandMult:mid},200);
      const idle=D.reduce((s,d)=>s+d.idleH,0)/200;
      if(idle>target)lo=mid;else hi=mid;
    }
    return (lo+hi)/2;
  };
  for(const target of [3,4,5,6,7.6]){
    const dm=bisect(target);
    const o={demandMult:dm};
    const r=reportDay(o,800,`idle~${target}h (demandMult=${dm.toFixed(2)})`);
    const M=[];for(let i=0;i<300;i++)M.push(monthSim(o));
    const s=stats(M);
    line(`  month: mean=${s.mean.toFixed(0)} P50=${s.p50.toFixed(0)} P>=200k=${fracOver(M,200000).toFixed(4)} P>=250k=${fracOver(M,250000).toFixed(4)} P>=300k=${fracOver(M,300000).toFixed(4)}`);
  }
}

// ---- TASK 4: vehicle comparison (card B) ----
mark('TASK 4');
line('=== TASK 4: VEHICLE COMPARISON (card B, 1200 days + 300 months each) ===');
{
  const rows=[
    ['Highlander V6 2005 (14)',{l100:14}],
    ['corolla-ish (8)',{l100:8}],
    ['compact sedan (7)',{l100:7}],
    ['econ sedan (6)',{l100:6}],
    ['hybrid (5)',{l100:5}],
    ['Prius-class (4)',{l100:4}],
    ['hybrid-like + low idle',{l100:5,idleLPerHr:0.6}],
    ['EV-like (10 NGN/km equiv)',{l100:0,fuelPrice:0,idleLPerHr:0,costPerKm:10}],
  ];
  for(const [name,o0] of rows){
    const o={...o0};
    const D=runDays(o,1200);
    const netFn=d=> o0.costPerKm? d.after-10*(d.kmPaid+d.kmUnpaid) : d.net;
    const nets=D.map(netFn);const agg=k=>D.reduce((s,d)=>s+d[k],0)/1200;
    const s=stats(nets);
    let mo=0;const M=300;
    for(let i=0;i<M;i++){
      let mm=0;for(let d2=0;d2<26;d2++){
        const dd=daySim(o);mm+=netFn(dd);
      }
      if(mm>=300000)mo++;
    }
    line(`  ${name}: netDay=${s.mean.toFixed(0)} [p5=${s.p5.toFixed(0)} p95=${s.p95.toFixed(0)}] trips=${agg('trips').toFixed(1)} idle=${agg('idleH').toFixed(1)} l/day=${agg('litres').toFixed(1)} P(month>=300k)=${(mo/M).toFixed(3)}`);
  }
}

// ---- TASK 5: Copilot channel quantification (card B) ----
mark('TASK 5');
line('=== TASK 5: COPILOT CHANNELS (card B; 1500 days + 300 months each) ===');
{
  const channels=[
    ['base',{}],
    ['no repositioning',{relocKm:0,relocProb:0}],
    ['halved deadhead (pickup/reloc x0.6)',{unpaidFactor:0.6}],
    ['zero idle petrol (engine off waits)',{engineOnIdleFrac:0,idleLPerHr:0}],
    ['fares +20% (surgeMult 1.2)',{surgeMult:1.2}],
    ['best combo (no reloc + half deadhead + no idle fuel + +20% fares)',{relocKm:0,relocProb:0,unpaidFactor:0.6,engineOnIdleFrac:0,idleLPerHr:0,surgeMult:1.2}],
  ];
  for(const [name,o0] of channels){
    const o={...o0};
    const D=runDays(o,1500);
    const agg=k=>D.reduce((s,d)=>s+d[k],0)/1500;
    const nets=D.map(d=>d.net);const s=stats(nets);
    let mo=0;const M=300;
    for(let i=0;i<M;i++){if(monthSim(o)>=300000)mo++;}
    line(`  ${name}: netDay=${s.mean.toFixed(0)} grossDay=${agg('gross').toFixed(0)} km/day=${(agg('kmPaid')+agg('kmUnpaid')).toFixed(0)} idle=${agg('idleH').toFixed(1)} trips=${agg('trips').toFixed(1)} monthMean=${(s.mean*26).toFixed(0)} P>=300k=${(mo/M).toFixed(4)}`);
  }
}

// ---- TASK 6: economic frontier ----
mark('TASK 6');
line('=== TASK 6: FRONTIER — what must be true for P(month>=300k) >= 5% / 50% (400 days per cell, normal-approx month) ===');
{
  const out=[];
  for(const card of [CARD_A,CARD_B,CARD_C])
  for(const dm of [1.0,1.5,2.0,2.5,3.0])
  for(const sm of [1.0,1.2,1.4])
  for(const l100 of [5.5,7,9,11,14,16.5]){
    const o={fareCard:card,demandMult:dm,surgeMult:sm,l100:l100};
    const p=Pmonth(o,400);
    out.push({card:card.label,dm,sm,l100,P:p.P300,month:p.monthMean});
  }
  out.sort((a,b)=>b.P-a.P);
  line('  top 12 combos by P(month>=300k):');
  for(const c of out.slice(0,12))line(`   ${c.card} dem${c.dm} surge${c.sm} l100=${c.l100}  monthMean=${c.month.toFixed(0)}  P=${c.P.toFixed(3)}`);
  const b05=out.filter(c=>c.P>=0.05),b50=out.filter(c=>c.P>=0.50);
  line(`  combos with P>=0.05: ${b05.length}  |  combos with P>=0.50: ${b50.length}`);
  if(b05.length)line(`  cheapest combo for P>=0.05: ${JSON.stringify(b05[b05.length-1])}`);
  if(b50.length)line(`  cheapest combo for P>=0.50: ${JSON.stringify(b50[b50.length-1])}`);
}

// ---- TASK 7/8: statistical bound + monthly i.i.d. test ----
mark('TASK 7/8');
line('=== TASK 7/8: STATS & MONTH SIMULATION ===');
{
  line('  Rule-of-three: zero successes in n trials -> 95% upper bound = 3/n. n=10000 -> <0.030%. n=1500 -> <0.20%.');
  const base={};
  const M1=[];for(let i=0;i<500;i++)M1.push(monthSim(base));
  const s1=stats(M1);
  const M2=[];for(let i=0;i<500;i++){
    let mm=0;const l=randN(14,1.4,10,18);
    for(let d2=0;d2<26;d2++)mm+=daySim({l100:l}).net;
    M2.push(mm);
  }
  const s2=stats(M2);
  line(`  iid monthly: mean=${s1.mean.toFixed(0)} sd=${s1.sd.toFixed(0)} p5=${s1.p5.toFixed(0)} p95=${s1.p95.toFixed(0)} P>=300k=${fracOver(M1,300000).toFixed(4)}`);
  line(`  persistent-l100 monthly: mean=${s2.mean.toFixed(0)} sd=${s2.sd.toFixed(0)} p5=${s2.p5.toFixed(0)} p95=${s2.p95.toFixed(0)} P>=300k=${fracOver(M2,300000).toFixed(4)}`);
  line('  weekday note: uniform-dow approximation (26 random dows) vs calendar month changes weekend share by ~0.5 day; effect on month mean ~0.2%.');
}

// ---- TASK 9: THREE MODELS ----
mark('TASK 9');
line('=== TASK 9: THREE MODELS (required result sheet) ===');
{
  const models=[
    ['M1 CONSERVATIVE',{fareCard:CARD_A,demandMult:0.8,l100:14,engineOnIdleFrac:0.5}],
    ['M2 BEST ESTIMATE',{fareCard:CARD_B,demandMult:1.0,l100:14,engineOnIdleFrac:0.5}],
    ['M3 FAVORABLE-PLAUSIBLE',{fareCard:CARD_B,surgeMult:1.15,demandMult:1.5,unpaidFactor:0.8,l100:12.5,engineOnIdleFrac:0.35}],
  ];
  for(const [name,o0] of models){
    const o={...o0};const D=runDays(o,1500);
    const agg=k=>D.reduce((s,d)=>s+d[k],0)/1500;
    const nets=D.map(d=>d.net);const s=stats(nets);
    const kmP=agg('kmPaid'),kmU=agg('kmUnpaid'),tot=kmP+kmU;
    const M=[];for(let i=0;i<500;i++)M.push(monthSim(o));
    const sm=stats(M);
    line(`  --- ${name} ---`);
    line(`  gross/day=${agg('gross').toFixed(0)}  commission/day=${(agg('gross')*0.20).toFixed(0)}  after-commission/day=${agg('after').toFixed(0)}`);
    line(`  petrol/day=${agg('petrol').toFixed(0)}  NET_AFTER_FUEL/day=${s.mean.toFixed(0)} (p5=${s.p5.toFixed(0)} p95=${s.p95.toFixed(0)})`);
    line(`  total km=${tot.toFixed(0)}  paid km=${kmP.toFixed(0)}  unpaid km=${kmU.toFixed(0)}  unpaid fraction=${(kmU/tot).toFixed(3)}`);
    line(`  trips/day=${agg('trips').toFixed(1)}  onlineH=${agg('onlineH').toFixed(1)}  driveH=${agg('driveH').toFixed(1)}  idleH=${agg('idleH').toFixed(1)} l/100km=${o.l100.toFixed(1)} l/day=${agg('litres').toFixed(1)}`);
    line(`  gross NGN/total-km=${(agg('gross')/tot).toFixed(1)}  after-comm NGN/total-km=${(agg('after')/tot).toFixed(1)}  NET NGN/total-km=${(s.mean/tot).toFixed(1)}`);
    line(`  monthly NET mean=${sm.mean.toFixed(0)}  P(>=200k)=${fracOver(M,200000).toFixed(4)}  P(>=250k)=${fracOver(M,250000).toFixed(4)}  P(>=300k)=${fracOver(M,300000).toFixed(4)}  P(>=400k)=${fracOver(M,400000).toFixed(4)}`);
  }
}
mark('DONE');
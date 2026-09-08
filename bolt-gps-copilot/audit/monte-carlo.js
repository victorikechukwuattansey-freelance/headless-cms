'use strict';
// Independent falsification Monte Carlo for: Bolt Abuja, 2005 Toyota Highlander,
// NET_AFTER_FUEL = gross fares x (1 - commission) - petrol.
// Parameters named in ASSUMPTIONS; every assumption audited in AUDIT-REPORT.md.

const PER_KM = 88;        // NGN/km  (official Abuja, bolt.eu 2023 / bigswich 04-2026)
const PER_MIN = 10;       // NGN/min (official Abuja)
const BASE_FARE = 350;    // NGN
const MIN_FARE = 700;     // NGN

const ZONES = [
  {n:'CBD',    lat:9.058, lng:7.496, w:1.00, gr:'core'},
  {n:'Wuse 2', lat:9.077, lng:7.463, w:1.25, gr:'core'},
  {n:'Wuse 1', lat:9.070, lng:7.490, w:1.10, gr:'core'},
  {n:'Maitama',lat:9.083, lng:7.525, w:1.05, gr:'core'},
  {n:'Asokoro',lat:9.075, lng:7.495, w:0.95, gr:'core'},
  {n:'Garki',  lat:9.040, lng:7.490, w:1.15, gr:'core'},
  {n:'Jabi',   lat:9.067, lng:7.414, w:1.30, gr:'mall'},
  {n:'Utako',  lat:9.060, lng:7.440, w:0.90, gr:'core'},
  {n:'Gwarinpa',lat:9.100,lng:7.420, w:1.05, gr:'sub'},
  {n:'Kubwa',  lat:9.120, lng:7.320, w:0.80, gr:'sub'},
  {n:'Lugbe',  lat:8.990, lng:7.380, w:0.60, gr:'sat'},
  {n:'Nyanya', lat:8.940, lng:7.530, w:0.70, gr:'sat'},
  {n:'Mararaba',lat:8.910,lng:7.560, w:0.50, gr:'sat'},
  {n:'Lokogoma',lat:9.000,lng:7.520, w:0.70, gr:'sub'},
  {n:'Airport',lat:9.007, lng:7.263, w:0.75, gr:'air'},
];

const BAND = {
  '0':{d:0.35,s:1.00},'1':{d:0.28,s:1.00},'2':{d:0.22,s:1.00},'3':{d:0.18,s:1.00},'4':{d:0.22,s:1.00},
  '5':{d:0.45,s:1.05},'6':{d:0.85,s:1.10},'7':{d:1.25,s:1.20},'8':{d:1.40,s:1.30},'9':{d:1.25,s:1.25},
  '10':{d:1.05,s:1.05},'11':{d:1.00,s:1.00},'12':{d:1.05,s:1.00},'13':{d:1.05,s:1.00},'14':{d:1.10,s:1.05},'15':{d:1.30,s:1.15},
  '16':{d:1.55,s:1.30},'17':{d:1.75,s:1.45},'18':{d:1.70,s:1.50},'19':{d:1.50,s:1.45},'20':{d:1.30,s:1.35},
  '21':{d:1.15,s:1.25},'22':{d:1.00,s:1.20},'23':{d:0.80,s:1.15},
};

const OD = {
  core:[{t:'intra-core',k:3.0,m:14,w:30},{t:'mall',k:5.0,m:16,w:14},{t:'cross',k:6.5,m:22,w:26},{t:'sub',k:13,m:32,w:18},{t:'sat',k:18,m:42,w:7},{t:'air',k:32,m:48,w:5}],
  mall:[{t:'intra-core',k:4.5,m:15,w:40},{t:'mall',k:4.0,m:12,w:12},{t:'core-return',k:5.5,m:18,w:30},{t:'sub',k:12,m:30,w:12},{t:'air',k:33,m:50,w:6}],
  sub:[{t:'commute',k:11,m:30,w:55},{t:'sub',k:7,m:24,w:20},{t:'mall',k:8,m:25,w:12},{t:'private',k:3.0,m:12,w:13}],
  sat:[{t:'commute',k:16,m:42,w:65},{t:'sat',k:8,m:26,w:18},{t:'mall',k:12,m:32,w:12},{t:'private',k:4,m:14,w:5}],
  air:[{t:'air',k:31,m:46,w:100}],
};

const PREF = {
  'intra-core':['core'],'mall':['core','mall'],'cross':['core'],'sub':['sub'],'sat':['sat'],
  'commute':['core'],'private':['core','sub'],'core-return':['core'],'air':['air'],
};

const CLASS_SPEED = {
  'intra-core':{ff:30,pk:20},'mall':{ff:32,pk:21},'cross':{ff:34,pk:21},'sub':{ff:42,pk:26},
  'sat':{ff:48,pk:30},'air':{ff:55,pk:38},'core-return':{ff:32,pk:21},'commute':{ff:44,pk:27},'private':{ff:28,pk:19},
};

const ASSUMPTIONS = {
  comm:0.20, fuelPrice:1299,   // Bolt commission (official) and AA petrol price (NGN/L)
  shiftHours:12,
  shiftStart:6.5,
  baseHourlyRate:1.30,      // expected requests / online hour at band demand=1.0, good position
  captureA:0.80, captureB:1.00, captureC:1.07,
  acceptA:4.5, acceptB:3.4, acceptC:3.0,      // max pickup km accepted
  relocA:0, relocB:3.5, relocC:2.6,
  relocProbB:0.55, relocProbC:0.65,
  roadFactor:1.28, pickRoadFactor:1.25, jitterDeg:0.004, localDecayKm:2.6,
  dwellPostTrip:1.6, dwellOnSite:1.2, cancelP:0.06,
  rainP:0.12, rainSurge:1.15, eventP:0.02, eventSurge:1.55,
  weekendNightBoost:1.15,
  l100Base:14.0, l100Sd:1.2, l100Min:12.5, l100Max:16.5,  // L/100km city, 2005 V6 Highlander (Fuelly combined 12.2; city higher)
  idleLPerHr:1.5, engineOnIdleFrac:0.5, acFactor:1.04,
  surgeJitter:0.10,
  airportShareFrac:0.045,
  peakWindow:[[6,10],[16,21]],
  workDaysPerMonth:26,
};

function gc(a,b){const R=6371,dLng=(b.lng-a.lng)*Math.PI/180,
  la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180,
  h=Math.sin((la2-la1)/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));}
function cl(x,a,b){return Math.min(b,Math.max(a,x));}
function randN(mu,sd,r0,r1){const t=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());return cl(mu+sd*t,r0,r1);}
function isPeak(h){for(const [a,b] of ASSUMPTIONS.peakWindow)if(h>=a&&h<b)return true;return false;}

function drawOrigin(driver,A){
  const J=A.jitterDeg;
  if(Math.random()<0.72){
    const t=Math.random()*2*Math.PI;
    const r=0.4+Math.random()*1.4;
    const p={lat:driver.lat+Math.cos(t)*(r/111),lng:driver.lng+Math.sin(t)*(r/111)/Math.cos(driver.lat*Math.PI/180)};
    let z=ZONES[0],md=1e9;
    for(const zz of ZONES){const d=gc(p,zz);if(d<md){md=d;z=zz;}}
    return {z,px:p};
  }
  const list=[];let sum=0;
  for(const z of ZONES){
    const d=gc(driver,z);
    const w=z.w*Math.exp(-d/5);
    list.push({z,w});sum+=w;
  }
  let r=Math.random()*sum;
  for(const e of list){r-=e.w;if(r<=0)return{z:e.z,px:{lat:e.z.lat+(Math.random()-.5)*2*J,lng:e.z.lng+(Math.random()-.5)*2*J}};}
  return {z:ZONES[0],px:{lat:ZONES[0].lat,lng:ZONES[0].lng}};
}

function drawDest(g,A){
  const list=OD[g]||OD.core;let sum=0;
  const airScale=(A.airportShareFrac||0.06)/0.06;
  for(const x of list)sum+=x.w*(x.t==='air'?airScale:1);
  let r=Math.random()*sum;
  for(const x of list){r-=x.w*(x.t==='air'?airScale:1);if(r<=0)return x;}
  return list[list.length-1];
}

function destFor(originPt,g,cls){
  const prefs=PREF[cls.t]||['core'];
  const kLo=cls.k*0.35,kHi=cls.k*1.7,cands=[];
  for(const z of ZONES){
    const d=gc(originPt,z)*1.08;
    if(d<kLo||d>kHi)continue;
    cands.push({z,d,c:(prefs.includes(z.gr)?2:1)*z.w});
  }
  if(!cands.length)for(const z of ZONES)cands.push({z,d:gc(originPt,z)*1.08,c:z.w});
  let sum=0;for(const c of cands)sum+=c.c;
  let r=Math.random()*sum;
  for(const c of cands){r-=c.c;if(r<=0)return c;}
  return cands[cands.length-1];
}

function surgeMult(h,dow,rain,event){
  const A=ASSUMPTIONS;
  let b=BAND[Math.floor(h)].s;
  if(event)b*=A.eventSurge;
  if(rain)b*=A.rainSurge;
  if((dow===0||dow===6)&&h>=21)b*=A.weekendNightBoost;
  return b*(1+Math.random()*A.surgeJitter);
}

function daySim(baseline){
  const A=ASSUMPTIONS;
  const R={gross:0,trips:0,rej:0,cancel:0,kmPaid:0,kmUnpaid:0,litresD:0,litresI:0,idleH:0,driveH:0,relocKm:0};
  const dow=Math.floor(Math.random()*7);
  const rain=Math.random()<A.rainP;
  const event=Math.random()<A.eventP;
  const l100=randN(A.l100Base,A.l100Sd,A.l100Min,A.l100Max);
  const driveL100=l100*A.acFactor;

  let start=A.shiftStart;
  if(baseline==='A')start=5+Math.random()*4;
  const end=start+A.shiftHours;
  let driver={lat:ZONES[0].lat,lng:ZONES[0].lng};
  {const z0=ZONES[Math.floor(Math.random()*5)];driver={lat:z0.lat+(Math.random()-.5)*.02,lng:z0.lng+(Math.random()-.5)*.02};}
  const accept=baseline==='A'?A.acceptA:baseline==='B'?A.acceptB:A.acceptC;
  const capture=baseline==='A'?A.captureA:baseline==='B'?A.captureB:A.captureC;
  const relocKm=baseline==='A'?A.relocA:baseline==='B'?A.relocB:A.relocC;
  const relocProb=baseline==='A'?0:baseline==='B'?A.relocProbB:A.relocProbC;

  for(let h=Math.floor(start);h<Math.floor(end);h++){
    const frac=Math.min(1,end-h);
    const band=BAND[h];
    const peak=isPeak(h);
    const rate=A.baseHourlyRate*band.d*capture*frac;
    const nReq=Math.floor(-Math.log(1-Math.random())*rate)+(Math.random()<rate%1?1:0);
    let batchMin=frac*60,tripThisHour=0;
    for(let q=0;q<nReq&&batchMin>0&&tripThisHour<3;q++){
      R.rej++;
      const o=drawOrigin(driver,A);
      const pickKm=Math.max(0.4,gc(driver,o.px)*A.pickRoadFactor);
      if(pickKm>accept)continue;
      const cls=drawDest(o.z.gr,A);
      const dst=destFor(o.px,o.z.gr,cls);
      const spd=CLASS_SPEED[cls.t][peak?'pk':'ff']||30;
      const paidKm=Math.max(1.2,dst.d*(0.92+Math.random()*0.12));
      const rideMin=(paidKm/spd)*60;
      const pickMin=(pickKm/Math.max(20,spd*0.75))*60+1.5;
      const used=pickMin+A.dwellOnSite+rideMin+A.dwellPostTrip;
      if(used>batchMin)break;
      const surge=surgeMult(h,dow,rain,event);
      const fare=Math.max(MIN_FARE,(BASE_FARE+paidKm*PER_KM+rideMin*PER_MIN))*surge;
      R.gross+=fare;
      if(Math.random()<A.cancelP){R.cancel++;R.kmUnpaid+=pickKm;batchMin-=pickMin;continue;}
      R.trips++;
      R.kmPaid+=paidKm;
      R.kmUnpaid+=pickKm;
      R.driveH+=used/60;
      batchMin-=used;
      tripThisHour++;
      driver={lat:dst.z.lat+(Math.random()-.5)*.01,lng:dst.z.lng+(Math.random()-.5)*.01};
    }
    const idleM=Math.max(0,batchMin);
    R.idleH+=idleM/60;
    if(idleM>15&&Math.random()<relocProb){
      const best=ZONES.slice().sort((x,y)=>y.w-x.w).slice(0,3)[Math.floor(Math.random()*3)];
      const d=gc(driver,best);
      if(d>1){const m=Math.min(relocKm,d);driver={lat:driver.lat+(best.lat-driver.lat)*m/d,lng:driver.lng+(best.lng-driver.lng)*m/d};R.relocKm+=m;R.kmUnpaid+=m;}
    }
  }
  R.litresD=(R.kmPaid+R.kmUnpaid)/100*driveL100;
  R.litresI=R.idleH*A.engineOnIdleFrac*A.idleLPerHr;
  const litres=R.litresD+R.litresI;
  const after=R.gross*(1-A.comm);
  const petrol=litres*A.fuelPrice;
  R.after=after;R.petrol=petrol;R.net=after-petrol;R.litres=litres;
  R.onlineH=R.driveH+R.idleH;
  R.captureR=R.trips/Math.max(1,R.trips+R.rej);
  return R;
}

function runDays(baseline,n){const out=[];for(let i=0;i<n;i++)out.push(daySim(baseline));return out;}
function stats(arr){
  const a=arr.slice().sort((x,y)=>x-y);
  const mean=a.reduce((s,v)=>s+v,0)/a.length;
  const med=a[Math.floor(a.length/2)];
  return{mean,med,p5:a[Math.floor(a.length*0.05)],p10:a[Math.floor(a.length*0.10)],p25:a[Math.floor(a.length*0.25)],p50:med,p75:a[Math.floor(a.length*0.75)],p90:a[Math.floor(a.length*0.90)],p95:a[Math.floor(a.length*0.95)]};
}
function fracOver(arr,t){return arr.filter(v=>v>=t).length/arr.length;}
function monthSim(baseline){let s=0;for(let d=0;d<26;d++)s+=daySim(baseline).net;return s;}

const N_DAYS=10000,N_MONTHS=10000;
const A_days=runDays('A',N_DAYS),B_days=runDays('B',N_DAYS),C_days=runDays('C',N_DAYS);
const A_M=[],B_M=[],C_M=[];
for(let i=0;i<N_MONTHS;i++){A_M.push(monthSim('A'));B_M.push(monthSim('B'));C_M.push(monthSim('C'));}

console.log('=== DAILY NET_AFTER_FUEL (NGN) ===');
console.log('A',JSON.stringify(stats(A_days.map(d=>d.net))));
console.log('B',JSON.stringify(stats(B_days.map(d=>d.net))));
console.log('C',JSON.stringify(stats(C_days.map(d=>d.net))));
console.log('=== MONTHLY NET (26 workdays) ===');
console.log('A_M',JSON.stringify(stats(A_M)));
console.log('B_M',JSON.stringify(stats(B_M)));
console.log('C_M',JSON.stringify(stats(C_M)));
console.log('=== AVERAGES/DAY ===');
for(const [nm,ds] of [['A',A_days],['B',B_days],['C',C_days]]){
  const g=ds.reduce((s,d)=>s+d.gross,0)/ds.length;
  const p=ds.reduce((s,d)=>s+d.petrol,0)/ds.length;
  const km=ds.reduce((s,d)=>s+d.kmPaid+d.kmUnpaid,0)/ds.length;
  const t=ds.reduce((s,d)=>s+d.trips,0)/ds.length;
  const id=ds.reduce((s,d)=>s+d.idleH,0)/ds.length;
  const c=ds.reduce((s,d)=>s+d.after,0)/ds.length;
  const afKm=ds.reduce((s,d)=>s+d.after,0)/Math.max(1,ds.reduce((s,d)=>s+d.kmPaid,0));
  console.log(`${nm} gross=${g.toFixed(0)} afterComm=${c.toFixed(0)} petrol=${p.toFixed(0)} net=${(g-p).toFixed(0)} km=${km.toFixed(0)} trips=${t.toFixed(1)} idleH=${id.toFixed(1)} afterCommPerPaidKm=${afKm.toFixed(1)}`);
}
console.log('=== DAY THRESHOLD PROBS (net-after-fuel) ===');
for(const t of [8000,10000,11538,12000,15000]){
  console.log(`>=${t}: A=${fracOver(A_days.map(d=>d.net),t).toFixed(4)} B=${fracOver(B_days.map(d=>d.net),t).toFixed(4)} C=${fracOver(C_days.map(d=>d.net),t).toFixed(4)}`);
}
console.log('=== MONTH THRESHOLD PROBS ===');
for(const t of [200000,250000,300000,350000,400000]){
  console.log(`>=${t}: A=${fracOver(A_M,t).toFixed(4)} B=${fracOver(B_M,t).toFixed(4)} C=${fracOver(C_M,t).toFixed(4)}`);
}
console.log(`P(month>=300k | C) = ${(fracOver(C_M,300000)*100).toFixed(2)}%`);

console.log('=== DOWNSIDE (C daily sequence, N='+N_DAYS+') ===');
{
  const seq=C_days.map(d=>d.net);
  let maxRun=0,run=0;
  for(const v of seq){if(v<11538){run++;maxRun=Math.max(maxRun,run);}else run=0;}
  let worst7=Infinity;
  for(let i=0;i+7<=seq.length;i++){const s=seq.slice(i,i+7).reduce((a,b)=>a+b,0);if(s<worst7)worst7=s;}
  const sorted=seq.slice().sort((a,b)=>a-b);
  const p10=sorted[Math.floor(seq.length*0.10)];
  let rec=0,recTot=0;
  for(let i=1;i<seq.length;i++){if(seq[i-1]<11538){recTot++;if(seq[i]<11538)rec++;}}
  console.log('max consecutive days < target:',maxRun,'(as P(day<target):',fracOver(seq,11538).toFixed(4)+')');
  console.log('worst 7-day rolling net:',worst7.toFixed(0),'==',(worst7/7).toFixed(0),'/day');
  console.log('P10 single-day net:',p10.toFixed(0));
  console.log('P(next day also below target | today below):',recTot?(rec/recTot).toFixed(4):'n/a');
}

console.log('=== C SCENARIOS (fuel economy, 5000 months each) ===');
{
  const save=Object.assign({},ASSUMPTIONS);
  for(const [name,lw,hi] of [['optimistic',12.5,12.5],['base',14.0,14.0],['harsh',16.5,16.5]]){
    ASSUMPTIONS.l100Base=lw;ASSUMPTIONS.l100Min=hi;ASSUMPTIONS.l100Max=hi+0.0001;ASSUMPTIONS.l100Sd=0;
    const ms=[];for(let i=0;i<5000;i++)ms.push(monthSim('C'));
    const s=stats(ms);
    console.log(`${name} (${hi} L/100km): mean=${s.mean.toFixed(0)} P50=${s.p50.toFixed(0)} P95=${s.p95.toFixed(0)} P>=300k=${fracOver(ms,300000).toFixed(4)}`);
  }
  Object.assign(ASSUMPTIONS,save);
}

console.log('=== REVERSE-SOLVE ===');
{
  const days=runDays('C',2000);
  const after=days.reduce((s,d)=>s+d.after,0);
  const payKm=days.reduce((s,d)=>s+d.kmPaid,0);
  const totKm=days.reduce((s,d)=>s+d.kmPaid+d.kmUnpaid,0);
  const litres=days.reduce((s,d)=>s+d.litres,0);
  const afterPerPaidKm=after/payKm;
  const afterPerTotKm=after/totKm;
  const litresPerKm=litres/totKm;
  const fuelPerKm=litresPerKm*ASSUMPTIONS.fuelPrice;
  console.log('C base mean: after-comm/day',(after/days.length).toFixed(0),
    'total-km/day',(totKm/days.length).toFixed(0),
    'litres/day',(litres/days.length).toFixed(1),
    'after-comm per PAID-km',afterPerPaidKm.toFixed(1),
    'after-comm per TOTAL-km',afterPerTotKm.toFixed(1),
    'fuel NGN per TOTAL-km',fuelPerKm.toFixed(1));
  console.log('break-even petrol price NGN/L (mean conditions):',(after/litres).toFixed(0));
  console.log('sustainable L/100km for zero fuel-loss at mean conditions:',((100/1299)*afterPerTotKm).toFixed(1));
  const bases=[4,7,10,12.5,14,16.5,22];
  console.log('P(month>=300k) vs L/100km (C, 1500 months each):');
  const save=Object.assign({},ASSUMPTIONS);
  for(const lw of bases){
    ASSUMPTIONS.l100Base=lw;ASSUMPTIONS.l100Min=lw;ASSUMPTIONS.l100Max=lw+0.0001;ASSUMPTIONS.l100Sd=0;
    let over=0;const M=1500;
    for(let i=0;i<M;i++)if(monthSim('C')>=300000)over++;
    console.log('  L/100km='+lw+'  P='+(over/M).toFixed(3));
  }
  Object.assign(ASSUMPTIONS,save);
}

console.log('=== SENSITIVITY (C, monthly, 2400 each) ===');
{
  const save=Object.assign({},ASSUMPTIONS);
  const run=(label,fn)=>{Object.assign(ASSUMPTIONS,save);fn(ASSUMPTIONS);let sum=0,over=0;const M=2400;
    for(let i=0;i<M;i++){const m=monthSim('C');sum+=m;if(m>=300000)over++;}
    console.log(`${label}: mean=${(sum/M).toFixed(0)} P>=300k=${(over/M).toFixed(3)}`);};
  run('base',()=>{});
  run('commission 22.5%',a=>{a.comm=0.225});
  run('commission 25%',a=>{a.comm=0.25});
  run('fuel 1120/L',a=>{a.fuelPrice=1120});
  run('fuel 1000/L',a=>{a.fuelPrice=1000});
  run('fuel 1500/L',a=>{a.fuelPrice=1500});
  run('fuel 2000/L',a=>{a.fuelPrice=2000});
  run('shift 10h',a=>{a.shiftHours=10});
  run('shift 14h',a=>{a.shiftHours=14});
  run('demand +20%',a=>{a.baseHourlyRate*=1.2});
  run('demand -20%',a=>{a.baseHourlyRate*=0.8});
  const BS={};for(const h in BAND)BS[h]=BAND[h].s;
  run('surge -20%',a=>{for(const h in BAND)BAND[h].s=BS[h]*0.8});
  run('surge +20%',a=>{for(const h in BAND)BAND[h].s=BS[h]*1.2});
  run('l/100km 12.5',a=>{a.l100Base=12.5;a.l100Min=12.5;a.l100Max=12.5;a.l100Sd=0});
  run('l/100km 16.5',a=>{a.l100Base=16.5;a.l100Min=16.5;a.l100Max=16.5;a.l100Sd=0});
  run('airport share x1.5',a=>{a.airportShareFrac=0.0675});
  run('pickup accept C 3.5km',a=>{a.acceptC=3.5});
  Object.assign(ASSUMPTIONS,save);
  for(const h in BAND)BAND[h].s=BS[h];
}

{
  const d=daySim('C');
  console.log('=== REPRESENTATIVE C DAY ===');
  console.log(JSON.stringify(d));
}

console.log('=== VEHICLE EFFICIENCY SENSITIVITY (C, 4000 days each) ===');
{
  const save=Object.assign({},ASSUMPTIONS);
  for(const lw of [4,5.5,7,9,11,12.5,14,16.5]){
    ASSUMPTIONS.l100Base=lw;ASSUMPTIONS.l100Min=lw;ASSUMPTIONS.l100Max=lw+0.0001;ASSUMPTIONS.l100Sd=0;
    const ds=runDays('C',4000);
    const nets=ds.map(d=>d.net);
    const s=stats(nets);
    let mo=0;const M=1500;for(let i=0;i<M;i++)if(monthSim('C')>=300000)mo++;
    console.log(`L/100km=${lw}: meanDay=${s.mean.toFixed(0)} P(day>=12000)=${fracOver(nets,12000).toFixed(3)} P(month>=300k)=${(mo/M).toFixed(3)}`);
  }
  Object.assign(ASSUMPTIONS,save);
}
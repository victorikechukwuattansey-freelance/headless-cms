'use strict';
// Exact replication of the app's ride-handler economics (index.html) as an audit baseline.
// Purpose: quantify what the app CLAIMS vs the corrected model.

const ZONES = [
  {name:'Airport',boost:1.45,peak:[[5,9],[16,20]]},
  {name:'Maitama',boost:1.35,peak:[[7,10],[17,21]]},
  {name:'Asokoro',boost:1.35,peak:[[7,10],[17,21]]},
  {name:'Wuse 2',boost:1.30,peak:[[7,10],[17,21]]},
  {name:'Garki',boost:1.25,peak:[[8,11],[16,19]]},
  {name:'Jabi',boost:1.25,peak:[[8,11],[16,20]]},
  {name:'CBD',boost:1.20,peak:[[7,10],[16,19]]},
  {name:'Utako',boost:1.15,peak:[[8,10],[16,19]]},
  {name:'Gwarinpa',boost:1.10,peak:[[6,9],[16,19]]},
  {name:'Kubwa',boost:1.05,peak:[[6,8],[17,19]]},
  {name:'Lugbe',boost:1.00,peak:[[6,8],[17,19]]},
  {name:'Nyanya',boost:0.95,peak:[[6,8],[17,19]]},
  {name:'Mararaba',boost:0.90,peak:[[6,8],[17,19]]},
];
const LOOP=['CBD','Wuse 2','Maitama','Airport'];
const FC=1370,SF=70,BF=3000;

function appDay(){
  let loc='CBD',ear=0,trips=0,fuel=SF,hr=6,loopIdx=1,fail=0;
  const dow=Math.floor(Math.random()*7);
  const rain=Math.random()<0.12;
  for(let step=0;step<12;step++){
    hr=hr>=24?6:hr+1;
    const z=ZONES.find(x=>x.name===loc);
    const pk=z.peak.some(([a,b])=>hr>=a&&hr<b);
    const hi=z.boost>1.25;
    const rn=rain?0.12:0,wp=(dow===0||dow===6)?-0.08:0;
    const rc=Math.min(0.97,Math.max(0.15,(pk?(hi?0.92:0.72):(hi?0.68:0.4))+rn+wp));
    if(Math.random()<rc){
      const i=Math.round(BF*z.boost*(rain?1.15:1)*(pk?1.15:1));
      ear+=i;trips++;fuel=Math.max(fuel-2,0);
      loc=LOOP[loopIdx];loopIdx=(loopIdx+1)%LOOP.length;
    }else{fuel=Math.max(fuel-0.6,0);fail++;}
  }
  const net=ear-Math.max(SF-fuel,0)*FC;
  return{ear,trips,fuel,fail,grossPerTrip:ear/Math.max(1,trips),net,litres:Math.max(SF-fuel,0)};
}

function appDayNoLoop(){
  let loc='CBD',ear=0,trips=0,fuel=SF,hr=6,fail=0;
  const dow=Math.floor(Math.random()*7);
  const rain=Math.random()<0.12;
  for(let step=0;step<12;step++){
    hr=hr>=24?6:hr+1;
    const z=ZONES.find(x=>x.name===loc);
    const pk=z.peak.some(([a,b])=>hr>=a&&hr<b);
    const hi=z.boost>1.25;
    const rn=rain?0.12:0,wp=(dow===0||dow===6)?-0.08:0;
    const rc=Math.min(0.97,Math.max(0.15,(pk?(hi?0.92:0.72):(hi?0.68:0.4))+rn+wp));
    if(Math.random()<rc){
      const i=Math.round(BF*z.boost*(rain?1.15:1)*(pk?1.15:1));
      ear+=i;trips++;fuel=Math.max(fuel-2,0);
    }else{fuel=Math.max(fuel-0.6,0);fail++;}
  }
  const net=ear-Math.max(SF-fuel,0)*FC;
  return{ear,trips,fuel,fail,grossPerTrip:ear/Math.max(1,trips),net,litres:Math.max(SF-fuel,0)};
}

function summarize(days){
  const m=x=>days.reduce((s,d)=>s+d[x],0)/days.length;
  const nets=days.map(d=>d.net).sort((a,b)=>a-b);
  const mean=nets.reduce((a,b)=>a+b,0)/nets.length;
  return{
    meanGross:m('ear'),meanNet:mean,
    p5Net:nets[Math.floor(nets.length*0.05)],p50Net:nets[Math.floor(nets.length*0.5)],p95Net:nets[Math.floor(nets.length*0.95)],
    meanTrips:m('trips'),meanFuelL:m('litres'),meanGrossPerTrip:m('grossPerTrip'),
    pDayPos:days.filter(d=>d.net>=0).length/days.length,
    monthPace:mean*26,
  };
}

const N=10000;
const loopDays=[];for(let i=0;i<N;i++)loopDays.push(appDay());
const noLoopDays=[];for(let i=0;i<N;i++)noLoopDays.push(appDayNoLoop());
console.log('=== APP MODEL (replicated) — 10,000 x 12h days ===');
console.log('with fixed loop:',JSON.stringify(summarize(loopDays)));
console.log('without loop  :',JSON.stringify(summarize(noLoopDays)));

// App model with a commission taken off the top (20%), to show app claim vs corrected screening
const netsWithComm=loopDays.map(d=>d.ear*0.8-Math.max(SF-d.fuel,0)*FC).sort((a,b)=>a-b);
const p5=netsWithComm[Math.floor(netsWithComm.length*0.05)];
const p50=netsWithComm[Math.floor(netsWithComm.length*0.5)];
const p95=netsWithComm[Math.floor(netsWithComm.length*0.95)];
const mean=netsWithComm.reduce((a,b)=>a+b,0)/netsWithComm.length;
console.log('with 20% commission (same trip/fuel structure): mean',mean.toFixed(0),'p50',p50.toFixed(0),'p95',p95.toFixed(0),'monthPace',(mean*26).toFixed(0));
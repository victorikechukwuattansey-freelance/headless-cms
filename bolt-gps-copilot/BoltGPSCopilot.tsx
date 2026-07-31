import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Coords = { lat: number; lng: number };
type Zone = {
  name: string; lat: number; lng: number; boost: number;
  peak?: [number, number][]; pop: number; traffic: number;
};

const ZONES: Zone[] = [
  { name: "Airport",  lat: 9.0068, lng: 7.2632, boost: 1.45, peak: [[5,9],[16,20]], pop: 3, traffic: 0.3 },
  { name: "Maitama",  lat: 9.0833, lng: 7.5248, boost: 1.35, peak: [[7,10],[17,21]], pop: 5, traffic: 0.6 },
  { name: "Asokoro",  lat: 9.0750, lng: 7.4950, boost: 1.35, peak: [[7,10],[17,21]], pop: 4, traffic: 0.5 },
  { name: "Wuse 2",   lat: 9.0765, lng: 7.4632, boost: 1.30, peak: [[7,10],[17,21]], pop: 5, traffic: 0.7 },
  { name: "Garki",    lat: 9.0400, lng: 7.4900, boost: 1.25, peak: [[8,11],[16,19]], pop: 4, traffic: 0.6 },
  { name: "Jabi",     lat: 9.0667, lng: 7.4142, boost: 1.25, peak: [[8,11],[16,20]], pop: 3, traffic: 0.5 },
  { name: "CBD",      lat: 9.0579, lng: 7.4951, boost: 1.20, peak: [[7,10],[16,19]], pop: 4, traffic: 0.8 },
  { name: "Utako",    lat: 9.0600, lng: 7.4400, boost: 1.15, peak: [[8,10],[16,19]], pop: 3, traffic: 0.4 },
  { name: "Gwarinpa", lat: 9.1000, lng: 7.4200, boost: 1.10, peak: [[6,9],[16,19]], pop: 4, traffic: 0.4 },
  { name: "Kubwa",    lat: 9.1200, lng: 7.3200, boost: 1.05, peak: [[6,8],[17,19]], pop: 3, traffic: 0.3 },
  { name: "Lugbe",    lat: 8.9900, lng: 7.3800, boost: 1.00, peak: [[6,8],[17,19]], pop: 2, traffic: 0.2 },
  { name: "Nyanya",   lat: 8.9400, lng: 7.5300, boost: 0.95, peak: [[6,8],[17,19]], pop: 2, traffic: 0.3 },
  { name: "Mararaba", lat: 8.9100, lng: 7.5600, boost: 0.90, peak: [[6,8],[17,19]], pop: 1, traffic: 0.2 },
];

const FUEL_COST = 1370;
const START_FUEL = 70;
const BASE_FARE = 3000;
const WEEKDAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function dist(a: Coords, b: Coords) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function weightedRandomZone(): Zone {
  const total = ZONES.reduce((s, z) => s + z.boost, 0);
  let r = Math.random() * total;
  for (const z of ZONES) { r -= z.boost; if (r <= 0) return z; }
  return ZONES[0];
}

function randomPos(zone: Zone, spread = 0.01): Coords {
  return { lat: zone.lat + (Math.random() - 0.5) * spread, lng: zone.lng + (Math.random() - 0.5) * spread };
}

function scoreZone(zone: Zone, location: Coords, fuel: number, hour: number, dayOfWeek: number, raining: boolean): number {
  let score = zone.boost * 100;
  const inPeak = zone.peak?.some(([s, e]) => hour >= s && hour < e);
  if (inPeak) score += 25;
  const d = dist(location, zone);
  score += Math.max(0, 30 - d * 2000);
  if (inPeak) score -= zone.traffic * 15;
  if (fuel < 25) score -= d * 5000;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) { if (zone.name === "Airport") score += 15; if (zone.name === "Maitama" || zone.name === "Asokoro") score += 10; if (zone.name === "CBD") score -= 10; }
  if (raining) { score += 10; if (zone.pop >= 4) score += 10; }
  return Math.round(score);
}

export default function BoltGPSCopilotApp() {
  const apiKey = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY) || "";
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey, id: "bolt-gps-v2" });

  const [earnings, setEarnings] = useState(0);
  const [trips, setTrips] = useState(0);
  const [fuel, setFuel] = useState(START_FUEL);
  const [copilotState, setCopilotState] = useState<"SURGE" | "LEAK" | "STANDBY">("SURGE");
  const [hour, setHour] = useState(6);
  const [shiftStartHour] = useState(6);
  const [copilotMsg, setCopilotMsg] = useState("Initialising v2 copilot...");
  const [location, setLocation] = useState<Coords>({ lat: 9.057, lng: 7.495 });
  const [tripLog, setTripLog] = useState<string[]>([]);
  const [path, setPath] = useState<Coords[]>([{ lat: 9.057, lng: 7.495 }]);
  const [dayOfWeek] = useState(new Date().getDay());
  const [raining, setRaining] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(30000);
  const [shiftActive, setShiftActive] = useState(true);
  const [earningsHistory, setEarningsHistory] = useState<number[]>([]);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const currentZone = useMemo(() => {
    let best = ZONES[0], min = dist(location, best);
    for (const z of ZONES) { const d = dist(location, z); if (d < min) { min = d; best = z; } }
    return best;
  }, [location]);

  const rankings = useMemo(() =>
    ZONES.map(z => ({ ...z, _score: scoreZone(z, location, fuel, hour, dayOfWeek, raining), _dist: dist(location, z) }))
      .sort((a, b) => b._score - a._score),
  [location, fuel, hour, dayOfWeek, raining]);

  const isPeakHour = useMemo(() => {
    for (const z of ZONES) if (z.peak?.some(([s, e]) => hour >= s && hour < e)) return true;
    return false;
  }, [hour]);

  const fuelCost = Math.max(START_FUEL - fuel, 0) * FUEL_COST;
  const net = earnings - fuelCost;
  const hrs = Math.max(hour - shiftStartHour, 1);
  const perHr = earnings / hrs;
  const progress = dailyGoal > 0 ? Math.min(100, earnings / dailyGoal * 100) : 0;

  const generateAdvice = useCallback((): string => {
    const top = rankings[0];
    const isHighValue = currentZone.boost >= 1.35;
    const lowFuel = fuel < 25;

    if (lowFuel && top._dist > 0.02) return `⛽ Fuel critical! Nearest high-score zone: ${top.name} (${(top._dist * 111).toFixed(1)}km)`;
    if (fuel < 10) return "⛽ CRITICAL: fuel near empty. End shift or head to nearest station.";
    if (isPeakHour && top.name !== currentZone.name) return `📈 Peak hour — relocate to ${top.name} (score: ${top._score}, boost: ${top.boost}x)`;
    if (isHighValue && copilotState !== "SURGE") return `🚀 High demand at ${currentZone.name} — stay and accept all good fares`;
    if (copilotState === "LEAK") return `🔴 Low demand here. Best zone: ${top.name} (${top.boost}x boost, score: ${top._score})`;
    if (perHr < 3000) return `⚠️ Low ₦/hr (₦${perHr.toLocaleString()}). Move toward ${top.name} to improve`;
    if (progress < 50 && hour > 12) return `🎯 Only ${Math.round(progress)}% of daily goal — pick up pace in ${top.name}`;
    if (raining && currentZone.pop < 4) return `🌧️ Rainy — move to denser zone (${rankings.find(z => z.pop >= 4)?.name || "Maitama"}) for more rides`;
    if (!isPeakHour && hour > 10 && hour < 16) return `🟡 Midday slump — conserve fuel, fewer rides until ${top.peak?.[0]?.[0] || 16}:00`;
    if (progress >= 100) return `🎉 Daily goal achieved! (₦${earnings.toLocaleString()}/${dailyGoal.toLocaleString()}) — consider ending shift`;
    return `🟢 Stable at ${currentZone.name} (${currentZone.boost}x). Top pick: ${top.name} (score: ${top._score})`;
  }, [rankings, currentZone, fuel, hour, isPeakHour, copilotState, perHr, progress, raining, earnings, dailyGoal]);

  useEffect(() => {
    const interval = setInterval(() => { setCopilotMsg(generateAdvice()); }, 8000);
    return () => clearInterval(interval);
  }, [generateAdvice]);

  const simulateRide = () => {
    if (!shiftActive || hour >= 23) {
      setCopilotMsg("🛑 Late night — demand drops sharply. Consider ending shift.");
      setCopilotState("STANDBY");
      return;
    }
    setHour(h => (h >= 24 ? 6 : h + 1));

    const baseChance = currentZone.boost > 1.25 ? 0.85 : 0.45;
    const rainBonus = raining ? 0.12 : 0;
    const weekendPenalty = (dayOfWeek === 0 || dayOfWeek === 6) ? -0.08 : 0;
    const rideChance = Math.min(0.95, Math.max(0.2, baseChance + rainBonus + weekendPenalty));

    if (Math.random() < rideChance) {
      const income = Math.round(BASE_FARE * currentZone.boost * (raining ? 1.15 : 1));
      setEarnings(e => e + income);
      setTrips(t => t + 1);
      setFuel(f => Math.max(f - 2.3, 0));
      setCopilotState("SURGE");
      setEarningsHistory(h => [...h, income]);
      const nextZone = weightedRandomZone();
      const newPos = randomPos(nextZone);
      setLocation(newPos);
      setPath(prev => [...prev, newPos]);
      setTripLog(log => [`₦${income.toLocaleString()} → ${nextZone.name}`, ...log].slice(0, 30));
    } else {
      setFuel(f => Math.max(f - 0.9, 0));
      setCopilotState("LEAK");
    }
    setCopilotMsg(generateAdvice());
  };

  const resetShift = () => {
    setEarnings(0); setTrips(0); setFuel(START_FUEL); setHour(6);
    setCopilotState("SURGE"); setCopilotMsg("Reset. Start your shift.");
    setTripLog([]); setPath([{ lat: 9.057, lng: 7.495 }]); setLocation({ lat: 9.057, lng: 7.495 });
    setEarningsHistory([]); setShiftActive(true);
  };

  const endShift = () => { setShiftActive(false); setCopilotMsg("🏁 Shift ended. Review your summary below."); };

  if (!apiKey) return <div className="p-6"><Card><CardContent className="p-4"><h2 className="font-bold text-red-600">Missing API Key</h2><p className="text-sm">Set VITE_GOOGLE_MAPS_API_KEY in .env</p></CardContent></Card></div>;
  if (loadError) return <div className="p-6"><Card><CardContent className="p-4"><h2 className="font-bold text-red-600">Map Load Error</h2><p className="text-sm">Check Google Maps API config</p></CardContent></Card></div>;
  if (!isLoaded) return <div className="p-4">Loading map...</div>;

  const chartMax = Math.max(...earningsHistory.slice(-12), 1);

  return (
    <div className="grid gap-3 p-3 bg-[#0d1117] min-h-screen text-[#e6edf3]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Copilot bar */}
      <Card className="border-[#30363d] bg-[#161b22]">
        <CardContent className="p-3 flex items-center gap-3">
          <span className="text-xl">🤖</span>
          <p className="text-sm text-[#8b949e] flex-1" dangerouslySetInnerHTML={{ __html: copilotMsg }} />
          <Badge className={`bg-transparent border ${copilotState === "SURGE" ? "text-[#3fb950] border-[#3fb950]" : copilotState === "LEAK" ? "text-[#f85149] border-[#f85149]" : "text-[#d29922] border-[#d29922]"}`}>{copilotState}</Badge>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-[280px_1fr_240px] gap-3">
        {/* Dashboard */}
        <Card className="border-[#30363d] bg-[#161b22]">
          <CardContent className="p-3 space-y-1 text-sm">
            <div className="flex justify-between text-xs text-[#8b949e] uppercase tracking-wide mb-1">
              <span>Dashboard</span><span>{WEEKDAY[dayOfWeek]} {hour}:00 {isPeakHour ? "📈" : "🟡"}</span>
            </div>
            <DashStat label="📍 Zone" value={`${currentZone.name} (${currentZone.boost}x)`} />
            <DashStat label="⛽ Fuel" value={`${fuel.toFixed(1)}L`} color={fuel < 25 ? "red" : fuel < 40 ? "orange" : "green"} />
            <DashStat label="🛵 Trips" value={String(trips)} />
            {raining && <DashStat label="🌧️ Rain" value="Active (+15%)" color="blue" />}
            <hr className="border-[#21262d] my-1" />
            <DashStat label="💰 Gross" value={`₦${earnings.toLocaleString()}`} color="green" />
            <DashStat label="💸 Fuel cost" value={`₦${fuelCost.toLocaleString()}`} color="red" />
            <div className={`text-2xl font-bold ${net >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}`}>₦{net.toLocaleString()}</div>
            <div className="text-[10px] text-[#8b949e] uppercase tracking-wide">Net earnings</div>
            <DashStat label="₦/hr" value={`₦${perHr.toLocaleString()}`} color={perHr < 3000 ? "red" : "green"} />
            <hr className="border-[#21262d] my-1" />
            <div className="flex items-center gap-2 text-xs text-[#8b949e]">🎯 Goal <input className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-xs text-[#e6edf3] w-20" type="number" value={dailyGoal} onChange={e => setDailyGoal(Number(e.target.value))} /></div>
            <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: progress >= 100 ? "#3fb950" : "#d29922" }} /></div>
            <div className="flex justify-between text-[10px] text-[#8b949e]"><span>₦{earnings.toLocaleString()}</span><span>{Math.round(progress)}%</span></div>
            <hr className="border-[#21262d] my-1" />
            <div className="text-[10px] text-[#8b949e]">Last 12 rides</div>
            <div className="flex items-end h-12 gap-0.5">
              {earningsHistory.slice(-12).map((v, i) => (
                <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(2, (v / chartMax) * 44)}px`, background: v > BASE_FARE * 1.2 ? "#3fb950" : "#238636" }} />
              ))}
              {!earningsHistory.length && <div className="text-[#8b949e] text-xs py-3">No rides yet</div>}
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="border-[#30363d] p-0 overflow-hidden">
          <GoogleMap center={location} zoom={12} mapContainerStyle={{ width: "100%", height: 460 }}>
            <Marker position={location} label={{ text: "YOU", color: "#fff", fontSize: "10px" }} icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: "#238636", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 }} />
            {ZONES.map(z => (
              <Marker key={z.name} position={{ lat: z.lat, lng: z.lng }} label={{ text: z.name, color: z.boost >= 1.35 ? "#f85149" : z.boost >= 1.2 ? "#d29922" : "#8b949e", fontSize: "9px" }} />
            ))}
            {path.length > 1 && <Polyline path={path} options={{ strokeColor: "#238636", strokeWeight: 2.5, strokeOpacity: 0.5 }} />}
          </GoogleMap>
        </Card>

        {/* Rankings */}
        <Card className="border-[#30363d] bg-[#161b22]">
          <CardContent className="p-3">
            <div className="text-xs text-[#8b949e] uppercase tracking-wide mb-2">🏆 Zone Rankings</div>
            {rankings.slice(0, 6).map((z, i) => (
              <div key={z.name} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#0d1117] mb-0.5 text-xs">
                <span className="text-[#8b949e] w-4">#{i + 1}</span>
                <span className="flex-1 font-medium">{z.name}</span>
                <span className="text-[#8b949e]">{(z._dist * 111).toFixed(1)}km</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  z._score >= 130 ? "bg-[#0f2d1a] text-[#3fb950]" : z._score >= 110 ? "bg-[#1a2d0f] text-[#7ee787]" : z._score >= 90 ? "bg-[#2d1f0f] text-[#d29922]" : "bg-[#2d0f0f] text-[#f85149]"
                }`}>{z._score}</span>
              </div>
            ))}
            <hr className="border-[#21262d] my-2" />
            <div className="text-[10px] text-[#8b949e] mb-1">Factors</div>
            <div className="flex flex-wrap gap-2 text-xs text-[#8b949e]">
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={raining} onChange={e => setRaining(e.target.checked)} className="accent-[#238636]" /> 🌧️ Rain</label>
              <span>📅 {WEEKDAY[dayOfWeek]}</span>
            </div>
            <hr className="border-[#21262d] my-2" />
            <div className="text-[10px] text-[#8b949e] mb-1">Suburbs</div>
            <div className="flex flex-wrap gap-1">{rankings.slice(6).map(z => (
              <span key={z.name} className="text-[10px] px-1.5 py-0.5 rounded bg-[#0d1117] text-[#8b949e]">{z.name} {z._score}</span>
            ))}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="border-[#30363d] bg-[#161b22]">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={simulateRide} className="bg-[#238636] hover:bg-[#2ea043] text-white border-none text-xs h-8">🚗 Ride</Button>
            <span className="text-xs text-[#8b949e] ml-auto">{shiftActive ? `🟢 Shift active (since ${shiftStartHour}:00)` : "🔴 Shift ended"}</span>
          </div>
          {!shiftActive && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <SumBox label="Gross" value={`₦${earnings.toLocaleString()}`} color="green" />
              <SumBox label="Net" value={`₦${net.toLocaleString()}`} color={net >= 0 ? "green" : "red"} />
              <SumBox label="Trips" value={String(trips)} />
              <SumBox label="₦/hr" value={`₦${perHr.toLocaleString()}`} color={perHr < 3000 ? "red" : "green"} />
              <SumBox label="Goal" value={`${Math.round(progress)}%`} />
              <SumBox label="Duration" value={`${hour - shiftStartHour}h`} />
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button onClick={endShift} variant="outline" className="border-[#30363d] text-[#e6edf3] text-xs h-7">🏁 End Shift</Button>
            <Button onClick={resetShift} variant="destructive" className="text-xs h-7">Reset</Button>
          </div>
          {tripLog.length > 0 && (
            <div className="mt-2 max-h-24 overflow-y-auto text-xs text-[#8b949e] space-y-0.5">
              {tripLog.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashStat({ label, value, color }: { label: string; value: string; color?: string }) {
  const cls = color === "green" ? "text-[#3fb950]" : color === "red" ? "text-[#f85149]" : color === "orange" ? "text-[#d29922]" : color === "blue" ? "text-[#58a6ff]" : "";
  return <div className="flex justify-between py-0.5 text-xs"><span className="text-[#8b949e]">{label}</span><span className={`font-semibold ${cls}`}>{value}</span></div>;
}

function SumBox({ label, value, color }: { label: string; value: string; color?: string }) {
  const cls = color === "green" ? "text-[#3fb950]" : color === "red" ? "text-[#f85149]" : "text-[#e6edf3]";
  return <div className="text-center bg-[#0d1117] rounded p-2"><div className={`text-lg font-bold ${cls}`}>{value}</div><div className="text-[10px] text-[#8b949e] uppercase tracking-wide">{label}</div></div>;
}

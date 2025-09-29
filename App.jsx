// App.jsx - Main application component

function App() {
    const nowYear = new Date().getFullYear();
    const saved = (() => { 
        try { 
            const s = localStorage.getItem(STORAGE_KEY); 
            return s ? JSON.parse(s) : null; 
        } catch { 
            return null; 
        } 
    })();

    // --- state
    const [beds, setBeds] = React.useState(saved?.beds ? saved.beds : migrateBeds(window.initialData.beds));
    const [crops, setCrops] = React.useState(saved?.crops || window.initialData.crops);
    const [planningYear, setPlanningYear] = React.useState(saved?.planningYear ?? nowYear);
    const [selectedBedId, setSelectedBedId] = React.useState(null);
    const [selectedSeasonByBed, setSelectedSeasonByBed] = React.useState(saved?.selectedSeasonByBed || {});
    const [selectedCropName, setSelectedCropName] = React.useState("");
    const [selectedVariety, setSelectedVariety] = React.useState("");
    const [servingOz, setServingOz] = React.useState(saved?.servingOz ?? 6);
    const [targetPct, setTargetPct] = React.useState(saved?.targetPct ?? 70);
    const [undoStack, setUndoStack] = React.useState([]);
    const [tab, setTab] = React.useState(saved?.tab || "planner");

    // lbs/plant defaults prefill
    const prefill = React.useMemo(() => {
        const map = Object.assign({}, saved?.lbsPerPlant || {});
        if (!saved?.lbsPerPlant) {
            (crops || []).forEach(c => {
                const k = keyFor(c);
                if (map[k] == null) map[k] = defaultForName(c.name);
            });
        }
        return map;
    }, []);
    const [lbsPerPlant, setLbsPerPlant] = React.useState(prefill);

    React.useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                beds, crops, servingOz, lbsPerPlant, planningYear, targetPct, selectedSeasonByBed, tab
            }));
        } catch { }
    }, [beds, crops, servingOz, lbsPerPlant, planningYear, targetPct, selectedSeasonByBed, tab]);

    const selectedBed = beds.find(b => b.id === selectedBedId) || null;
    const selectedSeason = (selectedBed && selectedBed.seasonType === "warm-weather")
        ? (selectedSeasonByBed[selectedBed.id] || "spring")
        : "spring";
    const cropNames = Array.from(new Set(crops.map(c => c.name))).sort((a, b) => a.localeCompare(b));
    const varieties = crops.filter(c => c.name === selectedCropName).map(c => c.variety).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const selectedCrop = crops.find(c => c.name === selectedCropName && c.variety === selectedVariety) || null;

    function pushUndo() { 
        setUndoStack(stk => [...stk, JSON.parse(JSON.stringify(beds))]); 
    }
    
    function undo() { 
        setUndoStack(stk => { 
            if (stk.length === 0) return stk; 
            const prev = stk[stk.length - 1]; 
            setBeds(prev); 
            return stk.slice(0, -1); 
        }); 
    }

    function setBedSeason(bedId, season) {
        setSelectedSeasonByBed(prev => ({ ...prev, [bedId]: season }));
        const b = beds.find(x => x.id === bedId);
        if (!b) return;
        
        const seasonType = b.seasonType || (b.location === "South" ? "warm-weather" : "cool-weather");
        if (seasonType === "cool-weather") return; // Can't set fall for cool-weather beds
        
        if (season === "fall" && (!b.plans.fall || !b.plans.fall.crop) && b.plans.spring && b.plans.spring.crop) {
            setSelectedCropName(b.plans.spring.crop.name);
            setSelectedVariety(b.plans.spring.crop.variety || "");
        }
    }

    // --- NEW: Reset everything
    function resetAll() {
        if (!confirm("Reset all plans, history, and settings? This cannot be undone.")) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch { }
        setUndoStack([]); // clear undo
        setSelectedBedId(null);
        setSelectedSeasonByBed({});
        setSelectedCropName(""); 
        setSelectedVariety("");
        setPlanningYear(new Date().getFullYear());
        setTargetPct(70);
        setBeds(migrateBeds(window.initialData.beds));
        setCrops(window.initialData.crops);
        // lbsPerPlant re-infer from defaults
        const map = {};
        (window.initialData.crops || []).forEach(c => { 
            const k = keyFor(c); 
            if (map[k] == null) map[k] = defaultForName(c.name); 
        });
        setLbsPerPlant(map);
        setTab("planner");
    }

    // --- NEW: Delete selected bed's current plan (season-aware)
    function deleteSelectedPlan() {
        if (!selectedBed) { alert("Select a bed to delete its plan."); return; }
        const seasonType = selectedBed.seasonType || (selectedBed.location === "South" ? "warm-weather" : "cool-weather");
        const season = (seasonType === "warm-weather") ? (selectedSeasonByBed[selectedBed.id] || "spring") : "spring";
        const plan = (selectedBed.plans || {})[season];
        if (!plan || !plan.crop) { alert("No planted plan found for this bed/season."); return; }
        if (!confirm(`Delete plan for ${selectedBed.id} (${season})?\n${plan.crop.name} • ${plan.crop.variety || ""}`)) return;
        pushUndo();
        setBeds(prev => prev.map(b => {
            if (b.id !== selectedBed.id) return b;
            const plans = { ...b.plans, [season]: null };
            return { ...b, plans };
        }));
    }

    function plant() {
        if (!selectedBed) { alert("Select a bed"); return; }
        if (!selectedCrop) { alert("Select crop and variety"); return; }
        const seasonType = selectedBed.seasonType || (selectedBed.location === "South" ? "warm-weather" : "cool-weather");
        const season = (seasonType === "warm-weather") ? (selectedSeasonByBed[selectedBed.id] || "spring") : "spring";
        const plantISO = getPlantDateFromJSON(selectedCrop, season, planningYear);
        if (!plantISO) { alert(`No ${season} planting date found in JSON for this crop/variety.`); return; }

        // Check if bed already has a plan for this season
        const existingPlan = (selectedBed.plans || {})[season];
        if (existingPlan && existingPlan.crop) {
            const existingCrop = `${existingPlan.crop.name} (${existingPlan.crop.variety || ""})`;
            const newCrop = `${selectedCrop.name} (${selectedCrop.variety || ""})`;
            if (!confirm(`⚠️ REPLANTING: ${selectedBed.id} (${season}) already has ${existingCrop} planted.\n\nReplace with ${newCrop}?`)) {
                return;
            }
        }

        const dtm = parseDTM(selectedCrop.days_to_maturity);
        const expectedHarvest = (dtm ? addDaysISO(plantISO, dtm) : null);

        const plants = adjustedPlantsForBed(selectedCrop, selectedBed.id);
        const key = keyFor(selectedCrop);
        const per = parseFloat(lbsPerPlant[key]);
        const projectedLbs = (Number.isFinite(per) ? plants * per : null);
        const servingLb = Math.max(0.01, Number(servingOz) / 16.0);
        const projectedServings = (projectedLbs != null) ? Math.round(projectedLbs / servingLb) : null;

        pushUndo();
        setBeds(prev => prev.map(b => {
            if (b.id !== selectedBed.id) return b;
            const plan = {
                crop: { name: selectedCrop.name, variety: selectedCrop.variety, plants_per_bed: selectedCrop.plants_per_bed ?? null },
                date_planted: plantISO, expected_harvest: expectedHarvest,
                projected_yield_lbs: projectedLbs, projected_servings: projectedServings, empty: false
            };
            const plans = { ...b.plans, [season]: plan };
            const bedSeasonType = b.seasonType || (b.location === "South" ? "warm-weather" : "cool-weather");
            if (bedSeasonType === "warm-weather" && season === "spring" && (!plans.fall || !plans.fall.crop)) {
                plans.fall = { crop: { ...plan.crop }, date_planted: null, expected_harvest: null, projected_yield_lbs: null, projected_servings: null, empty: true };
            }
            return { ...b, plans };
        }));
    }

    function logHarvest() {
        if (!selectedBed) { alert("Select a bed"); return; }
        const seasonType = selectedBed.seasonType || (selectedBed.location === "South" ? "warm-weather" : "cool-weather");
        const season = (seasonType === "warm-weather") ? (selectedSeasonByBed[selectedBed.id] || "spring") : "spring";
        const plan = (selectedBed.plans || {})[season];
        if (!plan || !plan.crop || !plan.date_planted) { alert("Select a planted plan (season) for this bed."); return; }
        const lbsStr = prompt("Log harvest weight (lbs):", "0"); 
        if (lbsStr == null) return;
        const lbs = parseFloat(lbsStr); 
        if (!Number.isFinite(lbs) || lbs < 0) { alert("Enter a valid non-negative number"); return; }
        const todayISO = toISO(new Date());
        const actualYear = new Date().getFullYear();
        pushUndo();
        setBeds(prev => prev.map(b => {
            if (b.id !== selectedBed.id) return b;
            return {
                ...b,
                history: [...(Array.isArray(b.history) ? b.history : []), {
                    year: actualYear,
                    crop: plan.crop?.name || "", variety: plan.crop?.variety || "",
                    planted: plan.date_planted, expected_harvest: plan.expected_harvest, harvested: todayISO, actual_yield: lbs, season
                }]
            };
        }));
    }

    function completeHarvest() {
        if (!selectedBed) { alert("Select a bed"); return; }
        const seasonType = selectedBed.seasonType || (selectedBed.location === "South" ? "warm-weather" : "cool-weather");
        const season = (seasonType === "warm-weather") ? (selectedSeasonByBed[selectedBed.id] || "spring") : "spring";
        const plan = (selectedBed.plans || {})[season];
        if (!plan || !plan.crop) { alert("Select a planted plan (season) for this bed."); return; }
        const lbsStr = prompt("Optional: final harvest weight to log now (lbs). Leave blank for none:", "");
        const addWeight = (lbsStr != null && lbsStr.trim() !== "");
        const lbs = addWeight ? parseFloat(lbsStr) : null;
        if (addWeight && (!Number.isFinite(lbs) || lbs < 0)) { alert("Enter a valid non-negative number"); return; }
        const todayISO = toISO(new Date());
        const actualYear = new Date().getFullYear();
        pushUndo();
        setBeds(prev => prev.map(b => {
            if (b.id !== selectedBed.id) return b;
            const plans = { ...b.plans, [season]: null };
            const extraHistory = addWeight ? [{
                year: actualYear,
                crop: plan.crop?.name || "", variety: plan.crop?.variety || "",
                planted: plan.date_planted, expected_harvest: plan.expected_harvest, harvested: todayISO, actual_yield: lbs, season
            }] : [];
            return { ...b, plans, history: [...(Array.isArray(b.history) ? b.history : []), ...extraHistory] };
        }));
    }

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Garden Planner</h1>
<div className="rounded border">
  <div className="flex gap-2 overflow-x-auto whitespace-nowrap p-1">
    <button 
      className={"inline-flex shrink-0 px-3 py-1 text-sm " + (tab === "planner" ? "bg-gray-200" : "bg-white hover:bg-gray-50")} 
      onClick={() => setTab("planner")}
    >
      Planner
    </button>
    <button 
      className={"inline-flex shrink-0 px-3 py-1 text-sm " + (tab === "analytics" ? "bg-gray-200" : "bg-white hover:bg-gray-50")} 
      onClick={() => setTab("analytics")}
    >
      Analytics
    </button>
    <button 
      className={"inline-flex shrink-0 px-3 py-1 text-sm " + (tab === "database" ? "bg-gray-200" : "bg-white hover:bg-gray-50")} 
      onClick={() => setTab("database")}
    >
      Plant Database
    </button>
    <button 
      className={"inline-flex shrink-0 px-3 py-1 text-sm " + (tab === "bedcreator" ? "bg-gray-200" : "bg-white hover:bg-gray-50")} 
      onClick={() => setTab("bedcreator")}
    >
      Bed Creator
    </button>
    <button 
      className={"inline-flex shrink-0 px-3 py-1 text-sm " + (tab === "orchard" ? "bg-gray-200" : "bg-white hover:bg-gray-50")} 
      onClick={() => setTab("orchard")}
    >
      Orchard
    </button>
    <button 
      className={"inline-flex shrink-0 px-3 py-1 text-sm " + (tab === "weather" ? "bg-gray-200" : "bg-white hover:bg-gray-50")} 
      onClick={() => setTab("weather")}
    >
      Weather
    </button>
  </div>
</div>
            </div>
            {tab === "planner" ? (
                <PlannerView 
                    beds={beds}
                    setBeds={setBeds}
                    crops={crops}
                    planningYear={planningYear}
                    setPlanningYear={setPlanningYear}
                    selectedBedId={selectedBedId}
                    setSelectedBedId={setSelectedBedId}
                    selectedSeasonByBed={selectedSeasonByBed}
                    setBedSeason={setBedSeason}
                    selectedCropName={selectedCropName}
                    setSelectedCropName={setSelectedCropName}
                    selectedVariety={selectedVariety}
                    setSelectedVariety={setSelectedVariety}
                    plant={plant}
                    logHarvest={logHarvest}
                    completeHarvest={completeHarvest}
                    undo={undo}
                    deleteSelectedPlan={deleteSelectedPlan}
                    resetAll={resetAll}
                    pushUndo={pushUndo}
                    lbsPerPlant={lbsPerPlant}
                    servingOz={servingOz}
                />
            ) : tab === "analytics" ? (
                <AnalyticsView 
                    beds={beds}
                    planningYear={planningYear}
                    targetPct={targetPct}
                    setTargetPct={setTargetPct}
                    servingOz={servingOz}
                />
            ) : tab === "database" ? (
                <PlantDatabaseView crops={crops} setCrops={setCrops} />
            ) : tab === "bedcreator" ? (
                <BedCreatorView />
            ) : tab === "orchard" ? (
                <OrchardView />
            ) : (
                <WeatherView />
            )}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

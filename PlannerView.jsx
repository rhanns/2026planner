function PlannerView({ 
    beds, setBeds, crops, planningYear, setPlanningYear, 
    selectedBedId, setSelectedBedId, selectedSeasonByBed, setBedSeason,
    selectedCropName, setSelectedCropName, selectedVariety, setSelectedVariety,
    plant, logHarvest, completeHarvest, undo, deleteSelectedPlan, resetAll,
    pushUndo, lbsPerPlant, servingOz
}) {
    const [cropSeasonFilter, setCropSeasonFilter] = React.useState("all");
    
    const selectedBed = beds.find(b => b.id === selectedBedId) || null;
    
    const filteredCrops = React.useMemo(() => {
        if (cropSeasonFilter === "all") return crops;
        
        return crops.filter(c => {
            if (cropSeasonFilter === "cool") {
                const name = (c.name || "").toLowerCase();
                return /(lettuce|spinach|arugula|mizuna|radish|carrot|beet|turnip|pea|kale|chard|collard|mustard|cabbage|broccoli|cauliflower|onion|garlic|leek)/.test(name);
            } else if (cropSeasonFilter === "warm") {
                const name = (c.name || "").toLowerCase();
                return /(tomato|pepper|eggplant|cucumber|zucchini|squash|melon|watermelon|cantaloupe|corn|bean|okra|basil)/.test(name);
            }
            return true;
        });
    }, [crops, cropSeasonFilter]);
    
    const cropNames = Array.from(new Set(filteredCrops.map(c => c.name))).sort((a, b) => a.localeCompare(b));
    const varieties = filteredCrops.filter(c => c.name === selectedCropName).map(c => c.variety).filter(Boolean).sort((a, b) => a.localeCompare(b));
    
    const weeklyPlan = buildWeeklyPlan(beds, crops, planningYear);
    const weeklyKeys = Object.keys(weeklyPlan).sort();
    const materials = buildMaterials(beds, crops);

    function toggleBedSeasonType(bedId) {
        pushUndo();
        setBeds(prev => prev.map(bed => {
            if (bed.id !== bedId) return bed;
            const currentType = bed.seasonType || (bed.location === "South" ? "warm-weather" : "cool-weather");
            const newType = currentType === "cool-weather" ? "warm-weather" : "cool-weather";
            return { ...bed, seasonType: newType };
        }));
    }

    function seasonTabs(b) {
        const seasonType = b.seasonType || (b.location === "South" ? "warm-weather" : "cool-weather");
        if (seasonType === "cool-weather") return null;
        
        const sel = selectedSeasonByBed[b.id] || "spring";
        return (
            <div className="mt-1 inline-flex border rounded overflow-hidden">
                <button 
                    onClick={() => setBedSeason(b.id, "spring")} 
                    className={"px-1.5 py-0.5 text-[10px] " + (sel === "spring" ? "bg-gray-200" : "bg-white hover:bg-gray-50")}
                >
                    S
                </button>
                <button 
                    onClick={() => setBedSeason(b.id, "fall")} 
                    className={"px-1.5 py-0.5 text-[10px] " + (sel === "fall" ? "bg-gray-200" : "bg-white hover:bg-gray-50")}
                >
                    F
                </button>
            </div>
        );
    }

    function bedClasses(b) {
        const anyPlan = (b.plans?.spring && b.plans.spring.crop) || (b.plans?.fall && b.plans.fall.crop);
        let color = anyPlan ? "bg-green-400" : "bg-gray-200";
        const selected = (b.id === selectedBedId) ? "ring-2 ring-blue-500" : "";
        return ["w-10 h-24 rounded cursor-pointer flex flex-col items-center justify-center text-[9px] leading-tight px-1 text-center", color, selected].join(" ");
    }

    const northBeds = beds.filter(b => b.location === "North");
    const southBeds = beds.filter(b => b.location === "South");
    const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(30, 2.5rem)', gap: '0.25rem' };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold">Planner</h2>
                    <div className="flex items-center gap-2">
                        <label className="text-sm">Planning Year:</label>
                        <select 
                            className="px-2 py-1 border rounded" 
                            value={planningYear} 
                            onChange={e => setPlanningYear(Number(e.target.value))}
                        >
                            {Array.from({ length: 6 }).map((_, i) => { 
                                const y = new Date().getFullYear() - 1 + i; 
                                return <option key={y} value={y}>{y}</option>; 
                            })}
                        </select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={undo} 
                        className="bg-gray-200 px-3 py-2 rounded" 
                        title="Undo last change"
                    >
                        Undo
                    </button>
                    <button 
                        onClick={deleteSelectedPlan} 
                        className="bg-orange-600 text-white px-3 py-2 rounded" 
                        title="Delete selected bed's plan"
                    >
                        Delete
                    </button>
                    <button 
                        onClick={resetAll} 
                        className="bg-red-700 text-white px-3 py-2 rounded" 
                        title="Reset all data"
                    >
                        Reset
                    </button>
                </div>
            </div>

            <div>
                <h3 className="font-semibold mb-2">North Beds</h3>
                <div style={gridStyle}>
                    {northBeds.map(b => {
                        const sp = b.plans.spring;
                        const seasonType = b.seasonType || "cool-weather";
                        const label = sp && sp.crop ? (sp.crop.variety || sp.crop.name) : "Empty";
                        const title = sp && sp.crop ? `${b.id} – ${sp.crop.name} • ${sp.crop.variety || ""}` : `${b.id} – Empty`;
                        return (
                            <div key={b.id} className="flex flex-col items-center">
                                <div 
                                    className={bedClasses(b)} 
                                    title={title} 
                                    onClick={() => setSelectedBedId(b.id)}
                                >
                                    <div className="font-semibold">{b.id}</div>
                                    <div className="truncate w-full">{abbrev(label, 12)}</div>
                                    <div className="text-[8px] text-gray-500">{seasonType === "warm-weather" ? "Hot" : "Cool"}</div>
                                </div>
                                <button
                                    onClick={() => toggleBedSeasonType(b.id)}
                                    className="mt-1 text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded border"
                                    title={`Toggle to ${seasonType === "cool-weather" ? "Warm Weather" : "Cool Weather"}`}
                                >
                                    {seasonType === "cool-weather" ? "→Hot" : "→Cool"}
                                </button>
                                {seasonTabs(b)}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div>
                <h3 className="font-semibold mb-2">South Beds</h3>
                <div style={gridStyle}>
                    {southBeds.map(b => {
                        const sp = b.plans.spring, fl = b.plans.fall;
                        const seasonType = b.seasonType || "warm-weather";
                        const mainLabel = sp && sp.crop ? (sp.crop.variety || sp.crop.name) : "Empty";
                        const fallBadge = fl && fl.crop ? (fl.crop.variety || fl.crop.name) : null;
                        const titleParts = [`${b.id}`];
                        if (sp && sp.crop) titleParts.push(`Spring: ${sp.crop.name} • ${sp.crop.variety || ""}`);
                        if (fl && fl.crop) titleParts.push(`Fall: ${fl.crop.name} • ${fl.crop.variety || ""}`);
                        const title = titleParts.join(" — ");
                        return (
                            <div key={b.id} className="flex flex-col items-center">
                                <div 
                                    className={bedClasses(b)} 
                                    title={title} 
                                    onClick={() => setSelectedBedId(b.id)}
                                >
                                    <div className="font-semibold">{b.id}</div>
                                    <div className="truncate w-full">{abbrev(mainLabel, 12)}</div>
                                    {fallBadge && <div className="truncate w-full text-[9px] italic">F: {abbrev(fallBadge, 10)}</div>}
                                    <div className="text-[8px] text-gray-500">{seasonType === "warm-weather" ? "Hot" : "Cool"}</div>
                                </div>
                                <button
                                    onClick={() => toggleBedSeasonType(b.id)}
                                    className="mt-1 text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded border"
                                    title={`Toggle to ${seasonType === "cool-weather" ? "Warm Weather" : "Cool Weather"}`}
                                >
                                    {seasonType === "cool-weather" ? "→Hot" : "→Cool"}
                                </button>
                                {seasonTabs(b)}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 border rounded bg-white">
                <h3 className="font-semibold mb-2">Controls</h3>
                <div className="flex gap-2 flex-wrap items-end">
                    <div className="flex flex-col">
                        <label className="text-sm text-gray-600">Season Filter</label>
                        <select 
                            value={cropSeasonFilter} 
                            onChange={e => {
                                setCropSeasonFilter(e.target.value);
                                setSelectedCropName("");
                                setSelectedVariety("");
                            }}
                            className="px-3 py-2 border rounded"
                        >
                            <option value="all">All Crops</option>
                            <option value="cool">Cool Season</option>
                            <option value="warm">Warm Season</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm text-gray-600">Crop</label>
                        <select 
                            value={selectedCropName} 
                            onChange={e => { setSelectedCropName(e.target.value); setSelectedVariety(""); }} 
                            className="px-3 py-2 border rounded"
                        >
                            <option value="">Select crop</option>
                            {cropNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm text-gray-600">Variety</label>
                        <select 
                            value={selectedVariety} 
                            onChange={e => setSelectedVariety(e.target.value)} 
                            disabled={!selectedCropName} 
                            className="px-3 py-2 border rounded"
                        >
                            <option value="">Select variety</option>
                            {varieties.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={plant} 
                            className={(() => {
                                if (!selectedBed || !selectedCropName || !selectedVariety) {
                                    return "bg-gray-400 text-white px-3 py-2 rounded cursor-not-allowed";
                                }
                                const seasonType = selectedBed.seasonType || (selectedBed.location === "South" ? "warm-weather" : "cool-weather");
                                const season = (seasonType === "warm-weather") ? (selectedSeasonByBed[selectedBed.id] || "spring") : "spring";
                                const existingPlan = (selectedBed.plans || {})[season];
                                if (existingPlan && existingPlan.crop) {
                                    return "bg-orange-600 text-white px-3 py-2 rounded";
                                }
                                return "bg-green-600 text-white px-3 py-2 rounded";
                            })()}
                            disabled={!selectedBed || !selectedCropName || !selectedVariety}
                        >
                            {(() => {
                                if (!selectedBed || !selectedCropName || !selectedVariety) {
                                    return "Plant!";
                                }
                                const seasonType = selectedBed.seasonType || (selectedBed.location === "South" ? "warm-weather" : "cool-weather");
                                const season = (seasonType === "warm-weather") ? (selectedSeasonByBed[selectedBed.id] || "spring") : "spring";
                                const existingPlan = (selectedBed.plans || {})[season];
                                if (existingPlan && existingPlan.crop) {
                                    return "Re-Plant!"; 
                                }
                                return "Plant!";
                            })()}
                        </button>
                        <button 
                            onClick={logHarvest} 
                            className="bg-amber-600 text-white px-3 py-2 rounded"
                        >
                            Log Harvest
                        </button>
                        <button 
                            onClick={completeHarvest} 
                            className="bg-red-600 text-white px-3 py-2 rounded"
                        >
                            Complete Harvest
                        </button>
                    </div>
                </div>
                {selectedBed && (() => {
                    const seasonType = selectedBed.seasonType || (selectedBed.location === "South" ? "warm-weather" : "cool-weather");
                    const selSeason = (seasonType === "warm-weather") ? (selectedSeasonByBed[selectedBed.id] || "spring") : "spring";
                    const plan = (selectedBed.plans || {})[selSeason];
                    const projL = plan?.projected_yield_lbs != null ? ` • Projected lbs: ${plan.projected_yield_lbs.toFixed(1)}` : "";
                    const projS = plan?.projected_servings != null ? ` • Projected servings: ${plan.projected_servings}` : "";
                    const expH = plan?.expected_harvest ? ` • Expected harvest: ${plan.expected_harvest}` : "";
                    const label = plan && plan.crop ? `${plan.crop.name} (${plan.crop.variety || ""})` : "Empty";
                    return (
                        <div className="mt-2 text-sm text-gray-600">
                            Selected Bed: <span className="font-medium">{selectedBed.id}</span> — <span className="uppercase">{selSeason}</span> — {label}{projL}{projS}{expH}
                        </div>
                    );
                })()}
            </div>

            <div className="p-4 border rounded bg-white">
                <h3 className="font-semibold mb-2">Weekly To-Do List ({planningYear})</h3>
                {weeklyKeys.length === 0 ? (
                    <p className="text-sm text-gray-600">No tasks yet. Plant a bed to generate the plan.</p>
                ) : (() => {
                    const groups = {};
                    weeklyKeys.forEach(k => {
                        const { key, label } = monthKeyLabel(k);
                        if (!groups[key]) groups[key] = { label, weeks: [] };
                        groups[key].weeks.push(k);
                    });
                    const monthKeys = Object.keys(groups).sort();
                    return (
                        <div className="space-y-4">
                            {monthKeys.map(mk => (
                                <div key={mk} className="space-y-3">
                                    <div className="text-xs uppercase tracking-wide text-gray-500">
                                        {groups[mk].label}
                                    </div>
                                    {groups[mk].weeks.map(k => {
                                        const items = weeklyPlan[k].sort((a, b) => a.date.localeCompare(b.date));
                                        if (items.length === 0) return null;
                                        return (
                                            <div key={k} className="border rounded p-2">
                                                <div className="font-medium">Week of {k}</div>
                                                <ul className="list-disc ml-5">
                                                    {items.map((it, idx) => (
                                                        <li key={idx}>
                                                            <span className="text-gray-500 mr-2">{it.date}</span>
                                                            {it.text}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>

            <div className="p-4 border rounded bg-white">
                <h3 className="font-semibold mb-2">Materials</h3>
                {(() => {
                    const m = materials;
                    if (m.rows.length === 0) return <p className="text-sm text-gray-600">Plant some beds to see materials.</p>;
                    return (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b">
                                        <th className="py-1 pr-4">Bed</th>
                                        <th className="py-1 pr-4">Season</th>
                                        <th className="py-1 pr-4">Crop</th>
                                        <th className="py-1 pr-4">Variety</th>
                                        <th className="py-1 pr-4">Plants</th>
                                        <th className="py-1 pr-4">Seeds (2–3/plant)</th>
                                        <th className="py-1 pr-4">Fence?</th>
                                        <th className="py-1 pr-4">T-posts</th>
                                        <th className="py-1 pr-4">Panel ft</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {m.rows.map((r, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="py-1 pr-4">{r.bed}</td>
                                            <td className="py-1 pr-4 capitalize">{r.season}</td>
                                            <td className="py-1 pr-4">{r.crop}</td>
                                            <td className="py-1 pr-4">{r.variety}</td>
                                            <td className="py-1 pr-4">{r.plants}</td>
                                            <td className="py-1 pr-4">{r.seeds}</td>
                                            <td className="py-1 pr-4">{r.fence}</td>
                                            <td className="py-1 pr-4">{r.tposts}</td>
                                            <td className="py-1 pr-4">{r.panelFeet}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-medium">
                                        <td className="py-1 pr-4" colSpan="5">Totals</td>
                                        <td className="py-1 pr-4">{m.totals.seeds}</td>
                                        <td className="py-1 pr-4"></td>
                                        <td className="py-1 pr-4">{m.totals.tposts}</td>
                                        <td className="py-1 pr-4">{m.totals.panelFeet}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    );
                })()}
            </div>

        </div>
    );
}

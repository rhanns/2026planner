// AnalyticsView.jsx - Analytics component

function AnalyticsView({ beds, planningYear, targetPct, setTargetPct, servingOz }) {
    const history = flattenHistoryFromBeds(beds);
    const plans = flattenPlans(beds);
    const servingLb = Math.max(0.01, Number(servingOz) / 16.0);

    // PROJECTED
    const projTotalLbs = sum(plans, x => x.projected_yield_lbs);
    const projTotalServ = sum(plans, x => x.projected_servings);

    const projByCrop = Array.from(groupBy(plans, r => `${r.crop}|||${r.variety}`).entries())
        .map(([k, arr]) => {
            const [crop, variety] = k.split("|||");
            return { 
                crop, 
                variety, 
                lbs: sum(arr, x => x.projected_yield_lbs), 
                servings: sum(arr, x => x.projected_servings), 
                beds: new Set(arr.map(x => x.bed)).size 
            };
        }).sort((a, b) => b.lbs - a.lbs);

    const projByBed = Array.from(groupBy(plans, r => r.bed).entries())
        .map(([bed, arr]) => ({ 
            bed, 
            lbs: sum(arr, x => x.projected_yield_lbs), 
            servings: sum(arr, x => x.projected_servings) 
        }))
        .sort((a, b) => a.bed.localeCompare(b.bed));

    // ACTUALS
    const byYear = groupBy(history, h => h.year || "Unknown");
    const byCropActual = Array.from(groupBy(history, h => `${h.crop}|||${h.variety || ""}`).entries())
        .map(([k, arr]) => { 
            const [crop, variety] = k.split("|||"); 
            return { 
                crop, 
                variety, 
                lbs: sum(arr, x => Number(x.actual_yield) || 0), 
                entries: arr.length 
            }; 
        })
        .sort((a, b) => b.lbs - a.lbs);

    const byBedActual = Array.from(groupBy(history, h => h.bed || "Unknown").entries())
        .map(([bed, arr]) => ({ 
            bed, 
            lbs: sum(arr, x => Number(x.actual_yield) || 0), 
            entries: arr.length 
        }))
        .sort((a, b) => a.bed.localeCompare(b.bed));

    // TARGET % MET
    const actualTotalLbs = sum(history, x => Number(x.actual_yield) || 0);
    const targetPctNum = Math.max(0, Math.min(100, Number(targetPct) || 0));
    const pctMetOverall = projTotalLbs > 0 ? (actualTotalLbs / projTotalLbs) * 100 : 0;
    const overallPass = pctMetOverall >= targetPctNum;

    const coverageByCrop = projByCrop.map(p => {
        const actual = (byCropActual.find(a => a.crop === p.crop && a.variety === p.variety)?.lbs) || 0;
        const pct = p.lbs > 0 ? (actual / p.lbs) * 100 : 0;
        return {
            crop: p.crop, 
            variety: p.variety,
            projected_lbs: p.lbs, 
            actual_lbs: actual, 
            variance_lbs: actual - p.lbs,
            projected_servings: p.servings, 
            actual_servings: (actual / servingLb) || 0, 
            variance_servings: ((actual / servingLb) - p.servings) || 0,
            pctMet: pct, 
            pass: pct >= targetPctNum
        };
    }).sort((a, b) => a.pass === b.pass ? b.pctMet - a.pctMet : (a.pass ? -1 : 1));

    const coverageByBed = projByBed.map(p => {
        const actual = (byBedActual.find(a => a.bed === p.bed)?.lbs) || 0;
        const pct = p.lbs > 0 ? (actual / p.lbs) * 100 : 0;
        return {
            bed: p.bed,
            projected_lbs: p.lbs, 
            actual_lbs: actual, 
            variance_lbs: actual - p.lbs,
            projected_servings: p.servings, 
            actual_servings: (actual / servingLb) || 0, 
            variance_servings: ((actual / servingLb) - p.servings) || 0,
            pctMet: pct, 
            pass: pct >= targetPctNum
        };
    }).sort((a, b) => a.pass === b.pass ? b.pctMet - a.pctMet : (a.pass ? -1 : 1));

    return (
        <div className="space-y-6">

            {/* SUMMARY / TARGET */}
            <div className="p-4 border rounded bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Summary — {planningYear}</h3>
                    <div className="text-sm">
                        <label className="mr-2">Target %</label>
                        <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            className="px-2 py-1 border rounded w-20"
                            value={targetPct} 
                            onChange={e => setTargetPct(Number(e.target.value))} 
                        />
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="p-2 border rounded">
                        <div className="text-gray-500">Projected lbs</div>
                        <div className="text-lg font-semibold">{projTotalLbs.toFixed(1)}</div>
                        <div className="text-gray-500 mt-1">Projected servings</div>
                        <div className="font-semibold">{projTotalServ}</div>
                    </div>
                    <div className="p-2 border rounded">
                        <div className="text-gray-500">Actual lbs (all years)</div>
                        <div className="text-lg font-semibold">{actualTotalLbs.toFixed(1)}</div>
                        <div className="text-gray-500 mt-1">Actual servings (est.)</div>
                        <div className="font-semibold">{Math.round(actualTotalLbs / servingLb)}</div>
                    </div>
                    <div className="p-2 border rounded">
                        <div className="text-gray-500">% Met vs Target</div>
                        <div className={"text-lg font-semibold " + (overallPass ? "text-green-700" : "text-red-700")}>
                            {projTotalLbs > 0 ? pctMetOverall.toFixed(0) + "%" : "—"}
                        </div>
                        <div className="text-xs text-gray-500">Threshold: {targetPctNum}%</div>
                    </div>
                </div>
            </div>


            {/* TARGET COVERAGE tables */}
            <div className="p-4 border rounded bg-white">
                <h3 className="font-semibold mb-2">Target Coverage — by Crop</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-left border-b">
                                <th className="py-1 pr-4">Crop</th>
                                <th className="py-1 pr-4">Variety</th>
                                <th className="py-1 pr-4">Projected lbs</th>
                                <th className="py-1 pr-4">Actual lbs</th>
                                <th className="py-1 pr-4">Variance lbs</th>
                                <th className="py-1 pr-4">% Met</th>
                                <th className="py-1 pr-4">Projected servings</th>
                                <th className="py-1 pr-4">Actual servings</th>
                                <th className="py-1 pr-4">Variance servings</th>
                                <th className="py-1 pr-4">Pass?</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coverageByCrop.map((r, i) => (
                                <tr key={i} className="border-b">
                                    <td className="py-1 pr-4">{r.crop}</td>
                                    <td className="py-1 pr-4">{r.variety}</td>
                                    <td className="py-1 pr-4">{r.projected_lbs.toFixed(1)}</td>
                                    <td className="py-1 pr-4">{r.actual_lbs.toFixed(1)}</td>
                                    <td className="py-1 pr-4">{r.variance_lbs.toFixed(1)}</td>
                                    <td className="py-1 pr-4">{r.projected_lbs > 0 ? r.pctMet.toFixed(0) + "%" : "—"}</td>
                                    <td className="py-1 pr-4">{r.projected_servings}</td>
                                    <td className="py-1 pr-4">{Math.round(r.actual_servings)}</td>
                                    <td className="py-1 pr-4">{Math.round(r.variance_servings)}</td>
                                    <td className={"py-1 pr-4 font-medium " + (r.pass ? "text-green-700" : "text-red-700")}>
                                        {r.pass ? "Yes" : "No"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ACTUALS — yearly */}
            <div className="p-4 border rounded bg-white">
                <h3 className="font-semibold mb-2">Actuals — Yearly</h3>
                {history.length === 0 ? (
                    <p className="text-sm text-gray-600">No harvests logged yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left border-b">
                                    <th className="py-1 pr-4">Year</th>
                                    <th className="py-1 pr-4">Entries</th>
                                    <th className="py-1 pr-4">Total lbs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from(groupBy(history, h => h.year || "Unknown").entries())
                                    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
                                    .map(([y, arr]) => {
                                        const lbs = sum(arr, x => Number(x.actual_yield) || 0);
                                        return (
                                            <tr key={y} className="border-b">
                                                <td className="py-1 pr-4">{y}</td>
                                                <td className="py-1 pr-4">{arr.length}</td>
                                                <td className="py-1 pr-4">{lbs.toFixed(1)}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
}
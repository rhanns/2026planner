// gardenLogic.js - Business logic functions

/* Data migration function */
function migrateBeds(beds) {
    return beds.map(b => {
        // Determine season type based on location (for migration)
        const seasonType = b.seasonType || (b.location === "South" ? "warm-weather" : "cool-weather");
        
        if (b.location !== "South") {
            const plan = (!b.empty && b.current_crop) ? {
                crop: b.current_crop, 
                date_planted: b.date_planted, 
                expected_harvest: b.expected_harvest,
                projected_yield_lbs: b.projected_yield_lbs, 
                projected_servings: b.projected_servings, 
                empty: false
            } : null;
            return { 
                ...b, 
                seasonType,
                plans: { spring: plan, fall: null }, 
                current_crop: undefined, 
                date_planted: undefined, 
                expected_harvest: undefined, 
                projected_yield_lbs: undefined, 
                projected_servings: undefined 
            };
        } else {
            const planSpring = (!b.empty && b.current_crop) ? {
                crop: b.current_crop, 
                date_planted: b.date_planted, 
                expected_harvest: b.expected_harvest,
                projected_yield_lbs: b.projected_yield_lbs, 
                projected_servings: b.projected_servings, 
                empty: false
            } : null;
            return { 
                ...b, 
                seasonType,
                plans: { spring: planSpring, fall: null }, 
                season: undefined, 
                current_crop: undefined, 
                date_planted: undefined, 
                expected_harvest: undefined, 
                projected_yield_lbs: undefined, 
                projected_servings: undefined 
            };
        }
    });
}

/* Build weekly plan from beds and crops */
function buildWeeklyPlan(beds, crops, planningYear) {
    const weeks = buildWeeksOfYear(planningYear);
    const perWeek = {}; 
    weeks.forEach(k => perWeek[k] = []);

    function addTask(iso, text) {
        const d = toDateFlexible(iso);
        if (!d || !text) return;
        const wk = toISO(startOfWeek(d));
        if (!perWeek[wk]) perWeek[wk] = [];
        perWeek[wk].push({ date: toISO(d) + " 00:00:00", text });
    }

    beds.forEach(b => {
        const seasonType = b.seasonType || (b.location === "South" ? "warm-weather" : "cool-weather");
        const seasons = (seasonType === "warm-weather") ? ["spring", "fall"] : ["spring"];
        seasons.forEach(season => {
            const plan = (b.plans || {})[season];
            if (!(plan && plan.crop)) return;

            const c = crops.find(x => x.name === plan.crop.name && x.variety === plan.crop.variety);
            const qty = c ? adjustedPlantsForBed(c, b.id) : (plan.crop.plants_per_bed || 0);

            const seedStart = getSeedStartFromJSON(c || {}, season, planningYear);
            if (seedStart) {
                addTask(seedStart, `Seed start: ${plan.crop.name} (${plan.crop.variety || ""}) for ${b.id} — ${qty} plants`);
            }

            const plantISO = getPlantDateFromJSON(c || {}, season, planningYear);
            if (plantISO) {
                addTask(plantISO, `Plant: ${plan.crop.name} (${plan.crop.variety || ""}) in ${b.id} — ${qty} plants`);
            }

            // --- Harvest & Clear Bed logic ---
            let harvestStartISO = null;
            let harvestEndISO = null;

            if (plantISO && c) {
                const dtm = parseDTM(c.days_to_maturity);
                if (dtm) {
                    const h = addDaysISO(plantISO, dtm);
                    if (h) {
                        harvestStartISO = h;
                        addTask(h, `Start Harvesting: ${plan.crop.name} (${plan.crop.variety || ""}) from ${b.id}`);
                    }
                } else {
                    const eh = toDateFlexible(c.expected_harvest);
                    const hs = toDateFlexible(c.harvest_date_start);
                    const h2 = eh || hs;
                    if (h2) {
                        harvestStartISO = toISO(h2);
                        addTask(h2, `Start Harvesting: ${plan.crop.name} (${plan.crop.variety || ""}) from ${b.id}`);
                    }
                }
                const he = toDateFlexible(c.harvest_date_end);
                if (he) harvestEndISO = toISO(he);
            }

            // Determine CLEAR BED date
            let clearISO = null;
            if (season === "spring" && seasonType === "warm-weather" && b.plans?.fall?.crop) {
                const fallCrop = crops.find(x =>
                    x.name === b.plans.fall.crop.name && x.variety === b.plans.fall.crop.variety
                ) || b.plans.fall.crop;
                const fallPlantISO = getPlantDateFromJSON(fallCrop || {}, "fall", planningYear);
                if (fallPlantISO) clearISO = addDaysISO(fallPlantISO, -7);
            }
            if (!clearISO) clearISO = harvestEndISO || harvestStartISO || null;
            if (clearISO) {
                addTask(clearISO, `Clear Bed: ${plan.crop.name} (${plan.crop.variety || ""}) in ${b.id}`);
            }
        });
    });

    return perWeek;
}

/* Build materials list */
function buildMaterials(beds, crops) {
    let rows = []; 
    let totalSeeds = 0, totalTposts = 0, totalPanelFeet = 0;
    
    beds.forEach(b => {
        const seasonType = b.seasonType || (b.location === "South" ? "warm-weather" : "cool-weather");
        const seasons = (seasonType === "warm-weather") ? ["spring", "fall"] : ["spring"];
        seasons.forEach(season => {
            const plan = (b.plans || {})[season];
            if (plan && plan.crop) {
                const c = crops.find(x => x.name === plan.crop.name && x.variety === plan.crop.variety) || { 
                    name: plan.crop.name, 
                    variety: plan.crop.variety, 
                    plants_per_bed: plan.crop.plants_per_bed 
                };
                const plants = adjustedPlantsForBed(c, b.id);
                const seeds = Math.ceil(plants * 2.5);
                const fence = needsFence(c);
                const tposts = fence ? 10 : 0;
                const panelFeet = fence ? 48 : 0;
                totalSeeds += seeds; 
                totalTposts += tposts; 
                totalPanelFeet += panelFeet;
                rows.push({ 
                    bed: b.id, 
                    season: (seasonType === "warm-weather" ? season : "spring"), 
                    crop: c.name, 
                    variety: c.variety, 
                    plants, 
                    seeds, 
                    fence: fence ? "Yes" : "No", 
                    tposts, 
                    panelFeet 
                });
            }
        });
    });
    
    return { 
        rows, 
        totals: { 
            seeds: totalSeeds, 
            tposts: totalTposts, 
            panelFeet: totalPanelFeet 
        } 
    };
}

/* Analytics helper functions */
function flattenHistoryFromBeds(beds) {
    const out = [];
    beds.forEach(b => (b.history || []).forEach(h => out.push({ ...h, bed: b.id })));
    return out;
}

function flattenPlans(beds) {
    const out = [];
    beds.forEach(b => {
        const seasonType = b.seasonType || (b.location === "South" ? "warm-weather" : "cool-weather");
        const seasons = (seasonType === "warm-weather") ? ["spring", "fall"] : ["spring"];
        seasons.forEach(season => {
            const p = (b.plans || {})[season];
            if (p && p.crop) {
                out.push({
                    bed: b.id,
                    season: (seasonType === "warm-weather" ? season : "spring"),
                    crop: p.crop.name, 
                    variety: p.crop.variety || "",
                    projected_yield_lbs: Number(p.projected_yield_lbs) || 0,
                    projected_servings: Number(p.projected_servings) || 0
                });
            }
        });
    });
    return out;
}
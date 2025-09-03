// dataSchema.js - Clean data structure definitions and migration

/* Clean Bed Schema */
const BED_SCHEMA = {
    id: "", // string - bed identifier (e.g. "N1", "S15")
    location: "", // "North" | "South"
    plans: {
        spring: null, // Plan | null
        fall: null    // Plan | null (only for South beds)
    },
    history: [] // Array of HistoryEntry
};

const PLAN_SCHEMA = {
    crop: {
        name: "",     // string - crop name
        variety: "",  // string - variety name
        plants_per_bed: 0 // number - plants planned for this bed size
    },
    date_planted: "",           // ISO date string | null
    expected_harvest: "",       // ISO date string | null  
    projected_yield_lbs: 0,     // number | null
    projected_servings: 0,      // number | null
    notes: ""                   // string - planting notes
};

const HISTORY_ENTRY_SCHEMA = {
    year: 0,                    // number - harvest year
    season: "",                 // "spring" | "fall"
    crop: "",                   // string - crop name
    variety: "",                // string - variety name
    planted: "",                // ISO date string - when planted
    expected_harvest: "",       // ISO date string | null - expected harvest
    harvested: "",              // ISO date string - when harvested
    actual_yield: 0,            // number - lbs harvested
    notes: "",                  // string - harvest notes
    photos: []                  // array of photo URLs/base64 (for future)
};

/* Migration Functions */
function cleanBed(dirtyBed) {
    const clean = {
        id: dirtyBed.id || "",
        location: dirtyBed.location || "North",
        plans: {
            spring: null,
            fall: null
        },
        history: Array.isArray(dirtyBed.history) ? dirtyBed.history.map(cleanHistoryEntry) : []
    };

    // Handle legacy data - old single-crop format
    if (dirtyBed.current_crop && !dirtyBed.plans) {
        clean.plans.spring = {
            crop: {
                name: dirtyBed.current_crop.name || "",
                variety: dirtyBed.current_crop.variety || "",
                plants_per_bed: dirtyBed.current_crop.plants_per_bed || null
            },
            date_planted: dirtyBed.date_planted || null,
            expected_harvest: dirtyBed.expected_harvest || null,
            projected_yield_lbs: dirtyBed.projected_yield_lbs || null,
            projected_servings: dirtyBed.projected_servings || null,
            notes: ""
        };
    }

    // Handle new format - preserve existing plans
    if (dirtyBed.plans) {
        if (dirtyBed.plans.spring && dirtyBed.plans.spring.crop) {
            clean.plans.spring = cleanPlan(dirtyBed.plans.spring);
        }
        if (dirtyBed.plans.fall && dirtyBed.plans.fall.crop) {
            clean.plans.fall = cleanPlan(dirtyBed.plans.fall);
        }
    }

    return clean;
}

function cleanPlan(dirtyPlan) {
    if (!dirtyPlan || !dirtyPlan.crop) return null;
    
    return {
        crop: {
            name: dirtyPlan.crop.name || "",
            variety: dirtyPlan.crop.variety || "",
            plants_per_bed: dirtyPlan.crop.plants_per_bed || null
        },
        date_planted: dirtyPlan.date_planted || null,
        expected_harvest: dirtyPlan.expected_harvest || null,
        projected_yield_lbs: dirtyPlan.projected_yield_lbs || null,
        projected_servings: dirtyPlan.projected_servings || null,
        notes: dirtyPlan.notes || ""
    };
}

function cleanHistoryEntry(dirtyEntry) {
    return {
        year: Number(dirtyEntry.year) || new Date().getFullYear(),
        season: dirtyEntry.season || "spring",
        crop: dirtyEntry.crop || "",
        variety: dirtyEntry.variety || "",
        planted: dirtyEntry.planted || "",
        expected_harvest: dirtyEntry.expected_harvest || null,
        harvested: dirtyEntry.harvested || "",
        actual_yield: Number(dirtyEntry.actual_yield) || 0,
        notes: dirtyEntry.notes || "",
        photos: Array.isArray(dirtyEntry.photos) ? dirtyEntry.photos : []
    };
}

/* Validation Functions */
function validateBed(bed) {
    const errors = [];
    
    if (!bed.id || typeof bed.id !== 'string') {
        errors.push('Bed must have a valid ID');
    }
    
    if (!['North', 'South'].includes(bed.location)) {
        errors.push('Bed location must be North or South');
    }
    
    if (bed.location === 'North' && bed.plans.fall && bed.plans.fall.crop) {
        errors.push('North beds cannot have fall plantings');
    }
    
    if (!Array.isArray(bed.history)) {
        errors.push('Bed history must be an array');
    }
    
    return errors;
}

function validatePlan(plan) {
    if (!plan) return [];
    
    const errors = [];
    
    if (!plan.crop || !plan.crop.name) {
        errors.push('Plan must have a crop with a name');
    }
    
    if (plan.date_planted && !/^\d{4}-\d{2}-\d{2}$/.test(plan.date_planted)) {
        errors.push('Plan date_planted must be ISO date format (YYYY-MM-DD)');
    }
    
    return errors;
}

/* Export/Import Functions */
function exportAppData(beds, crops, settings) {
    const exportData = {
        version: "2.0",
        exported_at: new Date().toISOString(),
        beds: beds.map(cleanBed),
        crops: crops,
        settings: {
            servingOz: settings.servingOz || 6,
            targetPct: settings.targetPct || 70,
            lbsPerPlant: settings.lbsPerPlant || {},
            planningYear: settings.planningYear || new Date().getFullYear()
        }
    };
    
    return JSON.stringify(exportData, null, 2);
}

function importAppData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        // Validate basic structure
        if (!data.beds || !Array.isArray(data.beds)) {
            throw new Error('Invalid data: beds must be an array');
        }
        
        if (!data.crops || !Array.isArray(data.crops)) {
            throw new Error('Invalid data: crops must be an array');
        }
        
        // Clean and validate beds
        const cleanedBeds = data.beds.map(bed => {
            const clean = cleanBed(bed);
            const errors = validateBed(clean);
            if (errors.length > 0) {
                console.warn(`Bed ${bed.id} has validation errors:`, errors);
            }
            return clean;
        });
        
        return {
            success: true,
            beds: cleanedBeds,
            crops: data.crops,
            settings: data.settings || {}
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/* Batch Operation Helpers */
function createBatchPlan(cropName, variety, plantsPerBed) {
    return {
        crop: {
            name: cropName,
            variety: variety || "",
            plants_per_bed: plantsPerBed || null
        },
        date_planted: null,
        expected_harvest: null,
        projected_yield_lbs: null,
        projected_servings: null,
        notes: ""
    };
}

function applyBatchOperation(beds, selectedBedIds, operation) {
    return beds.map(bed => {
        if (!selectedBedIds.includes(bed.id)) return bed;
        
        switch (operation.type) {
            case 'plant':
                const season = (bed.location === "South" && operation.season) ? operation.season : "spring";
                const newPlan = createBatchPlan(
                    operation.cropName, 
                    operation.variety, 
                    operation.plantsPerBed
                );
                return {
                    ...bed,
                    plans: {
                        ...bed.plans,
                        [season]: newPlan
                    }
                };
                
            case 'clear':
                const clearSeason = (bed.location === "South" && operation.season) ? operation.season : "spring";
                return {
                    ...bed,
                    plans: {
                        ...bed.plans,
                        [clearSeason]: null
                    }
                };
                
            default:
                return bed;
        }
    });
}
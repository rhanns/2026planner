// utils.js - Helper functions and constants

const STORAGE_KEY = "gardenPlanner_grid_dateNormalize_v1";
const SHORT_BEDS = new Set(["S1", "S2", "S3"]); //beds next to the sukkah - 30 feet long opposed to 50
const SHORT_FACTOR = 0.6;

/* lbs-per-plant defaults (used to estimate servings) */
const BASE_DEFAULTS = {
    "tomato": 12.0, "cherry tomato": 8.0, "paste tomato": 10.0, "tomatillo": 4.0,
    "pepper": 4.4, "bell pepper": 4.4, "hot pepper": 3.0, "eggplant": 5.0, "okra": 3.0,
    "cucumber": 22.0, "zucchini": 8.0, "summer squash": 8.0,
    "squash (acorn)": 12.9, "squash (butternut)": 18.8, "squash (buttercup)": 14.1,
    "spaghetti squash": 10.0, "delicata": 8.0, "pumpkin": 10.0, "gourd": 5.0,
    "melon": 8.0, "watermelon": 12.0, "cantaloupe": 6.0,
    "broccoli": 1.1, "cauliflower": 2.0, "cabbage": 3.0, "napa": 2.5,
    "bok choy": 1.0, "brussels": 2.0, "kohlrabi": 0.7,
    "beet": 0.22, "carrot": 0.2, "radish": 0.12, "turnip": 0.35, "daikon": 1.2,
    "parsnip": 0.5, "rutabaga": 1.5, "potato": 4.0, "sweet potato": 3.0,
    "onion": 0.35, "shallot": 0.2, "garlic": 0.15, "leek": 0.5, "green onion": 0.1,
    "lettuce": 0.6, "romaine": 0.9, "leaf lettuce": 0.4, "spinach": 0.12,
    "kale": 1.5, "chard": 2.0, "collard": 1.5, "mustard": 0.3, "arugula": 0.12, "mizuna": 0.12,
    "pea": 1.0, "snap pea": 1.2, "snow pea": 1.0, "bush bean": 1.5, "green bean": 1.5,
    "pole bean": 2.5, "soybean": 0.3,
    "basil": 0.3, "cilantro": 0.2, "dill": 0.2, "parsley": 0.5, "sage": 0.3,
    "thyme": 0.2, "rosemary": 0.4, "oregano": 0.3, "mint": 0.4, "chive": 0.1,
    "celery": 1.0, "fennel": 1.0, "corn": 0.5, "sunflower": 0.4
};

/* Date and time helper functions */
function toISO(d) { 
    return new Date(d).toISOString().slice(0, 10); 
}

function monthKeyLabel(isoWeekStart) {
    const d = new Date(isoWeekStart + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    return { key, label };
}

function startOfWeek(d) {
    const x = new Date(d);
    const dow = x.getDay();
    const diff = x.getDate() - dow + (dow === 0 ? -6 : 1);
    x.setDate(diff); 
    x.setHours(0, 0, 0, 0);
    return x;
}

function toDateFlexible(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === "string") {
        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
        const d = new Date(v.replace(" ", "T"));
        if (!isNaN(d)) return d;
    }
    return null;
}

function addDaysISO(isoOrDate, days) {
    const d = toDateFlexible(isoOrDate); 
    if (!d) return null;
    d.setDate(d.getDate() + Number(days || 0));
    return toISO(d);
}

function parseDTM(dtm) {
    if (dtm == null) return null;
    if (typeof dtm === "number" && Number.isFinite(dtm)) return dtm;
    const s = String(dtm).toLowerCase();
    const r = s.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (r) { 
        const a = +r[1], b = +r[2]; 
        if (Number.isFinite(a) && Number.isFinite(b)) return Math.round((a + b) / 2); 
    }
    const m = s.match(/(\d+)/); 
    if (m) { 
        const n = +m[1]; 
        return Number.isFinite(n) ? n : null; 
    }
    return null;
}

function buildWeeksOfYear(year) {
    const weeks = {};
    const start = new Date(`${year}-01-01T00:00:00`);
    const end = new Date(`${year}-12-31T23:59:59`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const wk = toISO(startOfWeek(d));
        weeks[wk] = weeks[wk] || [];
    }
    return Object.keys(weeks).sort();
}

/* Crop and garden helper functions */
function abbrev(s, n = 12) { 
    if (!s) return ""; 
    return s.length <= n ? s : (s.slice(0, n - 1) + "…"); 
}

function needsFence(c) {
    const n = (c?.notes || "").toLowerCase();
    const name = (c?.name || "").toLowerCase();
    if (c?.support === true) return true;
    if (/(trellis|fence|climb|vining|vine|stake|panel)/.test(n)) return true;
    if (/(tomato|cucumber|pole bean|beans? \(pole\)|pea|peas)/.test(name)) return true;
    return false;
}

function adjustedPlantsForBed(crop, bedId) {
    const base = Number(crop?.plants_per_bed ?? 0);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return Math.round(base * (SHORT_BEDS.has(bedId) ? SHORT_FACTOR : 1));
}

function keyFor(c) { 
    return (c?.name || "") + "|" + (c?.variety || ""); 
}

function defaultForName(name) {
    if (!name) return 1.0;
    const s = name.toLowerCase();
    for (const key in BASE_DEFAULTS) { 
        if (s.includes(key)) return BASE_DEFAULTS[key]; 
    }
    if (/(squash|melon|gourd)/.test(s)) return 8.0;
    if (/(lettuce|greens|arugula|spinach|mizuna)/.test(s)) return 0.3;
    if (/(bean|pea)/.test(s)) return 1.5;
    if (/(herb|basil|cilantro|dill|parsley|sage|thyme|rosemary|oregano|mint)/.test(s)) return 0.3;
    if (/(onion|garlic|leek|shallot|chive)/.test(s)) return 0.3;
    if (/(carrot|beet|radish|turnip|root|parsnip|rutabaga|daikon)/.test(s)) return 0.3;
    if (/(tomato|pepper|eggplant|okra)/.test(s)) return 4.0;
    return 1.0;
}

function normalizeToYear(iso, year) {
    if (!iso) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(year) + iso.slice(4);
    const d = new Date(iso); 
    if (!isNaN(d)) { 
        d.setFullYear(year); 
        return toISO(d); 
    }
    return null;
}

function getPlantDateFromJSON(crop, season, year) {
    const pw = crop?.planting_windows || {};
    if (season === "fall") {
        const fallDate = pw.fall?.date || null;
        if (!fallDate) return null;
        return fallDate.startsWith(String(year)) ? fallDate : normalizeToYear(fallDate, year);
    } else {
        const springStart = pw.spring?.start || null;
        if (!springStart) return null;
        return springStart.startsWith(String(year)) ? springStart : normalizeToYear(springStart, year);
    }
}

function getSeedStartFromJSON(crop, season, year) {
    const pw = crop?.planting_windows || {};
    if (season === "fall") {
        const fallSeed = pw.fall?.seed_start?.start || null;
        if (!fallSeed) return null;
        return fallSeed.startsWith(String(year)) ? fallSeed : normalizeToYear(fallSeed, year);
    } else {
        const seedStart = pw.seed_start?.start || null;
        if (!seedStart) return null;
        return seedStart.startsWith(String(year)) ? seedStart : normalizeToYear(seedStart, year);
    }
}

/* Analytics helper functions */
function sum(arr, sel) { 
    let t = 0; 
    arr.forEach(x => { 
        const v = sel(x); 
        if (Number.isFinite(v)) t += v; 
    }); 
    return t; 
}

function groupBy(list, keyFn) {
    const m = new Map();
    list.forEach(item => { 
        const k = keyFn(item); 
        if (!m.has(k)) m.set(k, []); 
        m.get(k).push(item); 
    });
    return m;
}
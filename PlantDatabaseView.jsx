// PlantDatabaseView.jsx — compact table with search, season filter, collapsible date editor, and native calendar inputs

function PlantDatabaseView({ crops, setCrops }) {
  const [rows, setRows] = React.useState(() => cloneDeep(crops));
  const [query, setQuery] = React.useState("");
  const [seasonFilter, setSeasonFilter] = React.useState("all");
  const [expanded, setExpanded] = React.useState(() => new Set());

  React.useEffect(() => { setRows(cloneDeep(crops)); setExpanded(new Set()); }, [crops]);

  const filteredIdxs = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const idxs = [];
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i];
      const hay = `${c.name||""} ${c.variety||""} ${c.notes||""}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      if (seasonFilter !== "all") {
        const name = (c.name||"").toLowerCase();
        const isCool = /(lettuce|spinach|arugula|radish|carrot|beet|turnip|pea|kale|chard|collard|mustard|cabbage|broccoli|cauliflower|onion|garlic|leek)/.test(name);
        const isWarm = /(tomato|pepper|eggplant|cucumber|zucchini|squash|melon|watermelon|cantaloupe|corn|bean|okra|basil|pumpkin|sweet potato)/.test(name);
        if (seasonFilter === "cool" && !isCool) continue;
        if (seasonFilter === "warm" && !isWarm) continue;
      }
      idxs.push(i);
    }
    return idxs;
  }, [rows, query, seasonFilter]);

  function updateCell(i, key, value) {
    setRows(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: value } : c));
  }

  function updateWin(i, winKey, field, value) {
    setRows(prev => prev.map((c, idx) => {
      if (idx !== i) return c;
      const wins = c.planting_windows || {};
      const w = { ...wins[winKey], [field]: toOrNull(value) };
      return { ...c, planting_windows: { ...wins, [winKey]: w } };
    }));
  }

  function toggleExpanded(i){
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function saveAll() {
    const normalized = rows.map(n => normalizeCrop(n));
    setCrops(normalized);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Plant Database</h2>
          <p className="text-sm text-gray-500">{filteredIdxs.length} of {rows.length} crops</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <input className="px-2 py-1 border rounded w-56" placeholder="name, variety, notes..." value={query} onChange={e=>setQuery(e.target.value)} />
          <select className="px-2 py-1 border rounded" value={seasonFilter} onChange={e=>setSeasonFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="cool">Cool season</option>
            <option value="warm">Warm season</option>
          </select>
          <button onClick={saveAll} className="px-3 py-1.5 rounded bg-blue-600 text-white">Save All</button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded bg-white">
        <table className="min-w-full text-xs align-top">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b text-left">
              <th className="p-1">#</th>
              <th className="p-1">Name</th>
              <th className="p-1">Variety</th>
              <th className="p-1">Days</th>
              <th className="p-1">Notes</th>
              <th className="p-1">Plants / Bed</th>
              <th className="p-1">Servings / lb</th>
              <th className="p-1">Dates</th>
            </tr>
          </thead>
          <tbody>
            {filteredIdxs.map((i) => {
              const c = rows[i];
              const w = c.planting_windows || {};
              const spring = w.spring || {}; const fall = w.fall || {}; const seed = w.seed_start || {}; const seed2 = w.second_seed_start || {};
              const isOpen = expanded.has(i);
              return (
                <React.Fragment key={i}>
                  <tr className="border-b">
                    <td className="p-1 text-gray-500 align-middle">{i+1}</td>
                    <td className="p-1"><input className="w-full px-1 py-0.5 border rounded" value={c.name||""} onChange={e=>updateCell(i,'name', e.target.value)} /></td>
                    <td className="p-1"><input className="w-full px-1 py-0.5 border rounded" value={c.variety||""} onChange={e=>updateCell(i,'variety', e.target.value)} /></td>
                    <td className="p-1"><input className="w-full px-1 py-0.5 border rounded" value={c.days_to_maturity||""} onChange={e=>updateCell(i,'days_to_maturity', e.target.value)} /></td>
                    <td className="p-1"><textarea className="w-full px-1 py-0.5 border rounded" rows={1} value={c.notes||""} onChange={e=>updateCell(i,'notes', e.target.value)} /></td>
                    <td className="p-1">
                      <Tooltip text="Currently this is factored off 200 sq ft using Square Foot Gardening spacing.">
                        <input type="number" className="w-full px-1 py-0.5 border rounded" value={c.plants_per_bed ?? ''} onChange={e=>updateCell(i,'plants_per_bed', toNumOrNull(e.target.value))} />
                      </Tooltip>
                    </td>
                    <td className="p-1"><input type="number" className="w-full px-1 py-0.5 border rounded" value={c.servings_per_pound ?? ''} onChange={e=>updateCell(i,'servings_per_pound', toNumOrNull(e.target.value))} /></td>
                    <td className="p-1 text-right align-middle">
                      <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50 inline-flex items-center gap-1" onClick={()=>toggleExpanded(i)}>
                        <span>Edit dates</span>
                        <span className={"transition-transform " + (isOpen ? 'rotate-180' : '')}>▾</span>
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b">
                      <td className="p-1 text-right text-gray-400 align-top">&nbsp;</td>
                      <td className="p-1" colSpan={7}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          <DateField label="Spring start" value={spring.start} onChange={v=>updateWin(i,'spring','start',v)} />
                          <DateField label="Spring end" value={spring.end} onChange={v=>updateWin(i,'spring','end',v)} />
                          <DateField label="Seed start" value={seed.start} onChange={v=>updateWin(i,'seed_start','start',v)} />
                          <DateField label="Seed end" value={seed.end} onChange={v=>updateWin(i,'seed_start','end',v)} />
                          <DateField label="2nd seed start" value={seed2.start} onChange={v=>updateWin(i,'second_seed_start','start',v)} />
                          <DateField label="2nd seed end" value={seed2.end} onChange={v=>updateWin(i,'second_seed_start','end',v)} />
                          <DateField label="Fall date" value={fall.date} onChange={v=>updateWin(i,'fall','date',v)} />
                          <DateField label="Harvest start" value={c.harvest_date_start} onChange={v=>updateCell(i,'harvest_date_start', toOrNull(v))} />
                          <DateField label="Harvest end" value={c.harvest_date_end} onChange={v=>updateCell(i,'harvest_date_end', toOrNull(v))} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filteredIdxs.length === 0 && (
              <tr><td className="p-4 text-center text-gray-500" colSpan={8}>No crops match your search/filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tooltip({ text, children }) {
  return (
    <span className="relative group inline-block">
      {children}
      <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black text-white text-[10px] px-2 py-1 rounded max-w-xs whitespace-nowrap">
        {text}
      </span>
    </span>
  );
}

// Native calendar input (type=date) with string conversion helpers
function DateField({ label, value, onChange }) {
  const inputVal = isoToDateInput(value);
  function handle(e){
    const v = e.target.value;
    onChange(v ? dateInputToIso(v) : null);
  }
  return (
    <label className="text-[10px] text-gray-700 flex flex-col">
      <span className="mb-0.5 text-gray-500">{label}</span>
      <input type="date" className="w-full px-1 py-0.5 border rounded" value={inputVal} onChange={handle} />
    </label>
  );
}

function isoToDateInput(s){
  if(!s) return '';
  const m = String(s).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}
function dateInputToIso(s){
  return s ? `${s} 00:00:00` : null;
}

function cloneDeep(x){ return JSON.parse(JSON.stringify(x)); }
function toNumOrNull(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
function toOrNull(v){ if (v == null) return null; const s = String(v).trim(); return s === '' ? null : s; }
function setDeep(o, path, val){ let cur=o; for(let i=0;i<path.length-1;i++){ cur[path[i]] = cur[path[i]]||{}; cur = cur[path[i]]; } cur[path[path.length-1]] = val; }
function getDeep(o, path){ return path.reduce((a,k)=>a?a[k]:undefined,o); }
function normalizeCrop(c){
  const out = cloneDeep(c);
  const dateish = [["planting_windows","spring","start"],["planting_windows","spring","end"],["planting_windows","fall","date"],["planting_windows","seed_start","start"],["planting_windows","seed_start","end"],["planting_windows","second_seed_start","start"],["planting_windows","second_seed_start","end"],["harvest_date_start"],["harvest_date_end"]];
  dateish.forEach(p=>{ const v = getDeep(out,p); setDeep(out,p,toOrNull(v)); });
  out.plants_per_bed = toNumOrNull(out.plants_per_bed);
  out.servings_per_pound = toNumOrNull(out.servings_per_pound);
  return out;
}

// expose globally
window.PlantDatabaseView = PlantDatabaseView;
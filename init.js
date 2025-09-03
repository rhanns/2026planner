// init.js - Initialization and error handling

window.addEventListener('error', (e) => {
    const el = document.getElementById('root');
    if (el && !el.dataset.errShown) {
        el.dataset.errShown = '1';
        el.innerHTML =
            '<div style="padding:12px;background:#fee;color:#900;border:1px solid #f99;border-radius:8px;margin:12px;">' +
            '<div style="font-weight:600;margin-bottom:6px;">Script error</div>' +
            '<div>' + (e.message || 'Unknown error') + '</div>' +
            '</div>';
    }
});

/* ---------- Optional: limit UI to a given data year ---------- */
(function enforceYear() {
    try {
        const YEAR = 2026;

        function hasYear(obj, year) {
            if (!obj || typeof obj !== 'object') return false;
            for (const key in obj) {
                const v = obj[key];
                if (typeof v === 'string') {
                    if (v && v !== 'NaT') {
                        const d = new Date((v.includes(' ') ? v.replace(' ', 'T') : v));
                        if (!Number.isNaN(d.getTime()) && d.getFullYear() === year) return true;
                    }
                } else if (v && typeof v === 'object') {
                    if (hasYear(v, year)) return true;
                }
            }
            return false;
        }

        if (Array.isArray(window.initialData?.crops)) {
            window.initialData.crops = window.initialData.crops.filter(crop => hasYear(crop?.planting_windows, YEAR));
        }
        window.initialData.__yearFilter = YEAR;
        console.log("[GardenPlanner] Applied", YEAR, "crop filter. Remaining crops:", window.initialData.crops?.length);
    } catch (err) {
        console.warn("Year filter injection error:", err);
    }
})();
// PlantDatabaseView.jsx - Placeholder
function PlantDatabaseView({ crops, setCrops }) {
  return (
    <div className="p-4 border rounded bg-white">
      <h2 className="text-xl font-semibold mb-2">Plant Database</h2>
      <p>STUFF GOES HERE</p>
    </div>
  );
}

// expose globally (same pattern as Planner/Analytics)
window.PlantDatabaseView = PlantDatabaseView;
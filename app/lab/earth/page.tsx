import Earth from "../../components/Earth";

// Preview of the Earth model on its own, before it is placed in the site.
export default function EarthLab() {
  return (
    <main style={{ height: "100svh", background: "#05090b" }}>
      <Earth className="earth-lab" />
      <style>{`.earth-lab { position: fixed; inset: 0; }`}</style>
    </main>
  );
}

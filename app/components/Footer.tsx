import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "./wordmark";
import "./Footer.css";

/*
 * The page's footer, after the journey: you scroll up off the open sea onto
 * solid ground. Dark, as the water above it, so nothing jumps. Links are
 * placeholders until the real pages and addresses exist.
 */

const EXPLORE = [
  { href: "/", label: "Home" },
  { href: "#pentara", label: "Pentara" },
  { href: "#people", label: "People" },
  { href: "#projects", label: "Projects" },
];

const CONNECT = [
  { href: "#instagram", label: "Instagram" },
  { href: "#linkedin", label: "LinkedIn" },
  { href: "#contact", label: "Email us" },
];

// The five landscapes, each by its orb's colour.
const LANDS = [
  { name: "NEXIO", tone: "#24566A" },
  { name: "ORIGO", tone: "#8B7968" },
  { name: "SILVA", tone: "#536B50" },
  { name: "CULTURA", tone: "#B49355" },
  { name: "TENAX", tone: "#A65F45" },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <p className="footer-lede">A landscape of ideas, people and possibilities.</p>
        <nav className="footer-col" aria-label="Explore">
          <p className="footer-head">Explore</p>
          <ul>
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="footer-col" aria-label="Connect">
          <p className="footer-head">Connect</p>
          <ul>
            {CONNECT.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="footer-col">
          <p className="footer-head">Pentara</p>
          <ul className="footer-lands">
            {LANDS.map((l) => (
              <li key={l.name} style={{ color: l.tone }}>
                <span>{l.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <svg className="footer-mark" viewBox={WORDMARK_VIEWBOX} role="img" aria-label="The South Project">
        <path d={WORDMARK_PATH} fill="currentColor" />
      </svg>

      <div className="footer-base">
        <p>© 2026 The South Project</p>
        <p className="footer-legal">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
        </p>
        <a className="footer-back" href="#">
          Back to the ocean ↑
        </a>
      </div>
    </footer>
  );
}

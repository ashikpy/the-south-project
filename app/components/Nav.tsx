import Link from "next/link";
import "./Nav.css";

/*
 * Section anchors until the real pages exist.
 */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "#pentara", label: "Pentara" },
  { href: "#people", label: "People" },
  { href: "#projects", label: "Projects" },
];

/**
 * Site navigation: logo, a frosted group of links with a lit active tab,
 * a quiet text link and the main action as a white button with an arrow chip.
 */
export default function Nav({ current = "/" }: { current?: string }) {
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-start">
        <Link href="/" className="nav-logo" aria-label="The South Project, home">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG mark, no optimisation needed */}
          <img src="/hero/tsp-logo.svg" alt="" width={59} height={35} />
        </Link>
      </div>

      <ul className="nav-group">
          {LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="nav-link"
                aria-current={href === current ? "page" : undefined}
              >
                {label}
              </Link>
            </li>
          ))}
      </ul>

      <div className="nav-end">
        <Link href="#contact" className="nav-text">
          Contact
        </Link>
        <Link href="#join" className="nav-cta">
          <span>Join us</span>
          <span className="nav-cta-chip" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </Link>
      </div>
    </nav>
  );
}

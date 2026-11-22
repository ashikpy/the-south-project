/**
 * ORIGO's story, one thought to a screen, set low on the dark left slope.
 * Dive.tsx fades each in and out (see BEATS there). It sits outside the
 * decorative scene, so screen readers and reduced motion get it as plain text.
 */
export default function OrigoStory() {
  return (
    <section className="origo-story" aria-labelledby="origo-story-title">
      <p className="origo-line origo-line-river">Every river has a beginning.</p>
      <p className="origo-line origo-line-rain">
        <span>What the ocean gave to the sky,</span> <span>the mountains bring home.</span>
      </p>
      <div className="origo-meaning">
        <h2 className="origo-meaning-title" id="origo-story-title">
          ORIGO — Origin
        </h2>
        <div className="origo-meaning-lines">
          <p className="origo-line origo-line-person">
            Before an idea becomes a project, it is a person, and the place they come from.
          </p>
          <p className="origo-line origo-line-people">
            The South Project brings those people together.
          </p>
        </div>
      </div>
      <p className="origo-line origo-line-grows">What begins here, grows.</p>
    </section>
  );
}

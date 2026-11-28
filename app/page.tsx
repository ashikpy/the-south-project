import Dive from "./components/Dive";
import Footer from "./components/Footer";
import Hero from "./components/Hero";

export default function Home() {
  return (
    <main>
      <Dive>
        <Hero />
      </Dive>
      <Footer />
    </main>
  );
}

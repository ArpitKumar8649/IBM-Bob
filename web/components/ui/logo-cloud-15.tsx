"use client";

import { useAnimationFrame } from "framer-motion";
import { useRef } from "react";
import {
  Logo01,
  Logo02,
  Logo03,
  Logo04,
  Logo05,
  Logo06,
  Logo07,
  Logo08,
} from "@/components/ui/logo-cloud-15-utils/logos";
import { Marquee } from "@/components/ui/logo-cloud-15-utils/marquee";
import { BorderBeam } from "@/components/ui/logo-cloud-15-utils/border-beam";

/**
 * "Trusted by" logo cloud with a beam that orbits the card border. As the beam
 * passes behind the headline, a rose shimmer sweeps through the text — the two
 * are driven by the same clock so they stay in sync.
 *
 * Adapted to a landing section (not full-screen) and the site's rose palette.
 */

const BEAM_DURATION = 8; // must match BorderBeam duration prop
const BEAM_SIZE = 100; // must match BorderBeam size prop

const LogoCloud = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const waveSpanRef = useRef<HTMLSpanElement>(null);
  const startTimeRef = useRef<number | null>(null);

  useAnimationFrame((time) => {
    if (!(cardRef.current && textRef.current && waveSpanRef.current)) return;

    if (startTimeRef.current === null) {
      startTimeRef.current = time;
    }

    // Beam progress: 0–100 along the perimeter, linear, same clock as BorderBeam
    const elapsed = ((time - startTimeRef.current) / 1000) % BEAM_DURATION;
    const beamOffset = (elapsed / BEAM_DURATION) * 100;

    const cardRect = cardRef.current.getBoundingClientRect();
    const textRect = textRef.current.getBoundingClientRect();

    const W = cardRect.width;
    const H = cardRect.height;
    const perimeter = 2 * (W + H);

    // Text horizontal bounds on the top edge, relative to card left
    const textLeft = Math.max(0, textRect.left - cardRect.left);
    const textRight = Math.min(W, textRect.right - cardRect.left);

    // Convert pixel positions to perimeter percentages
    const textStartPercent = (textLeft / perimeter) * 100;
    const textEndPercent = (textRight / perimeter) * 100;

    const span = waveSpanRef.current;

    if (beamOffset >= textStartPercent && beamOffset <= textEndPercent) {
      // Beam is behind the text — sweep the shimmer left→right.
      const t =
        (beamOffset - textStartPercent) / (textEndPercent - textStartPercent);
      span.style.backgroundPosition = `${95 - t * 90}% center`;
    } else if (beamOffset < textStartPercent) {
      // Beam hasn't reached text yet — wave parked to the right.
      span.style.backgroundPosition = "0% center";
    } else {
      // Beam has passed text — wave parked to the left.
      span.style.backgroundPosition = "100% center";
    }
  });

  return (
    <div className="flex items-center justify-center px-6">
      <div
        className="relative w-full max-w-5xl rounded-2xl border border-rose-400/15 bg-wine-900/60 backdrop-blur-md"
        ref={cardRef}
      >
        <BorderBeam
          className="isolate -z-1"
          duration={BEAM_DURATION}
          size={BEAM_SIZE}
        />

        {/* Headline riding the top border */}
        <div className="absolute inset-x-0 top-0 flex -translate-y-1/2 items-center justify-center px-10">
          <p
            className="bg-wine-950 px-4 text-center font-display font-semibold text-rose-50 text-xl tracking-[-0.01em] sm:px-6"
            ref={textRef}
          >
            <span
              ref={waveSpanRef}
              style={{
                // Rose shimmer band swept by the orbiting beam.
                backgroundImage:
                  "linear-gradient(90deg, currentColor 0%, currentColor 45%, #FDA4AF 47%, #F43F5E 50%, #FDA4AF 53%, currentColor 55%, currentColor 100%)",
                backgroundSize: "250% 100%",
                backgroundRepeat: "no-repeat",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundPosition: "0% center",
              }}
            >
              Trusted by writers&apos; rooms{" "}
              <span className="max-sm:hidden">around the world</span>
            </span>
          </p>
        </div>

        {/* Logo marquee */}
        <div className="grid">
          <div className="flex min-w-0 items-center justify-center gap-x-14 gap-y-10 p-10 pt-14 *:h-14">
            <Marquee
              className="mask-x-from-75% [--duration:24s] [&_svg]:mr-14 text-rose-100/50"
              pauseOnHover
            >
              <Logo01 />
              <Logo02 />
              <Logo03 />
              <Logo04 />
              <Logo05 />
              <Logo06 />
              <Logo07 />
              <Logo08 />
            </Marquee>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoCloud;

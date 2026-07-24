"use client";

import {
  ModernPricingPage,
  type PricingCardProps,
} from "@/components/ui/animated-glassy-pricing";
import Navbar from "@/components/landing/Navbar";

/**
 * Pricing page — themed to the Writers' Room product, built on the shared
 * ModernPricingPage (WebGL shader backdrop + glassy cards).
 */

const plans: PricingCardProps[] = [
  {
    planName: "Solo",
    description: "For the lone writer testing the waters.",
    price: "0",
    features: [
      "1 writer",
      "1 active room",
      "Full debate loop (7 agents)",
      "Community forum",
    ],
    buttonText: "Start writing free",
    buttonVariant: "secondary",
  },
  {
    planName: "Writers' Room",
    description: "Bring your collaborators into the room.",
    price: "49",
    features: [
      "10 collaborators",
      "Unlimited rooms",
      "Real-time shared canvas",
      "Director's Cut exports",
      "Email support",
    ],
    buttonText: "Choose Writers' Room",
    isPopular: true,
    buttonVariant: "primary",
  },
  {
    planName: "Studio",
    description: "Run every client's story under one roof.",
    price: "149",
    features: [
      "Unlimited collaborators",
      "Client workspaces",
      "Priority rendering",
      "Dedicated support",
      "Custom agent personas",
    ],
    buttonText: "Contact us",
    buttonVariant: "primary",
  },
];

export default function PricingPage() {
  return (
    <div className="relative min-h-screen bg-wine-950">
      <Navbar />
      <ModernPricingPage
        title={
          <>
            Find the <span className="text-rose-400">right room</span> for your story
          </>
        }
        subtitle="Start free, then bring the whole room in. Flexible plans for solo writers, teams, and studios."
        plans={plans}
        showAnimatedBackground={true}
      />
    </div>
  );
}

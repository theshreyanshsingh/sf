export type StartingPoint = {
  id: string;
  label: string;
  description: string;
  prompt: string;
};

export const STARTING_POINTS: StartingPoint[] = [
  {
    id: "landing-page",
    label: "Landing Page",
    description: "Hero, features, social proof, pricing, and CTA.",
    prompt:
      "Create a high-converting landing page for a SaaS product with a bold hero, benefits grid, social proof, pricing table, FAQ, and a primary call-to-action. Make it responsive and conversion-focused.",
  },
  {
    id: "microsite",
    label: "Microsite",
    description: "Short multi-section site with 2-3 pages.",
    prompt:
      "Build a sleek microsite with Home, About, and Contact pages. Include a short story, a visual highlight section, and a simple contact form. Make it minimal, fast, and responsive.",
  },
  {
    id: "event-page",
    label: "Event Page",
    description: "Agenda, speakers, venue, and registration.",
    prompt:
      "Design an event page with event overview, agenda timeline, speaker cards, venue details, ticket tiers, and a registration CTA. Make it easy to scan and mobile-friendly.",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    description: "Projects, about, and contact.",
    prompt:
      "Create a modern portfolio website with a striking intro, featured projects grid, case study highlights, about section, and contact form. Use crisp typography and refined spacing.",
  },
  {
    id: "product-launch",
    label: "Product Launch",
    description: "Launch story, feature highlights, and waitlist.",
    prompt:
      "Build a product launch page with a launch story, feature highlights, timeline, pricing teaser, and a waitlist form. Keep it bold, premium, and responsive.",
  },
  {
    id: "blog",
    label: "Blog Starter",
    description: "Blog index, categories, and newsletter signup.",
    prompt:
      "Create a blog starter site with a homepage hero, featured posts, category list, newsletter signup, and an about section. Use clean typography and a readable layout.",
  },
];

export const MOBILE_STARTING_POINTS: StartingPoint[] = [
  {
    id: "mobile-fitness",
    label: "Fitness App",
    description: "Workout plans, progress charts, and streak tracking.",
    prompt:
      "Create a mobile fitness app with onboarding, workout categories, daily plans, progress tracking charts, and a streak system. Use mobile-first layouts with bottom navigation and touch-friendly components.",
  },
  {
    id: "mobile-food-delivery",
    label: "Food Delivery",
    description: "Restaurant list, cart, checkout, and order tracking.",
    prompt:
      "Build a mobile food delivery app with location-based restaurant feed, menu browsing, cart, checkout, and live order tracking. Keep the UI clean, fast, and optimized for one-hand use.",
  },
  {
    id: "mobile-fintech",
    label: "Wallet App",
    description: "Balance, transfers, transaction history, and insights.",
    prompt:
      "Design a mobile wallet app with account summary, send/request money flows, transaction history, and spending insights. Focus on trust-building visuals, clear hierarchy, and secure interaction patterns.",
  },
  {
    id: "mobile-travel",
    label: "Travel App",
    description: "Trip discovery, booking flow, itinerary, and maps.",
    prompt:
      "Create a mobile travel app with destination discovery, booking cards, itinerary timeline, saved trips, and map previews. Use immersive visuals and compact cards for small screens.",
  },
  {
    id: "mobile-ecommerce",
    label: "Shopping App",
    description: "Product feed, product detail, wishlist, and checkout.",
    prompt:
      "Build a mobile shopping app with product feed, smart filters, product detail page, wishlist, and checkout flow. Emphasize conversion, fast browsing, and thumb-friendly interactions.",
  },
  {
    id: "mobile-social",
    label: "Social App",
    description: "Feed, reels, profile, notifications, and messaging.",
    prompt:
      "Develop a mobile social app with home feed, short-video/reels section, profile page, notifications, and direct messaging preview. Prioritize responsive gestures and smooth mobile transitions.",
  },
];

export const ALL_STARTING_POINTS: StartingPoint[] = [
  ...STARTING_POINTS,
  ...MOBILE_STARTING_POINTS,
];

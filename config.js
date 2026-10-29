// =====================================================================
//  Portal settings. One block per builder.
//  To add a builder: copy the "stoneledge" block, change the values,
//  add their web address to "hosts", and create their row in the
//  builders table with the same slug.
// =====================================================================
window.PORTAL = {
  // Filled in once the Supabase project exists (Project Settings > API)
  supabaseUrl: "https://nsftiohfzboovyyzijbu.supabase.co",
  supabaseKey: "sb_publishable_g2jG6-WShPhdRIQ9_ZRi9A_vybxudXj",

  // Which builder each web address shows. Anything not listed uses defaultBuilder.
  // You can also preview any builder with ?builder=slug
  hosts: {
    "portal.stoneledge.life": "stoneledge",
  },
  defaultBuilder: "stoneledge",

  builders: {
    stoneledge: {
      slug: "stoneledge",
      name: "Stoneledge",
      fullName: "Stoneledge Luxury Homes",
      wordmarkSub: "Luxury Homes · Client portal",
      tagline: "Constructing dreams",
      logo: { onLight: "logos/stoneledge-dark.png", onDark: "logos/stoneledge-light.png" }, // dark lettering for light backgrounds, light for dark

      fonts: {
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@300;400;500;600&display=swap",
        display: '"Cormorant Garamond","Cormorant","Garamond","Times New Roman",serif',
        body: '"Jost","Futura","Avenir Next",system-ui,sans-serif',
      },

      // hero = the dark band on the overview; accent = small caps labels, highlights
      colors: {
        light: { bg: "#F1F0EC", surface: "#FAFAF8", surface2: "#E6E4DE", ink: "#1F2123", muted: "#67696B", line: "#D7D4CC",
                 hero: "#2A2D2F", hero2: "#3A3E41", heroInk: "#EFECE5", heroMuted: "#A9ABA9",
                 accent: "#7D6744", accentBright: "#C2AA7E", accentSoft: "#ECE5D6", btn: "#2A2D2F", btnInk: "#F4F1E9" },
        dark:  { bg: "#151718", surface: "#1C1F21", surface2: "#25292B", ink: "#ECE9E2", muted: "#9EA1A2", line: "#31363A",
                 hero: "#0F1112", hero2: "#2A2E31", heroInk: "#ECE9E2", heroMuted: "#9A9D9E",
                 accent: "#C9B184", accentBright: "#D6BF94", accentSoft: "#2C281F", btn: "#C9B184", btnInk: "#151718" },
      },

      // Their words for things
      labels: {
        client: "Client",
        projectLead: "Project manager",
        designCenter: "Design Center",
        designLead: "Meranda Bailey, MB Interiors and Design",
        finalTour: "Pre-close tour",
        closing: "The Closing",
        daysUntil: "Days until your closing",
      },

      // Build phases copied into every new home. days = typical length, used to draft dates.
      phases: [
        { name: "Homesite discovery & design services", days: 60,
          what: "Your homesite chosen with our real estate and construction team, then your home designed with our design, construction, and architecture team, from concept through permit.",
          look: "Nothing on site yet. Your plan set and design documents are in Documents.",
          decisions: "Homesite, final plan sign-off, exterior palette, and the agreement and allowance schedule." },
        { name: "Site preparation", days: 25,
          what: "Clearing, grading, erosion control, utilities, and the house staked from the survey.",
          look: "Tree protection, the staked footprint, and the views from the main rooms.",
          decisions: "A staking walk to confirm the house sits exactly where you want it." },
        { name: "Foundation", days: 30,
          what: "Footings, foundation walls, waterproofing and drainage, and slabs.",
          look: "The footing inspection card on the permit board and plumbing stubbed through the slab.",
          decisions: "Exterior outlet, hose bib, and landscape lighting conduit locations." },
        { name: "Framing", days: 35,
          what: "Floor system, walls, beams, roof framing, and sheathing. Rooms become real.",
          look: "Ceiling heights, window placement, and the scale of each room. Bring a tape measure for furnishings.",
          decisions: "Your post-framing & pre rough-in walk-through: we meet on site to confirm electrical, mechanical, and plumbing requirements before rough-ins begin." },
        { name: "Roof, windows & exterior envelope", days: 20,
          what: "Roofing, flashing and gutters, windows and exterior doors, and the weather barrier.",
          look: "The house is now dried in. The interior stays protected from here on.",
          decisions: "Roofing and window finishes, confirmed during design." },
        { name: "Mechanical, electrical & plumbing rough-ins", days: 30,
          what: "Plumbing, wiring, HVAC, lighting control, audio, security, and network cabling run inside the open walls, ending with the county inspection.",
          look: "Switch and outlet locations, speaker locations, shower valve heights, recessed lighting layout.",
          decisions: "Outlet and TV locations, lighting scenes, speaker zones. Changes after insulation are far more involved." },
        { name: "Insulation & drywall", days: 40,
          what: "Insulation installed and inspected, then drywall hung and finished.",
          look: "Before insulation we photograph every wall, so you always know what's behind it.",
          decisions: "Your pre-insulation walkthrough. After this, what's in the walls is set." },
        { name: "Interior finishes", days: 100,
          what: "Cabinetry, trim, stone, flooring, tile, paint, fixtures, and lighting.",
          look: "Your Design Center selections arriving and being installed. Note anything you'd like adjusted.",
          decisions: "All remaining selections finalized before fabrication is scheduled." },
        { name: "Exterior & landscape", days: 60,
          what: "Hardscape, driveway, final grading, irrigation, and landscaping.",
          look: "Terrace levels, drainage away from the house, landscape lighting at dusk.",
          decisions: "Planting palette, exterior lighting, and outdoor living details." },
        { name: "Pre-close tour & the closing", days: 18,
          what: "Final quality-control inspections and punch lists, then your pre-close tour of systems, finishes, and construction quality. At the closing you receive your photo diary, home information manual, warranty booklet, and keys.",
          look: "Everything. Your punch list is finalized from this tour.",
          decisions: "Your pre-close tour with your project manager, and the closing." },
      ],

      draws: [
        { name: "Agreement & deposit", percent: 10 },
        { name: "Foundation complete", percent: 15 },
        { name: "Framing & dry-in", percent: 20 },
        { name: "Rough-ins complete", percent: 15 },
        { name: "Insulation & drywall", percent: 10 },
        { name: "Interior finishes", percent: 20 },
        { name: "The Closing", percent: 10 },
      ],

      threads: ["Your project team", "Design Center"],
      documentFolders: ["Plans", "Permits & inspections", "Agreements", "Change orders", "Selections", "Invoices", "Warranty & manuals", "Lot & survey"],
      requestKinds: ["Private site visit", "Design Center session"],

      warranty: [["Workmanship & materials", "1 year"], ["Plumbing, electrical & mechanical systems", "2 years"], ["Structure", "10 years"]],
      aftercare: "At the closing you receive your photo diary of the construction, your home information manual, and your warranty booklet. This portal keeps all of it, along with every drawing, finish, and manual, for as long as you own the home.",
      office: { address: "105 Regency Commons Drive, Greer, SC 29651", hours: "By appointment only" },
    },
  },
};

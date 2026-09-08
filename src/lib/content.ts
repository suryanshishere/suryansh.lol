export const profile = {
  name: "Suryansh Singh",
  email: "heresuryanshsingh@gmail.com",
  location: "Noida, India",
  github: "https://github.com/suryanshishere",
  linkedin: "https://www.linkedin.com/in/suryanshishere",
  x: "https://x.com/suryaalgorithm",
};

export const projects = [
  {
    name: "Government Ninja",
    domain: "governmentninja.com",
    href: "https://governmentninja.com",
    image: "/projects/government-ninja.webp",
    color: "leaf",
    label: "An easier way to find your next opportunity.",
    description: "Government jobs, exam updates, and eligibility tools in one searchable place. From the data pipeline to the final click, built from scratch.",
    tags: ["Full-stack", "Data pipelines", "Cloudflare"],
    result: "100K+ impressions in its first two months",
    details: [
      "Built a 20+ step pipeline for aggregation, cleaning, validation, publishing, and scheduled email alerts.",
      "Shipped account and publishing workflows for users, contributors, publishers, and admins.",
      "Optimized for Cloudflare’s free Worker limits; reached 3,000+ clicks and 100+ signed-up users in the first two months, as recorded in my resume.",
    ],
  },
  {
    name: "Outmatch",
    domain: "outmatch.lol",
    href: "https://outmatch.lol",
    image: "/projects/outmatch.webp",
    color: "lilac",
    label: "Visibility is won. Never bought.",
    description: "A product leaderboard decided by people. Head-to-head votes move live Elo scores, while Bradley–Terry ratings shape the board.",
    tags: ["Next.js", "MongoDB", "Ranking systems"],
    result: "Real votes. A living leaderboard.",
    details: [
      "Created product submissions, head-to-head comparisons, and a public leaderboard with category and time filters.",
      "Combined immediate Elo feedback with Bradley–Terry rankings calculated from voting history.",
      "Built server-side protections against duplicate votes and owner votes, with anomaly detection for voting activity.",
    ],
  },
  {
    name: "Pollbuzz",
    domain: "pollbuzz.suryansh.lol",
    href: "https://pollbuzz.suryansh.lol",
    image: "/projects/pollbuzz.webp",
    color: "peach",
    label: "One question. Everyone gets a voice.",
    description: "Create a poll, share it, and watch the answers come in. A focused polling platform with live results and Google sign-in.",
    tags: ["Real-time", "Google auth", "Cloudflare"],
    result: "From a question to a live conversation",
    details: [
      "Built time-bound poll campaigns with question creation, expandable answer options, and shareable voting pages.",
      "Connected Google sign-in and real-time results in a lightweight, playful interface.",
    ],
  },
  {
    name: "Bulkflow",
    domain: "bulkflow.suryansh.lol",
    href: "https://bulkflow.suryansh.lol",
    image: "/projects/bulkflow.webp",
    color: "blue",
    label: "Big spreadsheets. Less waiting around.",
    description: "Large dataset uploads that keep processing in the background. Built to handle the unglamorous, important work without losing a row.",
    tags: ["Data processing", "Background jobs", "Cloudflare"],
    result: "Tested with 85,000+ spreadsheet rows",
    details: [
      "Built large spreadsheet ingestion and processing, tested with an Excel dataset of more than 85,000 rows without data loss.",
      "Added Google sign-in and upload history so people can come back to their processing jobs.",
    ],
  },
];

export const experience = [
  {
    company: "Crowe",
    role: "Data Engineer Intern",
    date: "Feb — Jul 2026",
    description: "Built ELT pipelines, worked on Power BI reporting and client databases, and automated data quality checks. Also explored MCP architecture for the team’s AI tooling.",
  },
  {
    company: "ShelfEx",
    role: "Full Stack Developer",
    date: "Jul 2025 — Jan 2026",
    description: "Led backend development from a blank slate to production. Designed data models and APIs, working directly with PepsiCo to turn requirements and feedback into shipped software.",
  },
  {
    company: "Internshala",
    role: "Full Stack Teaching Assistant",
    date: "Jan — Feb 2025",
    description: "Reviewed student project codebases and ran daily doubt-clearing sessions. Helped developers understand the why behind their code.",
  },
];

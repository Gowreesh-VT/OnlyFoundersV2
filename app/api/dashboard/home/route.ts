import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    countdown: {
      endsAt: "2026-02-15T18:30:00Z",
    },
    milestone: {
      title: "Code Freeze & Commit",
      status: "LIVE",
      deadline: "2026-02-15T19:15:00Z",
    },
    stats: {
      commits: 1248,
      teamsActive: 42,
    },
    valuation: {
      total: 4250000,
      changePercent: 12.5,
    },
  });
}

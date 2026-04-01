import { NextRequest, NextResponse } from "next/server";
import { calculateRunway } from "@/lib/calculations/runway";
 
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cash, ar, ap, burn } = body;
 
    if (cash === undefined || ar === undefined || ap === undefined || burn === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: cash, ar, ap, burn" },
        { status: 400 }
      );
    }
 
    if (typeof cash !== "number" || typeof ar !== "number" || typeof ap !== "number" || typeof burn !== "number") {
      return NextResponse.json(
        { error: "All fields must be numbers: cash, ar, ap, burn" },
        { status: 400 }
      );
    }
 
    const result = calculateRunway({ cash, ar, ap, burn });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
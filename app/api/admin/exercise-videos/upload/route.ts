import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  return NextResponse.json({
    success: false,
    message: "Uploadul video prin corpul cererii a fost dezactivat. Reîncarcă panoul administrativ.",
  }, {
    status: 410,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
    },
  });
}

"use client";

import dynamic from "next/dynamic";
import type { DistrictMapProps } from "@/lib/mapStyles";

const DistrictMap = dynamic(() => import("@/components/DistrictMap"), {
  ssr: false,
  loading: () => (
    <div
      data-testid="district-map-loading"
      className="flex h-80 items-center justify-center rounded-3xl border border-[#dce3dc] bg-white text-sm text-[#6c7b73] sm:h-[28rem]"
    >
      Загружаем карту…
    </div>
  ),
});

export function DistrictMapDynamic(props: DistrictMapProps) {
  return <DistrictMap {...props} />;
}

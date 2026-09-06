"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (
          container: HTMLElement,
          options: { center: unknown; level: number }
        ) => unknown;
        Marker: new (options: { position: unknown; map: unknown }) => unknown;
      };
    };
  }
}

type KakaoMapProps = {
  lat: number;
  lng: number;
  label: string;
};

export function KakaoMap({ lat, lng, label }: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"ready" | "missing-key" | "loaded">(
    "ready"
  );

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

    if (!appKey || !containerRef.current) {
      setStatus("missing-key");
      return;
    }

    const renderMap = () => {
      if (!window.kakao || !containerRef.current) return;
      const center = new window.kakao.maps.LatLng(lat, lng);
      const map = new window.kakao.maps.Map(containerRef.current, {
        center,
        level: 4,
      });
      new window.kakao.maps.Marker({ position: center, map });
      setStatus("loaded");
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-kakao-map]"
    );

    if (existingScript && window.kakao) {
      window.kakao.maps.load(renderMap);
      return;
    }

    const script = document.createElement("script");
    script.dataset.kakaoMap = "true";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.onload = () => window.kakao?.maps.load(renderMap);
    document.head.appendChild(script);
  }, [lat, lng]);

  return (
    <div className="relative min-h-56 overflow-hidden rounded-lg border border-[#d9d0c0] bg-[#f6f1e7]">
      <div ref={containerRef} className="h-56 w-full" aria-label={`${label} 지도`} />
      {status !== "loaded" ? (
        <div className="map-grid absolute inset-0 flex items-center justify-center">
          <div className="flex max-w-xs flex-col items-center gap-3 rounded-lg border border-[#d9d0c0] bg-white/90 px-5 py-4 text-center soft-shadow">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffe24a] text-[#20251f]">
              <MapPin size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#20251f]">{label}</p>
              <p className="mt-1 text-xs leading-5 text-[#677064]">
                {status === "missing-key"
                  ? "카카오맵 키를 넣으면 대략 위치 핀이 표시됩니다."
                  : "카카오맵을 불러오는 중입니다."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

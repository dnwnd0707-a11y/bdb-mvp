"use client";

import {
  AlertTriangle,
  ArrowUp,
  Bell,
  CheckCircle2,
  Crosshair,
  ImageUp,
  Radar,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

type Point = {
  x: number;
  y: number;
  count: number;
};

type MiniMapResult = {
  character: Point | null;
  portal: Point | null;
  distance: number | null;
  readyToEnter: boolean;
};

type MonsterResult = {
  confidence: number;
  orangePixels: number;
  creamPixels: number;
  darkPixels: number;
  detected: boolean;
};

const defaultMiniMap = "/samples/portal-minimap.png";
const defaultDragon = "/samples/dragon-monster.png";

function colorDistance(
  first: { r: number; g: number; b: number },
  second: { r: number; g: number; b: number }
) {
  return Math.sqrt(
    (first.r - second.r) ** 2 + (first.g - second.g) ** 2 + (first.b - second.b) ** 2
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function readPixels(src: string) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas context를 만들 수 없습니다.");
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  return {
    width: canvas.width,
    height: canvas.height,
    pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

function getCentroid(points: Array<{ x: number; y: number }>): Point | null {
  if (points.length === 0) return null;

  const total = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: Math.round(total.x / points.length),
    y: Math.round(total.y / points.length),
    count: points.length,
  };
}

async function analyzeMiniMap(src: string): Promise<MiniMapResult> {
  const { width, height, pixels } = await readPixels(src);
  const redPoints: Array<{ x: number; y: number }> = [];
  const bluePoints: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];

      if (a < 120) continue;

      const isRedMarker = r > 190 && g < 110 && b < 100 && r > g * 1.7;
      const isBlueMarker = b > 160 && g > 80 && r < 100 && b > r * 1.8;

      if (isRedMarker) redPoints.push({ x, y });
      if (isBlueMarker) bluePoints.push({ x, y });
    }
  }

  const character = getCentroid(redPoints);
  const portal = getCentroid(bluePoints);
  const distance =
    character && portal
      ? Math.round(Math.hypot(character.x - portal.x, character.y - portal.y))
      : null;

  return {
    character,
    portal,
    distance,
    readyToEnter: distance !== null && distance <= Math.max(18, width * 0.065),
  };
}

async function analyzeMonster(src: string): Promise<MonsterResult> {
  const { width, height, pixels } = await readPixels(src);
  let orangePixels = 0;
  let creamPixels = 0;
  let darkPixels = 0;
  let occupiedPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];

      if (a < 80) continue;

      const isNearWhite = r > 245 && g > 245 && b > 245;
      if (!isNearWhite) occupiedPixels += 1;

      const isDragonOrange = r > 135 && r < 240 && g > 45 && g < 150 && b < 95;
      const isBellyCream = r > 200 && g > 170 && b > 115 && colorDistance({ r, g, b }, { r: 232, g: 214, b: 173 }) < 82;
      const isOutlineDark = r > 55 && r < 120 && g > 25 && g < 80 && b < 65;

      if (isDragonOrange) orangePixels += 1;
      if (isBellyCream) creamPixels += 1;
      if (isOutlineDark) darkPixels += 1;
    }
  }

  const totalPixels = width * height;
  const occupiedRatio = occupiedPixels / totalPixels;
  const orangeRatio = orangePixels / totalPixels;
  const creamRatio = creamPixels / totalPixels;
  const darkRatio = darkPixels / totalPixels;
  const confidence = Math.min(
    100,
    Math.round((orangeRatio * 900 + creamRatio * 450 + darkRatio * 320 + occupiedRatio * 55) * 100)
  );

  return {
    confidence,
    orangePixels,
    creamPixels,
    darkPixels,
    detected: confidence >= 58 && orangePixels > 650 && creamPixels > 250,
  };
}

function StatusPill({
  tone,
  children,
}: {
  tone: "idle" | "ok" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const classes = {
    idle: "border-slate-300 bg-white text-slate-700",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-800",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    danger: "border-red-300 bg-red-50 text-red-800",
  };

  return (
    <span className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-bold ${classes[tone]}`}>
      {children}
    </span>
  );
}

function ImagePicker({
  title,
  src,
  onChange,
}: {
  title: string;
  src: string;
  onChange: (src: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <label className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-bold text-white">
          <ImageUp size={17} aria-hidden="true" />
          이미지 선택
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onChange(URL.createObjectURL(file));
            }}
          />
        </label>
      </div>
      <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title} className="max-h-[26rem] w-full object-contain" />
      </div>
    </div>
  );
}

export function PortalMonitor() {
  const [miniMapSrc, setMiniMapSrc] = useState(defaultMiniMap);
  const [monsterSrc, setMonsterSrc] = useState(defaultDragon);
  const [miniMapResult, setMiniMapResult] = useState<MiniMapResult | null>(null);
  const [monsterResult, setMonsterResult] = useState<MonsterResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [portalEntered, setPortalEntered] = useState(false);
  const [error, setError] = useState("");

  const headline = useMemo(() => {
    if (monsterResult?.detected) return "용 몬스터 감지됨";
    if (portalEntered) return "포탈 입장 후 화면 확인 필요";
    if (miniMapResult?.readyToEnter) return "포탈 위치 도착";
    return "포탈 이동 모니터";
  }, [miniMapResult?.readyToEnter, monsterResult?.detected, portalEntered]);

  async function runMiniMapScan() {
    setError("");
    setIsAnalyzing(true);
    setPortalEntered(false);
    setMonsterResult(null);

    try {
      setMiniMapResult(await analyzeMiniMap(miniMapSrc));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "미니맵 분석에 실패했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function runMonsterScan() {
    setError("");
    setIsAnalyzing(true);

    try {
      setMonsterResult(await analyzeMonster(monsterSrc));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "몬스터 분석에 실패했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function enterPortal() {
    setPortalEntered(true);
    setMonsterResult(null);
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-bold text-blue-700">Maple portal monitor</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">{headline}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              빨간 표시를 캐릭터, 파란 표시를 포탈로 인식합니다. 캐릭터가 포탈에 붙으면 위 방향키 입력 상태로 전환하고,
              입장 후 화면에서 용 몬스터 색상 패턴이 보이면 알림을 띄웁니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <StatusPill tone={miniMapResult?.readyToEnter ? "ok" : "idle"}>
              <Crosshair size={16} aria-hidden="true" />
              {miniMapResult?.readyToEnter ? "포탈 앞" : "위치 대기"}
            </StatusPill>
            <StatusPill tone={portalEntered ? "ok" : "idle"}>
              <ArrowUp size={16} aria-hidden="true" />
              {portalEntered ? "입장 처리" : "위 키 대기"}
            </StatusPill>
            <StatusPill tone={monsterResult?.detected ? "danger" : monsterResult ? "ok" : "idle"}>
              <Bell size={16} aria-hidden="true" />
              {monsterResult?.detected ? "몬스터 있음" : monsterResult ? "미감지" : "확인 전"}
            </StatusPill>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <ImagePicker title="1. 미니맵 캡처" src={miniMapSrc} onChange={setMiniMapSrc} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={runMiniMapScan}
                disabled={isAnalyzing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 font-bold text-white disabled:bg-slate-400"
              >
                <Radar size={18} aria-hidden="true" />
                위치 분석
              </button>
              <button
                onClick={enterPortal}
                disabled={!miniMapResult?.readyToEnter}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-950 disabled:text-slate-400"
              >
                <ArrowUp size={18} aria-hidden="true" />
                위 방향키 입력
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>캐릭터 중심: {miniMapResult?.character ? `${miniMapResult.character.x}, ${miniMapResult.character.y}` : "미확인"}</p>
              <p>포탈 중심: {miniMapResult?.portal ? `${miniMapResult.portal.x}, ${miniMapResult.portal.y}` : "미확인"}</p>
              <p>거리: {miniMapResult?.distance ?? "미확인"} px</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <ImagePicker title="2. 포탈 입장 후 화면" src={monsterSrc} onChange={setMonsterSrc} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={runMonsterScan}
                disabled={isAnalyzing || !portalEntered}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 font-bold text-white disabled:bg-slate-400"
              >
                <ShieldAlert size={18} aria-hidden="true" />
                몬스터 확인
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>감지 신뢰도: {monsterResult ? `${monsterResult.confidence}%` : "미확인"}</p>
              <p>주황/갈색 픽셀: {monsterResult?.orangePixels.toLocaleString("ko-KR") ?? "미확인"}</p>
              <p>배/뿔 계열 픽셀: {monsterResult?.creamPixels.toLocaleString("ko-KR") ?? "미확인"}</p>
            </div>
          </div>
        </section>

        <section
          className={`rounded-lg border p-5 ${
            monsterResult?.detected
              ? "border-red-300 bg-red-50"
              : miniMapResult?.readyToEnter
                ? "border-emerald-300 bg-emerald-50"
                : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start gap-3">
            {monsterResult?.detected ? (
              <AlertTriangle className="mt-1 text-red-700" size={24} aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-1 text-emerald-700" size={24} aria-hidden="true" />
            )}
            <div>
              <h2 className="text-lg font-black">
                {monsterResult?.detected
                  ? "알림: 두 번째 화면에 용같이 생긴 몬스터가 있습니다."
                  : miniMapResult?.readyToEnter
                    ? "캐릭터가 포탈 근처입니다. 위 방향키 입력으로 입장할 수 있습니다."
                    : "미니맵을 먼저 분석해 주세요."}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                실제 게임 조작 대신 캡처 이미지 기반으로 판단합니다. 실시간 캡처 연동이 필요하면 같은 분석 함수에 화면 캡처 프레임만 연결하면 됩니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

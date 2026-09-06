# BDB

BDB는 수요자가 원하는 전월세 주거 조건을 요청서로 올리면 승인된 공인중개사가 여러 매물을 묶어 제안하고, 중개사는 자기 사무소 매물 피드도 무료로 운영할 수 있는 웹앱 MVP입니다.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Storage
- Kakao OAuth login
- Kakao Maps Web API

## Local Setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

`.env.local`에 아래 값을 넣으면 실제 외부 연동이 활성화됩니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
```

Supabase 프로젝트에는 `supabase/schema.sql`을 적용하세요. 카카오 로그인을 사용하려면 Kakao Developers의 Redirect URI에 로컬과 배포 주소의 `/auth/kakao/callback`을 등록해야 합니다.

로컬 예시:

```text
http://localhost:3000/auth/kakao/callback
http://localhost:3001/auth/kakao/callback
```

Vercel 배포 예시:

```text
https://bdb-mvp.vercel.app/auth/kakao/callback
```

## Vercel Deployment

이 프로젝트는 React/Vite나 별도 Node 서버가 아니라 Next.js App Router 프로젝트입니다. Vercel에서는 Framework Preset을 `Next.js`로 선택하면 됩니다.

권장 설정:

```text
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: 비워둠
Root Directory: 저장소 루트
```

`vercel.json`은 현재 필요하지 않습니다. Next.js 프리셋이 App Router, Route Handler, 정적 파일, 쿼리스트링 URL을 자동으로 처리합니다.

Vercel 환경변수에는 아래 값을 등록합니다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_KAKAO_MAP_APP_KEY
KAKAO_REST_API_KEY
KAKAO_CLIENT_SECRET
```

`KAKAO_CLIENT_SECRET`을 사용하지 않는 경우 비워둘 수 있습니다. `.env.local`, `.env`, `.vercel`, `node_modules`, `.next`는 Git에 올리지 않습니다.

배포 후 확인할 주소:

```text
https://bdb-mvp.vercel.app/?preview=1
https://bdb-mvp.vercel.app/?preview=1&role=buyer
https://bdb-mvp.vercel.app/?preview=1&role=agent
```

## MVP Coverage

- 수요자: 상세 요청서 작성, 제안 비교, 제안별 채팅, 신고
- 중개사: 대표 공인중개사/소속 공인중개사 온보딩, 매칭 요청서 확인, 여러 매물 묶음 제안, 무료 매물 피드 등록
- 소속 승인: 대표가 등록되어 있으면 소속 공인중개사는 대표 승인 후 제안/채팅/방문 안내 가능
- 중개보수 제안: 같은 매물이라도 중개사가 법정 최대보수 이하의 금액을 제안해 차별화 가능
- 중개보수 계산: 요율표 테이블/버전 ID를 기준으로 거래금액, 법정 최대보수, 제안 가능 범위를 자동 계산
- 관리자: 중개사 승인, 신고 확인, 콘텐츠 숨김 처리
- 수익 모델: 임차인의 조건 등록, 제안 비교, 방문 예약은 무료이며 계약 성사 시 선택한 공인중개사에게 사전에 제안받은 중개보수를 지급
- 피드 수익 모델: 공인중개사는 매물 등록과 고객 제안까지 무료로 이용하고, BDB를 통한 계약 성사 시 성과형 플랫폼 이용료가 발생
- 보안 모델: Supabase RLS 기반 역할별 접근 제어

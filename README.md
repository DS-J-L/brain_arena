# Brain Arena

친구와 회원가입 없이 방 코드로 즐기는 1대1 두뇌게임입니다. 현재 **흑과 백**, **배틀 오름차순**, **시크릿 다이스**, **인디언 포커**, **숫자를 찾아라** 다섯 게임을 플레이할 수 있습니다.

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev
```

- 클라이언트: http://localhost:5173
- 서버 상태: http://localhost:3000/health

서로 다른 브라우저(또는 시크릿 창)에서 한 명이 방을 만들고 다른 한 명이 6자리 코드로 참가하면 됩니다.

## 검증

```bash
npm test
npm run build
```

## 저장소 구조

```text
apps/
├─ web/       # React + Vite 클라이언트
└─ server/    # Express + Socket.IO 서버
packages/
└─ shared/    # 앱 사이에서 공유하는 타입과 이벤트
docs/
├─ rules/     # 게임 및 봇 규칙
└─ audits/    # 저장소 점검 기록
```

상세 문서는 [`docs/README.md`](./docs/README.md)에서 확인할 수 있습니다.

## 배포 환경변수

- Render 서버: `CLIENT_URL=https://your-app.vercel.app`
- Vercel 클라이언트: `VITE_SERVER_URL=https://your-server.onrender.com`

Render의 시작 명령은 `npm install && npm run start -w brain-arena-server`, Vercel의 Root Directory는 `apps/web`으로 설정합니다.

## 보안 구조

방과 전체 게임 상태는 서버 메모리에만 저장됩니다. 서버는 각 플레이어에게 `getPlayerView()`로 만든 개별 뷰를 전송하므로, 상대방이 낸 실제 숫자는 게임 종료 전 클라이언트에 전달되지 않습니다. 타일 소유권, 중복 사용, 플레이어/소켓 일치, 승패 계산도 모두 서버에서 검증합니다.

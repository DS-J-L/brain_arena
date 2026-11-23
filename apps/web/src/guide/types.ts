import type { ReactNode } from "react";

/** 그림 + 그림을 글로 옮긴 설명(스크린리더용). */
export interface GuideFigureSpec { figure: ReactNode; label: string }

export interface GuideOverview extends GuideFigureSpec {
  goal: string;
  win: string;
  essentials: [string, string, string];
}

export interface GuideStep extends GuideFigureSpec { title: string; body: string }

export interface RuleSection {
  title: string;
  items: string[];
  example?: { title: string; body: string } & Partial<GuideFigureSpec>;
}

/** 탭에 내용이 없으면 그 탭은 감춘다. 전체 규칙은 모든 게임에 반드시 있다. */
export interface GameGuide {
  overview?: GuideOverview;
  steps?: GuideStep[];
  rules: RuleSection[];
}

export type GuideTab = "overview" | "steps" | "rules";

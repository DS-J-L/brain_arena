import type { GameType } from "@brain-arena/shared";
import type { GameGuide } from "./types";
import { ascendingGuide } from "./games/ascending";
import { atlasGuide } from "./games/atlas";
import { blackAndWhiteGuide } from "./games/blackAndWhite";
import { findTheNumberGuide } from "./games/findTheNumber";
import { gyeolHap1Guide, gyeolHap2Guide } from "./games/gyeolHap";
import { indianPokerGuide } from "./games/indianPoker";
import { memoryHoldemGuide } from "./games/memoryHoldem";
import { secretDiceGuide } from "./games/secretDice";

/** 새 게임을 추가하면 여기서 타입 에러가 나므로 설명서를 빼먹을 수 없다. */
export const GUIDES: Record<GameType, GameGuide> = {
  ATLAS: atlasGuide,
  GYEOL_HAP_1: gyeolHap1Guide,
  GYEOL_HAP: gyeolHap2Guide,
  BLACK_AND_WHITE: blackAndWhiteGuide,
  ASCENDING: ascendingGuide,
  SECRET_DICE: secretDiceGuide,
  INDIAN_POKER: indianPokerGuide,
  MEMORY_HOLDEM: memoryHoldemGuide,
  FIND_THE_NUMBER: findTheNumberGuide,
};

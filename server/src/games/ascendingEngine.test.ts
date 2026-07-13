import {describe,expect,it} from "vitest";
import {ascendingEngine,scoreAscending} from "./ascendingEngine.js";

describe("ascendingEngine",()=>{
  it("한 턴에 공개되는 두 카드는 중복되지 않는다",()=>{
    for(let i=0;i<100;i++){
      const state=ascendingEngine.createInitialState(["a","b"]);
      expect(state.offeredCards[0]).not.toBe(state.offeredCards[1]);
    }
  });
  it("같은 숫자를 포함해 비내림차순을 계산한다",()=>{
    expect(scoreAscending([1,2,2,5,7,3,3,6,9,4])).toEqual({longest:5,longestCount:1,longestSum:17,ascendingPairs:7});
  });
  it("선택자가 한 카드를 고르면 나머지를 상대에게 지급한다",()=>{
    let state=ascendingEngine.createInitialState(["a","b"]);state.chooserId="a";state.offeredCards=[3,8];
    state=ascendingEngine.applyAction(state,"a",{type:"CHOOSE_CARD",cardIndex:1});
    expect(state.assignedCards).toEqual({a:8,b:3});expect(state.phase).toBe("PLACE");
    expect(ascendingEngine.validateAction(state,"b",{type:"CHOOSE_CARD",cardIndex:0})).toBe(false);
  });
  it("양쪽 위치를 모두 고를 때까지 배치를 공개하지 않는다",()=>{
    let state=ascendingEngine.createInitialState(["a","b"]);state.chooserId="a";
    state=ascendingEngine.applyAction(state,"a",{type:"CHOOSE_CARD",cardIndex:0});
    state=ascendingEngine.applyAction(state,"a",{type:"PLACE_CARD",position:2});
    expect(state.boards.a[2]).toBeNull();expect(ascendingEngine.getPlayerView(state,"b").opponentHasPlaced).toBe(true);
    state=ascendingEngine.applyAction(state,"b",{type:"PLACE_CARD",position:4});
    expect(state.boards.a[2]).not.toBeNull();expect(state.round).toBe(2);expect(state.chooserId).toBe("b");
    const playingView=ascendingEngine.getPlayerView(state,"b");
    expect(playingView.opponentBoard.every(value=>value===null)).toBe(true);
    expect(playingView.history[0].opponentPosition).toBeUndefined();
    state.results={a:{longest:1,longestCount:1,longestSum:1,ascendingPairs:0},b:{longest:1,longestCount:1,longestSum:1,ascendingPairs:0}};
    state.winnerId="DRAW";state.isDraw=true;
    const finishedView=ascendingEngine.getPlayerView(state,"b");
    expect(finishedView.opponentBoard[2]).toBe(state.boards.a[2]);
    expect(finishedView.history[0].opponentPosition).toBe(2);
  });
});

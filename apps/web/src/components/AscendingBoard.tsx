interface Props {
  title: string;
  board: Array<number | null>;
  interactive?: boolean;
  onPick?: (index: number) => void;
  hidden?: boolean;
  highlightIndices?: number[];
}

/** 배틀 오름차순의 10칸 보드. 빈칸은 +, 숨긴 보드는 ?로 보여준다. */
export function AscendingBoard({ title, board, interactive = false, onPick, hidden = false, highlightIndices = [] }: Props) {
  return <div className={`board-wrap ${hidden ? "hidden-board" : ""}`}>
    <p className="eyebrow">{title}</p>
    <div className="number-board">{board.map((value, i) => <button key={i} className={highlightIndices.includes(i) ? "ascending-highlight" : ""} disabled={!interactive || value !== null} onClick={() => onPick?.(i)}>
      <small>{i + 1}</small><strong>{hidden ? "?" : value ?? "+"}</strong>
    </button>)}</div>
  </div>;
}

/** 가장 긴 오름차순 구간(오른쪽이 크거나 같으면 연결)의 칸 번호. 길이가 같으면 합이 큰 쪽. */
export function longestAscendingRun(board:Array<number|null>){let bestStart=0,bestLength=0,bestSum=-1,start=0,length=0,sum=0;const commit=()=>{if(length>bestLength||(length===bestLength&&sum>bestSum)){bestStart=start;bestLength=length;bestSum=sum;}};for(let i=0;i<board.length;i++){const value=board[i];if(value===null){commit();start=i+1;length=0;sum=0;continue}if(length===0){start=i;length=1;sum=value}else if(board[i-1]!==null&&board[i-1]!<=value){length++;sum+=value}else{commit();start=i;length=1;sum=value}}commit();return Array.from({length:bestLength},(_,i)=>bestStart+i)}

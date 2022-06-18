import { EMPTY_ADDRESS } from '@darkforest_eth/constants';
import { address } from '@darkforest_eth/serde';
import {
  ArenaLeaderboard,
  ArenaLeaderboardEntry,
  Leaderboard,
  LeaderboardEntry,
} from '@darkforest_eth/types';
import {
  roundEndTimestamp,
  roundStartTimestamp,
  competitiveConfig,
} from '../../Frontend/Utils/constants';
import { getAllTwitters } from './UtilityServerAPI';

const API_URL_GRAPH = 'https://5a04-2601-601-d00-5e30-ed4a-347f-6eae-7dde.ngrok.io/subgraphs/name/df';

export async function loadCompetitiveLeaderboard(
  config: string = competitiveConfig,
  isCompetitive: boolean
): Promise<Leaderboard> {
  const QUERY = `
query {
  arenas(first:1000, where: {configHash: "${config}"}) {
    id
    startTime
    winners(first :1) {
      address
   }
    gameOver
    endTime
    duration
  }
}
`;

  const data = await fetchGQL(QUERY, isCompetitive);
  return data;
}

interface winners {
  address: string;
}
interface graphArena {
  winners: winners[];
  creator: string;
  duration: number | null;
  endTime: number | null;
  gameOver: boolean;
  id: string;
  startTime: number;
}

async function fetchGQL(query: any, isCompetitive: boolean) {
  const response = await fetch(API_URL_GRAPH, {
    method: 'POST',
    body: JSON.stringify({ query }),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  const rep = await response.json();

  if (rep.error) {
    throw new Error(rep.error);
  }

  const ret = await convertData(rep.data.arenas, isCompetitive);

  return ret;
}

async function convertData(arenas: graphArena[], isCompetitive: boolean): Promise<Leaderboard> {
  let entries: LeaderboardEntry[] = [];
  const twitters = await getAllTwitters();

  const roundStart = new Date(roundStartTimestamp).getTime() / 1000;

  const roundEnd = new Date(roundEndTimestamp).getTime() / 1000;
  for (const arena of arenas) {
    if (
      !arena.gameOver ||
      !arena.endTime ||
      !arena.duration ||
      arena.startTime == 0 ||
      arena.winners.length == 0 ||
      !arena.winners[0].address || 
      isCompetitive && (roundEnd <= arena.endTime || roundStart >= arena.startTime)
    )
      continue;

    const winnerAddress = address(arena.winners[0].address);
    const entry = entries.find((p) => winnerAddress == p.ethAddress);

    if (!entry) {
      entries.push({
        ethAddress: winnerAddress,
        score: arena.duration,
        twitter: twitters[winnerAddress],
      });
    } else if (entry.score && entry.score > arena.duration) {
      entry.score = arena.duration;
    }
  }

  return { entries, length: arenas.length };
}

import { apiGet } from '@/features/football/client';
import {
  playerProfileSchema,
  teamResultSchema,
  transferRecordSchema,
  type ApiResult,
  type PlayerProfile,
  type TeamResult,
  type TransferRecord,
} from '@/features/football/types';

/** Endpoint wrappers with their cache TTLs. Names/ids barely change: 7 days. */

const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TRANSFERS_TTL_MS = 24 * 60 * 60 * 1000;

export function searchPlayers(query: string): Promise<ApiResult<PlayerProfile[]>> {
  return apiGet('/players/profiles', { search: query.trim() }, playerProfileSchema, SEARCH_TTL_MS);
}

export function searchTeams(query: string): Promise<ApiResult<TeamResult[]>> {
  return apiGet('/teams', { search: query.trim() }, teamResultSchema, SEARCH_TTL_MS);
}

export function getPlayerTransfers(playerApiId: number): Promise<ApiResult<TransferRecord[]>> {
  return apiGet('/transfers', { player: String(playerApiId) }, transferRecordSchema, TRANSFERS_TTL_MS);
}

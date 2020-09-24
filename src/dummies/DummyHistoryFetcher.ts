import { History } from "../webapi/HistoryInterfaces";
import { IHistoryFecher } from "../webapi/HistoryRepository";

class DummyHistoryFecher implements IHistoryFecher {
  fetchHistory(limit: number, before: number | null, after: number | null, matchId: number): Promise<History> {
    throw new Error("Method not implemented.");
  }
  
}
import axios from 'axios';
import { promises as fs } from 'fs';
import { HistoryFecher } from '../webapi/HistoryFetcher';
import { HistoryRepository } from '../webapi/HistoryRepository';

export async function trial() {
  await GetHistryTrial();
}

async function GetHistryTrial() {

  // 67261609
  // 67268731
  const matchId = 67360792;
  // https://osu.ppy.sh/community/matches/${matchId}/history?before=1509690736&limit=100
  const url = `https://osu.ppy.sh/community/matches/${matchId}/`;
  const params = {
    'limit': 20,
    'after': 0
  }

  const response = await axios.get(url, { params })
    .catch(err => {
      return err.response;
    });
  console.log(JSON.stringify(response.data));


  fs.writeFile("data/arc/history_67360792_first.json", JSON.stringify(response.data));
}

async function GetOrderTrial() {
  const matchId = 67510335;
  const repo = new HistoryRepository(matchId);
  const res = await repo.calcCurrentOrderAsName()
  console.log(res);
}

async function GetLobbyNameChanger() {
  let hr = new HistoryRepository(67719013, new HistoryFecher());
  let ln = "";
  hr.changedLobbyName.on(e => {
    console.log(e.oldName + "->" + e.newName + " " + e.index);
    ln = e.newName;
  });
  while(!ln.startsWith("4-5*")) {
    await hr.fetch(true);
  }
}
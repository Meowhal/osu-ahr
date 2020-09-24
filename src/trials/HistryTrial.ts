import axios from 'axios';
import { promises as fs } from 'fs';

export async function HistryTrial() {
  await GetHistryTrial();
}

async function GetHistryTrial() {

  // 67261609
  // 67268731
  const matchId = 67360792;
  // https://osu.ppy.sh/community/matches/${matchId}/history?before=1509690736&limit=100
  const url = `https://osu.ppy.sh/community/matches/${matchId}/history`;
  const params = {
    'limit': 20,
  }

  const response = await axios.get(url, { params })
  .catch(err =>{
    return err.response;});
  console.log( JSON.stringify(response.data));

  
  fs.writeFile("data/arc/history_67360792.json", JSON.stringify(response.data));
}

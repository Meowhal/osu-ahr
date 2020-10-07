import axios from 'axios';
import cheerio from "cheerio";
import { fetchBeatmapsets } from '../webapi/Beatmapsets';
import { promises as fs } from 'fs';
export async function trial() {
  let res = await fetchBeatmapsets(1522330);

  fs.writeFile("data/arc/beatmapset_search_1522330.json", JSON.stringify(res));


}

async function fetchFromBeatmapPage(id: number) {
  const target = "https://osu.ppy.sh/b/" + id;
  const res = await axios.get(target);
  const $ = cheerio.load(res.data);
  const src = $('#json-beatmapset')[0].children[0].data;
  if (src) {
    const json = JSON.parse(src);
    console.log(json);
  }
}
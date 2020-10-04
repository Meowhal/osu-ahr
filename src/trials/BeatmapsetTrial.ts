import axios from 'axios';
import config from "config";

import cheerio from "cheerio";

export async function trial() {
  const target = "https://osu.ppy.sh/b/1522330";
  const res = await axios.get(target);
  const $ = cheerio.load(res.data);
  const src = $('#json-beatmapset')[0].children[0].data;
  if (src) {
    const json = JSON.parse(src);
    console.log(json);
  }
}